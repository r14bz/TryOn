import { FabricInfo, TshirtColor, GraphicSettings, PrintTechniqueInfo, StudioBgColor } from '../types/sablon';

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
  black_front: '/src/assets/images/tshirt_black_front_1790758501022.jpg',
  black_back: '/src/assets/images/tshirt_black_back_1790758517353.jpg',
  white_front: '/src/assets/images/tshirt_white_front_1790758537680.jpg',
  white_back: '/src/assets/images/tshirt_white_back_1790758582809.jpg'
};

// Mask cache to store precomputed binary/alpha masks of the garment silhouette
const maskCache = new Map<string, Uint8Array>();

export function getGarmentMask(blackImg: HTMLImageElement, width: number, height: number): Uint8Array {
  const key = `${blackImg.src}_${width}_${height}`;
  if (maskCache.has(key)) {
    return maskCache.get(key)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(blackImg, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;

  const mask = new Uint8Array(width * height);
  const totalPixels = width * height;

  for (let i = 0; i < totalPixels; i++) {
    const p = i * 4;
    // In black t-shirt photo: background is white (>220), shirt is black (<80)
    const lum = (data[p] + data[p + 1] + data[p + 2]) / 3;
    if (lum < 160) {
      mask[i] = 255; // 100% garment
    } else if (lum < 235) {
      // Soft anti-aliased edge
      mask[i] = Math.round(((235 - lum) / 75) * 255);
    } else {
      mask[i] = 0; // Pure studio background
    }
  }

  maskCache.set(key, mask);
  return mask;
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
 * Draws the 2D studio t-shirt with guaranteed studio background preservation,
 * mask-based realistic dye synthesis for ALL colors, authentic cloth folds, and clipped graphic.
 */
export function renderRealisticTshirt(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  baseImg: HTMLImageElement,
  maskImg: HTMLImageElement,
  color: TshirtColor,
  fabric: FabricInfo,
  transparentBg = false,
  bgColor: StudioBgColor = 'white',
  graphic?: GraphicSettings | null,
  graphicImg?: HTMLImageElement | null,
  technique?: PrintTechniqueInfo | null
) {
  // Offscreen buffer for crisp rendering
  const buffer = document.createElement('canvas');
  buffer.width = width;
  buffer.height = height;
  const bctx = buffer.getContext('2d')!;

  const isBlack = color.id === 'black';
  const isWhite = color.id === 'white' || color.id === 'broken_white';

  const isLightBg = bgColor === 'white';
  const bgR = isLightBg ? 255 : 9;
  const bgG = isLightBg ? 255 : 9;
  const bgB = isLightBg ? 255 : 11;

  if (isBlack) {
    // 1. JET BLACK NATIVE PHOTO
    bctx.drawImage(baseImg, 0, 0, width, height);

    if (bgColor === 'black') {
      const imgData = bctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (lum > 220) {
          data[i] = 9;
          data[i + 1] = 9;
          data[i + 2] = 11;
        }
      }
      bctx.putImageData(imgData, 0, 0);
    }
  } else {
    // 2. WHITE OR ANY CUSTOM COLOR (Mustard, Sage Green, Royal Blue, Terracotta, Navy, Maroon, etc.)
    // First, obtain razor-sharp garment silhouette mask
    const mask = getGarmentMask(maskImg, width, height);

    // Read base white image containing natural cotton drape & fold shadows
    bctx.drawImage(baseImg, 0, 0, width, height);
    const imgData = bctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const hex = color.hex.replace('#', '');
    const targetR = parseInt(hex.substring(0, 2), 16);
    const targetG = parseInt(hex.substring(2, 4), 16);
    const targetB = parseInt(hex.substring(4, 6), 16);

    const totalPixels = width * height;

    for (let idx = 0; idx < totalPixels; idx++) {
      const m = mask[idx];
      const p = idx * 4;

      if (m === 0) {
        // PURE STUDIO BACKGROUND: GUARANTEED TO NEVER DYE OR LEACH COLOR!
        data[p] = bgR;
        data[p + 1] = bgG;
        data[p + 2] = bgB;
      } else {
        // GARMENT PIXEL: Dye with natural cotton fold shadows
        const baseLum = (data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114);
        // Normalize fold intensity relative to white cotton highlights
        const foldIntensity = Math.min(1.0, Math.pow(baseLum / 225, 0.90));
        const sheen = fabric.sheen * Math.pow(foldIntensity, 3) * 35;

        let garR: number, garG: number, garB: number;

        if (isWhite) {
          // Pure / Broken White
          garR = Math.min(255, Math.round(targetR * (0.15 + 0.85 * foldIntensity)));
          garG = Math.min(255, Math.round(targetG * (0.15 + 0.85 * foldIntensity)));
          garB = Math.min(255, Math.round(targetB * (0.15 + 0.85 * foldIntensity)));
        } else {
          // Vibrant Colored Garment (Mustard, Blue, Terracotta, Olive, etc.)
          garR = Math.min(255, Math.round(targetR * foldIntensity + sheen));
          garG = Math.min(255, Math.round(targetG * foldIntensity + sheen));
          garB = Math.min(255, Math.round(targetB * foldIntensity + sheen));
        }

        if (m === 255) {
          data[p] = garR;
          data[p + 1] = garG;
          data[p + 2] = garB;
        } else {
          // Smooth anti-aliased edge transition between garment and solid background
          const alpha = m / 255;
          data[p] = Math.round(garR * alpha + bgR * (1 - alpha));
          data[p + 1] = Math.round(garG * alpha + bgG * (1 - alpha));
          data[p + 2] = Math.round(garB * alpha + bgB * (1 - alpha));
        }
      }
    }
    bctx.putImageData(imgData, 0, 0);
  }

  // 3. Apply subtle fabric weave micro-texture
  const patternCanvas = createFabricTexturePattern(fabric, color);
  const pattern = bctx.createPattern(patternCanvas, 'repeat');
  if (pattern) {
    bctx.save();
    bctx.globalAlpha = isBlack ? 0.04 : 0.08;
    bctx.fillStyle = pattern;
    bctx.fillRect(0, 0, width, height);
    bctx.restore();
  }

  // 4. Render print graphic with strict boundary clipping
  if (graphic && graphicImg && technique) {
    bctx.save();
    bctx.beginPath();
    bctx.rect(width * 0.15, height * 0.18, width * 0.70, height * 0.70);
    bctx.clip();

    renderPrintGraphic(bctx, width, height, graphicImg, graphic, technique, fabric, color);
    bctx.restore();
  }

  // 5. Output to target canvas
  if (!transparentBg) {
    ctx.fillStyle = bgColor === 'white' ? '#FFFFFF' : '#09090b';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(buffer, 0, 0);
  } else {
    // Transparent for AR virtual try-on
    const mask = getGarmentMask(maskImg, width, height);
    const imgData = bctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    for (let idx = 0; idx < width * height; idx++) {
      if (mask[idx] === 0) {
        data[idx * 4 + 3] = 0;
      }
    }
    bctx.putImageData(imgData, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(buffer, 0, 0);
  }
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

  // Print area center on the t-shirt chest/back
  const centerX = width * 0.5 + (graphic.x / 100) * (width * 0.40);
  const centerY = height * 0.48 + (graphic.y / 100) * (height * 0.40);

  const baseDim = width * 0.38;
  const printWidth = baseDim * graphic.scale;
  const aspect = graphicImg.height / (graphicImg.width || 1);
  const printHeight = printWidth * aspect;

  ctx.translate(centerX, centerY);
  ctx.rotate((graphic.rotation * Math.PI) / 180);

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
