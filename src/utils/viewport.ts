/** true di layar lebar (desktop). Di bawah 1024px aplikasi memakai tata letak mobile dengan dock bawah. */
export function isDesktopViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
}
