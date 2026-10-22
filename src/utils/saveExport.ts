import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
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
 * Browser uses its normal download flow. On Android, save the file to the
 * app's Documents/Try-D folder and then open the Android share sheet so the
 * user can also save/copy it to Downloads or another app. A success is only
 * returned after the write and share invocation both complete.
 */
export async function saveExportBlob(blob: Blob, filename: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    downloadBlob(blob, filename);
    return;
  }

  const base64 = await blobToBase64(blob);
  const safeName = filename.replace(/[\\/:*?"<>|]/g, '-');
  const path = `Try-D/${safeName}`;
  const writeResult = await Filesystem.writeFile({
    path,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  });

  if (!writeResult.uri) {
    throw new Error('Android tidak mengembalikan lokasi file setelah penyimpanan.');
  }

  const file = await Filesystem.getUri({
    path,
    directory: Directory.Documents,
  });
  if (!file.uri) {
    throw new Error('File tersimpan di dokumen aplikasi, tetapi lokasinya tidak dapat dibuka.');
  }

  // Native Documents is app-specific on modern Android; expose the actual file
  // to the user through Android's share sheet rather than falsely claiming it
  // was downloaded to the public Downloads folder.
  await Share.share({
    title: filename,
    text: 'File Try-D tersimpan di Dokumen aplikasi. Pilih aplikasi tujuan untuk menyimpan atau membagikannya.',
    url: file.uri,
    dialogTitle: 'Simpan atau bagikan file Try-D',
  });
}
