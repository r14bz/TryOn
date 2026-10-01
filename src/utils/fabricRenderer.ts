import { FabricInfo, TshirtColor, GraphicSettings, PrintTechniqueInfo, StudioBgColor } from '../types/sablon';
import blackFrontUrl from '../assets/images/tshirt_black_front_1790758501022.jpg';
import blackBackUrl from '../assets/images/tshirt_black_back_1790758517353.jpg';
import whiteFrontUrl from '../assets/images/tshirt_white_front_1790758537680.jpg';
import whiteBackUrl from '../assets/images/tshirt_white_back_1790758582809.jpg';
import maskBlackFrontUrl from '../assets/masks/black_front.png';
import maskBlackBackUrl from '../assets/masks/black_back.png';
import maskWhiteFrontUrl from '../assets/masks/white_front.png';
import maskWhiteBackUrl from '../assets/masks/white_back.png';

// Image cache to avoid re-loading on every frame
const imageCache = new Map<string, HTMLImageElement>();

export function getCachedImage(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

// Pristine studio catalog image assets
export const TSHIRT_ASSETS = {
  black_front: blackFrontUrl,
  black_back: blackBackUrl,
  white_front: whiteFrontUrl,
  white_back: whiteBackUrl
};

// Pre-computed silhouette masks: one per photo (each photo has its own pose/shape,
// so a mask must never be shared between the black and the white photo).
export const MASK_ASSETS = {
  black_front: maskBlackFrontUrl,
  black_back: maskBlackBackUrl,
  white_front: maskWhiteFrontUrl,
  white_back: maskWhiteBackUrl
};

export type ShirtSide = 'front' | 'back';

/** Per-photo data needed to render the 2D shirt (photo, silhouette alpha, cloth-fold maps). */
export interface ShirtRenderAssets {
  baseImg: HTMLImageElement;
  mask: Uint8Array; // 0..255 garment coverage, width*height
  fold: FoldMaps;
}

/** Cloth-fold information derived from the photo, used to make prints follow the fabric. */
export interface FoldMaps {
  shade: Int16Array; // relative brightness of folds, x1000
  dx: Int16Array; // displacement (px) x256
  dy: Int16Array;
}

const alphaCache = new Map<string, Uint8Array>();
const foldCache = new Map<string, FoldMaps>();

async function getMaskAlpha(url: string, width: number, height: number): Promise<Uint8Array> {
  const key = `${url}_${width}_${height}`;
  const hit = alphaCache.get(key);
  if (hit) return hit;
  const img = await getCachedImage(url);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const cx = c.getContext('2d', { willReadFrequently: true })!;
  cx.drawImage(img, 0, 0, width, height);
  const data = cx.getImageData(0, 0, width, height).data;
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4];
  alphaCache.set(key, out);
  return out;
}

/** Separable box blur (running sum), edge-clamped. Two passes ~ gaussian. Never writes into `src`. */
function boxBlur(src: Float32Array, w: number, h: number, r: number, passes = 2): Float32Array {
  const tmp = new Float32Array(src.length);
  const bufA = new Float32Array(src.length);
  const bufB = new Float32Array(src.length);
  const win = r * 2 + 1;
  let from: Float32Array = src;
  let to: Float32Array = bufA;
  for (let pass = 0; pass < passes; pass++) {
    // horizontal: from -> tmp
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += from[row + Math.min(w - 1, Math.max(0, k))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = sum / win;
        sum += from[row + Math.min(w - 1, x + r + 1)] - from[row + Math.max(0, x - r)];
      }
    }
    // vertical: tmp -> to
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (let y = 0; y < h; y++) {
        to[y * w + x] = sum / win;
        sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    from = to;
    to = to === bufA ? bufB : bufA;
  }
  return from;
}

