import type { GarmentModel, PlacementSide } from '../types/sablon';

/**
 * Satu sumber kebenaran untuk posisi & ukuran sablon di tampilan 2D DAN 3D.
 *
 * Nilai (x, y, scale) di GraphicSettings selalu berarti hal yang sama:
 * pecahan dari badan kaos. Tampilan 2D membacanya sebagai pecahan kanvas foto,
 * tampilan 3D mengubahnya ke satuan model lewat proporsi kaos di bawah ini,
 * sehingga gambar jatuh di bagian kaos yang sama pada keduanya.
 */

/** Proporsi kaos pada foto 2D (pecahan kanvas 1024x1024, diukur dari mask siluet). */
export const PHOTO_LAYOUT = {
  /** lebar badan (tanpa lengan) */
  torsoWidth: 0.52,
  /** tepi atas kaos (bahu / kerah) */
  shirtTop: 0.109,
  /** tepi bawah kaos (hem) */
  shirtBottom: 0.891,
  /** posisi vertikal pusat sablon badan saat y = 0 */
  bodyCenterY: 0.48,
  /** lebar sablon badan pada scale 1 */
  bodyBaseWidth: 0.38,
  /** geser maksimum sablon badan (x/y = +-100%) */
  bodyRange: 0.4,
  /** posisi vertikal pusat sablon lengan saat y = 0 */
  sleeveCenterY: 0.31,
  /** jarak pusat lengan dari tengah foto */
  sleeveCenterOffsetX: 0.335,
  /** lebar sablon lengan pada scale 1 */
  sleeveBaseWidth: 0.15,
  /** geser maksimum sablon lengan */
  sleeveRange: 0.3
} as const;

/** Proporsi kaos pada model 3D (satuan mentah GLB, diukur dari mesh shirt_baked.glb). JANGAN diubah: ini nilai produksi kaos. */
export const MODEL_LAYOUT = {
  /** lebar badan di area dada/perut */
  torsoWidth: 0.305,
  /** titik tertinggi kaos (bahu / kerah) */
  top: 0.261,
  /** titik terendah kaos (hem) */
  bottom: -0.352
} as const;

/** Proporsi hoodie pada mesh yang dinormalisasi ke tinggi 0.82 (lihat prepareHoodieModel). */
export const HOODIE_MODEL_LAYOUT = {
  /** Lebar badan hoodie pada mesh yang sudah dinormalisasi (bukan ukuran foto kaos). */
  torsoWidth: 0.39,
  /** Titik tertinggi hoodie (termasuk tudung); sablon badan tetap dibatasi oleh panel shader. */
  top: 0.41,
  /** Titik terendah hoodie setelah normalisasi ke tinggi 0.82 unit. */
  bottom: -0.41
} as const;

export interface ModelPlacement {
  /** lebar sablon (satuan model) pada scale 1 */
  baseWidth: number;
  /** tinggi pusat sablon (satuan model) saat y = 0 */
  baseY: number;
  /** jarak geser horizontal untuk x = 100% (satuan model) */
  rangeX: number;
  /** jarak geser vertikal untuk y = 100% (satuan model) */
  rangeY: number;
}

const shirtHeight2D = PHOTO_LAYOUT.shirtBottom - PHOTO_LAYOUT.shirtTop;

interface GarmentScale {
  layout: { readonly torsoWidth: number; readonly top: number; readonly bottom: number };
  height3D: number;
  /** satuan model per 1 lebar-badan-foto */
  widthToModel: number;
  /** satuan model per 1 tinggi-kanvas-foto */
  heightToModel: number;
}

function makeGarmentScale(layout: GarmentScale['layout']): GarmentScale {
  const height3D = layout.top - layout.bottom;
  return {
    layout,
    height3D,
    widthToModel: layout.torsoWidth / PHOTO_LAYOUT.torsoWidth,
    heightToModel: height3D / shirtHeight2D
  };
}

const GARMENT_SCALE: Record<GarmentModel, GarmentScale> = {
  shirt: makeGarmentScale(MODEL_LAYOUT),
  hoodie: makeGarmentScale(HOODIE_MODEL_LAYOUT)
};

/** Tinggi di model 3D yang setara dengan posisi vertikal `photoY` (pecahan kanvas foto). */
function photoYToModelY(photoY: number, garment: GarmentModel): number {
  const g = GARMENT_SCALE[garment];
  const fromTop = (photoY - PHOTO_LAYOUT.shirtTop) / shirtHeight2D;
  return g.layout.top - fromTop * g.height3D;
}

export function isSleeveSide(side: PlacementSide): boolean {
  return side === 'sleeve_left' || side === 'sleeve_right';
}

/** Padanan 3D dari rumus penempatan 2D (lihat getPrintPlacement di fabricRenderer). */
export function getModelPlacement(side: PlacementSide, garment: GarmentModel = 'shirt'): ModelPlacement {
  const { widthToModel, heightToModel } = GARMENT_SCALE[garment];
  const sleeve = isSleeveSide(side);
  const baseWidth = sleeve ? PHOTO_LAYOUT.sleeveBaseWidth : PHOTO_LAYOUT.bodyBaseWidth;
  const range = sleeve ? PHOTO_LAYOUT.sleeveRange : PHOTO_LAYOUT.bodyRange;
  const centerY = sleeve ? PHOTO_LAYOUT.sleeveCenterY : PHOTO_LAYOUT.bodyCenterY;
  return {
    baseWidth: baseWidth * widthToModel,
    baseY: photoYToModelY(centerY, garment),
    rangeX: range * widthToModel,
    rangeY: range * heightToModel
  };
}
