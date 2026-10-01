import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { 
  RotateCcw, 
  ZoomIn, 
  ZoomOut,
  Play, 
  Pause,
  Move
} from 'lucide-react';
import { 
  FabricInfo, 
  TshirtColor, 
  GraphicSettings, 
  PrintTechniqueInfo, 
  GarmentSize, 
  PlacementSide, 
  StudioBgColor,
  MAX_GRAPHICS
} from '../types/sablon';
import { PlacementPanel } from './PlacementPanel';
import {
  PrintLayerUniforms,
  PrintTextureEntry,
  buildPrintTexture,
  prepareShirtModel,
  shirtBaseHex,
  shirtRoughness,
  syncLayerUniforms
} from '../utils/shirt3d';

interface ThreeDStudioProps {
  fabric: FabricInfo;
  color: TshirtColor;
  graphics: GraphicSettings[];
  activeGraphic: GraphicSettings | null;
  technique: PrintTechniqueInfo;
  currentSide: PlacementSide;
  garmentSize: GarmentSize;
  studioBgColor: StudioBgColor;
  onSideChange: (side: PlacementSide) => void;
  onGraphicChange: (updated: Partial<GraphicSettings>) => void;
  onStudioBgChange: (bg: StudioBgColor) => void;
  onCanvasRendered?: (canvas: HTMLCanvasElement) => void;
  onOpenInspect: () => void;
  onSwitchTo2D?: () => void;
}


