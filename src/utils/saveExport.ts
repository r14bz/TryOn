import { Capacitor, registerPlugin } from '@capacitor/core';
import { downloadBlob } from './exportDesign';

interface DownloadsPlugin {
  saveToDownloads(options: {
    filename: string;
    mimeType: string;
    data: string;
  }): Promise<{ uri: string; filename: string; folder: string }>;
}

const AndroidDownloads = registerPlugin<DownloadsPlugin>('Downloads');

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

/** Browser downloads normally; native Android writes through MediaStore into public Download/Try-D. */
export async function saveExportBlob(blob: Blob, filename: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    downloadBlob(blob, filename);
    return;
  }

  const safeName = filename.replace(/[\\/:*?"<>|]/g, '-');
  const data = await blobToBase64(blob);
  await AndroidDownloads.saveToDownloads({
    filename: safeName,
    mimeType: blob.type || 'application/octet-stream',
    data,
  });
}
