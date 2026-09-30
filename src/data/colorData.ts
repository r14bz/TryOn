import { TshirtColor } from '../types/sablon';

export const TSHIRT_COLORS: TshirtColor[] = [
  // Monochrome & Essentials
  {
    id: 'black',
    name: 'Jet Black (Hitam Reaktif)',
    hex: '#161618',
    category: 'monochrome',
    dark: true
  },
  {
    id: 'white',
    name: 'Pure White (Putih Bersih)',
    hex: '#F7F7FA',
    category: 'monochrome',
    dark: false
  },
  {
    id: 'broken_white',
    name: 'Broken White / Off-White',
    hex: '#EBE5D8',
    category: 'monochrome',
    dark: false
  },
  {
    id: 'charcoal',
    name: 'Charcoal Heather (Abu Tua)',
    hex: '#2F343B',
    category: 'monochrome',
    dark: true
  },
  {
    id: 'misty_grey',
    name: 'Misty Grey M71 (Abu Muda)',
    hex: '#B8BAC0',
    category: 'monochrome',
    dark: false
  },

  // Earth Tones
  {
    id: 'sage_green',
    name: 'Sage Green (Hijau Sage)',
    hex: '#6B8779',
    category: 'earth',
    dark: false
  },
  {
    id: 'army_olive',
    name: 'Army Olive (Hijau Lumut)',
    hex: '#47533B',
    category: 'earth',
    dark: true
  },
  {
    id: 'terracotta',
    name: 'Terracotta Rust (Merah Bata)',
    hex: '#964E3D',
    category: 'earth',
    dark: true
  },
  {
    id: 'sand_khaki',
    name: 'Sand Khaki (Krem Pasir)',
    hex: '#C5B69F',
    category: 'earth',
    dark: false
  },

  // Streetwear & Distro Classics
  {
    id: 'navy_blue',
    name: 'Deep Navy (Biru Dongker)',
    hex: '#1B2436',
    category: 'streetwear',
    dark: true
  },
  {
    id: 'maroon',
    name: 'Burgundy Maroon (Merah Marun)',
    hex: '#5B1E29',
    category: 'streetwear',
    dark: true
  },
  {
    id: 'vintage_mustard',
    name: 'Vintage Mustard (Kuning Kunyit)',
    hex: '#CF9639',
    category: 'streetwear',
    dark: false
  },
  {
    id: 'cobalt_blue',
    name: 'Electric Cobalt (Biru Benhur)',
    hex: '#1D4586',
    category: 'streetwear',
    dark: true
  },

  // Pastel
  {
    id: 'muted_lilac',
    name: 'Muted Lilac (Ungu Pastel)',
    hex: '#9888A5',
    category: 'pastel',
    dark: false
  },
  {
    id: 'dusty_rose',
    name: 'Dusty Rose (Merah Muda Antik)',
    hex: '#B78486',
    category: 'pastel',
    dark: false
  },
  {
    id: 'pale_mint',
    name: 'Mint Cloud (Hijau Mint)',
    hex: '#9AC4B7',
    category: 'pastel',
    dark: false
  }
];
