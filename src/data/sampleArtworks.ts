export interface SampleArtwork {
  id: string;
  name: string;
  category: 'streetwear' | 'vintage' | 'minimal' | 'typography' | 'anime';
  dataUrl: string;
  suggestedPreset: 'chest_left' | 'chest_center' | 'front_a4' | 'front_a3';
}

// Crisp vector SVG graphics converted to data URLs for high-res rendering
const SVG_TOKYO = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF3366"/>
      <stop offset="100%" stop-color="#FF9933"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="500" height="500" fill="none"/>
  <circle cx="250" cy="230" r="160" fill="url(#grad1)" />
  <rect x="70" y="220" width="360" height="18" fill="#18181b"/>
  <rect x="70" y="248" width="360" height="12" fill="#18181b"/>
  <rect x="70" y="268" width="360" height="8" fill="#18181b"/>
  <rect x="70" y="282" width="360" height="4" fill="#18181b"/>
  <text x="250" y="140" font-family="'Syne', sans-serif" font-weight="900" font-size="44" fill="#ffffff" text-anchor="middle" letter-spacing="10">TOKYO</text>
  <text x="250" y="180" font-family="sans-serif" font-weight="700" font-size="20" fill="#ffffff" text-anchor="middle" opacity="0.9">東京 · UNDERGROUND</text>
  <path d="M 170 330 L 250 210 L 330 330 Z" fill="#ffffff" opacity="0.95"/>
  <path d="M 210 330 L 250 270 L 290 330 Z" fill="#18181b"/>
  <text x="250" y="380" font-family="'JetBrains Mono', monospace" font-weight="800" font-size="34" fill="#ffffff" text-anchor="middle" letter-spacing="6">OVERDRIVE</text>
  <text x="250" y="415" font-family="'JetBrains Mono', monospace" font-size="14" fill="#FF9933" text-anchor="middle" letter-spacing="4">PROJECT // 2026</text>
</svg>
`)}`;

const SVG_VINTAGE_SURF = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <linearGradient id="sunset" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FF5E36"/>
      <stop offset="40%" stop-color="#FFAE33"/>
      <stop offset="100%" stop-color="#FCE181"/>
    </linearGradient>
  </defs>
  <!-- Outer Arch -->
  <path d="M 100 280 A 150 150 0 0 1 400 280 L 400 370 A 10 10 0 0 1 390 380 L 110 380 A 10 10 0 0 1 100 370 Z" fill="#202A36" stroke="#EDE8D0" stroke-width="6"/>
  <!-- Sun -->
  <circle cx="250" cy="250" r="100" fill="url(#sunset)"/>
  <!-- Palm silhouette -->
  <path d="M 250 360 Q 245 280 230 220 Q 225 200 210 180" stroke="#202A36" stroke-width="12" fill="none" stroke-linecap="round"/>
  <path d="M 210 180 Q 150 160 120 190 Q 160 190 200 190" fill="#202A36"/>
  <path d="M 210 180 Q 180 130 160 110 Q 190 140 215 175" fill="#202A36"/>
  <path d="M 210 180 Q 250 130 280 120 Q 250 150 220 180" fill="#202A36"/>
  <path d="M 210 180 Q 270 170 300 200 Q 260 190 220 185" fill="#202A36"/>
  <!-- Waves -->
  <path d="M 120 320 Q 160 290 200 320 T 280 320 T 360 320 T 400 320 L 400 360 L 100 360 Z" fill="#008080" opacity="0.8"/>
  <path d="M 100 340 Q 140 310 180 340 T 260 340 T 340 340 T 400 340 L 400 375 L 100 375 Z" fill="#202A36"/>
  <!-- Typography -->
  <text x="250" y="80" font-family="'Syne', serif" font-weight="800" font-size="34" fill="#EDE8D0" text-anchor="middle" letter-spacing="8">BALI SOUL</text>
  <text x="250" y="430" font-family="'JetBrains Mono', sans-serif" font-weight="700" font-size="18" fill="#EDE8D0" text-anchor="middle" letter-spacing="5">SURF &amp; VIBES · EST 1988</text>
</svg>
`)}`;

const SVG_MINIMAL_CREST = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <polygon points="250,50 430,150 430,350 250,450 70,350 70,150" fill="none" stroke="#F4F4F5" stroke-width="8"/>
  <polygon points="250,75 410,165 410,335 250,425 90,335 90,165" fill="none" stroke="#F4F4F5" stroke-width="2" stroke-dasharray="8 6"/>
  <circle cx="250" cy="250" r="100" fill="none" stroke="#F4F4F5" stroke-width="4"/>
  <path d="M 210 220 L 250 170 L 290 220 L 265 220 L 265 310 L 235 310 L 235 220 Z" fill="#F4F4F5"/>
  <text x="250" y="340" font-family="'Syne', sans-serif" font-weight="700" font-size="16" fill="#F4F4F5" text-anchor="middle" letter-spacing="6">ATELIER</text>
  <text x="250" y="360" font-family="'JetBrains Mono', monospace" font-size="12" fill="#A1A1AA" text-anchor="middle" letter-spacing="3">JAKARTA</text>
  <text x="250" y="475" font-family="'JetBrains Mono', monospace" font-weight="600" font-size="13" fill="#A1A1AA" text-anchor="middle" letter-spacing="4">ORIGINAL QUALITY CO.</text>
