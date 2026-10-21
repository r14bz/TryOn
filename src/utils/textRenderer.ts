import type { TextSpec } from '../types/sablon';
import { ensureFontLoaded, getTextFont } from '../data/textFonts';

const BASE_SIZE = 200; // px tinggi font saat dirender; hasil diperkecil jika terlalu lebar
const MAX_WIDTH = 2048;
const MAX_LINES = 5;

/** Nama layer dari isi teks, mis. `Teks: KUSTOM SABLON`. */
export const textLayerName = (spec: TextSpec): string => {
  const first = spec.content.split('\n').find((l) => l.trim()) ?? '';
  return `Teks: ${first.trim().slice(0, 24)}`;
};

/**
 * Merender teks menjadi gambar PNG transparan (dipangkas rapat) yang dipakai seperti gambar sablon
 * biasa di 3D, 2D, dan ekspor.
 */
export async function renderTextToDataUrl(spec: TextSpec): Promise<string> {
  const font = getTextFont(spec.fontId);
  await ensureFontLoaded(font);

  const lines = spec.content.replace(/\r/g, '').split('\n').slice(0, MAX_LINES);
  const cssFont = `${font.style} ${font.weight} ${BASE_SIZE}px "${font.family}"`;
  const spacing = (spec.letterSpacing / 100) * BASE_SIZE;
  const strokePx = spec.outlineColor ? (spec.outlineWidth / 100) * BASE_SIZE : 0;

  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) throw new Error('Canvas 2D tidak tersedia');
  mctx.font = cssFont;

  // Lebar baris; jarak antar huruf dihitung manual agar konsisten di semua browser
  const lineWidth = (text: string): number => {
    if (spacing === 0) return mctx.measureText(text).width;
    let w = 0;
    for (const ch of text) w += mctx.measureText(ch).width + spacing;
    return Math.max(0, w - spacing);
  };
  const widths = lines.map(lineWidth);
  const maxW = Math.max(1, ...widths);

  const ref = mctx.measureText('Hg');
  const ascent = ref.actualBoundingBoxAscent || BASE_SIZE * 0.8;
  const descent = ref.actualBoundingBoxDescent || BASE_SIZE * 0.22;
  const lineH = (ascent + descent) * 1.08;
  const pad = Math.ceil(strokePx / 2 + BASE_SIZE * 0.06);

  const w = Math.ceil(maxW + pad * 2);
  const h = Math.ceil(lineH * lines.length - (lineH - ascent - descent) + pad * 2);
  const shrink = Math.min(1, MAX_WIDTH / w);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * shrink));
  canvas.height = Math.max(1, Math.round(h * shrink));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D tidak tersedia');
  ctx.scale(shrink, shrink);
  ctx.font = cssFont;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.lineWidth = strokePx;
  ctx.strokeStyle = spec.outlineColor ?? '#000000';
  ctx.fillStyle = spec.color;

  const drawLine = (text: string, x: number, y: number) => {
    if (spacing === 0) {
      if (strokePx > 0) ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
      return;
    }
    let cx = x;
    for (const ch of text) {
      if (strokePx > 0) ctx.strokeText(ch, cx, y);
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + spacing;
    }
  };

  lines.forEach((text, i) => {
    const y = pad + ascent + i * lineH;
    const free = maxW - widths[i];
    const x = pad + (spec.align === 'center' ? free / 2 : spec.align === 'right' ? free : 0);
    drawLine(text, x, y);
  });

  return canvas.toDataURL('image/png');
}
