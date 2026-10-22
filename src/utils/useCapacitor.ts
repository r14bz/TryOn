/**
 * Hook React untuk integrasi Capacitor di Try-D
 * Menyediakan fungsi untuk akses kamera, galeri, dan sharing
 */

import { useState, useCallback } from 'react';
import {
  captureImageFromGallery,
  captureImageFromCamera,
  saveImageToGallery,
  shareImage,
} from './capacitorPlugins';

interface UseCapacitorResult {
  loading: boolean;
  error: string | null;
  pickImageFromGallery: () => Promise<string | undefined>;
  takePhotoWithCamera: () => Promise<string | undefined>;
  saveToGallery: (base64: string, fileName?: string) => Promise<void>;
  shareDesign: (base64: string, title?: string) => Promise<void>;
}

export function useCapacitor(): UseCapacitorResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickImageFromGallery = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base64 = await captureImageFromGallery();
      return base64;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  const takePhotoWithCamera = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base64 = await captureImageFromCamera();
      return base64;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveToGallery = useCallback(
    async (base64: string, fileName?: string) => {
      setLoading(true);
      setError(null);
      try {
        await saveImageToGallery(base64, fileName);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const shareDesign = useCallback(
    async (base64: string, title?: string) => {
      setLoading(true);
      setError(null);
      try {
        await shareImage(base64, title);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    pickImageFromGallery,
    takePhotoWithCamera,
    saveToGallery,
    shareDesign,
  };
}
