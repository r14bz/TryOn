import React, { useEffect, useState } from 'react';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { TextSpec } from '../types/sablon';
import { TEXT_COLORS, TEXT_FONTS, MAX_TEXT_LENGTH, ensureAllFontsLoaded } from '../data/textFonts';

interface TextEditorProps {
  spec: TextSpec;
  onChange: (spec: TextSpec) => void;
}

const labelCls = 'text-[10px] font-semibold uppercase tracking-wider text-zinc-400';

const ColorRow: React.FC<{ value: string; onPick: (hex: string) => void; label: string }> = ({ value, onPick, label }) => (
  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
    {TEXT_COLORS.map((c) => (
      <button
        key={c}
        type="button"
        aria-label={`${label} ${c}`}
        onClick={() => onPick(c)}
        style={{ backgroundColor: c }}
        className={`w-7 h-7 shrink-0 rounded-full border touch-manipulation ${
          value.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-brand ring-offset-2 ring-offset-zinc-950 border-transparent' : 'border-zinc-700'
        }`}
      />
    ))}
    <label className="w-7 h-7 shrink-0 rounded-full border border-zinc-700 overflow-hidden relative cursor-pointer" title="Warna bebas">
      <input
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'}
        onChange={(e) => onPick(e.target.value.toUpperCase())}
        className="absolute -inset-2 w-11 h-11 cursor-pointer"
      />
      <span
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'conic-gradient(#e53935,#fdd835,#43a047,#1e88e5,#8e24aa,#e53935)' }}
      />
    </label>
  </div>
);

/** Editor teks: isi, font, warna, garis tepi, jarak huruf, rata. Perubahan diterapkan langsung ke gambar sablon. */
export const TextEditor: React.FC<TextEditorProps> = ({ spec, onChange }) => {
  const [, setFontsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    ensureAllFontsLoaded().then(() => alive && setFontsReady(true)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const set = (u: Partial<TextSpec>) => onChange({ ...spec, ...u });
  const hasOutline = spec.outlineColor !== null;
  const empty = spec.content.trim() === '';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-brand/30 bg-zinc-900/60 p-3">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={labelCls}>Isi Teks</span>
          <span className="text-[10px] font-mono text-zinc-500">{spec.content.length}/{MAX_TEXT_LENGTH}</span>
        </div>
        <textarea
          value={spec.content}
          maxLength={MAX_TEXT_LENGTH}
          rows={2}
          onChange={(e) => set({ content: e.target.value })}
          placeholder="Ketik teks desain (Enter = baris baru)"
          className="w-full resize-none rounded-lg bg-zinc-950 border border-zinc-800 focus:border-brand/60 focus:outline-none px-3 py-2 text-sm text-zinc-100"
        />
        {empty && <p className="text-[10px] text-amber-400 mt-1">Teks kosong: gambar sablon belum diperbarui.</p>}
      </div>

      <div>
        <span className={`${labelCls} block mb-1.5`}>Font</span>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          {TEXT_FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => set({ fontId: f.id })}
              style={{ fontFamily: `"${f.family}", sans-serif`, fontWeight: f.weight, fontStyle: f.style }}
              className={`shrink-0 h-10 px-3 rounded-lg border text-sm whitespace-nowrap touch-manipulation ${
                spec.fontId === f.id
                  ? 'border-brand bg-brand/10 text-white'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={`${labelCls} block mb-1.5`}>Warna Teks</span>
        <ColorRow value={spec.color} label="Warna teks" onPick={(c) => set({ color: c })} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={labelCls}>Garis Tepi</span>
          <button
            type="button"
            role="switch"
            aria-checked={hasOutline}
            onClick={() => set({ outlineColor: hasOutline ? null : '#000000' })}
            className={`w-10 h-6 rounded-full relative transition-colors touch-manipulation ${hasOutline ? 'bg-brand' : 'bg-zinc-700'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${hasOutline ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
        </div>
        {hasOutline && (
          <div className="flex flex-col gap-2">
            <ColorRow value={spec.outlineColor ?? '#000000'} label="Warna garis tepi" onPick={(c) => set({ outlineColor: c })} />
            <label className="flex items-center gap-2 text-[11px] text-zinc-400">
              <span className="w-14 shrink-0">Tebal</span>
              <input
                type="range" min={1} max={12} step={1} value={spec.outlineWidth}
                onChange={(e) => set({ outlineWidth: Number(e.target.value) })}
                className="flex-1 accent-brand h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
              />
              <span className="w-8 text-right font-mono text-zinc-300">{spec.outlineWidth}</span>
            </label>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <label className="flex-1 flex items-center gap-2 text-[11px] text-zinc-400">
          <span className="w-14 shrink-0">Jarak</span>
          <input
            type="range" min={0} max={30} step={1} value={spec.letterSpacing}
            onChange={(e) => set({ letterSpacing: Number(e.target.value) })}
            className="flex-1 min-w-0 accent-brand h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </label>
        <div className="flex items-center gap-1 shrink-0">
          {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Icon]) => (
            <button
              key={a}
              type="button"
              aria-label={`Rata ${a}`}
              onClick={() => set({ align: a })}
              className={`w-8 h-8 rounded-md border flex items-center justify-center touch-manipulation ${
                spec.align === a ? 'border-brand bg-brand/10 text-brand' : 'border-zinc-800 bg-zinc-950 text-zinc-400'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
