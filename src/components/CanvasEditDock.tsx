import React from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { GraphicSettings, MAX_GRAPHICS, PlacementSide } from '../types/sablon';
import { PlacementPanel } from './PlacementPanel';

interface CanvasEditDockProps {
  graphics: GraphicSettings[];
  /** gambar yang sedang diedit */
  graphic: GraphicSettings | null;
  onSelect?: (id: string) => void;
  onToggleVisible?: (id: string) => void;
  onRemove?: (id: string) => void;
  onGraphicChange: (updated: Partial<GraphicSettings>) => void;
}

const SIDE_SHORT: Record<PlacementSide, string> = {
  front: 'Depan',
  back: 'Belakang',
  sleeve_left: 'Leng. Kiri',
  sleeve_right: 'Leng. Kanan'
};

/**
 * Dock di bagian bawah kanvas: daftar "Gambar di Kaos" (di atas) dan panel
 * "Atur Posisi & Ukuran Sablon" (di bawah). Dipakai bersama oleh tampilan 3D dan 2D.
 */
export const CanvasEditDock: React.FC<CanvasEditDockProps> = ({
  graphics,
  graphic,
  onSelect,
  onToggleVisible,
  onRemove,
  onGraphicChange
}) => {
  if (graphics.length === 0) return null;

  return (
    <div className="absolute bottom-2 left-2 right-2 sm:left-4 sm:right-4 z-20 pointer-events-none flex flex-col gap-1.5">
      {/* Gambar di Kaos */}
      <div className="w-full max-w-md mx-auto pointer-events-auto bg-zinc-950/95 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-md px-2 py-1.5">
        <div className="flex items-center justify-between px-1 pb-1 text-[10px]">
          <span className="font-semibold uppercase tracking-wider text-zinc-400">Gambar di Kaos</span>
          <span className="font-mono text-zinc-500">
            {graphics.length}/{MAX_GRAPHICS}
          </span>
        </div>
        <ul className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {graphics.map((g) => {
            const active = g.id === graphic?.id;
            return (
              <li
                key={g.id}
                onClick={() => onSelect?.(g.id)}
                className={`shrink-0 flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-xl border cursor-pointer touch-manipulation transition-colors ${
                  active ? 'border-amber-500/70 bg-amber-400/10' : 'border-zinc-800 bg-zinc-900/70'
                }`}
              >
                <div className="w-8 h-8 shrink-0 rounded-lg bg-zinc-800 p-0.5 flex items-center justify-center">
                  <img
                    src={g.imageUrl}
                    alt=""
                    className={`max-w-full max-h-full object-contain ${g.visible ? '' : 'opacity-30'}`}
                  />
                </div>
                <div className="min-w-0 max-w-[84px]">
                  <div className={`text-[11px] font-semibold truncate ${active ? 'text-white' : 'text-zinc-300'}`}>
                    {g.imageName}
                  </div>
                  <div className="text-[9px] text-amber-400/90 font-mono">{SIDE_SHORT[g.side]}</div>
                </div>
                {active && (
                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    {onToggleVisible && (
                      <button
                        onClick={() => onToggleVisible(g.id)}
                        title={g.visible ? 'Sembunyikan' : 'Tampilkan'}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-white touch-manipulation"
                      >
                        {g.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    )}
                    {onRemove && (
                      <button
                        onClick={() => onRemove(g.id)}
                        title="Hapus gambar"
                        className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-red-400 touch-manipulation"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Atur Posisi & Ukuran Sablon */}
      {graphic && <PlacementPanel graphic={graphic} onGraphicChange={onGraphicChange} />}
    </div>
  );
};
