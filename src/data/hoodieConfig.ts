/**
 * Konfigurasi hoodie yang dipakai bersama oleh tampilan 3D (utils/shirt3d.ts) dan 2D
 * (utils/hoodie2d.ts). Sengaja tidak mengimpor three.js agar renderer 2D tetap ringan.
 * Semua koordinat dalam ruang mesh hoodie yang sudah dinormalisasi (tinggi 0.82).
 */

/**
 * Lengan hoodie dicetak dengan pemetaan silinder (sablon melengkung mengikuti lengan, tidak melar).
 * Hasil pengukuran garis tengah lengan pada GLB hoodie. Ganti GLB => ukur ulang.
 */
export const HOODIE_SLEEVE = {
  /** radius lengan atas, dipakai mengubah sudut keliling menjadi jarak busur */
  armRadius: 0.093,
  /** jarak dari titik bahu ke pusat sablon saat slider Atas/Bawah = 0 */
  alongStart: 0.17,
  /** geser Kiri/Kanan -50..50% memutar sablon mengelilingi lengan sebesar +/- sudut ini (rad) */
  maxAngle: 1.2,
  /** point = titik garis tengah dekat bahu, axis = arah bahu->manset, facing = arah sablon menghadap (depan-atas-luar) */
  left: { point: [0.299, 0.173, -0.036], axis: [0.9007, -0.4339, -0.021], facing: [0.2269, 0.4288, 0.8744] },
  right: { point: [-0.299, 0.173, -0.036], axis: [-0.9007, -0.4339, -0.021], facing: [-0.2269, 0.4288, 0.8744] }
} as const;

/**
 * Foto 2D hoodie adalah render ortografis model 3D (tools: render2d.py) dengan lengan ditekuk ke
 * bawah agar mengisi kanvas. Parameter ini menghubungkan satuan model dengan piksel foto.
 */
export const HOODIE_2D = {
  /** piksel per satuan model pada kanvas 1024 px; titik (0,0) model = tengah kanvas */
  ppu: 950,
  /** sudut tekuk lengan ke bawah pada foto (rad) */
  bend: 0.8,
  /** tekukan naik halus dari bahu: jarak sepanjang lengan mulai dan selesai menekuk */
  rampStart: -0.02,
  rampEnd: 0.34
} as const;
