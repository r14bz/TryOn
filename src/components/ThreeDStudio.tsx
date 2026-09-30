import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { 
  RotateCcw, 
  ZoomIn, 
  ZoomOut,
  Play, 
  Pause,
  RotateCw,
  Move,
  ChevronDown,
  ChevronUp,
  Sliders,
  Maximize2
} from 'lucide-react';
import { 
  FabricInfo, 
  TshirtColor, 
  GraphicSettings, 
  PrintTechniqueInfo, 
  GarmentSize, 
  PlacementSide, 
  StudioBgColor 
} from '../types/sablon';
import { getCachedImage } from '../utils/fabricRenderer';

interface ThreeDStudioProps {
  fabric: FabricInfo;
  color: TshirtColor;
  graphic: GraphicSettings;
  technique: PrintTechniqueInfo;
  currentSide: PlacementSide;
  garmentSize: GarmentSize;
  studioBgColor: StudioBgColor;
  onSideChange: (side: PlacementSide) => void;
  onGraphicChange: (updated: Partial<GraphicSettings>) => void;
  onStudioBgChange: (bg: StudioBgColor) => void;
  onCanvasRendered?: (canvas: HTMLCanvasElement) => void;
  onOpenAR: () => void;
  onOpenInspect: () => void;
  onSwitchTo2D?: () => void;
}


// ---------------------------------------------------------------------------
// Print projection: the artwork is projected onto the shirt surface INSIDE the
// fabric shader (no extra geometry), so it always hugs the cloth, follows the
// normal-mapped folds and lighting, and can never float, slice or tear.
// Coordinates are the mesh's local space (raw GLB units).
// ---------------------------------------------------------------------------
interface PrintUniforms {
  uPrintMap: { value: THREE.Texture };
  uPrintOrigin: { value: THREE.Vector3 };
  uPrintAxis: { value: THREE.Vector3 };
  uPrintRight: { value: THREE.Vector3 };
  uPrintUp: { value: THREE.Vector3 };
  uPrintSize: { value: THREE.Vector2 };
  uPrintRot: { value: number };
  uPrintRough: { value: number };
  uPrintOn: { value: number };
}

function createPrintUniforms(): PrintUniforms {
  const empty = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  empty.needsUpdate = true;
  return {
    uPrintMap: { value: empty },
    uPrintOrigin: { value: new THREE.Vector3() },
    uPrintAxis: { value: new THREE.Vector3(0, 0, 1) },
    uPrintRight: { value: new THREE.Vector3(1, 0, 0) },
    uPrintUp: { value: new THREE.Vector3(0, 1, 0) },
    uPrintSize: { value: new THREE.Vector2(0.17, 0.17) },
    uPrintRot: { value: 0 },
    uPrintRough: { value: 0.8 },
    uPrintOn: { value: 0 }
  };
}

function applyPrintShader(material: THREE.MeshStandardMaterial, u: PrintUniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPrintPos;\nvarying vec3 vPrintNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPrintPos = position;\nvPrintNrm = normal;');

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vPrintPos;
varying vec3 vPrintNrm;
uniform sampler2D uPrintMap;
uniform vec3 uPrintOrigin;
uniform vec3 uPrintAxis;
uniform vec3 uPrintRight;
uniform vec3 uPrintUp;
uniform vec2 uPrintSize;
uniform float uPrintRot;
uniform float uPrintRough;
uniform float uPrintOn;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float printMask = 0.0;
if (uPrintOn > 0.5 && gl_FrontFacing) {
  // Only cloth that faces the projector gets printed (fades out around the sides)
  float facing = dot(normalize(vPrintNrm), uPrintAxis);
  float k = smoothstep(0.30, 0.65, facing);
  vec3 rel = vPrintPos - uPrintOrigin;
  vec2 p = vec2(dot(rel, uPrintRight), dot(rel, uPrintUp));
  float c = cos(uPrintRot);
  float s = sin(uPrintRot);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  vec2 uv = p / uPrintSize + 0.5;
  if (k > 0.0 && uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
    vec4 dc = texture2D(uPrintMap, uv);
    printMask = dc.a * k;
    diffuseColor.rgb = mix(diffuseColor.rgb, dc.rgb, printMask);
  }
}`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, uPrintRough, printMask);`
      );
  };
  material.customProgramCacheKey = () => 'sablon-print-projection-v1';
}

