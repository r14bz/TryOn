import type { GarmentModel } from '../types/sablon';

export interface GarmentModelInfo {
  id: GarmentModel;
  label: string;
  /** apakah mode 2D (foto mockup) tersedia untuk model ini */
  has2D: boolean;
}

/**
 * Daftar model pakaian di dropdown. Menambah model baru: tambahkan entri di sini, perluas tipe
 * `GarmentModel` (types/sablon.ts) dan daftarkan konfigurasinya di utils/shirt3d.ts & placement.ts.
 */
export const GARMENT_MODELS: GarmentModelInfo[] = [
  { id: 'shirt', label: 'Kaos', has2D: true },
  { id: 'hoodie', label: 'Hoodie', has2D: true }
];
