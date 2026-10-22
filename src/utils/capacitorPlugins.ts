/**
 * Plugin native untuk Try-D: Camera, Filesystem, Share
 * Akan di-generate otomatis oleh Capacitor saat `cap add android`
 */

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function captureImageFromGallery() {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Photos,
    });
    return image.base64String;
  } catch (error) {
    console.error('Camera error:', error);
    throw error;
  }
}

export async function captureImageFromCamera() {
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
    });
    return image.base64String;
  } catch (error) {
    console.error('Camera error:', error);
    throw error;
  }
}

export async function saveImageToGallery(
  base64Data: string,
  fileName: string = 'try-d-mockup.png'
) {
  try {
    // Simpan sebagai base64 biner ke direktori Documents aplikasi (bukan Cache).
    const normalized = base64Data.replace(/^data:[^;]+;base64,/, '');
    const safeName = fileName.replace(/[\\/\\\\]/g, '-');
    const filePath = await Filesystem.writeFile({
      path: safeName,
      data: normalized,
      directory: Directory.Documents,
      recursive: true,
    });

    console.log('File saved to:', filePath.uri);
    return filePath.uri;
  } catch (error) {
    console.error('Filesystem error:', error);
    throw error;
  }
}

export async function shareImage(
  base64Data: string,
  title: string = 'Try-D Mockup'
) {
  try {
    // Share membutuhkan URI file yang valid, bukan nama file relatif.
    const fileName = `try-d-${Date.now()}.png`;
    const normalized = base64Data.replace(/^data:[^;]+;base64,/, '');
    await Filesystem.writeFile({
      path: fileName,
      data: normalized,
      directory: Directory.Cache,
      recursive: true,
    });
    const fileUri = await Filesystem.getUri({
      path: fileName,
      directory: Directory.Cache,
    });

    await Share.share({
      title,
      text: 'Desain Try-D saya',
      url: fileUri.uri,
      dialogTitle: 'Bagikan desain Try-D',
    });
  } catch (error) {
    console.error('Share error:', error);
    throw error;
  }
}