/** Projector frame (mesh-local) for each placement side. */
function getPrintFrame(side: PlacementSide, gx: number, gy: number) {
  // gx/gy: -50..50 (%) from the placement sliders
  const axis = new THREE.Vector3();
  const origin = new THREE.Vector3();
  let rangeX = 0.26;
  let rangeY = 0.30;

  switch (side) {
    case 'front':
      axis.set(0, 0, 1);
      origin.set(0, -0.005, 0);
      break;
    case 'back':
      axis.set(0, 0, -1);
      origin.set(0, -0.005, 0);
      break;
    case 'sleeve_left': // wearer's left = +x in the model
      axis.set(0.94, 0.34, -0.1).normalize();
      origin.set(0.22, 0.125, -0.025);
      rangeX = 0.14;
      rangeY = 0.12;
      break;
    default: // sleeve_right
      axis.set(-0.94, 0.34, -0.1).normalize();
      origin.set(-0.22, 0.125, -0.025);
      rangeX = 0.14;
      rangeY = 0.12;
  }

  // Viewer-oriented basis: up follows +Y, right = (looking direction) x up
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(axis, -axis.y).normalize();
  const right = new THREE.Vector3().crossVectors(axis.clone().negate(), up).normalize();

  origin.addScaledVector(right, (gx / 100) * rangeX);
  origin.addScaledVector(up, -(gy / 100) * rangeY);
  return { axis, origin, right, up };
}

