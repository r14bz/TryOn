import { FabricInfo, PrintTechniqueInfo, PlacementPreset, GarmentSize } from '../types/sablon';

export const FABRICS: FabricInfo[] = [
  {
    id: 'combed_30s',
    name: 'Cotton Combed 30s',
    shortName: 'Combed 30s',
    gsm: '140 - 150 GSM',
    thickness: 2,
    softness: 4,
    breathability: 5,
    sheen: 0.12,
    roughness: 0.2,
    description: 'Bahan paling populer untuk clothing line & distro Indonesia. Serat benang halus, jatuh lemas, dan sangat sejuk untuk iklim tropis.',
    recommendedFor: 'T-shirt harian kasual, merchandise event, kaos santai.',
    basePrice: 45000,
    textureCharacteristics: 'Rajutan tenun benang rapat, permukaan lembut bebas bulu (biowash finish).'
  },
  {
    id: 'combed_24s',
    name: 'Cotton Combed 24s',
    shortName: 'Combed 24s',
    gsm: '175 - 185 GSM',
    thickness: 3,
    softness: 4,
    breathability: 4,
    sheen: 0.10,
    roughness: 0.3,
    description: 'Karakter kain lebih padat dan tebal dibanding 30s. Tidak tembus pandang, sangat stabil, dan mampu menopang tinta sablon plastisol dengan kokoh.',
    recommendedFor: 'Kaos distro premium, brand clothing lokal, kaos seragam komunitas.',
    basePrice: 52000,
    textureCharacteristics: 'Struktur rajutan kokoh dengan ketebalan medium, awet dicuci berulang kali.'
  },
  {
    id: 'heavyweight_16s',
    name: 'Heavyweight Cotton 16s',
    shortName: 'Heavyweight 16s',
    gsm: '235 - 250 GSM',
    thickness: 5,
    softness: 3,
    breathability: 3,
    sheen: 0.05,
    roughness: 0.75,
    description: 'Kain katun tebal bervolume tinggi khas streetwear boxy cut & oversized. Kaku, berbobot, memberi siluet tubuh yang tegas dan maskulin.',
    recommendedFor: 'Streetwear oversized, boxy fit tee, vintage graphic tee.',
    basePrice: 75000,
    textureCharacteristics: 'Tekstur serat benang kasar artistik, solid, tahan kusut, dan sangat berkarakter.'
  },
  {
    id: 'cotton_bamboo',
    name: 'Cotton Bamboo (Serat Bambu)',
    shortName: 'Cotton Bamboo',
    gsm: '160 GSM',
    thickness: 2,
    softness: 5,
    breathability: 5,
    sheen: 0.35,
    roughness: 0.1,
    description: 'Kombinasi katun premium dan serat bambu alami. Memiliki sifat anti-bakteri alami, sangat adem, serta kilau halus elegan (silky luster).',
    recommendedFor: 'Apparel eksklusif, kulit sensitif, kaos basic luxury.',
    basePrice: 65000,
    textureCharacteristics: 'Drape jatuh sangat luwes, permukaan ultra-halus dengan kilau cahaya lembut.'
  },
  {
    id: 'slub_cotton',
    name: 'Slub Cotton / Pique Vintage',
    shortName: 'Slub Cotton',
    gsm: '165 GSM',
    thickness: 3,
    softness: 4,
    breathability: 4,
    sheen: 0.08,
    roughness: 0.65,
    description: 'Ditenun dengan benang slub berdiameter tidak merata, menciptakan corak garis-garis melintang alami bertekstur vintage estetik.',
    recommendedFor: 'Kaos bergaya retro/vintage, washed tee, brand indie.',
    basePrice: 58000,
    textureCharacteristics: 'Garis serat alami tampak kasat mata, memberi aksen tekstur unik saat diraba.'
  }
];

