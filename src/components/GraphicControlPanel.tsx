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
import { GraphicSettings, PlacementPresetId, PlacementSide, TextSpec, MAX_GRAPHICS } from '../types/sablon';
import { SAMPLE_ARTWORKS, SampleArtwork } from '../data/sampleArtworks';
import { prepareUploadedImage } from '../utils/imageUpload';
import { TextEditor } from './TextEditor';

interface GraphicControlPanelProps {
  graphics: GraphicSettings[];
  activeGraphic: GraphicSettings | null;
  onSelect: (id: string) => void;
  onAddImage: (image: { url: string; name: string }, presetId?: PlacementPresetId) => void;
  /** menambah layer teks baru (isi awal dibuat oleh App) */
  onAddText: () => void;
  /** mengubah teks pada layer aktif */
  onTextChange: (spec: TextSpec) => void;
  onRemove: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  /** Edits the active layer. Changing `side` also switches the studio view. */
  onChange: (updated: Partial<GraphicSettings>) => void;
}

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
  onAddText,
  onTextChange,
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

  // Sample artwork: adds it as a new layer (or replaces the active one when full)
  const addSampleArtwork = (sample: SampleArtwork) => {
    if (isFull && graphic) {
      onChange({ imageUrl: sample.dataUrl, imageName: sample.name });
      return;
    }
    onAddImage({ url: sample.dataUrl, name: sample.name }, sample.suggestedPreset);
  };

  return (
    <div className="flex flex-col gap-6 text-zinc-200">
      {/* 1. Layer list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Gambar
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

      {/* Editor teks: tampil jika layer aktif adalah teks */}
      {graphic?.text && <TextEditor spec={graphic.text} onChange={onTextChange} />}

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

        <button
          onClick={onAddText}
          disabled={isFull}
          className="mt-2 w-full h-11 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:border-brand/60 hover:bg-zinc-900 disabled:opacity-50 text-xs font-semibold text-zinc-200 flex items-center justify-center gap-2 touch-manipulation transition-all"
        >
          <span className="font-serif text-base font-bold text-brand leading-none">Aa</span>
          {isFull ? 'Batas gambar tercapai' : 'Tambah Teks'}
        </button>
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
          {/* 6. Color Filter & Ink Tints */}
          <div className="pt-2 border-t border-zinc-850">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
              Warna Tinta
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
