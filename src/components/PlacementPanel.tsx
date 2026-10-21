import React from 'react';
import { GraphicSettings, PlacementPresetId, PlacementSide } from '../types/sablon';
import { PLACEMENT_PRESETS } from '../data/fabricData';

interface PlacementPanelProps {
  graphics: GraphicSettings[];
  /** gambar yang sedang diatur */
  graphic: GraphicSettings | null;
  onSelect: (id: string) => void;
  onGraphicChange: (updated: Partial<GraphicSettings>) => void;
}

const SIDE_SHORT: Record<PlacementSide, string> = {
  front: 'Depan',
  back: 'Belakang',
  sleeve_left: 'Lengan Kiri',
  sleeve_right: 'Lengan Kanan'
};

const stepBtn =
  'w-8 h-8 shrink-0 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-[11px] font-bold text-brand touch-manipulation';
const rangeCls = 'flex-1 min-w-0 accent-brand h-1.5 bg-zinc-800 rounded-lg cursor-pointer';

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** besar langkah tombol -/+ */
  nudge: number;
  display: string;
  minus: string;
  plus: string;
  onChange: (v: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({ label, value, min, max, step, nudge, display, minus, plus, onChange }) => (
  <div className="flex items-center gap-1.5">
    <span className="w-[68px] shrink-0 text-zinc-400 font-medium whitespace-nowrap">{label}</span>
    <button className={stepBtn} onClick={() => onChange(Math.max(min, +(value - nudge).toFixed(2)))}>
      {minus}
    </button>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={rangeCls}
    />
    <button className={stepBtn} onClick={() => onChange(Math.min(max, +(value + nudge).toFixed(2)))}>
      {plus}
    </button>
    <span className="w-11 shrink-0 font-mono text-[10px] text-right text-zinc-300">{display}</span>
  </div>
);

/**
 * Kontrol posisi/ukuran sablon (tab "Posisi" di panel bawah). Memilih gambar yang diatur lewat
 * deretan thumbnail, lalu slider Kiri/Kanan, Atas/Bawah, Ukuran, dan Putar.
 */
export const PlacementPanel: React.FC<PlacementPanelProps> = ({ graphics, graphic, onSelect, onGraphicChange }) => {
  if (!graphic) {
    return (
      <div className="text-[11px] text-zinc-500 bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-center">
        Belum ada gambar. Tambahkan dari tab Desain.
      </div>
    );
  }

  const set = (u: Partial<GraphicSettings>) => onGraphicChange({ ...u, preset: 'custom' });
  const applyPreset = (id: PlacementPresetId) => {
    const p = PLACEMENT_PRESETS.find((x) => x.id === id);
    if (!p) return;
    onGraphicChange({ preset: id, side: p.side, scale: p.defaultScale, x: p.defaultX, y: p.defaultY, rotation: 0 });
  };
  const rotation = graphic.rotation > 180 ? graphic.rotation - 360 : graphic.rotation;

  return (
    <div className="flex flex-col gap-2 text-[11px] text-zinc-200">
      {/* Pilih gambar yang diatur */}
      <ul className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        {graphics.map((g) => {
          const active = g.id === graphic.id;
          return (
            <li
              key={g.id}
              onClick={() => onSelect(g.id)}
              className={`shrink-0 flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-xl border cursor-pointer touch-manipulation transition-colors ${
                active ? 'border-brand/70 bg-brand/10' : 'border-zinc-800 bg-zinc-900/70'
              }`}
            >
              <div className="w-9 h-9 shrink-0 rounded-lg bg-zinc-800 p-0.5 flex items-center justify-center">
                <img src={g.imageUrl} alt="" className={`max-w-full max-h-full object-contain ${g.visible ? '' : 'opacity-30'}`} />
              </div>
              <span className={`text-[10px] font-mono whitespace-nowrap ${active ? 'text-brand' : 'text-zinc-400'}`}>
                {SIDE_SHORT[g.side]}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Ukuran standar */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        {PLACEMENT_PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p.id)}
            className={`shrink-0 h-7 px-2.5 rounded-lg border text-[10px] font-medium whitespace-nowrap touch-manipulation ${
              graphic.preset === p.id
                ? 'border-brand/60 bg-zinc-800 text-brand'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {p.name.split(' (')[0]}
          </button>
        ))}
      </div>

      <SliderRow label="Kiri/Kanan" value={Math.round(graphic.x)} min={-50} max={50} step={1} nudge={2}
        display={`${Math.round(graphic.x)}%`} minus="◀" plus="▶" onChange={(v) => set({ x: v })} />
      <SliderRow label="Atas/Bawah" value={Math.round(graphic.y)} min={-50} max={50} step={1} nudge={2}
        display={`${Math.round(graphic.y)}%`} minus="▲" plus="▼" onChange={(v) => set({ y: v })} />
      <SliderRow label="Ukuran" value={graphic.scale} min={0.35} max={2} step={0.05} nudge={0.1}
        display={`${graphic.scale.toFixed(2)}×`} minus="−" plus="+" onChange={(v) => set({ scale: v })} />
      <SliderRow label="Putar" value={Math.round(rotation)} min={-180} max={180} step={1} nudge={5}
        display={`${Math.round(rotation)}°`} minus="−" plus="+" onChange={(v) => set({ rotation: v })} />

      <div className="flex justify-end pt-1 border-t border-zinc-800/70">
        <button
          onClick={() => set({ x: 0, y: 0, rotation: 0 })}
          title="Kembalikan posisi dan putaran ke tengah"
          className="px-3 h-8 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-400 hover:text-white touch-manipulation"
        >
          Tengah
        </button>
      </div>
    </div>
  );
};
