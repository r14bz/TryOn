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
 * Browser uses its normal download flow. On Android, write to the app-private
 * cache (which does not require broad storage permissions), then open Android's
 * share sheet so the user can choose a destination such as Downloads or Drive.
 */
export async function saveExportBlob(blob: Blob, filename: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    downloadBlob(blob, filename);
    return;
  }

  const base64 = await blobToBase64(blob);
  const safeName = filename.replace(/[\\/:*?"<>|]/g, '-');
  const path = `exports/${safeName}`;

  const writeResult = await Filesystem.writeFile({
    path,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  });

  if (!writeResult.uri) {
    throw new Error('Android tidak mengembalikan lokasi file setelah penyimpanan.');
  }

  const file = await Filesystem.getUri({
    path,
    directory: Directory.Cache,
  });
  if (!file.uri) {
    throw new Error('File dibuat di penyimpanan sementara aplikasi, tetapi lokasinya tidak dapat dibuka.');
  }

  await Share.share({
    title: filename,
    text: 'Pilih Simpan ke perangkat atau aplikasi tujuan untuk menyimpan file hasil ekspor Try-D.',
    url: file.uri,
    dialogTitle: 'Simpan atau bagikan file Try-D',
  });
}