function buildFoldMaps(img: HTMLImageElement, mask: Uint8Array, w: number, h: number): FoldMaps {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true })!;
  cx.drawImage(img, 0, 0, w, h);
  const px = cx.getImageData(0, 0, w, h).data;

  const n = w * h;
  const lum = new Float32Array(n);
  let sum = 0;
  let cnt = 0;
  for (let i = 0; i < n; i++) {
    const l = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114;
    lum[i] = l;
    if (mask[i] > 200) { sum += l; cnt++; }
  }
  const mean = cnt ? sum / cnt : 128;
  // Background must not bleed into the blurred garment brightness
  for (let i = 0; i < n; i++) if (mask[i] < 128) lum[i] = mean;

  const mid = boxBlur(lum, w, h, 3);
  const large = boxBlur(lum, w, h, Math.round(w * 0.02));

  const rel = new Float32Array(n);
  for (let i = 0; i < n; i++) rel[i] = (mid[i] - large[i]) / (large[i] + 12);

  const shade = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    shade[i] = Math.round(Math.max(-0.3, Math.min(0.3, rel[i])) * 1000);
  }

  // Gradient of the fold field -> displacement, normalised to a small RMS so that
  // black and white shirts (very different contrast) warp the print equally.
  const gx = new Float32Array(n);
  const gy = new Float32Array(n);
  let acc = 0;
  let m = 0;
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      const ax = (rel[i + 2] - rel[i - 2]) * 0.25;
      const ay = (rel[i + 2 * w] - rel[i - 2 * w]) * 0.25;
      gx[i] = ax;
      gy[i] = ay;
      if (mask[i] > 200) { acc += ax * ax + ay * ay; m++; }
    }
  }
  const rms = Math.sqrt(acc / Math.max(1, m)) || 1e-6;
  const targetPx = 0.9 * (w / 900); // RMS displacement in pixels (subtle bend, not a ripple)
  const k = targetPx / rms;
  const dx = new Int16Array(n);
  const dy = new Int16Array(n);
  const lim = 2.4 * (w / 900) * 256;
  for (let i = 0; i < n; i++) {
    dx[i] = Math.max(-lim, Math.min(lim, Math.round(gx[i] * k * 256)));
    dy[i] = Math.max(-lim, Math.min(lim, Math.round(gy[i] * k * 256)));
  }
  return { shade, dx, dy };
}

/** Loads photo + its own silhouette mask + fold maps for one side/colour family. */
export async function prepareShirtAssets(
  side: ShirtSide,
  useBlackPhoto: boolean,
  width: number,
  height: number
): Promise<ShirtRenderAssets> {
  const key = `${useBlackPhoto ? 'black' : 'white'}_${side}` as keyof typeof TSHIRT_ASSETS;
  const [baseImg, mask] = await Promise.all([
    getCachedImage(TSHIRT_ASSETS[key]),
    getMaskAlpha(MASK_ASSETS[key], width, height)
  ]);
  const foldKey = `${key}_${width}_${height}`;
  let fold = foldCache.get(foldKey);
  if (!fold) {
    fold = buildFoldMaps(baseImg, mask, width, height);
    foldCache.set(foldKey, fold);
  }
  return { baseImg, mask, fold };
}

/**
 * Creates procedural fabric micro-texture patterns based on the chosen fabric type
 */
