import { FabricInfo, TshirtColor, GraphicSettings, PrintTechniqueInfo, GarmentModel } from '../types/sablon';
import type { LayerCanvas } from './exportFormats';
import {
  ShirtSide,
  loadPrintLayers,
  prepareShirtAssets,
  renderPrintGraphic,
  renderRealisticTshirt
} from './fabricRenderer';

/** Base resolution of the shirt photos; export multiplies this. */
export const BASE_SIZE = 1024;

export type ExportMode = 'mockup' | 'design' | '3d';
export type ExportBackground = 'transparent' | 'white' | 'black';
export type ExportFormat = 'png' | 'jpeg' | 'pdf' | 'psd' | 'svg';

export interface ExportOptions {
  mode: ExportMode;
  views: ShirtSide[];
  scale: 1 | 2 | 3 | 4; // output = 1024 * scale px
  background: ExportBackground;
  format: ExportFormat;
}

export interface ExportContext {
  fabric: FabricInfo;
  color: TshirtColor;
  technique: PrintTechniqueInfo;
  graphics: GraphicSettings[];
  /** model pakaian; kosong = kaos */
  garment?: GarmentModel;
}

/** Renders one view at high resolution and returns the canvas. */
export async function renderExportCanvas(
  view: ShirtSide,
  opts: ExportOptions,
  data: ExportContext
): Promise<HTMLCanvasElement> {
  if (opts.mode === '3d') {
    // Mode 3D dirender oleh export3d.ts (WebGL), bukan oleh renderer foto 2D
    throw new Error('renderExportCanvas tidak menangani mode 3D');
  }
  const size = BASE_SIZE * opts.scale;
  const layers = await loadPrintLayers(data.graphics, view);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // JPG has no alpha: fall back to white
  const bg: ExportBackground =
    opts.format === 'jpeg' && opts.background === 'transparent' ? 'white' : opts.background;

  if (opts.mode === 'mockup') {
    const assets = await prepareShirtAssets(view, data.color.id === 'black', BASE_SIZE, BASE_SIZE, data.garment ?? 'shirt');
    renderRealisticTshirt(
      ctx,
      BASE_SIZE,
      BASE_SIZE,
      assets,
      data.color,
      data.fabric,
      bg === 'transparent',
      bg === 'black' ? 'black' : 'white',
      layers,
      data.technique,
      opts.scale
    );
  } else {
    // Artwork only (no shirt): every layer at its placement, full resolution
    if (bg === 'transparent') {
      ctx.clearRect(0, 0, size, size);
    } else {
      ctx.fillStyle = bg === 'black' ? '#09090b' : '#FFFFFF';
      ctx.fillRect(0, 0, size, size);
    }
    for (const l of layers) {
      renderPrintGraphic(ctx, size, size, l.img, l.graphic, data.technique, data.fabric, data.color, opts.scale, data.garment ?? 'shirt');
    }
  }
  return canvas;
}

/** Kotak terkecil yang memuat semua piksel tidak transparan; null jika kosong. */
function alphaBounds(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Setiap gambar sablon pada sisi ini menjadi satu layer: dirender datar pada posisinya (tanpa
 * pengaruh lipatan kain), lalu dipangkas rapat. Dipakai untuk PSD dan SVG berlapis.
 */
export async function renderGraphicLayers(
  view: ShirtSide,
  scale: 1 | 2 | 3 | 4,
  data: ExportContext
): Promise<LayerCanvas[]> {
  const size = BASE_SIZE * scale;
  const layers = await loadPrintLayers(data.graphics, view);
  const out: LayerCanvas[] = [];
  for (const l of layers) {
    const full = document.createElement('canvas');
    full.width = size;
    full.height = size;
    const ctx = full.getContext('2d')!;
    renderPrintGraphic(ctx, size, size, l.img, l.graphic, data.technique, data.fabric, data.color, scale, data.garment ?? 'shirt');
    const box = alphaBounds(full);
    if (!box) continue;
    const crop = document.createElement('canvas');
    crop.width = box.w;
    crop.height = box.h;
    crop.getContext('2d')!.drawImage(full, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    full.width = 0;
    full.height = 0;
    out.push({ name: l.graphic.imageName || 'Sablon', canvas: crop, x: box.x, y: box.y });
  }
  return out;
}

/** Foto pakaian saja (tanpa sablon) dengan latar transparan, untuk layer dasar PSD. */
export async function renderGarmentLayer(
  view: ShirtSide,
  scale: 1 | 2 | 3 | 4,
  data: ExportContext
): Promise<HTMLCanvasElement> {
  const size = BASE_SIZE * scale;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const assets = await prepareShirtAssets(view, data.color.id === 'black', BASE_SIZE, BASE_SIZE, data.garment ?? 'shirt');
  renderRealisticTshirt(canvas.getContext('2d')!, BASE_SIZE, BASE_SIZE, assets, data.color, data.fabric, true, 'white', [], data.technique, scale);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, format: ExportFormat): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Gagal membuat file gambar (memori browser tidak cukup?)'))),
      format === 'jpeg' ? 'image/jpeg' : 'image/png',
      0.95
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
