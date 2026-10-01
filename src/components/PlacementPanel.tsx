import React, { useState } from 'react';
import { ChevronDown, ChevronUp, RotateCw, Sliders } from 'lucide-react';
import { GraphicSettings } from '../types/sablon';
import { isDesktopViewport } from '../utils/viewport';

interface PlacementPanelProps {
  graphic: GraphicSettings;
  onGraphicChange: (updated: Partial<GraphicSettings>) => void;
  /** daftar gambar, ditampilkan di atas slider Kiri/Kanan */
  layers?: React.ReactNode;
}

// Pilihan terakhir pengguna (bertahan saat pindah 3D <-> 2D); null = belum pernah diubah
let lastExpanded: boolean | null = null;

const stepBtn =
  'w-7 h-7 shrink-0 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-[11px] font-bold text-amber-400 touch-manipulation';
const rangeCls = 'flex-1 min-w-0 accent-amber-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer';
const labelCls = 'w-[64px] shrink-0 text-zinc-400 font-medium whitespace-nowrap';
const valueCls = 'w-9 shrink-0 font-mono text-[10px] text-right text-zinc-300';

/**
 * Panel kontrol posisi/ukuran sablon. Lebarnya mengikuti layar (rata kiri-kanan),
 * barisnya rapat, dan labelnya tidak turun baris di layar HP.
 */
export const PlacementPanel: React.FC<PlacementPanelProps> = ({ graphic, onGraphicChange, layers }) => {
  // Awalnya tertutup di tampilan mobile agar kaos tidak tertutup panel
  const [expanded, setExpandedState] = useState<boolean>(() => lastExpanded ?? isDesktopViewport());
  const setExpanded = (value: boolean) => {
    lastExpanded = value;
    setExpandedState(value);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-zinc-950/95 border border-zinc-800 text-zinc-200 px-2.5 py-2 rounded-2xl shadow-2xl backdrop-blur-md pointer-events-auto">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        title={expanded ? 'Kecilkan Kontrol' : 'Buka Kontrol'}
        className="w-full flex items-center justify-between text-xs touch-manipulation"
      >
        <span className="flex items-center gap-1.5 font-bold text-amber-400">
          <Sliders className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Atur Posisi &amp; Ukuran Sablon</span>
        </span>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
        ) : (
          <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="flex flex-col gap-1.5 pt-2 mt-1.5 border-t border-zinc-800 text-[11px]">
          {layers}

          {/* Kiri / Kanan */}
          <div className="flex items-center gap-1.5">
            <span className={labelCls}>Kiri/Kanan</span>
            <button
              className={stepBtn}
              onClick={() => onGraphicChange({ x: Math.max(-50, graphic.x - 2), preset: 'custom' })}
            >
              ◀
            </button>
            <input
              type="range"
              min="-50"
              max="50"
              value={Math.round(graphic.x)}
              onChange={(e) => onGraphicChange({ x: Number(e.target.value), preset: 'custom' })}
              className={rangeCls}
            />
            <button
              className={stepBtn}
              onClick={() => onGraphicChange({ x: Math.min(50, graphic.x + 2), preset: 'custom' })}
            >
              ▶
            </button>
            <span className={valueCls}>{Math.round(graphic.x)}%</span>
          </div>

          {/* Atas / Bawah */}
          <div className="flex items-center gap-1.5">
            <span className={labelCls}>Atas/Bawah</span>
            <button
              className={stepBtn}
              onClick={() => onGraphicChange({ y: Math.max(-50, graphic.y - 2), preset: 'custom' })}
            >
              ▲
            </button>
            <input
              type="range"
              min="-50"
              max="50"
              value={Math.round(graphic.y)}
              onChange={(e) => onGraphicChange({ y: Number(e.target.value), preset: 'custom' })}
              className={rangeCls}
            />
            <button
              className={stepBtn}
              onClick={() => onGraphicChange({ y: Math.min(50, graphic.y + 2), preset: 'custom' })}
            >
              ▼
            </button>
            <span className={valueCls}>{Math.round(graphic.y)}%</span>
          </div>

          {/* Ukuran */}
          <div className="flex items-center gap-1.5">
            <span className={labelCls}>Ukuran</span>
            <button
              className={stepBtn}
              onClick={() =>
                onGraphicChange({ scale: Math.max(0.35, Number((graphic.scale - 0.1).toFixed(2))), preset: 'custom' })
              }
            >
              −
            </button>
            <input
              type="range"
              min="0.35"
              max="2.0"
              step="0.05"
              value={graphic.scale}
              onChange={(e) => onGraphicChange({ scale: Number(e.target.value), preset: 'custom' })}
              className={rangeCls}
            />
            <button
              className={stepBtn}
              onClick={() =>
                onGraphicChange({ scale: Math.min(2.0, Number((graphic.scale + 0.1).toFixed(2))), preset: 'custom' })
              }
            >
              +
            </button>
            <span className={valueCls}>{graphic.scale.toFixed(2)}×</span>
          </div>

          {/* Putar & Tengah */}
          <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-zinc-800/70">
            <button
              onClick={() => onGraphicChange({ rotation: (graphic.rotation + 15) % 360, preset: 'custom' })}
              className="px-2.5 h-7 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 flex items-center gap-1 touch-manipulation"
              title="Putar Sablon 15°"
            >
              <RotateCw className="w-3 h-3 text-amber-400" />
              <span>Putar {graphic.rotation}°</span>
            </button>
            <button
              onClick={() => onGraphicChange({ x: 0, y: 0, rotation: 0, preset: 'custom' })}
              className="px-2.5 h-7 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-400 hover:text-white touch-manipulation"
              title="Reset Posisi ke Tengah"
            >
              Tengah
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
