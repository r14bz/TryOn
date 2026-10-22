/**
 * Komponen untuk fitur native Android di Try-D
 * Camera, Gallery, Share, dan Save to Gallery
 */

import { Camera, Download, Share2 } from 'lucide-react';
import { useCapacitor } from '../utils/useCapacitor';

interface MobileActionsProps {
  onImageSelected?: (base64: string) => void;
  mockupBase64?: string;
}

export function MobileActions({
  onImageSelected,
  mockupBase64,
}: MobileActionsProps) {
  const {
    loading,
    error,
    pickImageFromGallery,
    takePhotoWithCamera,
    saveToGallery,
    shareDesign,
  } = useCapacitor();

  const handlePickGallery = async () => {
    const base64 = await pickImageFromGallery();
    if (base64 && onImageSelected) {
      onImageSelected(base64);
    }
  };

  const handleTakePhoto = async () => {
    const base64 = await takePhotoWithCamera();
    if (base64 && onImageSelected) {
      onImageSelected(base64);
    }
  };

  const handleSaveToGallery = async () => {
    if (!mockupBase64) {
      alert('Tidak ada mockup untuk disimpan');
      return;
    }
    try {
      await saveToGallery(
        mockupBase64,
        `try-d-${new Date().getTime()}.png`
      );
      alert('Mockup berhasil disimpan ke galeri');
    } catch (err) {
      alert(`Error: ${error || 'Gagal menyimpan'}`);
    }
  };

  const handleShare = async () => {
    if (!mockupBase64) {
      alert('Tidak ada mockup untuk dibagikan');
      return;
    }
    try {
      await shareDesign(mockupBase64, 'Try-D Mockup Saya');
      alert('Mockup dibagikan');
    } catch (err) {
      alert(`Error: ${error || 'Gagal membagikan'}`);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 p-4 bg-gray-100 rounded-lg">
      <button
        onClick={handlePickGallery}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        <Camera size={18} />
        {loading ? 'Loading...' : 'Pilih Foto'}
      </button>

      <button
        onClick={handleTakePhoto}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
      >
        <Camera size={18} />
        {loading ? 'Loading...' : 'Ambil Foto'}
      </button>

      {mockupBase64 && (
        <>
          <button
            onClick={handleSaveToGallery}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            <Download size={18} />
            {loading ? 'Loading...' : 'Simpan'}
          </button>

          <button
            onClick={handleShare}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
          >
            <Share2 size={18} />
            {loading ? 'Loading...' : 'Bagikan'}
          </button>
        </>
      )}

      {error && <div className="w-full text-red-600 text-sm">{error}</div>}
    </div>
  );
}