export function createFabricTexturePattern(
  fabric: FabricInfo,
  color: TshirtColor,
  size = 64
): HTMLCanvasElement {
  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = size;
  patternCanvas.height = size;
  const pctx = patternCanvas.getContext('2d')!;

  pctx.clearRect(0, 0, size, size);

  const isDark = color.dark;
  const isBlack = color.id === 'black';

  const grainAlpha = isBlack 
    ? '0.03' 
    : isDark 
    ? (fabric.roughness * 0.10).toFixed(3) 
    : (fabric.roughness * 0.12).toFixed(3);
  const highlightAlpha = isBlack 
    ? '0.02' 
    : (fabric.sheen * 0.10).toFixed(3);

  if (fabric.id === 'combed_30s') {
    pctx.fillStyle = isDark ? `rgba(255,255,255,${grainAlpha})` : `rgba(0,0,0,${grainAlpha})`;
    for (let x = 0; x < size; x += 3) {
      for (let y = 0; y < size; y += 4) {
        if ((x + y) % 6 === 0) {
          pctx.fillRect(x, y, 1.2, 1.8);
        }
      }
    }
  } else if (fabric.id === 'combed_24s') {
    pctx.fillStyle = isDark ? `rgba(255,255,255,${grainAlpha})` : `rgba(0,0,0,${grainAlpha})`;
    for (let x = 0; x < size; x += 4) {
      for (let y = 0; y < size; y += 4) {
        pctx.fillRect(x, y, 1.8, 1.8);
        pctx.fillRect(x + 2, y + 2, 1.8, 1.8);
      }
    }
  } else if (fabric.id === 'heavyweight_16s') {
    pctx.fillStyle = isDark ? `rgba(255,255,255,${grainAlpha})` : `rgba(0,0,0,${grainAlpha})`;
    for (let x = 0; x < size; x += 5) {
      for (let y = 0; y < size; y += 6) {
        pctx.fillRect(x, y, 2.5, 2.2);
        pctx.fillRect(x + 2.5, y + 3, 2.5, 2.2);
      }
    }
  } else if (fabric.id === 'cotton_bamboo') {
    const grad = pctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, `rgba(255,255,255,${highlightAlpha})`);
    grad.addColorStop(0.5, 'rgba(255,255,255,0)');
    grad.addColorStop(1, `rgba(255,255,255,${highlightAlpha})`);
    pctx.fillStyle = grad;
    pctx.fillRect(0, 0, size, size);
  } else if (fabric.id === 'slub_cotton') {
    pctx.fillStyle = isDark 
      ? `rgba(255,255,255,${isBlack ? '0.04' : (fabric.roughness * 0.14).toFixed(3)})` 
      : `rgba(0,0,0,${(fabric.roughness * 0.14).toFixed(3)})`;
    for (let y = 2; y < size; y += 6) {
      const segLen = (y * 7) % 20 + 8;
      const startX = (y * 11) % (size - segLen);
      pctx.fillRect(startX, y, segLen, 1.5);
    }
  }

  return patternCanvas;
}

// ---------------------------------------------------------------------------
// Artwork helpers: cache lookup + colour filters that do NOT rely on
// CanvasRenderingContext2D.filter (unsupported on Safari/iOS).
// ---------------------------------------------------------------------------

/** Returns an already-loaded image synchronously (or null). */
export function peekCachedImage(src: string): HTMLImageElement | null {
  return imageCache.get(src) ?? null;
}

/** Drops a cached image (call when a layer is deleted). */
export function forgetCachedImage(src: string) {
  imageCache.delete(src);
}

type ColorFilterId = GraphicSettings['colorFilter'];

function applyFilterPixels(data: Uint8ClampedArray, filter: ColorFilterId) {
  const n = data.length;
  if (filter === 'monochrome_black') {
    for (let i = 0; i < n; i += 4) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    }
    return;
  }
  if (filter === 'monochrome_white') {
    // brightness(200%) then grayscale(100%)
    for (let i = 0; i < n; i += 4) {
      const r = Math.min(255, data[i] * 2);
      const g = Math.min(255, data[i + 1] * 2);
      const b = Math.min(255, data[i + 2] * 2);
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    return;
  }
  if (filter === 'vintage_warm') {
    // sepia(40%) -> contrast(90%) -> brightness(95%)
    const k = 1 - 0.4;
    const m00 = 0.393 + 0.607 * k, m01 = 0.769 - 0.769 * k, m02 = 0.189 - 0.189 * k;
    const m10 = 0.349 - 0.349 * k, m11 = 0.686 + 0.314 * k, m12 = 0.168 - 0.168 * k;
    const m20 = 0.272 - 0.272 * k, m21 = 0.534 - 0.534 * k, m22 = 0.131 + 0.869 * k;
    const fin = (v: number) => {
      const c = Math.max(0, Math.min(255, v));
      return ((c - 127.5) * 0.9 + 127.5) * 0.95;
    };
    for (let i = 0; i < n; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      data[i] = fin(m00 * r + m01 * g + m02 * b);
      data[i + 1] = fin(m10 * r + m11 * g + m12 * b);
      data[i + 2] = fin(m20 * r + m21 * g + m22 * b);
    }
  }
}

