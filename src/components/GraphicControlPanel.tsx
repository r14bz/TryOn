import React, { useRef, useState } from 'react';
import { 
  Upload, 
  RotateCcw, 
  Trash2, 
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Plus
} from 'lucide-react';
import { GraphicSettings, PlacementPresetId, PlacementSide, MAX_GRAPHICS } from '../types/sablon';
import { SAMPLE_ARTWORKS, SampleArtwork } from '../data/sampleArtworks';
import { PLACEMENT_PRESETS } from '../data/fabricData';
import { prepareUploadedImage } from '../utils/imageUpload';

interface GraphicControlPanelProps {
  graphics: GraphicSettings[];
  activeGraphic: GraphicSettings | null;
  onSelect: (id: string) => void;
  onAddImage: (image: { url: string; name: string }, presetId?: PlacementPresetId) => void;
  onRemove: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  /** Edits the active layer. Changing `side` also switches the studio view. */
  onChange: (updated: Partial<GraphicSettings>) => void;
}

const SIDE_LABELS: Record<PlacementSide, string> = {
  front: 'Tampak Depan',
  back: 'Tampak Belakang',
  sleeve_left: 'Lengan Kiri',
  sleeve_right: 'Lengan Kanan'
};

const SIDE_SHORT: Record<PlacementSide, string> = {
  front: 'Depan',
  back: 'Belakang',
  sleeve_left: 'Lengan Kiri',
  sleeve_right: 'Lengan Kanan'
};

