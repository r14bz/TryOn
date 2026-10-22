# AGENTS.md: panduan untuk agent AI di repo Try-D

Try-D (Try On Your Design) adalah live preview sablon kaos dan hoodie: visualizer 3D (Three.js) dan mockup 2D. Stack: React 19, TypeScript, Vite, Tailwind CSS 4. Produksi: https://try-d.vercel.app (otomatis deploy dari `main`).

Bahasa antarmuka dan komentar kode: Indonesia. Balas pemilik repo dalam bahasa Indonesia.

## ATURAN UTAMA: JANGAN MENYENTUH PRODUKSI

`main` = produksi. Setiap push ke `main` langsung tayang di Vercel. Karena itu:

1. **Jangan pernah commit atau push langsung ke `main`.** Jangan merge ke `main`, jangan force push, jangan hapus branch milik orang lain.
2. **Sebelum mengubah file apa pun, buat branch baru dari `main` yang terbaru:**
   ```bash
   git switch main && git pull
   git switch -c fix/nama-singkat      # atau feature/..., chore/..., docs/...
   ```
   Cek dengan `git branch --show-current`. Kalau hasilnya `main`, berhenti dan buat branch dulu.
3. Satu branch untuk satu perubahan (atau satu kelompok kecil yang saling berkaitan). Jangan campur perbaikan UI dengan perubahan model 3D.
4. Commit dengan pesan bahasa Indonesia, gaya yang sudah dipakai: `fix(hoodie): ...`, `feat(ui): ...`, `chore: ...`, `docs: ...`.
5. Tambahkan file satu per satu (`git add path/file`). **Jangan `git add .`** dan jangan commit `package-lock.json` kecuali memang menambah atau mengubah dependency.
6. Setelah selesai: jalankan `npm run lint` dan `npm run build`, push branch (`git push -u origin <branch>`), lalu **berhenti**. Pemilik repo yang mengecek preview Vercel dan melakukan merge. Jangan merge sendiri.
7. Jangan menambah atau mengubah dependency tanpa izin. Jangan membuat file `.zip` atau patch di root repo.

## Perintah

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # tsc --noEmit (cek tipe)
npm run build    # vite build -> dist
```

WebGL tidak bisa diuji di Termux. Perubahan yang menyangkut tampilan 3D diverifikasi pemilik repo lewat deploy preview Vercel di browser. Katakan dengan jelas bagian mana yang belum teruji.

## Peta kode

```
src/App.tsx                   state utama studio (lapisan gambar, kain, warna, sisi, mode)
src/components/
  Header.tsx                  menu atas
  StudioToolbar.tsx           toolbar kanvas (model, 3D/2D, tema, tombol sisi)
  ThreeDStudio.tsx            kanvas 3D
  StudioMockup.tsx            kanvas 2D
  PlacementPanel.tsx          tab Posisi
  FabricColorSelector.tsx     pilihan kain dan warna
  GraphicControlPanel.tsx     kontrol per lapisan
  PriceQuoteModal.tsx         kalkulator estimasi harga
  ExportModal.tsx             simpan/ekspor
src/data/                     kain, warna, font, preset penempatan, konfigurasi hoodie
src/types/sablon.ts           tipe data bersama
src/utils/
  shirt3d.ts                  material dan proyeksi sablon 3D (kaos dan hoodie)
  fabricRenderer.ts           render 2D bertekstur kain
  hoodie2d.ts                 render 2D hoodie
  placement.ts                perhitungan posisi sablon
  export*.ts                  PNG/JPG/PDF/PSD/SVG