const filteredCache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();

/**
 * Artwork with the ink filter baked in. 'original' returns the image itself.
 * `targetW` (px the artwork will be drawn at) lets vector images stay crisp in
 * high-resolution exports.
 */
export function getFilteredSource(
  img: HTMLImageElement,
  filter: ColorFilterId,
  targetW: number
): CanvasImageSource {
  if (filter === 'original') return img;

  const natW = img.naturalWidth || img.width || 500;
  const natH = img.naturalHeight || img.height || 500;
  const buckets = [512, 1024, 2048, 4096];
  const bucket = buckets.find((b) => b >= targetW) ?? 4096;
  const w = Math.max(16, Math.min(bucket, natW * 8));
  const h = Math.max(16, Math.round(w * (natH / natW)));

  const key = `${filter}_${w}`;
  let perImg = filteredCache.get(img);
  if (!perImg) {
    perImg = new Map();
    filteredCache.set(img, perImg);
  }
  const hit = perImg.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true })!;
  cx.drawImage(img, 0, 0, w, h);
  const id = cx.getImageData(0, 0, w, h);
  applyFilterPixels(id.data, filter);
  cx.putImageData(id, 0, 0);
  perImg.set(key, c);
  return c;
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

export interface PrintLayer {
  graphic: GraphicSettings;
  img: HTMLImageElement;
}

/** Sleeve prints are visible on the front photo, front/back prints on their own side. */
export function graphicShownOnView(g: GraphicSettings, view: ShirtSide): boolean {
  if (!g.visible || !g.imageUrl) return false;
  return (
    g.side === view ||
    (view === 'front' && (g.side === 'sleeve_left' || g.side === 'sleeve_right'))
  );
}

/** Loads every visible layer for a view, in stacking order (first = bottom). */
export async function loadPrintLayers(
  graphics: GraphicSettings[],
  view: ShirtSide
): Promise<PrintLayer[]> {
  const wanted = graphics.filter((g) => graphicShownOnView(g, view));
  const loaded = await Promise.all(
    wanted.map(async (g) => {
      try {
        return { graphic: g, img: await getCachedImage(g.imageUrl) };
      } catch (e) {
        console.error('Failed to load graphic image:', e);
        return null;
      }
    })
  );
  return loaded.filter((l): l is PrintLayer => l !== null);
}

/**
 * Draws the 2D studio t-shirt using the photo's OWN silhouette mask (clean edges,
 * no photo shadow / backdrop), dyes it for any colour, and prints every layer so
 * that it follows the cloth folds and is clipped to the garment.
 *
 * `width`/`height` are the size of `assets`; the output canvas must be
 * `width*outScale` x `height*outScale` (outScale > 1 is used for hi-res export:
 * the photo is upscaled, but the artwork is re-rendered at full resolution).
 */
