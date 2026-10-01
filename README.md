# Try-D (Try On Your Design)

Live preview sablon kaos: visualizer 3D (Three.js) dan mockup 2D. Bisa memakai beberapa gambar sekaligus (depan, belakang, lengan kiri/kanan) dan menyimpan hasilnya dalam resolusi tinggi.

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
- Maksimal 6 gambar (lapisan) per kaos; lapisan paling atas di daftar tampil paling depan.
- Gambar katalog kaos 2D ada di `src/assets/images` dan di-import lewat bundler.
- Mask siluet tiap foto ada di `src/assets/masks` (satu mask per foto; foto hitam dan putih beda pose, jangan dipakai bergantian).
- Sablon 3D diproyeksikan di shader kain (ThreeDStudio), sablon 2D dilengkungkan mengikuti lipatan kain (fabricRenderer).
- Simpan gambar (`ExportModal`, `utils/exportDesign.ts`): mockup kaos atau desain saja, 2048/3072/4096 px, PNG/JPG. Foto kaos diperbesar dari 1024 px, gambar sablon dirender ulang pada resolusi penuh.