export const ThreeDStudio: React.FC<ThreeDStudioProps> = ({
  fabric,
  color,
  graphic,
  technique,
  currentSide,
  garmentSize,
  studioBgColor,
  onSideChange,
  onGraphicChange,
  onStudioBgChange,
  onCanvasRendered,
  onOpenAR,
  onOpenInspect,
  onSwitchTo2D
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const tshirtRootGroup = useRef<THREE.Group | null>(null);
  const tshirtMeshRef = useRef<THREE.Mesh | null>(null);
  const printUniformsRef = useRef<PrintUniforms | null>(null);
  const printTextureRef = useRef<THREE.Texture | null>(null);

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

  // Guards against overlapping async decal builds
  const decalRequestId = useRef(0);
  
  // Interactive Mode: 'rotate' (spin 360) vs 'graphic' (drag graphic)
  const [interactMode, setInteractMode] = useState<'rotate' | 'graphic'>('rotate');
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isSlidersExpanded, setIsSlidersExpanded] = useState(true);

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

  // Sync rotation with currentSide prop
  useEffect(() => {
    targetRotationY.current = getAngleForSide(currentSide);
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

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const isBlack = color.id === 'black';
            const isWhite = color.id === 'white';
            const baseHex = isBlack ? '#121214' : isWhite ? '#F8F8FC' : color.hex;

            if (mesh.material) {
              const origMat = mesh.material as THREE.MeshStandardMaterial;
              const newMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(baseHex),
                roughness: isBlack ? 0.88 : 0.70,
                metalness: 0.02,
                normalMap: origMat.normalMap || null,
                normalScale: new THREE.Vector2(1.2, 1.2),
                side: THREE.DoubleSide
              });
              const printUniforms = createPrintUniforms();
              applyPrintShader(newMat, printUniforms);
              printUniformsRef.current = printUniforms;
              mesh.material = newMat;
            }
            tshirtMeshRef.current = mesh;
          }
        });

        // Center model vertically
        model.position.set(0, 0.045, 0);
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

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);

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

      printUniformsRef.current = null;
      printTextureRef.current?.dispose();
      printTextureRef.current = null;
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

    const isBlack = color.id === 'black';
    const isWhite = color.id === 'white';
    const baseHex = isBlack ? '#121214' : isWhite ? '#F8F8FC' : color.hex;

    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.color.set(new THREE.Color(baseHex));
    mat.roughness = isBlack ? 0.88 : fabric.id === 'cotton_bamboo' ? 0.45 : 0.72;
    mat.needsUpdate = true;
  }, [color, fabric, isModelLoaded]);

  // 5. Artwork projection onto the fabric (shader-based, hugs the surface)
  const updateGraphicPrint = useCallback(async () => {
    const requestId = ++decalRequestId.current;
    const uniforms = printUniformsRef.current;
    if (!uniforms) return;

    if (!graphic.imageUrl) {
      uniforms.uPrintOn.value = 0;
      return;
    }

    try {
      const graphicImg = await getCachedImage(graphic.imageUrl);
      // A newer request started (or the scene was torn down) while loading
      if (requestId !== decalRequestId.current || printUniformsRef.current !== uniforms) return;

      const texW = 1024;
      const aspect = (graphicImg.height || 1) / (graphicImg.width || 1);
      const texH = Math.max(64, Math.min(2048, Math.round(texW * aspect)));

      const dCanvas = document.createElement('canvas');
      dCanvas.width = texW;
      dCanvas.height = texH;
      const dctx = dCanvas.getContext('2d');
      if (!dctx) return;

      if (graphic.colorFilter === 'monochrome_white') {
        dctx.filter = 'brightness(200%) grayscale(100%)';
      } else if (graphic.colorFilter === 'monochrome_black') {
        dctx.filter = 'brightness(0%)';
      } else if (graphic.colorFilter === 'vintage_warm') {
        dctx.filter = 'sepia(45%) contrast(90%)';
      }
      dctx.globalAlpha = graphic.opacity;
      dctx.drawImage(graphicImg, 0, 0, texW, texH);

      const tex = new THREE.CanvasTexture(dCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = rendererRef.current?.capabilities.getMaxAnisotropy() ?? 4;
      tex.needsUpdate = true;

      const oldTex = printTextureRef.current;
      printTextureRef.current = tex;
      uniforms.uPrintMap.value = tex;
      oldTex?.dispose();

      const frame = getPrintFrame(graphic.side, graphic.x, graphic.y);
      uniforms.uPrintOrigin.value.copy(frame.origin);
      uniforms.uPrintAxis.value.copy(frame.axis);
      uniforms.uPrintRight.value.copy(frame.right);
      uniforms.uPrintUp.value.copy(frame.up);

      const isSleeve = graphic.side === 'sleeve_left' || graphic.side === 'sleeve_right';
      const width = 0.17 * graphic.scale * (isSleeve ? 0.55 : 1.0);
      uniforms.uPrintSize.value.set(width, width * aspect);
      // Positive rotation = clockwise as seen by the viewer
      uniforms.uPrintRot.value = (graphic.rotation * Math.PI) / 180;
      uniforms.uPrintRough.value = technique.id === 'plastisol' ? 0.35 : 0.8;
      uniforms.uPrintOn.value = 1;

      if (onCanvasRendered && rendererRef.current) {
        onCanvasRendered(rendererRef.current.domElement);
      }
    } catch (err) {
      console.error('Error applying 3D print:', err);
    }
  }, [graphic, technique, isModelLoaded, onCanvasRendered]);

  useEffect(() => {
    updateGraphicPrint();
  }, [updateGraphicPrint]);

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
    } else {
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

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? -0.10 : 0.10;
    setCameraDistance(prev => Math.max(0.75, Math.min(2.1, prev + delta)));
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
        onWheel={handleWheel}
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

      {/* Mode Switcher Banner: Putar Kaos vs Geser Sablon */}
      <div className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 z-20 flex items-center p-1 rounded-xl shadow-lg border backdrop-blur text-xs font-semibold bg-zinc-900/90 border-zinc-800 text-zinc-300">
        <button
          onClick={() => setInteractMode('rotate')}
          className={`h-7 px-3 rounded-lg flex items-center gap-1.5 transition-all touch-manipulation ${
            interactMode === 'rotate'
              ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <RotateCw className="w-3.5 h-3.5 shrink-0" />
          <span>Putar 360°</span>
        </button>
        <button
          onClick={() => setInteractMode('graphic')}
          className={`h-7 px-3 rounded-lg flex items-center gap-1.5 transition-all touch-manipulation ${
            interactMode === 'graphic'
              ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Move className="w-3.5 h-3.5 shrink-0" />
          <span>Geser Sablon</span>
        </button>
      </div>

      {/* FLOATING ON-CANVAS SLIDERS: ALWAYS ACCESSIBLE EVEN WHEN BOTTOM PANEL IS CLOSED */}
      <div className="absolute bottom-2 left-2 right-14 sm:left-4 sm:right-16 z-20 pointer-events-auto">
        <div className="bg-zinc-950/95 border border-zinc-800 text-zinc-200 p-2.5 rounded-2xl shadow-2xl backdrop-blur-md max-w-sm mx-auto">
          {/* Header Row with Title and Collapse Button */}
          <div className="flex items-center justify-between pb-1.5 border-b border-zinc-850 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <Sliders className="w-3.5 h-3.5" />
              <span>Atur Posisi &amp; Ukuran Sablon</span>
            </div>
            <button
              onClick={() => setIsSlidersExpanded(!isSlidersExpanded)}
              className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-850 transition-colors"
              title={isSlidersExpanded ? 'Kecilkan Kontrol' : 'Buka Kontrol'}
            >
              {isSlidersExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {/* Sliders Content */}
          {isSlidersExpanded && (
            <div className="flex flex-col gap-2 pt-2 text-[11px]">
              {/* 1. Horizontal Slider (Kiri / Kanan) */}
              <div className="flex items-center gap-2">
                <span className="w-16 text-zinc-400 shrink-0 font-medium">Kiri / Kanan:</span>
                <button
                  onClick={() => onGraphicChange({ x: Math.max(-50, graphic.x - 2), preset: 'custom' })}
                  className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-xs font-bold text-amber-400"
                >
                  ◀
                </button>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={Math.round(graphic.x)}
                  onChange={(e) => onGraphicChange({ x: Number(e.target.value), preset: 'custom' })}
                  className="flex-1 accent-amber-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <button
                  onClick={() => onGraphicChange({ x: Math.min(50, graphic.x + 2), preset: 'custom' })}
                  className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-xs font-bold text-amber-400"
                >
                  ▶
                </button>
                <span className="w-9 font-mono text-[10px] text-right text-zinc-300">
                  {Math.round(graphic.x)}%
                </span>
              </div>

              {/* 2. Vertical Slider (Atas / Bawah) */}
              <div className="flex items-center gap-2">
                <span className="w-16 text-zinc-400 shrink-0 font-medium">Atas / Bwh:</span>
                <button
                  onClick={() => onGraphicChange({ y: Math.max(-50, graphic.y - 2), preset: 'custom' })}
                  className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-xs font-bold text-amber-400"
                >
                  ▲
                </button>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={Math.round(graphic.y)}
                  onChange={(e) => onGraphicChange({ y: Number(e.target.value), preset: 'custom' })}
                  className="flex-1 accent-amber-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <button
                  onClick={() => onGraphicChange({ y: Math.min(50, graphic.y + 2), preset: 'custom' })}
                  className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-xs font-bold text-amber-400"
                >
                  ▼
                </button>
                <span className="w-9 font-mono text-[10px] text-right text-zinc-300">
                  {Math.round(graphic.y)}%
                </span>
              </div>

              {/* 3. Scale & Rotate Quick Row */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-850/60">
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-zinc-400 font-medium">Ukuran:</span>
                  <button
                    onClick={() => onGraphicChange({ scale: Math.max(0.35, Number((graphic.scale - 0.1).toFixed(2))), preset: 'custom' })}
                    className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-xs font-bold text-amber-400"
                  >
                    −
                  </button>
                  <input
                    type="range"
                    min="0.35"
                    max="2.0"
                    step="0.05"
                    value={graphic.scale}
                    onChange={(e) => onGraphicChange({ scale: Number(e.target.value), preset: 'custom' })}
                    className="w-16 accent-amber-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                  <button
                    onClick={() => onGraphicChange({ scale: Math.min(2.0, Number((graphic.scale + 0.1).toFixed(2))), preset: 'custom' })}
                    className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-xs font-bold text-amber-400"
                  >
                    +
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onGraphicChange({ rotation: (graphic.rotation + 15) % 360, preset: 'custom' })}
                    className="px-2 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 flex items-center gap-1"
                    title="Putar Sablon 15°"
                  >
                    <RotateCw className="w-3 h-3 text-amber-400" />
                    <span>{graphic.rotation}°</span>
                  </button>
                  <button
                    onClick={() => onGraphicChange({ x: 0, y: 0, rotation: 0, preset: 'custom' })}
                    className="px-2 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-400 hover:text-white"
                    title="Reset Posisi ke Tengah"
                  >
                    Tengah
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Right Tool Strip: Zoom In/Out, Turntable, Reset */}
      <div className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5 p-1 rounded-xl shadow-xl border backdrop-blur ${
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

        <div className={`w-5 h-[1px] mx-auto ${studioBgColor === 'white' ? 'bg-zinc-200' : 'bg-zinc-800'}`} />

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
          onClick={() => {
            targetRotationY.current = getAngleForSide(currentSide);
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
