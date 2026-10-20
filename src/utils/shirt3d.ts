import * as THREE from 'three';
import {
  FabricInfo,
  TshirtColor,
  GraphicSettings,
  PrintTechniqueInfo,
  PlacementSide,
  MAX_GRAPHICS, GarmentModel } from '../types/sablon';
import { getCachedImage, getFilteredSource } from './fabricRenderer';
import { getModelPlacement } from './placement';
import { computeAxisVisibility, Vec3 } from './printVisibility';

/**
 * Bagian 3D yang dipakai bersama oleh studio 3D (ThreeDStudio) dan ekspor gambar 3D.
 *
 * Sablon diproyeksikan ke permukaan kaos DI DALAM shader kain (tanpa geometri
 * tambahan), sehingga selalu menempel pada kain, mengikuti lipatan dan cahaya.
 * Koordinat memakai ruang lokal mesh (satuan mentah GLB).
 */

export const SHIRT_MODEL_URL = '/shirt_baked.glb';

/** Urutan sisi pada atribut visibilitas (vec4) dan uniform uPrintSide. */
export const SIDE_ORDER: PlacementSide[] = ['front', 'back', 'sleeve_left', 'sleeve_right'];

/** Arah proyeksi tiap sisi (menuju pemirsa), di ruang lokal mesh. */
const SIDE_AXIS: Record<PlacementSide, Vec3> = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  sleeve_left: [0.94, 0.34, -0.1], // lengan kiri pemakai = +x pada model
  sleeve_right: [-0.94, 0.34, -0.1]
};

/** Titik tumpu horizontal (x, z) proyektor tiap sisi; tinggi (y) datang dari placement.ts. */
const SIDE_ANCHOR_XZ: Record<PlacementSide, [number, number]> = {
  front: [0, 0],
  back: [0, 0],
  sleeve_left: [0.22, -0.025], // lengan kiri pemakai = +x pada model
  sleeve_right: [-0.22, -0.025]
};

/** Titik tumpu khusus hoodie (mesh dipusatkan & dinormalisasi di prepareHoodieModel). */
const HOODIE_SIDE_ANCHOR_XZ: Record<PlacementSide, [number, number]> = {
  front: [0, 0.012],
  back: [0, -0.012],
  sleeve_left: [0.255, -0.018],
  sleeve_right: [-0.255, -0.018]
};

/** Batas jahitan lengan: sablon lengan tidak boleh melewati lingkar lengan ke badan. */
const SEAM_START = 0.165;
const SEAM_END = 0.195;

// ---------------------------------------------------------------------------
// Uniform & shader
// ---------------------------------------------------------------------------
export interface PrintLayerUniforms {
  uPrintMap: { value: THREE.Texture };
  uPrintOrigin: { value: THREE.Vector3 };
  uPrintAxis: { value: THREE.Vector3 };
  uPrintRight: { value: THREE.Vector3 };
  uPrintUp: { value: THREE.Vector3 };
  uPrintSize: { value: THREE.Vector2 };
  uPrintSide: { value: THREE.Vector4 };
  uPrintSeam: { value: number };
  /** Enable explicit front/back/sleeve spatial clipping for the hoodie asset only. */
  uPrintRegion: { value: number };
  uPrintRot: { value: number };
  uPrintRough: { value: number };
  uPrintOn: { value: number };
}

function createLayerUniforms(): PrintLayerUniforms {
  const empty = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  empty.needsUpdate = true;
  return {
    uPrintMap: { value: empty },
    uPrintOrigin: { value: new THREE.Vector3() },
    uPrintAxis: { value: new THREE.Vector3(0, 0, 1) },
    uPrintRight: { value: new THREE.Vector3(1, 0, 0) },
    uPrintUp: { value: new THREE.Vector3(0, 1, 0) },
    uPrintSize: { value: new THREE.Vector2(0.17, 0.17) },
    uPrintSide: { value: new THREE.Vector4(1, 0, 0, 0) },
    uPrintSeam: { value: 0 },
    uPrintRegion: { value: 0 },
    uPrintRot: { value: 0 },
    uPrintRough: { value: 0.8 },
    uPrintOn: { value: 0 }
  };
}

/** Satu set uniform independen per layer gambar (sampai MAX_GRAPHICS). */
export function createPrintUniforms(): PrintLayerUniforms[] {
  return Array.from({ length: MAX_GRAPHICS }, () => createLayerUniforms());
}