export const ThreeDStudio: React.FC<ThreeDStudioProps> = ({
  fabric,
  color,
  graphics,
  activeGraphic,
  technique,
  currentSide,
  garmentSize,
  studioBgColor,
  onSideChange,
  onGraphicChange,
  onStudioBgChange,
  onCanvasRendered,
  onOpenInspect,
  onSwitchTo2D
}) => {
  // The layer being edited by sliders / drag (may be null when there are no layers)
  const graphic = activeGraphic;
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const tshirtRootGroup = useRef<THREE.Group | null>(null);
  const tshirtMeshRef = useRef<THREE.Mesh | null>(null);
  const printUniformsRef = useRef<PrintLayerUniforms[] | null>(null);
  // Per-layer artwork textures (rebuilt only when image / ink filter / opacity change)
  const texCacheRef = useRef(
    new Map<string, PrintTextureEntry & { src: string; filter: string; opacity: number }>()
  );
  const pendingTexRef = useRef(new Set<string>());
  const graphicsRef = useRef<GraphicSettings[]>(graphics);
  graphicsRef.current = graphics;

  // Lights
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const rimLightRef = useRef<THREE.DirectionalLight | null>(null);

  // 3D Viewport Zoom & Rotation States
  const [cameraDistance, setCameraDistance] = useState(1.35); // 0.75 to 2.2
  const targetRotationY = useRef(0);
  const targetRotationX = useRef(0);
  const currentRotationY = useRef(0);
  const currentRotationX = useRef(0);
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  // Ref mirror so the render loop (created once) always reads the latest value
  const isAutoRotatingRef = useRef(false);
  useEffect(() => {
    isAutoRotatingRef.current = isAutoRotating;
  }, [isAutoRotating]);

  // Interactive Mode: 'rotate' (spin 360) vs 'graphic' (drag graphic)
  const [interactMode, setInteractMode] = useState<'rotate' | 'graphic'>('rotate');
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  // Drag tracking
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Map placement side to target viewing angle
  const getAngleForSide = (side: PlacementSide): number => {
    switch (side) {
      case 'front': return 0;
      case 'sleeve_left': return -Math.PI / 2;
      case 'back': return Math.PI;
      case 'sleeve_right': return Math.PI / 2;
    }
  };

  // Closest equivalent of the side's angle to the current rotation (no multi-turn spin-back)
  const nearestAngleForSide = (side: PlacementSide): number => {
    const base = getAngleForSide(side);
    const turns = Math.round((currentRotationY.current - base) / (Math.PI * 2));
    return base + turns * Math.PI * 2;
  };

  // Sync rotation with currentSide prop
  useEffect(() => {
    targetRotationY.current = nearestAngleForSide(currentSide);
    targetRotationX.current = 0;
  }, [currentSide]);

  // 1. Initialize Three.js Scene & Load Real 3D T-Shirt GLB
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    let disposed = false;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true, 
      preserveDrawingBuffer: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;

    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(studioBgColor === 'white' ? 0xffffff : 0x09090b);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);
    camera.position.set(0, 0, cameraDistance);
    cameraRef.current = camera;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, studioBgColor === 'white' ? 0.95 : 0.55);
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.4);
    keyLight.position.set(2, 3, 3);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xedf2ff, 0.85);
    fillLight.position.set(-2, 1.5, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, studioBgColor === 'white' ? 0.4 : 1.4);
    rimLight.position.set(0, 2.5, -3);
    scene.add(rimLight);
    rimLightRef.current = rimLight;

    // Root Group
    const rootGroup = new THREE.Group();
    tshirtRootGroup.current = rootGroup;
    scene.add(rootGroup);

    // Floor Shadow Plane
    const shadowGeo = new THREE.PlaneGeometry(1.6, 1.6);
    const shadowMat = new THREE.ShadowMaterial({ opacity: studioBgColor === 'white' ? 0.10 : 0.38 });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.38;
    shadowMesh.receiveShadow = true;
    rootGroup.add(shadowMesh);

    // Load authentic 3D T-Shirt GLB
    const loader = new GLTFLoader();
    loader.load(
      '/shirt_baked.glb',
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;

        // Material kain + shader sablon + atribut anti-tembus (kode bersama dengan ekspor 3D)
        const prepared = prepareShirtModel(model, color, fabric);
        printUniformsRef.current = prepared.uniforms;
        tshirtMeshRef.current = prepared.mesh;

        rootGroup.add(model);
        setIsModelLoaded(true);
      },
      undefined,
      (err) => {
        console.error('Failed to load 3D t-shirt model:', err);
      }
    );

    // Render loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (isAutoRotatingRef.current) {
        currentRotationY.current += 0.008;
        // keep the target in step so stopping doesn't rewind all the turns
        targetRotationY.current = currentRotationY.current;
      } else {
        currentRotationY.current += (targetRotationY.current - currentRotationY.current) * 0.12;
      }
      currentRotationX.current += (targetRotationX.current - currentRotationX.current) * 0.12;

      if (tshirtRootGroup.current) {
        tshirtRootGroup.current.rotation.y = currentRotationY.current;
        tshirtRootGroup.current.rotation.x = currentRotationX.current;
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);
    // Wadah berubah ukuran saat panel dibuka/ditutup, tanpa window resize
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(container);

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();

      // Free GPU resources: geometries, materials and textures
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          if (!m) return;
          const std = m as THREE.MeshStandardMaterial;
          std.map?.dispose();
          std.normalMap?.dispose();
          m.dispose();
        });
      });

      printUniformsRef.current?.forEach((u) => u.uPrintMap.value?.dispose());
      printUniformsRef.current = null;
      texCacheRef.current.forEach((e) => e.tex.dispose());
      texCacheRef.current.clear();
      pendingTexRef.current.clear();
      tshirtMeshRef.current = null;
      tshirtRootGroup.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;

      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // 2. Camera Zoom Update
  useEffect(() => {
    if (cameraRef.current) {
      cameraRef.current.position.z = cameraDistance;
      cameraRef.current.updateProjectionMatrix();
    }
  }, [cameraDistance]);

  // 3. Studio Background Theme & Lighting Update
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(studioBgColor === 'white' ? 0xffffff : 0x09090b);
    }
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = studioBgColor === 'white' ? 0.95 : 0.55;
    }
    if (rimLightRef.current) {
      rimLightRef.current.intensity = studioBgColor === 'white' ? 0.4 : 1.4;
    }
  }, [studioBgColor]);

  // 4. Update T-Shirt Material Color & Fabric Properties
  useEffect(() => {
    const mesh = tshirtMeshRef.current;
    if (!mesh || !mesh.material) return;

    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.color.set(new THREE.Color(shirtBaseHex(color)));
    mat.roughness = shirtRoughness(color, fabric);
    mat.needsUpdate = true;
  }, [color, fabric, isModelLoaded]);

  // 5. Artwork projection onto the fabric (shader-based, hugs the surface).
  // Transform changes (x / y / scale / rotation / side) only update uniforms;
  // the 1024px textures are rebuilt only when image, ink filter or opacity change.
  const applyLayers = useCallback(() => {
    const uniforms = printUniformsRef.current;
    if (!uniforms) return;
    syncLayerUniforms(uniforms, graphicsRef.current, texCacheRef.current, technique);

    if (onCanvasRendered && rendererRef.current) {
      onCanvasRendered(rendererRef.current.domElement);
    }
  }, [technique, onCanvasRendered]);

  const ensureTextures = useCallback(async () => {
    const all = graphicsRef.current;
    const ids = new Set(all.map((g) => g.id));
    texCacheRef.current.forEach((entry, id) => {
      if (!ids.has(id)) {
        entry.tex.dispose();
        texCacheRef.current.delete(id);
      }
    });

    const wanted = all.filter((g) => g.visible && g.imageUrl).slice(0, MAX_GRAPHICS);
    let changed = false;

    await Promise.all(
      wanted.map(async (g) => {
        const cached = texCacheRef.current.get(g.id);
        if (
          cached &&
          cached.src === g.imageUrl &&
          cached.filter === g.colorFilter &&
          cached.opacity === g.opacity
        ) {
          return;
        }
        const key = `${g.id}|${g.imageUrl}|${g.colorFilter}|${g.opacity}`;
        if (pendingTexRef.current.has(key)) return;
        pendingTexRef.current.add(key);

        try {
          const built = await buildPrintTexture(
            g,
            1024,
            rendererRef.current?.capabilities.getMaxAnisotropy() ?? 4
          );
          if (!printUniformsRef.current) {
            built.tex.dispose(); // scene torn down
            return;
          }
          const latest = graphicsRef.current.find((x) => x.id === g.id);
          if (
            !latest ||
            latest.imageUrl !== g.imageUrl ||
            latest.colorFilter !== g.colorFilter ||
            latest.opacity !== g.opacity
          ) {
            built.tex.dispose(); // a newer update will rebuild it
            return;
          }

          texCacheRef.current.get(g.id)?.tex.dispose();
          texCacheRef.current.set(g.id, {
            tex: built.tex,
            aspect: built.aspect,
            src: g.imageUrl,
            filter: g.colorFilter,
            opacity: g.opacity
          });
          changed = true;
        } catch (err) {
          console.error('Error building 3D print texture:', err);
        } finally {
          pendingTexRef.current.delete(key);
        }
      })
    );

    if (changed) applyLayers();
  }, [applyLayers]);

  useEffect(() => {
    applyLayers();
    void ensureTextures();
  }, [graphics, technique, isModelLoaded, applyLayers, ensureTextures]);

  // Mouse wheel zoom: native non-passive listener so preventDefault really blocks page scroll
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? -0.1 : 0.1;
      setCameraDistance((prev) => Math.max(0.75, Math.min(2.1, prev + delta)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Pointer & Touch Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastPointerRef.current.x;
    const dy = e.clientY - lastPointerRef.current.y;

    if (interactMode === 'rotate') {
      targetRotationY.current += dx * 0.012;
      targetRotationX.current = Math.max(-0.45, Math.min(0.45, targetRotationX.current + dy * 0.007));
    } else if (graphic) {
      const sens = 0.28;
      const newX = Math.max(-50, Math.min(50, graphic.x + dx * sens));
      const newY = Math.max(-50, Math.min(50, graphic.y + dy * sens));
      onGraphicChange({ x: newX, y: newY, preset: 'custom' });
    }

    lastPointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div className={`relative flex flex-col items-center justify-center w-full h-full select-none overflow-hidden transition-colors duration-300 ${
      studioBgColor === 'white' ? 'bg-white text-zinc-900' : 'bg-zinc-950 text-white'
    }`}>
      {/* Main 3D Canvas Mount */}
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`w-full h-full touch-none flex items-center justify-center ${
          interactMode === 'rotate' ? 'cursor-grab active:cursor-grabbing' : 'cursor-move'
        }`}
      />

      {/* Loading Overlay */}
      {!isModelLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/20 backdrop-blur-sm pointer-events-none z-10">
          <div className="w-9 h-9 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-2" />
          <span className="text-xs font-semibold text-zinc-200">Memuat Model 3D Kaos...</span>
        </div>
      )}

      {/* Petunjuk saat mode geser sablon aktif */}
      {interactMode === 'graphic' && (
        <div className="absolute left-2 top-2 z-20 h-9 px-2.5 rounded-xl bg-amber-400 text-zinc-950 text-[11px] font-bold flex items-center gap-1.5 shadow-lg pointer-events-none">
          <Move className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap">Geser sablon</span>
        </div>
      )}

      {/* Panel posisi & ukuran sablon (lebar mengikuti layar) */}
      {graphic && (
        <div className="absolute bottom-2 left-2 right-2 sm:left-4 sm:right-4 z-20 pointer-events-none">
          <PlacementPanel graphic={graphic} onGraphicChange={onGraphicChange} />
        </div>
      )}

      {/* Floating Right Tool Strip: Zoom In/Out, Turntable, Reset */}
      <div className={`absolute right-2 top-2 sm:right-3 sm:top-1/2 sm:-translate-y-1/2 z-20 flex flex-row sm:flex-col items-center gap-1 sm:gap-1.5 p-1 rounded-xl shadow-xl border backdrop-blur ${
        studioBgColor === 'white' ? 'bg-white/95 border-zinc-200 text-zinc-700' : 'bg-zinc-900/95 border-zinc-800 text-zinc-300'
      }`}>
        <button
          onClick={() => setCameraDistance(prev => Math.max(0.75, prev - 0.15))}
          title="Perbesar Kaos 3D (Zoom In)"
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors touch-manipulation"
        >
          <ZoomIn className="w-4 h-4 text-amber-500" />
        </button>

        <button
          onClick={() => setCameraDistance(prev => Math.min(2.1, prev + 0.15))}
          title="Perkecil Kaos 3D (Zoom Out)"
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors touch-manipulation"
        >
          <ZoomOut className="w-4 h-4 text-amber-500" />
        </button>

        <div className={`w-[1px] h-5 sm:w-5 sm:h-[1px] ${studioBgColor === 'white' ? 'bg-zinc-200' : 'bg-zinc-800'}`} />

        <button
          onClick={() => setIsAutoRotating(!isAutoRotating)}
          title="Putar Otomatis 360°"
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors touch-manipulation ${
            isAutoRotating ? 'bg-amber-400 text-zinc-950 font-bold' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          {isAutoRotating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <button
          onClick={() => setInteractMode(interactMode === 'graphic' ? 'rotate' : 'graphic')}
          title={interactMode === 'graphic' ? 'Mode geser sablon aktif (ketuk untuk kembali memutar kaos)' : 'Geser sablon dengan jari'}
          aria-pressed={interactMode === 'graphic'}
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors touch-manipulation ${
            interactMode === 'graphic' ? 'bg-amber-400 text-zinc-950 font-bold' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Move className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            targetRotationY.current = nearestAngleForSide(currentSide);
            targetRotationX.current = 0;
            setCameraDistance(1.35);
          }}
          title="Reset Sudut Pandang"
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors touch-manipulation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
