const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_SIDE_PX = 2048;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export interface PreparedImage {
  url: string; // blob: URL (revoke with URL.revokeObjectURL when no longer needed)
  name: string;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gambar tidak dapat dibaca'));
    img.src = url;
  });
}

/**
 * Validates an uploaded file and returns a lightweight blob URL.
 * Large raster images are downscaled (max 2048 px) so they stay fast in 2D/3D.
 */
export async function prepareUploadedImage(file: File): Promise<PreparedImage> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error(`Format "${file.name}" tidak didukung. Gunakan PNG, JPG, WebP, atau SVG.`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`"${file.name}" lebih dari 15 MB.`);
  }

  const originalUrl = URL.createObjectURL(file);
  if (file.type === 'image/svg+xml') {
    return { url: originalUrl, name: file.name };
  }

  try {
    const img = await loadImage(originalUrl);
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    if (longest <= MAX_SIDE_PX) {
      return { url: originalUrl, name: file.name };
    }

    const k = MAX_SIDE_PX / longest;
    const w = Math.round(img.naturalWidth * k);
    const h = Math.round(img.naturalHeight * k);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { url: originalUrl, name: file.name };
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    const keepAlpha = file.type !== 'image/jpeg';
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, keepAlpha ? 'image/png' : 'image/jpeg', 0.92)
    );
    if (!blob) return { url: originalUrl, name: file.name };

    URL.revokeObjectURL(originalUrl);
    return { url: URL.createObjectURL(blob), name: file.name };
  } catch (err) {
    URL.revokeObjectURL(originalUrl);
    throw err;
  }
}