export function applyPrintShader(material: THREE.MeshStandardMaterial, layers: PrintLayerUniforms[]) {
  const declarations = layers
    .map(
      (_, i) => `uniform sampler2D uPrintMap${i};
uniform vec3 uPrintOrigin${i};
uniform vec3 uPrintAxis${i};
uniform vec3 uPrintRight${i};
uniform vec3 uPrintUp${i};
uniform vec2 uPrintSize${i};
uniform vec4 uPrintSide${i};
uniform float uPrintSeam${i};
uniform float uPrintRegion${i};
uniform float uPrintRot${i};
uniform float uPrintRough${i};
uniform float uPrintOn${i};`
    )
    .join('\n');

  // Tiap layer menimpa layer sebelumnya (layer berikutnya di atas). Tekstur selalu
  // di-sample (alur seragam) lalu di-mask sesudahnya.
  const blocks = layers
    .map(
      (_, i) => `{
  vec3 rel = vPrintPos - uPrintOrigin${i};
  vec2 p = vec2(dot(rel, uPrintRight${i}), dot(rel, uPrintUp${i}));
  float cr = cos(uPrintRot${i});
  float sr = sin(uPrintRot${i});
  p = vec2(cr * p.x - sr * p.y, sr * p.x + cr * p.y);
  vec2 uv = p / uPrintSize${i} + 0.5;
  vec4 dc = texture2D(uPrintMap${i}, clamp(uv, 0.0, 1.0));
  // Hanya kain yang menghadap proyektor yang tercetak (memudar di sisi samping)
  float facing = smoothstep(0.30, 0.65, dot(pNrm, uPrintAxis${i}));
  // Hanya permukaan yang PERTAMA terkena proyektor: kain di belakangnya (sisi dalam
  // lengan, dinding badan di balik lubang lengan) tidak ikut tercetak
  float seen = smoothstep(0.35, 0.65, dot(vPrintVis, uPrintSide${i}));
  // Keep hoodie artwork in the physical region matching the selected panel.
  // +Z is the front, -Z is the back, +X/-X are the wearer's left/right sleeves.
  // This positional mask prevents projections from leaking across torso panels.
  // The hoodie geometry is normalized to ~0.82 units high in prepareHoodieModel.
  // Keep body panels separated by the garment's depth axis, and only allow sleeve
  // projections well outside the torso. A narrow transition avoids fuzzy overlaps
  // around the side seams while preserving a small antialiasing-friendly fade.
  float frontRegion = smoothstep(0.008, 0.028, vPrintPos.z);
  // The hood is part of the rear silhouette but must not receive torso-back prints.
  // Clip the upper back panel just below the hood/neck seam.
  float backTorsoRegion = 1.0 - smoothstep(0.205, 0.235, vPrintPos.y);
  float backRegion = (1.0 - smoothstep(-0.028, -0.008, vPrintPos.z)) * backTorsoRegion;
  float sleeveLeftRegion = smoothstep(0.225, 0.255, vPrintPos.x);
  float sleeveRightRegion = smoothstep(0.225, 0.255, -vPrintPos.x);
  float hoodieRegion = uPrintSide${i}.x * frontRegion
    + uPrintSide${i}.y * backRegion
    + uPrintSide${i}.z * sleeveLeftRegion
    + uPrintSide${i}.w * sleeveRightRegion;
  float region = mix(1.0, hoodieRegion, uPrintRegion${i});
  // Sablon lengan berhenti di jahitan lengan
  float seam = mix(1.0, smoothstep(${SEAM_START.toFixed(3)}, ${SEAM_END.toFixed(3)}, uPrintSeam${i} * vPrintPos.x), abs(uPrintSeam${i}));
  bool inside = uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0;
  float pm = (uPrintOn${i} > 0.5 && gl_FrontFacing && inside) ? dc.a * facing * seen * seam * region : 0.0;
  diffuseColor.rgb = mix(diffuseColor.rgb, dc.rgb, pm);
  printRough = mix(printRough, uPrintRough${i}, pm);
  printMask = max(printMask, pm);
}`
    )
    .join('\n');

  material.onBeforeCompile = (shader) => {
    layers.forEach((u, i) => {
      (Object.keys(u) as (keyof PrintLayerUniforms)[]).forEach((k) => {
        shader.uniforms[`${k}${i}`] = u[k];
      });
    });

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute vec4 printVis;\nvarying vec3 vPrintPos;\nvarying vec3 vPrintNrm;\nvarying vec4 vPrintVis;'
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvPrintPos = position;\nvPrintNrm = normal;\nvPrintVis = printVis;'
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vPrintPos;\nvarying vec3 vPrintNrm;\nvarying vec4 vPrintVis;\n${declarations}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float printMask = 0.0;
float printRough = 0.8;
vec3 pNrm = normalize(vPrintNrm);
${blocks}`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, printRough, printMask);`
      );
  };
  material.customProgramCacheKey = () => `sablon-print-projection-v5-${layers.length}`;
}