export function renderRealisticTshirt(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  assets: ShirtRenderAssets,
  color: TshirtColor,
  fabric: FabricInfo,
  transparentBg = false,
  bgColor: StudioBgColor = 'white',
  layers: PrintLayer[] = [],
  technique?: PrintTechniqueInfo | null,
  outScale = 1
) {
  const { baseImg, mask } = assets;

  const buffer = document.createElement('canvas');
  buffer.width = width;
  buffer.height = height;
  const bctx = buffer.getContext('2d', { willReadFrequently: true })!;

  const isBlack = color.id === 'black';
  const isWhite = color.id === 'white' || color.id === 'broken_white';

  bctx.drawImage(baseImg, 0, 0, width, height);
  const imgData = bctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  const hex = color.hex.replace('#', '');
  const targetR = parseInt(hex.substring(0, 2), 16);
  const targetG = parseInt(hex.substring(2, 4), 16);
  const targetB = parseInt(hex.substring(4, 6), 16);

  for (let idx = 0; idx < totalPixels; idx++) {
    const p = idx * 4;
    const m = mask[idx];
    if (m === 0) {
      data[p + 3] = 0;
      continue;
    }

    if (!isBlack) {
      const baseLum = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
      const foldIntensity = Math.min(1.0, Math.pow(baseLum / 225, 0.9));
      if (isWhite) {
        const k = 0.15 + 0.85 * foldIntensity;
        data[p] = Math.min(255, Math.round(targetR * k));
        data[p + 1] = Math.min(255, Math.round(targetG * k));
        data[p + 2] = Math.min(255, Math.round(targetB * k));
      } else {
        const sheen = fabric.sheen * Math.pow(foldIntensity, 3) * 35;
        data[p] = Math.min(255, Math.round(targetR * foldIntensity + sheen));
        data[p + 1] = Math.min(255, Math.round(targetG * foldIntensity + sheen));
        data[p + 2] = Math.min(255, Math.round(targetB * foldIntensity + sheen));
      }
    }
    data[p + 3] = m; // silhouette becomes the alpha channel
  }
  bctx.putImageData(imgData, 0, 0);

  // Subtle fabric weave, only where the garment exists
  const pattern = bctx.createPattern(createFabricTexturePattern(fabric, color), 'repeat');
  if (pattern) {
    bctx.save();
    bctx.globalCompositeOperation = 'source-atop';
    bctx.globalAlpha = isBlack ? 0.04 : 0.08;
    bctx.fillStyle = pattern;
    bctx.fillRect(0, 0, width, height);
    bctx.restore();
  }

  const outW = Math.round(width * outScale);
  const outH = Math.round(height * outScale);

  if (!transparentBg) {
    ctx.fillStyle = bgColor === 'white' ? '#FFFFFF' : '#09090b';
    ctx.fillRect(0, 0, outW, outH);
  } else {
    ctx.clearRect(0, 0, outW, outH);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(buffer, 0, 0, outW, outH);

  // Print layers: warped by cloth folds, shaded, clipped to the garment
  if (technique) {
    for (const layer of layers) {
      drawWarpedPrint(ctx, width, height, outScale, layer.img, layer.graphic, technique, fabric, color, assets);
    }
  }
}

/** How strongly the cloth shading modulates the print, per technique. */
function printShadeStrength(technique: PrintTechniqueInfo): number {
  switch (technique.id) {
    case 'plastisol': return 0.9;
    case 'dtf': return 1.2;
    default: return 1.5;
  }
}

/** Bilinear lookup in a w x h grid (edge-clamped). */
function bilerp(arr: ArrayLike<number>, w: number, h: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const xa = x0 < 0 ? 0 : x0 > w - 1 ? w - 1 : x0;
  const xb = x0 + 1 < 0 ? 0 : x0 + 1 > w - 1 ? w - 1 : x0 + 1;
  const ya = y0 < 0 ? 0 : y0 > h - 1 ? h - 1 : y0;
  const yb = y0 + 1 < 0 ? 0 : y0 + 1 > h - 1 ? h - 1 : y0 + 1;
  const a = arr[ya * w + xa];
  const b = arr[ya * w + xb];
  const c = arr[yb * w + xa];
  const d = arr[yb * w + xb];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/**
 * Renders one print on its own layer, then re-samples it through the garment's
 * fold displacement map + brightness map, and clips it with the silhouette mask.
 * Result: the artwork bends with wrinkles, darkens in folds, never leaves the shirt.
 * `s` is the output scale relative to `assets` (1 = screen, 2..4 = export).
 */
function drawWarpedPrint(
  target: CanvasRenderingContext2D,
  baseW: number,
  baseH: number,
  s: number,
  graphicImg: HTMLImageElement,
  graphic: GraphicSettings,
  technique: PrintTechniqueInfo,
  fabric: FabricInfo,
  color: TshirtColor,
  assets: ShirtRenderAssets
) {
  const width = Math.round(baseW * s);
  const height = Math.round(baseH * s);

  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const lctx = layer.getContext('2d', { willReadFrequently: true })!;
  renderPrintGraphic(lctx, width, height, graphicImg, graphic, technique, fabric, color, s);

  const aspect = graphicImg.height / (graphicImg.width || 1);
  const { cx, cy, printW, printH } = getPrintPlacement(width, height, aspect, graphic);
  const r = Math.ceil(Math.hypot(printW, printH) / 2 + 12 * s);
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(width, Math.ceil(cx + r));
  const y1 = Math.min(height, Math.ceil(cy + r));
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (bw <= 0 || bh <= 0) return;

  const src = lctx.getImageData(x0, y0, bw, bh).data;
  const out = new ImageData(bw, bh);
  const od = out.data;
  const { mask, fold } = assets;
  const strength = printShadeStrength(technique);
  const exact = s === 1;

  for (let j = 0; j < bh; j++) {
    for (let i = 0; i < bw; i++) {
      let m: number;
      let ddx: number;
      let ddy: number;
      let shade: number;

      if (exact) {
        const gi = (y0 + j) * baseW + (x0 + i);
        m = mask[gi];
        if (m === 0) continue;
        ddx = fold.dx[gi] / 256;
        ddy = fold.dy[gi] / 256;
        shade = fold.shade[gi];
      } else {
        const bx = (x0 + i + 0.5) / s - 0.5;
        const by = (y0 + j + 0.5) / s - 0.5;
        m = bilerp(mask, baseW, baseH, bx, by);
        if (m < 1) continue;
        ddx = (bilerp(fold.dx, baseW, baseH, bx, by) / 256) * s;
        ddy = (bilerp(fold.dy, baseW, baseH, bx, by) / 256) * s;
        shade = bilerp(fold.shade, baseW, baseH, bx, by);
      }

      // Bilinear sample of the print layer at the fold-displaced position
      const fx = i + ddx;
      const fy = j + ddy;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const tx = fx - ix;
      const ty = fy - iy;

      let accA = 0;
      let accR = 0;
      let accG = 0;
      let accB = 0;
      for (let q = 0; q < 4; q++) {
        const qx = ix + (q & 1);
        const qy = iy + (q >> 1);
        if (qx < 0 || qy < 0 || qx >= bw || qy >= bh) continue;
        const wgt = ((q & 1) ? tx : 1 - tx) * ((q >> 1) ? ty : 1 - ty);
        const sp = (qy * bw + qx) * 4;
        const wa = wgt * src[sp + 3];
        accA += wa;
        accR += wa * src[sp];
        accG += wa * src[sp + 1];
        accB += wa * src[sp + 2];
      }
      if (accA < 0.5) continue;

      let f = 1 + (strength * shade) / 1000;
      f = f < 0.55 ? 0.55 : f > 1.25 ? 1.25 : f;

      const o = (j * bw + i) * 4;
      od[o] = Math.min(255, (accR / accA) * f);
      od[o + 1] = Math.min(255, (accG / accA) * f);
      od[o + 2] = Math.min(255, (accB / accA) * f);
      od[o + 3] = (accA * m) / 255;
    }
  }

  const tmp = document.createElement('canvas');
  tmp.width = bw;
  tmp.height = bh;
  tmp.getContext('2d')!.putImageData(out, 0, 0);
  target.drawImage(tmp, x0, y0);
}

/**
 * Shared placement math (2D photo space) for the print.
 * Body prints move by up to 40% of the canvas, sleeve prints by up to 30%.
 */
export const BODY_DRAG_RANGE = 0.4;
export const SLEEVE_DRAG_RANGE = 0.3;

export function getPrintPlacement(
  width: number,
  height: number,
  aspect: number,
  graphic: GraphicSettings
) {
  const isSleeve = graphic.side === 'sleeve_left' || graphic.side === 'sleeve_right';
  // On the front photo the wearer's left sleeve is on the image's right
  const dir = graphic.side === 'sleeve_left' ? 1 : -1;
  const range = isSleeve ? SLEEVE_DRAG_RANGE : BODY_DRAG_RANGE;

  const cx = isSleeve
    ? width * (0.5 + dir * 0.335) + (graphic.x / 100) * width * range
    : width * 0.5 + (graphic.x / 100) * (width * range);
  const cy = isSleeve
    ? height * 0.31 + (graphic.y / 100) * height * range
    : height * 0.48 + (graphic.y / 100) * (height * range);

  const baseDim = width * (isSleeve ? 0.15 : 0.38);
  const printW = baseDim * graphic.scale;
  const printH = printW * aspect;
  // Sablon lengan tampil tegak (sama dengan tampilan 3D), tidak ikut miring mengikuti lengan di foto
  const extraRot = 0;
  return { cx, cy, printW, printH, extraRot, isSleeve, range };
}

/**
 * Finds the top-most layer under a point (canvas coordinates of a
 * `width` x `height` canvas). Used to select a layer by tapping it in 2D.
 */
export function hitTestLayer(
  px: number,
  py: number,
  width: number,
  height: number,
  layers: PrintLayer[]
): string | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const { graphic, img } = layers[i];
    const aspect = img.height / (img.width || 1);
    const p = getPrintPlacement(width, height, aspect, graphic);
    const theta = ((graphic.rotation + p.extraRot) * Math.PI) / 180;
    const dx = px - p.cx;
    const dy = py - p.cy;
    const rx = dx * Math.cos(theta) + dy * Math.sin(theta);
    const ry = -dx * Math.sin(theta) + dy * Math.cos(theta);
    if (Math.abs(rx) <= p.printW / 2 && Math.abs(ry) <= p.printH / 2) {
      return graphic.id;
    }
  }
  return null;
}

