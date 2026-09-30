# SablonAR Studio (TryOn 3D)

Live preview sablon kaos: visualizer 3D (Three.js), mockup 2D, dan mode kamera AR.

## Jalankan lokal

```
bun install    # atau: npm install
bun run dev    # http://localhost:3000
```

## Build

```
bun run build
bun run preview
```

Deploy: Vercel (build command `vite build`, output `dist`).

## Catatan

- Model 3D ada di `public/shirt_baked.glb` (dimuat lewat `/shirt_baked.glb`).
- Gambar katalog kaos 2D ada di `src/assets/images` dan di-import lewat bundler.
- Mode AR memakai kamera (`getUserMedia`), butuh HTTPS atau localhost.
