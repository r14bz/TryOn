import React, { useState } from 'react';
import { Calculator, Smartphone, Layers } from 'lucide-react';
import { usePwaInstall } from '../utils/pwaInstall';
import logo from '../assets/logo-try-d.png';

interface HeaderProps {
  onOpenExport: () => void;
  onOpenQuote: () => void;
  onOpenProduction: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenExport,
  onOpenQuote,
  onOpenProduction
}) => {
  const { mode: installMode, install } = usePwaInstall();
  const [showIosHint, setShowIosHint] = useState(false);

  return (
    <header className="flex items-center justify-between px-3 sm:px-6 h-[68px] border-b border-zinc-850 bg-zinc-950/95 backdrop-blur z-30 shrink-0">
      {/* Zone 1: Logo Try-D */}
      <div className="flex items-center min-w-0 flex-1">
        <a href="/" aria-label="Try-D - Try On Your Design" className="flex items-center min-w-0">
          <img src={logo} alt="Try-D" width={900} height={228} className="h-12 min-[400px]:h-[52px] sm:h-14 w-auto max-w-full object-contain object-left select-none" draggable={false} />
        </a>
      </div>

      {/* Zone 3: aksi utama (ukuran kecil agar muat di HP) */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <button
          onClick={onOpenProduction}
          title="Teknik sablon, bahan & ukuran"
          aria-label="Teknik sablon"
          className="h-8 w-8 sm:w-auto sm:px-3 text-[11px] sm:text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 touch-manipulation"
        >
          <Layers className="w-3.5 h-3.5 text-brand shrink-0" />
          <span className="hidden sm:inline">Teknik</span>
        </button>

        <button
          onClick={onOpenQuote}
          title="Rincian & Biaya Sablon"
          aria-label="Hitung biaya"
          className="h-8 w-7 sm:w-auto sm:min-w-8 px-0 sm:px-3 text-[11px] sm:text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 touch-manipulation"
        >
          <Calculator className="w-3.5 h-3.5 text-brand shrink-0" />
          <span className="hidden sm:inline">Biaya</span>
        </button>

        {installMode !== 'none' && (
          <div className="relative">
            <button
              onClick={() => (installMode === 'prompt' ? install() : setShowIosHint((v) => !v))}
              title="Install aplikasi Try-D"
              aria-label="Install aplikasi Try-D"
              className="h-8 w-7 sm:w-auto sm:min-w-8 px-0 sm:px-3 text-[11px] sm:text-xs font-semibold text-brand bg-zinc-900 hover:bg-zinc-800 border border-brand/40 rounded-lg transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 touch-manipulation"
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