```

## Area rawan, hati-hati

- **`src/data/hoodieConfig.ts` dan `src/utils/shirt3d.ts`:** angka hasil kalibrasi manual (posisi lengan, sudut, skala). Ubah hanya kalau tugasnya memang soal itu, dan sebutkan nilai lama dan baru di pesan commit. Kalau GLB hoodie diganti, angkanya harus diukur ulang.
- **Perilaku kaos tidak boleh berubah** saat mengerjakan hoodie. Pengaturan hoodie sengaja diisolasi.
- **Mask siluet** (`src/assets/masks`, `src/assets/hoodie`): satu mask per foto. Foto hitam dan putih berbeda pose, jangan dipakai bergantian.
- **Aset biner** (`.glb`, foto, mask): jangan diganti atau dihapus tanpa izin, karena memperbesar riwayat git.
- **`public/sw.js`:** sengaja tanpa cache agar deploy baru langsung terlihat. Jangan ditambah caching.
- Maksimal 6 lapisan gambar per pakaian (`MAX_GRAPHICS`).
- Jangan menambah `localStorage` baru selain yang sudah ada (`tryd.sideNav`) tanpa alasan, dan selalu bungkus dengan `try/catch`.

## Daftar tugas awal

Dari catatan pemilik repo. Kerjakan berurutan, tiap item atau kelompok kecil di branch sendiri, dan konfirmasi dulu kalau ada yang ambigu.

1. **Pindahkan tombol Simpan dari header ke panel bawah**, di samping tab "Posisi". Header sekarang terlalu ramai. Tombol ada di `Header.tsx` (ikon `Download`); modal ekspor tetap `ExportModal`.
2. **Posisi awal gambar di lengan kiri/kanan terlalu ke kanan.** Saat slider Kiri/Kanan digeser ke -50, gambar masih di tengah. Periksa nilai default dan perhitungan di `placement.ts`, `PLACEMENT_PRESETS`, dan logika lengan di `shirt3d.ts`. Pastikan rentang -50..50 simetris di kedua lengan.
3. **Mode terang: panah dropdown model berwarna kuning dan kurang terlihat.** Ada di `StudioToolbar.tsx` (`ChevronDown` dengan kelas `text-brand`). Beri warna yang kontras di mode terang.
4. **Ganti ikon kompas** (`Compass` di `StudioToolbar.tsx`) dengan ikon lucide-react yang menggambarkan tombol sembunyikan/tampilkan navigasi sisi, misalnya `PanelTop` atau `Eye`/`EyeOff`. Ikon tidak boleh sama untuk dua keadaan yang berbeda artinya.
5. **Hapus teks "Estimasi" di panel bawah** (sekitar `App.tsx` baris 424). Estimasi harga hanya boleh ada di kalkulator (`PriceQuoteModal`). Pastikan tidak ada state atau import yang tertinggal tidak terpakai.
6. **Tab Warna: tambahkan preset warna cerah.** Data di `src/data/colorData.ts`, tampilan di `FabricColorSelector.tsx`. Ikuti bentuk `TshirtColor` (`id`, `name`, `hex`, `category`, `dark`). Kalau perlu kategori baru, perluas tipenya di `types/sablon.ts` dan pastikan filter kategori ikut bekerja.
7. **Tab Posisi: hapus preset** "Dada Kiri / Saku", "Dada Tengah A5", "Depan Standar A4", dan preset ukuran cetak sejenis. Pastikan nilai `PlacementPresetId` yang dipakai di tempat lain (mis. `front_a3` pada gambar contoh awal di `App.tsx`) tetap valid, dan mode `custom` tetap berfungsi. Jangan menghapus preset sebelum semua pemakaiannya dicek dengan `grep`.
8. **Tekukan lengan pada hoodie 2D terlihat aneh** di kedua lengan. Parameter ada di `HOODIE_2D` (`bend`, `rampStart`, `rampEnd`) pada `hoodieConfig.ts`, dirender oleh `hoodie2d.ts`. Foto hoodie 2D adalah render model 3D, jadi kalau perlu ubah bentuk tekukan, jelaskan dulu pendekatannya sebelum mengubah aset gambar.

Saran pengelompokan branch: `fix/ui-header-toolbar` (1, 3, 4, 5), `fix/penempatan-lengan` (2, 7), `feat/warna-cerah` (6), `fix/hoodie-2d-lengan` (8).

## Setelah selesai

- Perbarui bagian "Fitur" di `README.md` bila perilaku yang terlihat pengguna berubah (mis. preset penempatan dihapus).
- Ringkas hasil kerja: file yang diubah, apa yang sudah diuji, dan apa yang belum bisa diuji (terutama 3D).
