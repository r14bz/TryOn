import React from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { GraphicSettings, PlacementSide } from '../types/sablon';
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
  sleeve_left: 'Tgn. Kiri',
  sleeve_right: 'Tgn. Kanan'
};

/**
 * Dock di bagian bawah kanvas: panel "Atur Posisi & Ukuran Sablon" yang di dalamnya
 * (di atas slider Kiri/Kanan) memuat daftar gambar di kaos. Daftar ikut tertutup saat
 * panel ditutup, sehingga kaos tidak terhalang. Dipakai bersama oleh tampilan 3D dan 2D.
 */
export const CanvasEditDock: React.FC<CanvasEditDockProps> = ({
  graphics,
  graphic,
  onSelect,
  onToggleVisible,
  onRemove,
  onGraphicChange
}) => {
  if (graphics.length === 0 || !graphic) return null;

  const layerList = (
    <ul className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
      {graphics.map((g) => {
        const active = g.id === graphic.id;
        return (
          <li
            key={g.id}
            onClick={() => onSelect?.(g.id)}
            className={`shrink-0 flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-xl border cursor-pointer touch-manipulation transition-colors ${
              active ? 'border-brand/70 bg-brand/10' : 'border-zinc-800 bg-zinc-900/70'
            }`}
          >
            <div className="w-9 h-9 shrink-0 rounded-lg bg-zinc-800 p-0.5 flex items-center justify-center">
              <img
                src={g.imageUrl}
                alt=""
                className={`max-w-full max-h-full object-contain ${g.visible ? '' : 'opacity-30'}`}
              />
            </div>
            <span
              className={`text-[10px] font-mono whitespace-nowrap ${active ? 'text-brand' : 'text-brand/80'}`}
            >
              {SIDE_SHORT[g.side]}
            </span>
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
  );

  return (
    <div className="absolute bottom-2 left-2 right-2 sm:left-4 sm:right-4 z-20 pointer-events-none">
      <PlacementPanel graphic={graphic} onGraphicChange={onGraphicChange} layers={layerList} />
    </div>
  );
};
