import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FabricInfo, TshirtColor, GraphicSettings, PrintTechniqueInfo, PlacementSide } from '../types/sablon';
import {
  PrintTextureEntry,
  SHIRT_MODEL_URL,
  buildPrintTexture,
  prepareShirtModel,
  syncLayerUniforms
} from './shirt3d';

export type Export3DBackground = 'transparent' | 'white' | 'black';

export interface Export3DData {
  fabric: FabricInfo;
  color: TshirtColor;
  technique: PrintTechniqueInfo;
  graphics: GraphicSettings[];
}

export interface Shirt3DExporter {
  /** ukuran sisi gambar yang benar-benar dipakai (bisa lebih kecil dari yang diminta) */
  size: number;
  /** Render satu sisi; hasilnya canvas 2D biasa, siap diubah ke PNG/JPG. */
  renderView: (side: PlacementSide) => HTMLCanvasElement;
  dispose: () => void;
}

/** Sudut putar kaos untuk tiap sisi (sama dengan studio 3D). */
const SIDE_ANGLE: Record<PlacementSide, number> = {
  front: 0,
  sleeve_left: -Math.PI / 2,
  back: Math.PI,
  sleeve_right: Math.PI / 2
};

/**
 * Menyiapkan render 3D di luar layar. Model dimuat dan tekstur sablon dibuat sekali,
 * lalu `renderView` dipanggil untuk tiap sisi. Tampilan sama dengan studio 3D:
 * kamera, cahaya, material, dan proyeksi sablon memakai kode yang sama.
 */
export async function createShirt3DExporter(
  data: Export3DData,
  requestedSize: number,
  background: Export3DBackground
): Promise<Shirt3DExporter> {
  const transparent = background === 'transparent';
  const darkStudio = background === 'black';

  // Kanvas sebesar-besarnya sesuai batas GPU
  const probe = document.createElement('canvas');
  const gl = (probe.getContext('webgl2') || probe.getContext('webgl')) as WebGLRenderingContext | null;
  const gpuMax = gl
    ? Math.min(
        gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
        gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
      )
    : 2048;
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  const size = Math.max(256, Math.min(requestedSize, gpuMax));

  const renderer = new THREE.WebGLRenderer({
    antialias: size <= 3072,
    alpha: true,
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !transparent;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  if (transparent) {
    renderer.setClearColor(0x000000, 0);
  } else {
    renderer.setClearColor(darkStudio ? 0x09090b : 0xffffff, 1);
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 1.35);

  // Cahaya sama dengan studio 3D (latar gelap memakai set cahaya studio gelap)
  scene.add(new THREE.AmbientLight(0xffffff, darkStudio ? 0.55 : 0.95));
  const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.4);
  keyLight.position.set(2, 3, 3);
  keyLight.castShadow = true;
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xedf2ff, 0.85);
  fillLight.position.set(-2, 1.5, 2);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffffff, darkStudio ? 1.4 : 0.4);
  rimLight.position.set(0, 2.5, -3);
  scene.add(rimLight);

  const root = new THREE.Group();
  scene.add(root);

  if (!transparent) {
    const shadowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.6),
      new THREE.ShadowMaterial({ opacity: darkStudio ? 0.38 : 0.1 })
    );
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.38;
    shadowMesh.receiveShadow = true;
    root.add(shadowMesh);
  }

  const textures = new Map<string, PrintTextureEntry>();
  const dispose = () => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (!m) return;
        (m as THREE.MeshStandardMaterial).normalMap?.dispose();
        m.dispose();
      });
    });
    textures.forEach((e) => e.tex.dispose());
    textures.clear();
    renderer.dispose();
    renderer.forceContextLoss();
  };

  try {
    const gltf = await new GLTFLoader().loadAsync(SHIRT_MODEL_URL);
    const { uniforms } = prepareShirtModel(gltf.scene, data.color, data.fabric);
    root.add(gltf.scene);

    // Tekstur sablon: lebih tajam untuk gambar besar
    const texW = size >= 2048 ? 2048 : 1024;
    const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const visible = data.graphics.filter((g) => g.visible && g.imageUrl);
    await Promise.all(
      visible.map(async (g) => {
        try {
          textures.set(g.id, await buildPrintTexture(g, texW, anisotropy));
        } catch (err) {
          console.error('Gagal membuat tekstur sablon untuk ekspor 3D:', err);
        }
      })
    );
    syncLayerUniforms(uniforms, data.graphics, textures, data.technique);
  } catch (err) {
    dispose();
    throw err;
  }

  const renderView = (side: PlacementSide): HTMLCanvasElement => {
    root.rotation.set(0, SIDE_ANGLE[side], 0);
    renderer.render(scene, camera);

    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D tidak tersedia');
    ctx.drawImage(renderer.domElement, 0, 0);
    return out;
  };

  return { size, renderView, dispose };
}