// ---------------------------------------------------------------------------
// Visibilitas per-vertex (anti tembus)
// ---------------------------------------------------------------------------
let visibilityCache: { count: number; data: Float32Array } | null = null;

/**
 * Menambahkan atribut `printVis` (vec4: depan, belakang, lengan kiri, lengan kanan)
 * ke geometri. Nilai 1 = permukaan itu pertama terkena proyektor sisi tersebut.
 * Dihitung sekali (~0,1 detik) lalu disimpan, karena model tidak berubah.
 */
export function attachPrintVisibility(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute('position');
  const count = pos.count;

  if (!visibilityCache || visibilityCache.count !== count) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.getX(i);
      positions[i * 3 + 1] = pos.getY(i);
      positions[i * 3 + 2] = pos.getZ(i);
    }
    const index = geometry.getIndex();
    let indices: ArrayLike<number>;
    if (index) {
      indices = index.array as ArrayLike<number>;
    } else {
      const seq = new Uint32Array(count);
      for (let i = 0; i < count; i++) seq[i] = i;
      indices = seq;
    }

    const data = new Float32Array(count * 4).fill(1);
    SIDE_ORDER.forEach((side, channel) => {
      const vis = computeAxisVisibility(positions, indices, SIDE_AXIS[side]);
      for (let i = 0; i < count; i++) data[i * 4 + channel] = vis[i];
    });
    visibilityCache = { count, data };
  }

  geometry.setAttribute('printVis', new THREE.BufferAttribute(visibilityCache.data, 4));
}

// ---------------------------------------------------------------------------
// Frame proyektor & penempatan
// ---------------------------------------------------------------------------
/** Frame proyektor (ruang lokal mesh) untuk tiap sisi. gx/gy: -50..50 (%) dari slider. */
export function getPrintFrame(side: PlacementSide, gx: number, gy: number, garment: GarmentModel = 'shirt') {
  const place = getModelPlacement(side, garment);
  const a = SIDE_AXIS[side];
  const axis = new THREE.Vector3(a[0], a[1], a[2]).normalize();
  const [ox, oz] = (garment === 'hoodie' ? HOODIE_SIDE_ANCHOR_XZ : SIDE_ANCHOR_XZ)[side];
  const origin = new THREE.Vector3(ox, place.baseY, oz);

  // Basis mengikuti pemirsa: up mengikuti +Y, right = (arah pandang) x up
  const up = new THREE.Vector3(0, 1, 0).addScaledVector(axis, -axis.y).normalize();
  const right = new THREE.Vector3().crossVectors(axis.clone().negate(), up).normalize();

  // Kaos: rentang geser slider asli (gx/100, produksi). Hoodie: slider -50..50 dipetakan
  // ke seluruh rentang pakaian (gx/50) karena panel hoodie lebih lebar dari kaos.
  const sliderDivisor = garment === 'hoodie' ? 50 : 100;
  origin.addScaledVector(right, (gx / sliderDivisor) * place.rangeX);
  origin.addScaledVector(up, -(gy / sliderDivisor) * place.rangeY);
  return { axis, origin, right, up };
}

export interface PrintTextureEntry {
  tex: THREE.Texture;
  aspect: number; // tinggi / lebar
}

