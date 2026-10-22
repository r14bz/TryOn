import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { downloadBlob } from './exportDesign';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Tidak dapat membaca file hasil ekspor.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      if (comma < 0) {
        reject(new Error('Format data file hasil ekspor tidak valid.'));
        return;
      }
      resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Unduh pada browser web. Di Android native, tulis data biner ke Documents
 * milik aplikasi agar file tidak hilang saat cache dibersihkan.
 */
export async function saveExportBlob(blob: Blob, filename: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    downloadBlob(blob, filename);
    return;
  }

  const base64 = await blobToBase64(blob);
  const safeName = filename.replace(/[\\/:*?"<>|]/g, '-');
  await Filesystem.writeFile({
    path: `Try-D/${safeName}`,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  });
}