export const GraphicControlPanel: React.FC<GraphicControlPanelProps> = ({
  graphics,
  activeGraphic,
  onSelect,
  onAddImage,
  onRemove,
  onToggleVisible,
  onMove,
  onChange
}) => {
  const graphic = activeGraphic;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const isFull = graphics.length >= MAX_GRAPHICS;

  // File upload: several files at once, validated + downscaled
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = Array.from(e.target.files ?? []);
    e.target.value = ''; // allow picking the same file again
    if (files.length === 0) return;

    setUploadError(null);
    setIsUploading(true);
    const errors: string[] = [];
    let slots = MAX_GRAPHICS - graphics.length;

    for (const file of files) {
      if (slots <= 0) {
        errors.push(`Maksimal ${MAX_GRAPHICS} gambar pada satu kaos.`);
        break;
      }
      try {
        const prepared = await prepareUploadedImage(file);
        onAddImage(prepared);
        slots--;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : `Gagal memuat ${file.name}`);
      }
    }
    setIsUploading(false);
    if (errors.length) setUploadError(errors.join(' '));
  };

  // Preset selection (applies to the active layer)
  const applyPreset = (presetId: PlacementPresetId) => {
    const preset = PLACEMENT_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    onChange({
      preset: presetId,
      side: preset.side,
      scale: preset.defaultScale,
      x: preset.defaultX,
      y: preset.defaultY,
      rotation: 0
    });
  };

  // Sample artwork: adds it as a new layer (or replaces the active one when full)
  const addSampleArtwork = (sample: SampleArtwork) => {
    if (isFull && graphic) {
      onChange({ imageUrl: sample.dataUrl, imageName: sample.name });
      return;
    }
    onAddImage({ url: sample.dataUrl, name: sample.name }, sample.suggestedPreset);
  };

  const getSideLabel = (side: PlacementSide) => SIDE_LABELS[side];

  return (
    <div className="flex flex-col gap-6 text-zinc-200">
      {/* 1. Layer list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Gambar di Kaos
          </label>
          <span className="text-[11px] text-zinc-500 font-mono">
            {graphics.length}/{MAX_GRAPHICS}
          </span>
        </div>

        {graphics.length === 0 ? (
          <div className="text-[11px] text-zinc-500 bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 text-center">
            Belum ada gambar. Upload atau pilih dari pustaka di bawah.
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {/* Top of the list = top-most print */}
            {[...graphics].reverse().map((g) => {
              const isActive = g.id === graphic?.id;
              const index = graphics.findIndex((x) => x.id === g.id);
              return (
                <li
                  key={g.id}
                  onClick={() => onSelect(g.id)}
                  className={`flex items-center gap-2 p-1.5 rounded-xl border cursor-pointer transition-colors ${
                    isActive
                      ? 'border-brand/70 bg-brand/10'
                      : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                  }`}
                >
                  <div className="w-10 h-10 shrink-0 rounded-lg bg-zinc-800 p-1 flex items-center justify-center">
                    <img
                      src={g.imageUrl}
                      alt=""
                      className={`max-w-full max-h-full object-contain ${g.visible ? '' : 'opacity-30'}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-zinc-300'}`}>
                      {g.imageName}
                    </div>
                    <div className="text-[10px] text-brand/90 font-mono">{SIDE_SHORT[g.side]}</div>
                  </div>
                  <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onMove(g.id, 1)}
                      disabled={index === graphics.length - 1}
                      title="Naikkan (di atas gambar lain)"
                      className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-25 touch-manipulation"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onMove(g.id, -1)}
                      disabled={index === 0}
                      title="Turunkan (di bawah gambar lain)"
                      className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-25 touch-manipulation"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onToggleVisible(g.id)}
                      title={g.visible ? 'Sembunyikan' : 'Tampilkan'}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-white touch-manipulation"
                    >
                      {g.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => onRemove(g.id)}
                      title="Hapus gambar"
                      className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-red-400 touch-manipulation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 2. Upload */}
      <div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isFull || isUploading}
          className="w-full border-2 border-dashed border-zinc-800 hover:border-brand/60 bg-zinc-900/60 hover:bg-zinc-900 disabled:opacity-50 disabled:hover:border-zinc-800 transition-all rounded-xl p-3 flex items-center justify-center gap-3 group text-left touch-manipulation"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFileUpload}
            className="hidden"
          />
          <div className="w-9 h-9 rounded-full bg-zinc-800 group-hover:bg-brand/20 text-zinc-400 group-hover:text-brand flex items-center justify-center shrink-0 transition-colors">
            {isUploading ? <Plus className="w-5 h-5 animate-pulse" /> : <Upload className="w-5 h-5" />}
          </div>
          <div>
            <span className="text-xs font-semibold text-zinc-200 group-hover:text-white block">
              {isFull ? 'Batas gambar tercapai' : 'Tambah Gambar / Foto Sendiri'}
            </span>
            <span className="text-[10px] text-zinc-500">
              PNG transparan, JPG, WebP, SVG (maks 15MB, bisa pilih beberapa file)
            </span>
          </div>
        </button>
        {uploadError && (
          <p className="text-[11px] text-red-400 mt-1.5" role="alert">{uploadError}</p>
        )}
      </div>

      {/* 3. Sample Artwork Library */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Pustaka Desain Contoh
          </label>
          <span className="text-[10px] text-zinc-500">
            {isFull ? 'Klik untuk mengganti gambar aktif' : 'Klik untuk menambahkan'}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {SAMPLE_ARTWORKS.map((sample) => {
            const isSelected = graphics.some((g) => g.imageName === sample.name);
            return (
              <button
                key={sample.id}
                onClick={() => addSampleArtwork(sample)}
                className={`group relative aspect-square rounded-lg p-1.5 border transition-all flex flex-col items-center justify-center bg-zinc-900 ${
                  isSelected
                    ? 'border-brand ring-2 ring-brand/20 shadow-md'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
                title={sample.name}
              >
                <img
                  src={sample.dataUrl}
                  alt={sample.name}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                />
              </button>
            );
          })}
        </div>
      </div>

      {graphic ? (
        <>
          <div className="text-[11px] text-zinc-500 -mb-3">
            Pengaturan untuk: <span className="text-brand font-semibold">{graphic.imageName}</span>
          </div>
          {/* 3. Placement Side Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Posisi Bagian Kaos
              </label>
              <span className="text-[10px] font-mono text-brand font-semibold">
                {getSideLabel(graphic.side)}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
              <button
                onClick={() => {
                  onChange({ side: 'front', preset: 'custom' });
                }}
                className={`min-h-[36px] py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                  graphic.side === 'front' 
                    ? 'bg-brand text-zinc-950 font-bold shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Depan
              </button>
              <button
                onClick={() => {
                  onChange({ side: 'sleeve_left', preset: 'custom' });
                }}
                className={`min-h-[36px] py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                  graphic.side === 'sleeve_left' 
                    ? 'bg-brand text-zinc-950 font-bold shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Lengan Kiri
              </button>
              <button
                onClick={() => {
                  onChange({ side: 'back', preset: 'custom' });
                }}
                className={`min-h-[36px] py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                  graphic.side === 'back' 
                    ? 'bg-brand text-zinc-950 font-bold shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Belakang
              </button>
              <button
                onClick={() => {
                  onChange({ side: 'sleeve_right', preset: 'custom' });
                }}
                className={`min-h-[36px] py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
                  graphic.side === 'sleeve_right' 
                    ? 'bg-brand text-zinc-950 font-bold shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Lengan Kanan
              </button>
            </div>
          </div>

          {/* 4. Placement Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Preset Ukuran Standar
              </label>
              <span className="text-[10px] text-zinc-500">Standar distro ID</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {PLACEMENT_PRESETS.map((preset) => {
                const isActive = graphic.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset.id)}
                    className={`min-h-[50px] p-2.5 text-left rounded-xl border text-xs font-medium transition-all touch-manipulation active:scale-[0.98] ${
                      isActive
                        ? 'bg-zinc-800 border-brand/60 text-brand shadow-sm'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="truncate font-semibold">{preset.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {preset.dimensionsCm.width} × {preset.dimensionsCm.height} cm · {getSideLabel(preset.side)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Fine Tune Geometry Sliders */}
          <div className="space-y-4 pt-2 border-t border-zinc-850">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Penyesuaian Presisi (Custom)
              </span>
              <button
                onClick={() => {
                  onChange({ x: 0, y: graphic.side === 'front' ? 2 : 0, scale: 1.0, rotation: 0, opacity: 1.0, preset: 'custom' });
                }}
                className="text-[11px] text-zinc-500 hover:text-brand flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Posisi
              </button>
            </div>

            {/* Scale Slider */}
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Ukuran / Skala Gambar</span>
                <span className="font-mono text-zinc-200">{Math.round(graphic.scale * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.05"
                value={graphic.scale}
                onChange={(e) => onChange({ scale: parseFloat(e.target.value), preset: 'custom' })}
                className="w-full accent-brand h-1.5 bg-zinc-850 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Rotation Slider */}
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Sudut Rotasi Kemiringan</span>
                <span className="font-mono text-zinc-200">{graphic.rotation}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={graphic.rotation}
                onChange={(e) => onChange({ rotation: parseInt(e.target.value), preset: 'custom' })}
                className="w-full accent-brand h-1.5 bg-zinc-850 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Position X Slider */}
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Geser Horizontal (Kiri / Kanan)</span>
                <span className="font-mono text-zinc-200">{Math.round(graphic.x)}%</span>
              </div>
              <input
                type="range"
                min="-40"
                max="40"
                step="1"
                value={graphic.x}
                onChange={(e) => onChange({ x: parseInt(e.target.value), preset: 'custom' })}
                className="w-full accent-brand h-1.5 bg-zinc-850 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Position Y Slider */}
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Geser Vertikal (Atas / Bawah)</span>
                <span className="font-mono text-zinc-200">{Math.round(graphic.y)}%</span>
              </div>
              <input
                type="range"
                min="-40"
                max="40"
                step="1"
                value={graphic.y}
                onChange={(e) => onChange({ y: parseInt(e.target.value), preset: 'custom' })}
                className="w-full accent-brand h-1.5 bg-zinc-850 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* 6. Color Filter & Ink Tints */}
          <div className="pt-2 border-t border-zinc-850">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
              Filter Tinta Sablon
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => onChange({ colorFilter: 'original' })}
                className={`p-2 rounded-lg border text-left transition-colors ${
                  graphic.colorFilter === 'original'
                    ? 'border-brand bg-brand/10 text-white font-medium'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Warna Asli Gambar
              </button>
              <button
                onClick={() => onChange({ colorFilter: 'monochrome_white' })}
                className={`p-2 rounded-lg border text-left transition-colors ${
                  graphic.colorFilter === 'monochrome_white'
                    ? 'border-brand bg-brand/10 text-white font-medium'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sablon Putih (Monokrom)
              </button>
              <button
                onClick={() => onChange({ colorFilter: 'monochrome_black' })}
                className={`p-2 rounded-lg border text-left transition-colors ${
                  graphic.colorFilter === 'monochrome_black'
                    ? 'border-brand bg-brand/10 text-white font-medium'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sablon Hitam (Pekat)
              </button>
              <button
                onClick={() => onChange({ colorFilter: 'vintage_warm' })}
                className={`p-2 rounded-lg border text-left transition-colors ${
                  graphic.colorFilter === 'vintage_warm'
                    ? 'border-brand bg-brand/10 text-white font-medium'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Vintage Sepia Tone
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
