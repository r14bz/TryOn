export type FabricTypeId = 
  | 'combed_30s' 
  | 'combed_24s' 
  | 'heavyweight_16s' 
  | 'cotton_bamboo' 
  | 'slub_cotton';

export interface FabricInfo {
  id: FabricTypeId;
  name: string;
  shortName: string;
  gsm: string;
  thickness: 1 | 2 | 3 | 4 | 5;
  softness: 1 | 2 | 3 | 4 | 5;
  breathability: 1 | 2 | 3 | 4 | 5;
  sheen: number; // 0 to 1 (specular reflect)
  roughness: number; // micro-texture grain
  description: string;
  recommendedFor: string;
  basePrice: number; // IDR
  textureCharacteristics: string;
}

export interface TshirtColor {
  id: string;
  name: string;
  hex: string;
  category: 'monochrome' | 'earth' | 'streetwear' | 'pastel';
  dark: boolean;
}

export type PrintTechniqueId = 'dtf' | 'plastisol' | 'rubber' | 'discharge' | 'bordir';

export interface PrintTechniqueInfo {
  id: PrintTechniqueId;
  name: string;
  tagline: string;
  description: string;
  finishType: 'semi-gloss' | 'high-gloss-raised' | 'matte-soft' | 'no-feel-vintage' | 'thread-stitch';
  durability: string;
  minOrder: number;
  costModifier: number;
}

export type PlacementSide = 'front' | 'back' | 'sleeve_left' | 'sleeve_right';

export type PlacementPresetId = 
  | 'chest_left' 
  | 'chest_center' 
  | 'front_a4' 
  | 'front_a3' 
  | 'back_a3' 
  | 'back_neck' 
  | 'sleeve_left' 
  | 'sleeve_right' 
  | 'custom';

export interface PlacementPreset {
  id: PlacementPresetId;
  name: string;
  side: PlacementSide;
  dimensionsCm: { width: number; height: number };
  defaultScale: number;
  defaultX: number; // percentage offset -50 to 50
  defaultY: number; // percentage offset -50 to 50
}

export const MAX_GRAPHICS = 6;

export interface GraphicSettings {
  id: string;
  visible: boolean;
  imageUrl: string;
  imageName: string;
  side: PlacementSide;
  x: number; // percentage -50 to 50
  y: number; // percentage -50 to 50
  scale: number; // 0.2 to 2.5
  rotation: number; // degrees -180 to 180
  opacity: number; // 0.2 to 1.0
  blendMode: 'normal' | 'multiply' | 'hard-light' | 'overlay';
  colorFilter: 'original' | 'monochrome_white' | 'monochrome_black' | 'vintage_warm';
  preset: PlacementPresetId;
}

export type StudioBgColor = 'white' | 'black';

export interface GarmentSize {
  size: 'S' | 'M' | 'L' | 'XL' | 'XXL';
  chestWidthCm: number;
  bodyLengthCm: number;
}