/** Mengisi uniform tiap layer dari daftar gambar yang tampil. */
export function syncLayerUniforms(
  uniforms: PrintLayerUniforms[],
  graphics: GraphicSettings[],
  textures: Map<string, PrintTextureEntry>,
  technique: PrintTechniqueInfo,
  garment: GarmentModel = 'shirt'
) {
  const visible = graphics.filter((g) => g.visible && g.imageUrl).slice(0, MAX_GRAPHICS);

  uniforms.forEach((u, i) => {
    const g = visible[i];
    const entry = g ? textures.get(g.id) : undefined;
    if (!g || !entry) {
      u.uPrintOn.value = 0;
      return;
    }
    u.uPrintMap.value = entry.tex;

    const frame = getPrintFrame(g.side, g.x, g.y, garment);
    u.uPrintOrigin.value.copy(frame.origin);
    u.uPrintAxis.value.copy(frame.axis);
    u.uPrintRight.value.copy(frame.right);
    u.uPrintUp.value.copy(frame.up);

    // Ukuran dari rumus yang sama dengan tampilan 2D (placement.ts)
    const width = getModelPlacement(g.side, garment).baseWidth * g.scale;
    u.uPrintSize.value.set(width, width * entry.aspect);

    const channel = SIDE_ORDER.indexOf(g.side);
    u.uPrintSide.value.set(channel === 0 ? 1 : 0, channel === 1 ? 1 : 0, channel === 2 ? 1 : 0, channel === 3 ? 1 : 0);
    u.uPrintSeam.value = g.side === 'sleeve_left' ? 1 : g.side === 'sleeve_right' ? -1 : 0;

    // Rotasi positif = searah jarum jam bagi pemirsa
    u.uPrintRot.value = (g.rotation * Math.PI) / 180;
    u.uPrintRough.value = technique.id === 'plastisol' ? 0.35 : 0.8;
    u.uPrintOn.value = 1;
  });
}

/** Membuat tekstur sablon (filter tinta + opasitas sudah dipanggang). */
export async function buildPrintTexture(
  g: GraphicSettings,
  texW: number,
  anisotropy: number
): Promise<PrintTextureEntry> {
  const img = await getCachedImage(g.imageUrl);
  const natW = img.naturalWidth || img.width || 1;
  const natH = img.naturalHeight || img.height || 1;
  const texH = Math.max(64, Math.min(texW * 2, Math.round(texW * (natH / natW))));

  const c = document.createElement('canvas');
  c.width = texW;
  c.height = texH;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia');
  ctx.globalAlpha = g.opacity;
  ctx.drawImage(getFilteredSource(img, g.colorFilter, texW), 0, 0, texW, texH);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return { tex, aspect: texH / texW };
}

// ---------------------------------------------------------------------------
// Material & model
// ---------------------------------------------------------------------------
export function shirtBaseHex(color: TshirtColor): string {
  if (color.id === 'black') return '#121214';
  if (color.id === 'white') return '#F8F8FC';
  return color.hex;
}

export function shirtRoughness(color: TshirtColor, fabric: FabricInfo): number {
  if (color.id === 'black') return 0.88;
  return fabric.id === 'cotton_bamboo' ? 0.45 : 0.72;
}

/**
 * Menyiapkan model GLB: material kain + shader sablon + atribut visibilitas.
 * Mengembalikan mesh utama dan uniform yang dipakai semua layer.
 */
export function prepareShirtModel(
  model: THREE.Object3D,
  color: TshirtColor,
  fabric: FabricInfo
): { mesh: THREE.Mesh | null; uniforms: PrintLayerUniforms[] } {
  const uniforms = createPrintUniforms();
  let main: THREE.Mesh | null = null;

  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const orig = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (orig) {
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(shirtBaseHex(color)),
        roughness: shirtRoughness(color, fabric),
        metalness: 0.02,
        normalMap: orig.normalMap || null,
        normalScale: new THREE.Vector2(1.2, 1.2),
        side: THREE.DoubleSide
      });
      applyPrintShader(material, uniforms);
      attachPrintVisibility(mesh.geometry);
      mesh.material = material;
    }
    if (!main) main = mesh;
  });

  // Model dipusatkan secara vertikal
  model.position.set(0, 0.045, 0);
  return { mesh: main, uniforms };
}


/**
 * Prepare the high-poly pullover hoodie and compute print visibility across
 * all of its mesh parts so occlusion works across body, sleeves and hood.
 */
