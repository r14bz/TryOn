import poppinsBold from '../assets/fonts/poppins-bold.woff';
import poppinsBoldItalic from '../assets/fonts/poppins-bold-italic.woff';
import poppinsLight from '../assets/fonts/poppins-light.woff';
import liberationSansBold from '../assets/fonts/liberation-sans-bold.woff';
import dejavuCondensedBold from '../assets/fonts/dejavu-condensed-bold.woff';
import liberationSerifBold from '../assets/fonts/liberation-serif-bold.woff';
import caladeaBold from '../assets/fonts/caladea-bold.woff';
import liberationMonoBold from '../assets/fonts/liberation-mono-bold.woff';
import type { TextSpec } from '../types/sablon';

export interface TextFont {
  id: string;
  label: string;
  /** nama keluarga unik untuk CSS / canvas */
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  url: string;
}

/**
 * Font yang dibundel di aplikasi (subset Latin, format WOFF) sehingga tetap jalan offline sebagai PWA.
 * Menambah font: taruh file .woff di src/assets/fonts, impor di atas, dan tambahkan satu entri di sini.
 * Semua font di bawah berlisensi terbuka (OFL / Bitstream Vera).
 */
export const TEXT_FONTS: TextFont[] = [
  { id: 'poppins-bold', label: 'Poppins Tebal', family: 'TryD Poppins', weight: 700, style: 'normal', url: poppinsBold },
  { id: 'poppins-bold-italic', label: 'Poppins Miring', family: 'TryD Poppins', weight: 700, style: 'italic', url: poppinsBoldItalic },
  { id: 'poppins-light', label: 'Poppins Tipis', family: 'TryD Poppins', weight: 300, style: 'normal', url: poppinsLight },
  { id: 'sans-bold', label: 'Sans Klasik', family: 'TryD Liberation Sans', weight: 700, style: 'normal', url: liberationSansBold },
  { id: 'condensed-bold', label: 'Ramping Tegas', family: 'TryD DejaVu Condensed', weight: 700, style: 'normal', url: dejavuCondensedBold },
  { id: 'serif-bold', label: 'Serif Klasik', family: 'TryD Liberation Serif', weight: 700, style: 'normal', url: liberationSerifBold },
  { id: 'serif-modern', label: 'Serif Modern', family: 'TryD Caladea', weight: 700, style: 'normal', url: caladeaBold },
  { id: 'mono-bold', label: 'Mesin Tik', family: 'TryD Liberation Mono', weight: 700, style: 'normal', url: liberationMonoBold }
];

export const TEXT_COLORS = [
  '#FFFFFF', '#000000', '#E53935', '#FB8C00', '#FDD835', '#43A047', '#1E88E5', '#8E24AA'
];

export const DEFAULT_TEXT_SPEC: TextSpec = {
  content: 'TEKS ANDA',
  fontId: 'poppins-bold',
  color: '#FFFFFF',
  outlineColor: null,
  outlineWidth: 4,
  letterSpacing: 0,
  align: 'center'
};

export const MAX_TEXT_LENGTH = 80;

export const getTextFont = (id: string): TextFont => TEXT_FONTS.find((f) => f.id === id) ?? TEXT_FONTS[0];

const loading = new Map<string, Promise<void>>();

/** Mendaftarkan font ke dokumen (sekali) dan menunggu sampai siap dipakai di kanvas / CSS. */
export function ensureFontLoaded(font: TextFont): Promise<void> {
  let p = loading.get(font.id);
  if (!p) {
    const face = new FontFace(font.family, `url(${font.url})`, { weight: String(font.weight), style: font.style });
    p = face.load().then((loaded) => {
      document.fonts.add(loaded);
    });
    // gagal dimuat: izinkan coba lagi pada pemanggilan berikutnya
    p.catch(() => loading.delete(font.id));
    loading.set(font.id, p);
  }
  return p;
}

export const ensureAllFontsLoaded = () => Promise.all(TEXT_FONTS.map(ensureFontLoaded));
