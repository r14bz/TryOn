import type { GraphicSettings } from '../types/sablon';
import { getModelPlacement } from './placement';
import { HOODIE_2D, HOODIE_SLEEVE } from '../data/hoodieConfig';

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

type Vec3 = [number, number, number];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
/** bobot tekuk pada jarak `along` dari bahu. Model baru: bend=0, lengan lurus. */
const bendAngle = (along: number) => HOODIE_2D.bend;

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
    const sign = graphic.side === 'sleeve_left' ? 1 : -1;
    const cfg = graphic.side === 'sleeve_left' ? HOODIE_SLEEVE.left : HOODIE_SLEEVE.right;
    const A: Vec3 = [cfg.axis[0], cfg.axis[1], cfg.axis[2]];
    const R0: Vec3 = [cfg.facing[0], cfg.facing[1], cfg.facing[2]];
    const right0 = cross(R0, A);
    const t = HOODIE_SLEEVE.alongStart + (graphic.y / 50) * place.rangeY;
    const phi = (graphic.x / 50) * HOODIE_SLEEVE.maxAngle;
    const r = HOODIE_SLEEVE.armRadius;
    // Pada foto, lengan dilihat dari depan: sablon berada di tengah lebar lengan saat slider
    // Kiri/Kanan = 0, lalu bergeser melintang lengan sebesar r*sin(sudut) (lengan belum ditekuk)
    const v: Vec3 = [
      t * A[0] + r * Math.sin(phi) * right0[0],
      t * A[1] + r * Math.sin(phi) * right0[1],
      0
    ];
    const psi = bendAngle(t);
    const cb = Math.cos(psi);
    const sb = Math.sin(psi);
    const vx = v[0] * sign;
    const px = cfg.point[0] + (vx * cb + v[1] * sb) * sign;
    const py = cfg.point[1] + (-vx * sb + v[1] * cb);
    // arah "atas" gambar = ke arah bahu, ikut tertekuk
    const ax = -A[0] * sign;
    const ay = -A[1];
    const ux = (ax * cb + ay * sb) * sign;
    const uy = -ax * sb + ay * cb;
    return {
      cx: cx0 + px * ppu,
      cy: cy0 - py * ppu,
      printW,
      printH,
      extraRot: (Math.atan2(ux, uy) * 180) / Math.PI
    };
  }

  // Badan. Posisi "kanan" layar sama di tampak depan maupun belakang (lihat getPrintFrame).
  const X = (graphic.x / 50) * place.rangeX;
  const Y = place.baseY - (graphic.y / 50) * place.rangeY;
  return { cx: cx0 + X * ppu, cy: cy0 - Y * ppu, printW, printH, extraRot: 0 };
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
