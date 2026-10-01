// Service worker minimal untuk Try-D.
// Chrome mensyaratkan service worker dengan fetch handler agar aplikasi bisa di-install.
// Sengaja TIDAK menyimpan cache apa pun: semua permintaan tetap langsung ke jaringan,
// jadi setiap deploy baru di Vercel langsung terlihat tanpa risiko versi lama tersangkut.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // tanpa respondWith: browser menangani permintaan seperti biasa
});
