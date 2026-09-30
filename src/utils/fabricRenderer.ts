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

/**
 * Draws the 2D studio t-shirt using the photo's OWN silhouette mask (clean edges,
 * no photo shadow / backdrop), dyes it for any colour, and prints the graphic so
 * that it follows the cloth folds and is clipped to the garment.
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
  graphic?: GraphicSettings | null,
  graphicImg?: HTMLImageElement | null,
  technique?: PrintTechniqueInfo | null
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

  // Print graphic: warped by cloth folds, shaded, clipped to the garment
  if (graphic && graphicImg && technique) {
    drawWarpedPrint(bctx, width, height, graphicImg, graphic, technique, fabric, color, assets);
  }

  if (!transparentBg) {
    ctx.fillStyle = bgColor === 'white' ? '#FFFFFF' : '#09090b';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(buffer, 0, 0);
  } else {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(buffer, 0, 0);
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

/**
 * Renders the print on its own layer, then re-samples it through the garment's
 * fold displacement map + brightness map, and clips it with the silhouette mask.
 * Result: the artwork bends with wrinkles, darkens in folds, never leaves the shirt.
 */
function drawWarpedPrint(
  target: CanvasRenderingContext2D,
  width: number,
  height: number,
  graphicImg: HTMLImageElement,
  graphic: GraphicSettings,
  technique: PrintTechniqueInfo,
  fabric: FabricInfo,
  color: TshirtColor,
  assets: ShirtRenderAssets
) {
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const lctx = layer.getContext('2d', { willReadFrequently: true })!;
  renderPrintGraphic(lctx, width, height, graphicImg, graphic, technique, fabric, color);

  const { cx, cy, printW, printH } = getPrintPlacement(width, height, graphicImg, graphic);
  const r = Math.ceil(Math.hypot(printW, printH) / 2 + 12);
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

  for (let j = 0; j < bh; j++) {
    const gRow = (y0 + j) * width + x0;
    for (let i = 0; i < bw; i++) {
      const gi = gRow + i;
      const m = mask[gi];
      if (m === 0) continue;

      // Bilinear sample of the print layer at the fold-displaced position
      const fx = i + fold.dx[gi] / 256;
      const fy = j + fold.dy[gi] / 256;
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

      let f = 1 + (strength * fold.shade[gi]) / 1000;
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

/** Shared placement math (2D photo space) for the print. */
function getPrintPlacement(
  width: number,
  height: number,
  graphicImg: HTMLImageElement,
  graphic: GraphicSettings
) {
  const isSleeve = graphic.side === 'sleeve_left' || graphic.side === 'sleeve_right';
  // On the front photo the wearer's left sleeve is on the image's right
  const dir = graphic.side === 'sleeve_left' ? 1 : -1;

  const cx = isSleeve
    ? width * (0.5 + dir * 0.335) + (graphic.x / 100) * width * 0.1
    : width * 0.5 + (graphic.x / 100) * (width * 0.4);
  const cy = isSleeve
    ? height * 0.31 + (graphic.y / 100) * height * 0.1
    : height * 0.48 + (graphic.y / 100) * (height * 0.4);

  const baseDim = width * (isSleeve ? 0.15 : 0.38);
  const printW = baseDim * graphic.scale;
  const aspect = graphicImg.height / (graphicImg.width || 1);
  const printH = printW * aspect;
  const extraRot = isSleeve ? dir * 35 : 0;
  return { cx, cy, printW, printH, extraRot, isSleeve };
}

/**
 * Renders a transparent-background, tightly-cropped shirt (with print) for the AR
 * overlay, so the camera feed is never covered by a studio backdrop.
 */
export async function renderShirtCutout(
  fabric: FabricInfo,
  color: TshirtColor,
  graphic: GraphicSettings,
  technique: PrintTechniqueInfo,
  side: ShirtSide,
  size = 900
): Promise<HTMLCanvasElement> {
  const assets = await prepareShirtAssets(side, color.id === 'black', size, size);

  let graphicImg: HTMLImageElement | null = null;
  const printsOnThisView =
    graphic.imageUrl &&
    (graphic.side === side ||
      (side === 'front' && (graphic.side === 'sleeve_left' || graphic.side === 'sleeve_right')));
  if (printsOnThisView) {
    try {
      graphicImg = await getCachedImage(graphic.imageUrl);
    } catch (e) {
      console.error('Failed to load graphic image:', e);
    }
  }

  const full = document.createElement('canvas');
  full.width = size;
  full.height = size;
  renderRealisticTshirt(
    full.getContext('2d')!, size, size, assets, color, fabric, true, 'white', graphic, graphicImg, technique
  );

  // Crop to the garment bounds
  let minX = size, minY = size, maxX = 0, maxY = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (assets.mask[y * size + x] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(size - 1, maxX + pad);
  maxY = Math.min(size - 1, maxY + pad);
  const cw = Math.max(1, maxX - minX + 1);
  const ch = Math.max(1, maxY - minY + 1);
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d')!.drawImage(full, minX, minY, cw, ch, 0, 0, cw, ch);
  return out;
}

/**
 * Renders the printed graphic with perspective, scaling, and realistic print technique simulation.
 */
export function renderPrintGraphic(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  graphicImg: HTMLImageElement,
  graphic: GraphicSettings,
  technique: PrintTechniqueInfo,
  fabric: FabricInfo,
  color: TshirtColor
) {
  ctx.save();

  const { cx: centerX, cy: centerY, printW: printWidth, printH: printHeight, extraRot } =
    getPrintPlacement(width, height, graphicImg, graphic);

  ctx.translate(centerX, centerY);
  ctx.rotate(((graphic.rotation + extraRot) * Math.PI) / 180);

  // Technique specific effects
  if (technique.id === 'plastisol') {
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
  } else if (technique.id === 'dtf') {
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
  } else if (technique.id === 'rubber') {
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 1;
  }

  // Color Filter Processing
  ctx.globalAlpha = graphic.opacity;

  if (graphic.colorFilter === 'monochrome_white') {
    ctx.filter = 'brightness(200%) grayscale(100%)';
  } else if (graphic.colorFilter === 'monochrome_black') {
    ctx.filter = 'brightness(0%)';
  } else if (graphic.colorFilter === 'vintage_warm') {
    ctx.filter = 'sepia(40%) contrast(90%) brightness(95%)';
  }

  // Draw the print artwork
  ctx.drawImage(
    graphicImg,
    -printWidth / 2,
    -printHeight / 2,
    printWidth,
    printHeight
  );

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
    ctx.lineWidth = 1.5;
    for (let y = -printHeight / 2; y < printHeight / 2; y += 3) {
      ctx.beginPath();
      ctx.moveTo(-printWidth / 2, y);
      ctx.lineTo(printWidth / 2, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}
