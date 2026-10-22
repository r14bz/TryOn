/**
 * Konfigurasi hoodie yang dipakai bersama oleh tampilan 3D (utils/shirt3d.ts) dan 2D
 * (utils/hoodie2d.ts). Sengaja tidak mengimpor three.js agar renderer 2D tetap ringan.
 * Semua koordinat dalam ruang mesh hoodie yang sudah dinormalisasi (tinggi 0.82).
 */

/**
 * Lengan hoodie dicetak dengan pemetaan silinder (sablon melengkung mengikuti lengan, tidak melar).
 * Virtual Pandora model: lengan lurus, diukur dari render ortografis.
 * Catatan: nilai 3D (point, axis, facing) hanya dipakai untuk tampilan 3D (shirt3d.ts);
 * untuk 2D, posisi lengan ditentukan langsung oleh model render Virtual Pandora (x ±0.38, y ≈0.55).
 */
export const HOODIE_SLEEVE = {
  /** radius lengan atas, dipakai mengubah sudut keliling menjadi jarak busur */
  armRadius: 0.093,
  /** jarak dari titik bahu ke pusat sablon saat slider Atas/Bawah = 0 */
  alongStart: 0.17,
  /** geser Kiri/Kanan -50..50% memutar sablon mengelilingi lengan sebesar +/- sudut ini (rad) */
  maxAngle: 1.2,
  /** point = titik garis tengah dekat bahu, axis = arah bahu->manset, facing = arah sablon menghadap (depan-atas-luar)
   *  Nilai untuk repo hoodie.glb (tidak diubah agar kaos tetap kalibrasi).
   *  2D Virtual Pandora render menggunakan model ruang berbeda — lihat getHoodiePlacement2D. */
  left: { point: [0.299, 0.173, -0.036], axis: [0.9007, -0.4339, -0.021], facing: [0.2269, 0.4288, 0.8744] },
  right: { point: [-0.299, 0.173, -0.036], axis: [-0.9007, -0.4339, -0.021], facing: [-0.2269, 0.4288, 0.8744] }
} as const;

/**
 * Posisi tengah sablon pada lengan hoodie (hasil kalibrasi manual terhadap GLB hoodie).
 * Nilai slider yang dipakai hanya untuk model hoodie; kaos memakai default preset produksi.
 */
export const HOODIE_SLEEVE_CENTER = {
  sleeve_left: { x: 46, y: -15 },
  sleeve_right: { x: -46, y: -15 }
} as const;

/**
 * Foto 2D hoodie adalah render ortografis model 3D (Virtual Pandora CC BY 4.0, dirender ulang).
 * Lengan pada model baru sudah lurus, jadi bend = 0. Parameter menghubungkan satuan model dengan piksel.
 */
export const HOODIE_2D = {
  /** piksel per satuan model pada kanvas 1024 px; render 2440.6 ppu, scaled to 1024 */
  ppu: 1220.3,
  /** sudut tekuk lengan ke bawah pada foto (rad); model baru: lengan lurus */
  bend: 0,
  /** tekukan naik halus dari bahu: jarak sepanjang lengan mulai dan selesai menekuk (tidak dipakai saat bend=0) */
  rampStart: 0,
  rampEnd: 0
} as const;