/**
 * Renders the printed graphic with scaling and print technique simulation.
 * `px` scales pixel-based effects (shadows, stitch lines) for hi-res output.
 */
export function renderPrintGraphic(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  graphicImg: HTMLImageElement,
  graphic: GraphicSettings,
  technique: PrintTechniqueInfo,
  fabric: FabricInfo,
  color: TshirtColor,
  px = 1
) {
  ctx.save();

  const aspect = graphicImg.height / (graphicImg.width || 1);
  const { cx: centerX, cy: centerY, printW: printWidth, printH: printHeight, extraRot } =
    getPrintPlacement(width, height, aspect, graphic);

  ctx.translate(centerX, centerY);
  ctx.rotate(((graphic.rotation + extraRot) * Math.PI) / 180);

  // Technique specific effects
  if (technique.id === 'plastisol') {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4 * px;
    ctx.shadowOffsetY = 2 * px;
  } else if (technique.id === 'dtf') {
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 2 * px;
    ctx.shadowOffsetY = 1 * px;
  } else if (technique.id === 'rubber') {
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 1 * px;
  }

  ctx.globalAlpha = graphic.opacity;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw the print artwork (ink filter is baked in, no ctx.filter needed)
  const source = getFilteredSource(graphicImg, graphic.colorFilter, printWidth);
  ctx.drawImage(source, -printWidth / 2, -printHeight / 2, printWidth, printHeight);

  // Technique-specific finish overlays
  if (technique.id === 'discharge') {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 0.06 + fabric.roughness * 0.05;
    const patCanvas = createFabricTexturePattern(fabric, color, 32);
    const pat = ctx.createPattern(patCanvas, 'repeat');
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(-printWidth / 2, -printHeight / 2, printWidth, printHeight);
    }
    ctx.restore();
  } else if (technique.id === 'bordir') {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5 * px;
    for (let y = -printHeight / 2; y < printHeight / 2; y += 3 * px) {
      ctx.beginPath();
      ctx.moveTo(-printWidth / 2, y);
      ctx.lineTo(printWidth / 2, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}