export function prepareHoodieModel(
  model: THREE.Object3D,
  color: TshirtColor,
  fabric: FabricInfo
): { mesh: THREE.Mesh | null; meshes: THREE.Mesh[]; uniforms: PrintLayerUniforms[] } {
  const uniforms = createPrintUniforms();
  // Enable coordinate-region clipping for hoodie projections only; ordinary
  // T-shirt placement keeps the pre-existing projection path unchanged.
  uniforms.forEach((u) => { u.uPrintRegion.value = 1; });
  const meshes: THREE.Mesh[] = [];

  // Bake every mesh's transforms into shared model-local coordinates first.
  model.updateMatrixWorld(true);
  const inverseRoot = model.matrixWorld.clone().invert();
  const parts: THREE.Mesh[] = [];
  model.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) parts.push(mesh);
  });

  const prepared: Array<{ mesh: THREE.Mesh; geometry: THREE.BufferGeometry; original: THREE.Material }> = [];
  const bounds = new THREE.Box3();
  for (const mesh of parts) {
    const relativeMatrix = inverseRoot.clone().multiply(mesh.matrixWorld);
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(relativeMatrix);
    geometry.computeBoundingBox();
    if (geometry.boundingBox) bounds.union(geometry.boundingBox);
    const original = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) ?? new THREE.MeshStandardMaterial();
    prepared.push({ mesh, geometry, original });
  }

  // Normalize the actual vertex coordinates (not only Object3D.scale), because
  // the print projection shader works in vertex-local coordinates.
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);
  const maxDimension = Math.max(size.x, size.y, size.z);
  const normalization = Number.isFinite(maxDimension) && size.y > 0 ? 0.82 / size.y : 1;

  for (const part of prepared) {
    const { geometry } = part;
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.scale(normalization, normalization, normalization);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  // Compute occlusion against the ENTIRE hoodie surface, not one mesh at a
  // time. The GLB splits body, sleeves, hood and details into separate meshes;
  // per-mesh visibility cannot see a sleeve/body panel that occludes another
  // panel, which lets back/sleeve artwork leak onto the front torso.
  const vertexOffsets: number[] = [];
  let totalVertices = 0;
  let totalIndices = 0;
  const indexArrays: ArrayLike<number>[] = [];
  for (const { geometry } of prepared) {
    const position = geometry.getAttribute('position');
    vertexOffsets.push(totalVertices);
    totalVertices += position?.count ?? 0;
    const index = geometry.getIndex();
    const count = index ? index.count : (position?.count ?? 0);
    totalIndices += count;
    if (index) {
      indexArrays.push(index.array as ArrayLike<number>);
    } else {
      const sequential = new Uint32Array(count);
      for (let i = 0; i < count; i++) sequential[i] = i;
      indexArrays.push(sequential);
    }
  }

  const allPositions = new Float32Array(totalVertices * 3);
  const allIndices = new Uint32Array(totalIndices);
  let indexCursor = 0;
  for (let p = 0; p < prepared.length; p++) {
    const geometry = prepared[p].geometry;
    const position = geometry.getAttribute('position');
    const offset = vertexOffsets[p];
    for (let i = 0; i < position.count; i++) {
      allPositions[(offset + i) * 3] = position.getX(i);
      allPositions[(offset + i) * 3 + 1] = position.getY(i);
      allPositions[(offset + i) * 3 + 2] = position.getZ(i);
    }
    const indices = indexArrays[p];
    for (let i = 0; i < indices.length; i++) allIndices[indexCursor++] = indices[i] + offset;
  }

  const allVisibility = new Float32Array(totalVertices * 4).fill(1);
  SIDE_ORDER.forEach((side, channel) => {
    const visible = computeAxisVisibility(allPositions, allIndices, SIDE_AXIS[side], {
      // Hoodie is normalized to ~0.82 units; a finer grid helps retain details
      // around the armholes without making the visibility test too permissive.
      cell: 0.008,
      eps: 0.004
    });
    for (let i = 0; i < totalVertices; i++) allVisibility[i * 4 + channel] = visible[i];
  });

  for (let p = 0; p < prepared.length; p++) {
    const { mesh, geometry, original } = prepared[p];
    const count = geometry.getAttribute('position').count;
    const offset = vertexOffsets[p];
    const localVisibility = allVisibility.slice(offset * 4, (offset + count) * 4);
    geometry.setAttribute('printVis', new THREE.BufferAttribute(localVisibility, 4));

    mesh.removeFromParent();
    mesh.geometry = geometry;
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    mesh.updateMatrix();
    model.add(mesh);

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const source = original as THREE.MeshStandardMaterial;
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(shirtBaseHex(color)),
      roughness: shirtRoughness(color, fabric),
      metalness: 0.02,
      // The source GLB albedo is baked nearly black; using it as a color map
      // multiplies every chosen garment color by black. Keep surface detail maps,
      // but let the selected fabric color drive the albedo.
      map: null,
      normalMap: source.normalMap || null,
      roughnessMap: source.roughnessMap || null,
      aoMap: source.aoMap || null,
      side: THREE.DoubleSide
    });
    applyPrintShader(material, uniforms);
    // Visibility was precomputed above across all hoodie meshes together.
    mesh.material = material;
    meshes.push(mesh);
  }

  // Vertices are already normalized and centered; keep the root transform neutral.
  model.position.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  return { mesh: meshes[0] ?? null, meshes, uniforms };
}
