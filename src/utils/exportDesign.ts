import { FabricInfo, TshirtColor, GraphicSettings, PrintTechniqueInfo } from '../types/sablon';
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
export type ExportFormat = 'png' | 'jpeg';

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
    const assets = await prepareShirtAssets(view, data.color.id === 'black', BASE_SIZE, BASE_SIZE);
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
      renderPrintGraphic(ctx, size, size, l.img, l.graphic, data.technique, data.fabric, data.color, opts.scale);
    }
  }
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, format: ExportFormat): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Gagal membuat file gambar (memori browser tidak cukup?)'))),
      format === 'png' ? 'image/png' : 'image/jpeg',
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
