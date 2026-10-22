/**
 * Plugin native untuk Try-D: Camera, Filesystem, Share
 * Akan di-generate otomatis oleh Capacitor saat `cap add android`
 */

import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
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
    // Simpan ke cache terlebih dahulu
    const filePath = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
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
    // Untuk Android, kita perlu menyimpan file terlebih dahulu
    const fileName = `try-d-${Date.now()}.png`;
    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    await Share.share({
      title: title,
      text: 'Check out my custom design from Try-D!',
      url: fileName,
      dialogTitle: 'Share Your Design',
    });
  } catch (error) {
    console.error('Share error:', error);
    throw error;
  }
}
