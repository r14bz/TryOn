# Try-D (Try On Your Design)

Live preview sablon pakaian di browser. Tempel desainmu ke **kaos** atau **hoodie**, lihat hasilnya di visualizer **3D** (Three.js) atau mockup **2D** bertekstur kain, lalu simpan dalam resolusi tinggi.

Live: https://try-d.vercel.app

## Fitur

- **Dua model pakaian:** Kaos dan Hoodie, masing-masing punya tampilan 3D dan 2D.
- **Visualizer 3D:** model bisa diputar. Sablon diproyeksikan langsung di shader kain.
- **Mockup 2D:** foto pakaian dengan sablon yang melengkung mengikuti lipatan kain.
- **Hingga 6 lapisan** gambar per pakaian (depan, belakang, lengan kiri, lengan kanan). Lapisan paling atas di daftar tampil paling depan.
- **Layer teks** yang bisa diedit ulang: 8 pilihan font, warna isi, garis tepi, jarak huruf, dan perataan.
- **Kontrol tiap lapisan:** posisi, skala, rotasi, opasitas, blend mode (normal, multiply, hard-light, overlay), dan filter warna (asli, putih, hitam, vintage).
- **Preset penempatan** sesuai ukuran cetak nyata (depan A3, punggung A3, lengan kiri/kanan) plus mode custom drag & resize.
- **Bahan kain:** Cotton Combed 30s dan 24s, Heavyweight 16s, Cotton Bamboo, Slub Cotton / Pique Vintage, lengkap dengan inspeksi tekstur.
- **Teknik sablon:** DTF, Plastisol HD, Rubber GL, Discharge, dan Bordir.
- **Pilihan warna** (16 warna) dan **ukuran** S sampai XXL.
- **Estimasi harga** berdasarkan kain, teknik, ukuran, dan jumlah pesanan.
- **Export:** PNG, JPG, PDF, PSD, dan SVG. Pilihan hasil: mockup, desain saja, atau render 3D.
- **PWA:** bisa di-install di HP atau desktop.

## Tech stack

- React 19 + TypeScript
- Vite + Tailwind CSS 4
- Three.js untuk visualizer 3D (dimuat belakangan agar halaman awal cepat)
- Motion dan lucide-react untuk animasi dan ikon

## Jalankan lokal

```bash
bun install    # atau: npm install
bun run dev    # http://localhost:3000
```

Tidak ada environment variable yang dibutuhkan.

## Build dan deploy

```bash
bun run build      # atau: npm run build
bun run preview
bun run lint       # pengecekan tipe: tsc --noEmit
```

Deploy di Vercel: build command `vite build`, output directory `dist`.

## Struktur proyek

```
public/
  shirt_baked.glb        model 3D kaos
  models/hoodie.glb      model 3D hoodie
  sw.js, site.webmanifest, icon-*.png   PWA
src/
  App.tsx                state utama studio
  components/            UI: ThreeDStudio, StudioMockup, panel kontrol, modal export/harga/tekstur
  data/                  kain, warna, font, preset penempatan, konfigurasi model & hoodie
  types/sablon.ts        tipe data (GraphicSettings, PlacementPreset, dst.)
  utils/
    shirt3d.ts           material & proyeksi sablon 3D
    fabricRenderer.ts    render mockup 2D bertekstur kain
    hoodie2d.ts          render 2D hoodie
    exportDesign.ts, exportFormats.ts, export3d.ts   export PNG/JPG/PDF/PSD/SVG
  assets/
    images/              foto katalog kaos 2D
    masks/               mask siluet tiap foto kaos
    hoodie/              foto, mask, dan peta region hoodie
    fonts/               font untuk layer teks
```

## Catatan teknis

- Model 3D dimuat lewat `/shirt_baked.glb` dan `/models/hoodie.glb`.
- Mask siluet satu per foto. Foto hitam dan putih berbeda pose, jadi jangan dipakai bergantian.
- Lengan hoodie memakai pemetaan silinder agar sablon melengkung mengikuti lengan. Parameternya ada di `src/data/hoodieConfig.ts`. Jika GLB hoodie diganti, ukur ulang nilainya.
- Foto 2D hoodie adalah render ortografis dari model 3D-nya.
- Upload gambar: PNG, JPG, WebP, atau SVG, maksimal 15 MB. Gambar raster besar otomatis diperkecil ke 2048 px.
- Export 2D: 2048, 3072, atau 4096 px. Foto pakaian diperbesar dari 1024 px, sedangkan gambar sablon dirender ulang pada resolusi penuh.
- Export 3D: sampai 3072 px, karena WebGL di HP lebih terbatas.
- Service worker sengaja tidak menyimpan cache, jadi setiap deploy baru di Vercel langsung terlihat. Konsekuensinya, aplikasi tidak bisa dipakai offline.
- Menambah model pakaian baru: tambahkan entri di `src/data/garmentModels.ts`, perluas tipe `GarmentModel` di `src/types/sablon.ts`, lalu daftarkan konfigurasinya di `src/utils/shirt3d.ts` dan `src/utils/placement.ts`.