</svg>
`)}`;

const SVG_CYBER_TIGER = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <linearGradient id="neonCyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00F0FF"/>
      <stop offset="100%" stop-color="#7000FF"/>
    </linearGradient>
  </defs>
  <!-- Background Diamond -->
  <polygon points="250,40 460,250 250,460 40,250" fill="#0D0D12" stroke="url(#neonCyan)" stroke-width="6"/>
  <!-- Tiger stylized geometric lines -->
  <path d="M 160 170 L 250 110 L 340 170 L 320 250 L 250 310 L 180 250 Z" fill="none" stroke="#00F0FF" stroke-width="6"/>
  <path d="M 200 190 L 250 150 L 300 190 L 280 240 L 250 270 L 220 240 Z" fill="url(#neonCyan)" opacity="0.3"/>
  <!-- Eyes -->
  <polygon points="210,210 240,225 215,235" fill="#FFE600"/>
  <polygon points="290,210 260,225 285,235" fill="#FFE600"/>
  <!-- Nose and teeth -->
  <polygon points="240,250 260,250 250,265" fill="#FF0055"/>
  <path d="M 230 275 L 250 290 L 270 275" stroke="#FFFFFF" stroke-width="4" fill="none"/>
  <!-- Whiskers -->
  <line x1="140" y1="230" x2="200" y2="245" stroke="#00F0FF" stroke-width="3"/>
  <line x1="130" y1="260" x2="195" y2="265" stroke="#00F0FF" stroke-width="3"/>
  <line x1="360" y1="230" x2="300" y2="245" stroke="#00F0FF" stroke-width="3"/>
  <line x1="370" y1="260" x2="305" y2="265" stroke="#00F0FF" stroke-width="3"/>
  <!-- Text -->
  <text x="250" y="380" font-family="'Syne', sans-serif" font-weight="900" font-size="32" fill="#FFFFFF" text-anchor="middle" letter-spacing="8">NEO BEAST</text>
  <text x="250" y="415" font-family="'JetBrains Mono', monospace" font-size="14" fill="#00F0FF" text-anchor="middle" letter-spacing="5">CYBER DIVISION</text>
</svg>
`)}`;

const SVG_BADGE_POCKET = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
  <circle cx="150" cy="150" r="130" fill="#111827" stroke="#E5E7EB" stroke-width="8"/>
  <circle cx="150" cy="150" r="110" fill="none" stroke="#E5E7EB" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="150" y="110" font-family="'Syne', sans-serif" font-weight="800" font-size="28" fill="#F9FAFB" text-anchor="middle" letter-spacing="4">KUSTOM</text>
  <text x="150" y="155" font-family="'Syne', sans-serif" font-weight="900" font-size="44" fill="#F59E0B" text-anchor="middle">SABLON</text>
  <text x="150" y="195" font-family="'JetBrains Mono', monospace" font-weight="600" font-size="16" fill="#9CA3AF" text-anchor="middle" letter-spacing="3">INDONESIA</text>
  <path d="M 90 220 L 210 220" stroke="#F59E0B" stroke-width="4"/>
</svg>
`)}`;

export const SAMPLE_ARTWORKS: SampleArtwork[] = [
  {
    id: 'tokyo_overdrive',
    name: 'Tokyo Overdrive (Streetwear)',
    category: 'streetwear',
    dataUrl: SVG_TOKYO,
    suggestedPreset: 'front_a3'
  },
  {
    id: 'vintage_surf',
    name: 'Bali Surf Sunset (Vintage)',
    category: 'vintage',
    dataUrl: SVG_VINTAGE_SURF,
    suggestedPreset: 'front_a4'
  },
  {
    id: 'cyber_tiger',
    name: 'Neo Beast Cyber (Graphic)',
    category: 'anime',
    dataUrl: SVG_CYBER_TIGER,
    suggestedPreset: 'front_a4'
  },
  {
    id: 'minimal_crest',
    name: 'Atelier Crest (Minimalist)',
    category: 'minimal',
    dataUrl: SVG_MINIMAL_CREST,
    suggestedPreset: 'chest_center'
  },
  {
    id: 'badge_pocket',
    name: 'Kustom Sablon Emblem',
    category: 'typography',
    dataUrl: SVG_BADGE_POCKET,
    suggestedPreset: 'chest_left'
  }
];
