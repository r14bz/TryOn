import React, { useState } from 'react';
import { Download, Calculator, Smartphone } from 'lucide-react';
import { usePwaInstall } from '../utils/pwaInstall';
import logo from '../assets/logo-try-d.png';

interface HeaderProps {
  onOpenExport: () => void;
  onOpenQuote: () => void;
  onOpenTextureModal: () => void;
  activeSidebarTab: 'graphic' | 'fabric' | 'technique';
  onSelectSidebarTab: (tab: 'graphic' | 'fabric' | 'technique') => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenExport,
  onOpenQuote,
  onOpenTextureModal,
  activeSidebarTab,
  onSelectSidebarTab
}) => {
  const { mode: installMode, install } = usePwaInstall();
  const [showIosHint, setShowIosHint] = useState(false);

  return (
    <header className="flex items-center justify-between px-3 sm:px-6 h-16 border-b border-zinc-850 bg-zinc-950/95 backdrop-blur z-30 shrink-0">
      {/* Zone 1: Logo Try-D */}
      <div className="flex items-center min-w-0">
        <a href="/" aria-label="Try-D - Try On Your Design" className="flex items-center shrink-0">
          <img src={logo} alt="Try-D" width={560} height={193} className="h-10 min-[380px]:h-11 sm:h-12 w-auto select-none" draggable={false} />
        </a>
      </div>

      {/* Zone 2: 4-6 clean text navigation links (hidden on mobile, present on desktop) */}
      <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-zinc-400">
        <button
          onClick={() => onSelectSidebarTab('graphic')}
          className={`transition-colors whitespace-nowrap ${
            activeSidebarTab === 'graphic' ? 'text-white font-semibold' : 'hover:text-zinc-200'
          }`}
        >
          Desain Sablon
        </button>
        <button
          onClick={() => onSelectSidebarTab('fabric')}
          className={`transition-colors whitespace-nowrap ${
            activeSidebarTab === 'fabric' ? 'text-white font-semibold' : 'hover:text-zinc-200'
          }`}
        >
          Warna &amp; Bahan
        </button>
        <button
          onClick={() => onSelectSidebarTab('technique')}
          className={`transition-colors whitespace-nowrap ${
            activeSidebarTab === 'technique' ? 'text-white font-semibold' : 'hover:text-zinc-200'
          }`}
        >
          Teknik Sablon
        </button>
        <button
          onClick={onOpenTextureModal}
          className="hover:text-zinc-200 transition-colors whitespace-nowrap"
        >
          Inspeksi Serat
        </button>
      </nav>

      {/* Zone 3: aksi utama (ukuran kecil agar muat di HP) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          onClick={onOpenQuote}
          title="Rincian & Biaya Sablon"
          aria-label="Hitung biaya"
          className="h-8 min-w-8 px-2 sm:px-3 text-[11px] sm:text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 touch-manipulation"
        >
          <Calculator className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="hidden sm:inline">Hitung Biaya</span>
        </button>

        <button
          onClick={onOpenExport}
          className="h-8 px-2.5 sm:px-3 text-[11px] sm:text-xs font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm active:scale-95 transition-all whitespace-nowrap flex items-center gap-1 touch-manipulation"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>Simpan Gambar</span>
        </button>

        {installMode !== 'none' && (
          <div className="relative">
            <button
              onClick={() => (installMode === 'prompt' ? install() : setShowIosHint((v) => !v))}
              title="Install aplikasi Try-D"
              aria-label="Install aplikasi Try-D"
              className="h-8 min-w-8 px-2 sm:px-3 text-[11px] sm:text-xs font-semibold text-amber-300 bg-zinc-900 hover:bg-zinc-800 border border-amber-400/40 rounded-lg transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 touch-manipulation"
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Install</span>
            </button>

            {installMode === 'ios' && showIosHint && (
              <div
                role="status"
                className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-300 shadow-2xl"
              >
                Di iPhone/iPad: ketuk ikon <b className="text-white">Bagikan</b> di Safari, lalu pilih{' '}
                <b className="text-white">Tambahkan ke Layar Utama</b>.
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
