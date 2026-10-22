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
 * Penempatan sablon pada foto hoodie 2D, dihitung dari satuan model 3D yang sama dengan tampilan 3D
 * (getModelPlacement) sehingga sablon jatuh di tempat yang sama di 2D dan 3D.
 * Badan: proyeksi lurus. Lengan: titik pada permukaan lengan yang sudah ditekuk seperti pada foto.
 */
export function getHoodiePlacement2D(
  width: number,
  height: number,
  aspect: number,
  graphic: GraphicSettings
): Placement2D {
  const ppu = HOODIE_2D.ppu * (width / 1024);
  const place = getModelPlacement(graphic.side, 'hoodie');
  const printW = place.baseWidth * graphic.scale * ppu;
  const printH = printW * aspect;
  const cx0 = width / 2;
  const cy0 = height / 2;

  if (graphic.side === 'sleeve_left' || graphic.side === 'sleeve_right') {
    // Virtual Pandora 2D render: lengan di x ±~0.177, y ≈ 0.583 (render center 0.543 + offset)
    // Posisi dihitung langsung di ruang render 2D, bukan transformasi dari 3D model.
    const sleeveX = 0.177; // setengah lebar lengan di Virtual Pandora (dari make_regions.py HW=182, 512px=0.177)
    const sleeveY = 0.583; // tinggi lengan di model render (bahu-bawah)
    const sign = graphic.side === 'sleeve_left' ? 1 : -1;
    const X = sleeveX * sign + (graphic.x / 50) * place.rangeX;
    const Y = sleeveY - (graphic.y / 50) * place.rangeY;
    const Y_2d = Y - 0.543; // shift ke koordinat render
    return { cx: cx0 + X * ppu, cy: cy0 - Y_2d * ppu, printW, printH, extraRot: 0 };
  }

  // Badan. Model 2D render (Virtual Pandora) berpusat pada y=0.543, bukan y=0 seperti model 3D.
  // Tambahkan offset 0.543 agar body placement jatuh di vertikal yang tepat.
  const X = (graphic.x / 50) * place.rangeX;
  const Y = place.baseY - (graphic.y / 50) * place.rangeY;
  const Y_2d = Y - 0.543; // shift ke koordinat render 2D
  return { cx: cx0 + X * ppu, cy: cy0 - Y_2d * ppu, printW, printH, extraRot: 0 };
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
