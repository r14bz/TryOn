import type { GraphicSettings } from '../types/sablon';
import { getModelPlacement } from './placement';
import { HOODIE_2D } from '../data/hoodieConfig';

import whiteFrontUrl from '../assets/hoodie/hoodie_white_front.jpg';
import whiteBackUrl from '../assets/hoodie/hoodie_white_back.jpg';
import blackFrontUrl from '../assets/hoodie/hoodie_black_front.jpg';
import blackBackUrl from '../assets/hoodie/hoodie_black_back.jpg';
import maskFrontUrl from '../assets/hoodie/mask_front.png';
import maskBackUrl from '../assets/hoodie/mask_back.png';
import regionsFrontUrl from '../assets/hoodie/regions_front.png';
import regionsBackUrl from '../assets/hoodie/regions_back.png';

/** Foto dasar hoodie (putih dipakai untuk semua warna selain hitam, seperti kaos). */
export const HOODIE_PHOTOS = {
  white_front: whiteFrontUrl,
  white_back: whiteBackUrl,
  black_front: blackFrontUrl,
  black_back: blackBackUrl
};

/** Mask siluet (R = cakupan kain). Foto hitam dan putih berasal dari render yang sama, jadi masknya sama. */
export const HOODIE_MASKS = {
  front: maskFrontUrl,
  back: maskBackUrl
};

/**
 * Peta area yang boleh dicetak per tampilan: R = badan (depan+kantong atau belakang),
 * G = lengan kiri pemakai (+x), B = lengan kanan pemakai (-x). Tudung, tali, rib tidak termasuk.
 */
export const HOODIE_REGIONS = {
  front: regionsFrontUrl,
  back: regionsBackUrl
};

export interface Placement2D {
  cx: number;
  cy: number;
  printW: number;
  printH: number;
  /** putaran tambahan (derajat) di luar graphic.rotation, mis. mengikuti arah lengan */
  extraRot: number;
}

/**
 * Penempatan sablon pada foto hoodie 2D. Render Virtual Pandora punya aspek rasio berbeda dari model 3D repo,
 * jadi digunakan ppuX dan ppuY terpisah untuk pemetaan yang akurat.
 * Badan: proyeksi langsung dari repo model space ke pixel. Lengan: anchor pixel dari region map (diukur).
 */
export function getHoodiePlacement2D(
  width: number,
  height: number,
  aspect: number,
  graphic: GraphicSettings
): Placement2D {
  const ppuX = HOODIE_2D.ppuX * (width / 1024);
  const ppuY = HOODIE_2D.ppuY * (width / 1024);
  const place = getModelPlacement(graphic.side, 'hoodie');
  const printW = place.baseWidth * graphic.scale * ppuX;
  const printH = printW * aspect;
  const cx0 = width / 2;
  const cy0 = height / 2;

  if (graphic.side === 'sleeve_left' || graphic.side === 'sleeve_right') {
    // Lengan pada foto Virtual Pandora: diukur dari region map PNG channel G/B.
    // Mid-arm (y ≈ 620 di 1024 canvas): left sleeve cx ≈ 732, right sleeve cx ≈ 292 (±220 dari center).
    // Slider offset menggunakan rangeX/Y dari placement.ts, dikalikan ppuX/ppuY.
    const sign = graphic.side === 'sleeve_left' ? 1 : -1;
    const cx_base = cx0 + sign * 220;
    const cy_base = cy0 + 108; // mid-arm vertical: 620 - 512 = 108 px offset
    const rangeX_px = place.rangeX * ppuX;
    const rangeY_px = place.rangeY * ppuY;
    const cx = cx_base + (graphic.x / 50) * rangeX_px;
    const cy = cy_base + (graphic.y / 50) * rangeY_px;
    return { cx, cy, printW, printH, extraRot: 0 };
  }

  // Badan. Pemetaan langsung dari repo model space ke pixel dengan ppuX/ppuY terpisah.
  const X = (graphic.x / 50) * place.rangeX;
  const Y = place.baseY - (graphic.y / 50) * place.rangeY;
  const cx = cx0 + X * ppuX;
  const cy = cy0 - Y * ppuY;
  return { cx, cy, printW, printH, extraRot: 0 };
}

/**
 * Mengubah seretan jari (piksel layar) menjadi perubahan slider x/y (persen) untuk hoodie.
 * Memakai Jacobian numerik dari getHoodiePlacement2D sehingga berlaku untuk badan dan lengan.
 */
export function solveHoodieDrag(
  width: number,
  height: number,
  aspect: number,
  graphic: GraphicSettings,
  dxPx: number,
  dyPx: number
): { dx: number; dy: number } {
  const h = 1; // 1 persen
  const base = getHoodiePlacement2D(width, height, aspect, graphic);
  const px = getHoodiePlacement2D(width, height, aspect, { ...graphic, x: graphic.x + h });
  const py = getHoodiePlacement2D(width, height, aspect, { ...graphic, y: graphic.y + h });
  const a = (px.cx - base.cx) / h; // d(cx)/d(x%)
  const c = (px.cy - base.cy) / h;
  const b = (py.cx - base.cx) / h; // d(cx)/d(y%)
  const d = (py.cy - base.cy) / h;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-6) return { dx: 0, dy: 0 };
  return { dx: (d * dxPx - b * dyPx) / det, dy: (-c * dxPx + a * dyPx) / det };
}
