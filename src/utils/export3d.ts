import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FabricInfo, TshirtColor, GraphicSettings, PrintTechniqueInfo, PlacementSide, GarmentModel } from '../types/sablon';
import {
  HOODIE_SLEEVE_VIEW,
  PrintTextureEntry,
  SHIRT_MODEL_URL,
  buildPrintTexture,
  prepareHoodieModel,
  prepareShirtModel,
  syncLayerUniforms
} from './shirt3d';

export type Export3DBackground = 'transparent' | 'white' | 'black';

export interface Export3DData {
  fabric: FabricInfo;
  color: TshirtColor;
  technique: PrintTechniqueInfo;
  graphics: GraphicSettings[];
  /** model pakaian yang diekspor; kosong = kaos */
  garment?: GarmentModel;
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

/** Hoodie: lengan dilihat dari depan-samping-atas (sama dengan studio 3D), jadi ada sudut miring (pitch). */
const hoodieAngles = (side: PlacementSide): { yaw: number; pitch: number } => {
  switch (side) {
    case 'front': return { yaw: 0, pitch: 0 };
    case 'back': return { yaw: Math.PI, pitch: 0 };
    case 'sleeve_left': return { yaw: -HOODIE_SLEEVE_VIEW.yaw, pitch: HOODIE_SLEEVE_VIEW.pitch };
    case 'sleeve_right': return { yaw: HOODIE_SLEEVE_VIEW.yaw, pitch: HOODIE_SLEEVE_VIEW.pitch };
  }
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
  const garment: GarmentModel = data.garment ?? 'shirt';
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
    shadowMesh.position.y = garment === 'hoodie' ? -0.34 : -0.38;
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
    const gltf = await new GLTFLoader().loadAsync(garment === 'hoodie' ? '/models/hoodie.glb' : SHIRT_MODEL_URL);
    const { uniforms } =
      garment === 'hoodie'
        ? prepareHoodieModel(gltf.scene, data.color, data.fabric)
        : prepareShirtModel(gltf.scene, data.color, data.fabric);
    // Sama dengan studio 3D: skala hanya pada root agar proyeksi sablon di ruang lokal tetap sejajar
    if (garment === 'hoodie') gltf.scene.scale.setScalar(0.82);
    root.add(gltf.scene);

    // Framing eksport: hitung jarak kamera presisi per sisi agar model memenuhi
    // frame persegi (aspect 1) tanpa terpotong. Sphere-based terlalu konservatif;
    // bbox presisi per sisi memungkinkan zoom lebih dekat (depan/belakang ~19% lebih besar).
    gltf.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    const fovHalfRad = ((35 / 2) * Math.PI) / 180;
    const tanFov = Math.tan(fovHalfRad);
    
    // Cache jarak per sisi (dihitung lazy di renderView saat pertama kali dibutuhkan)
    const cameraDistances = new Map<PlacementSide, number>();
    
    const computeCameraDistance = (side: PlacementSide): number => {
      if (cameraDistances.has(side)) return cameraDistances.get(side)!;
      
      // Terapkan rotasi ke bounding box untuk menghitung jarak presisi per sisi
      let rotMatrix: THREE.Matrix4;
      if (garment === 'hoodie') {
        const angles = hoodieAngles(side);
        rotMatrix = new THREE.Matrix4().makeRotationFromEuler(
          new THREE.Euler(angles.pitch, angles.yaw, 0, 'XYZ')
        );
      } else {
        rotMatrix = new THREE.Matrix4().makeRotationY(SIDE_ANGLE[side]);
      }
      
      // Hitung bbox rotated
      const corners = [
        new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
        new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
        new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
        new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
        new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
        new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
        new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
        new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z)
      ];
      
      // Jarak kamera agar bbox rotated masuk dalam frustum persegi
      // Kamera di (0,0,d) melihat origin; untuk titik (x,y,z) di cam space: perlu |x|/t + z <= d dan |y|/t + z <= d
      let required = 0;
      for (const corner of corners) {
        corner.applyMatrix4(rotMatrix);
        required = Math.max(required, Math.abs(corner.x) / tanFov + corner.z, Math.abs(corner.y) / tanFov + corner.z);
      }
      
      // Margin ketat karena fit sudah presisi
      const distance = Math.max(1.35, Math.min(2.6, required * 1.02));
      cameraDistances.set(side, distance);
      return distance;
    };

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
    syncLayerUniforms(uniforms, data.graphics, textures, data.technique, garment);
  } catch (err) {
    dispose();
    throw err;
  }

  const renderView = (side: PlacementSide): HTMLCanvasElement => {
    if (garment === 'hoodie') {
      const a = hoodieAngles(side);
      root.rotation.set(a.pitch, a.yaw, 0);
    } else {
      root.rotation.set(0, SIDE_ANGLE[side], 0);
    }
    
    // Gunakan jarak kamera presisi per sisi
    camera.position.z = computeCameraDistance(side);
    
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