export const PRINT_TECHNIQUES: PrintTechniqueInfo[] = [
  {
    id: 'dtf',
    name: 'Direct to Film (DTF)',
    tagline: 'Full Color & Gradasi Foto Presisi',
    description: 'Teknologi cetak transfer film digital termutakhir. Mampu mereproduksi foto gradasi, jutaan warna, dan detail micro dengan kontras tajam.',
    finishType: 'semi-gloss',
    durability: 'Hingga 50+ kali cuci, elastis tidak mudah retak.',
    minOrder: 1,
    costModifier: 25000
  },
  {
    id: 'plastisol',
    name: 'Plastisol Screen Printing (HD)',
    tagline: 'Standar Emas Distro Manual',
    description: 'Tinta berbasis minyak (PVC) yang dipanaskan suhu tinggi. Hasil cetak timbul bertekstur mantap, warna sangat pekat dengan highlight kilau khas sablon premium.',
    finishType: 'high-gloss-raised',
    durability: 'Sangat awet puluhan tahun, warna tidak akan luntur.',
    minOrder: 12,
    costModifier: 30000
  },
  {
    id: 'rubber',
    name: 'Rubber GL (Water-Based)',
    tagline: 'Elastis & Halus Menyatu Kain',
    description: 'Tinta sablon berbahan dasar air yang lentur. Menyerap halus ke pori-pori kain, nyaman dipakai sehari-hari tanpa terasa kaku di dada.',
    finishType: 'matte-soft',
    durability: 'Tahan lama dan lentur mengikuti tarikan kaos.',
    minOrder: 12,
    costModifier: 20000
  },
  {
    id: 'discharge',
    name: 'Discharge (Cabut Warna)',
    tagline: 'No-Feel Soft Print Vintage',
    description: 'Teknik kimia khusus yang meremajakan warna asli kain gelap menjadi putih/warna baru. Tinta sama sekali tidak terasa timbul (nol rasa di tangan).',
    finishType: 'no-feel-vintage',
    durability: 'Permanen abadi seumur hidup kain katun.',
    minOrder: 24,
    costModifier: 35000
  },
  {
    id: 'bordir',
    name: 'Bordir Komputer Presisi',
    tagline: 'Sulaman Benang Mewah Timbul',
    description: 'Sulaman rajut benang polyester berkualitas tinggi. Menampilkan tekstur garis benang timbul 3D yang sangat elegan dan eksklusif.',
    finishType: 'thread-stitch',
    durability: 'Sulaman benang permanen tidak akan pernah pudar.',
    minOrder: 12,
    costModifier: 28000
  }
];

export const PLACEMENT_PRESETS: PlacementPreset[] = [
  {
    id: 'chest_left',
    name: 'Dada Kiri / Saku (8 × 8 cm)',
    side: 'front',
    dimensionsCm: { width: 8, height: 8 },
    defaultScale: 0.35,
    defaultX: -22,
    defaultY: -16
  },
  {
    id: 'chest_center',
    name: 'Dada Tengah A5 (15 × 21 cm)',
    side: 'front',
    dimensionsCm: { width: 15, height: 21 },
    defaultScale: 0.65,
    defaultX: 0,
    defaultY: -12
  },
  {
    id: 'front_a4',
    name: 'Depan Standar A4 (21 × 30 cm)',
    side: 'front',
    dimensionsCm: { width: 21, height: 30 },
    defaultScale: 0.95,
    defaultX: 0,
    defaultY: -4
  },
  {
    id: 'front_a3',
    name: 'Full Front A3 (30 × 42 cm)',
    side: 'front',
    dimensionsCm: { width: 30, height: 42 },
    defaultScale: 1.35,
    defaultX: 0,
    defaultY: 2
  },
  {
    id: 'back_a3',
    name: 'Punggung A3 Back (30 × 42 cm)',
    side: 'back',
    dimensionsCm: { width: 30, height: 42 },
    defaultScale: 1.35,
    defaultX: 0,
    defaultY: 0
  },
  {
    id: 'back_neck',
    name: 'Tengkuk Belakang (6 × 6 cm)',
    side: 'back',
    dimensionsCm: { width: 6, height: 6 },
    defaultScale: 0.28,
    defaultX: 0,
    defaultY: -32
  },
  {
    id: 'sleeve_left',
    name: 'Lengan Atas Kiri (8 × 8 cm)',
    side: 'sleeve_left',
    dimensionsCm: { width: 8, height: 8 },
    defaultScale: 0.45,
    defaultX: 0,
    defaultY: -5
  },
  {
    id: 'sleeve_right',
    name: 'Lengan Atas Kanan (8 × 8 cm)',
    side: 'sleeve_right',
    dimensionsCm: { width: 8, height: 8 },
    defaultScale: 0.45,
    defaultX: 0,
    defaultY: -5
  },
  {
    id: 'custom',
    name: 'Custom Bebas (Drag & Resize)',
    side: 'front',
    dimensionsCm: { width: 20, height: 20 },
    defaultScale: 0.85,
    defaultX: 0,
    defaultY: 0
  }
];

export const GARMENT_SIZES: GarmentSize[] = [
  { size: 'S', chestWidthCm: 48, bodyLengthCm: 68 },
  { size: 'M', chestWidthCm: 50, bodyLengthCm: 70 },
  { size: 'L', chestWidthCm: 53, bodyLengthCm: 73 },
  { size: 'XL', chestWidthCm: 56, bodyLengthCm: 76 },
  { size: 'XXL', chestWidthCm: 60, bodyLengthCm: 78 }
];
