import React, { useRef } from 'react';
import { 
  Upload, 
  RotateCcw, 
  FlipHorizontal, 
  Trash2, 
  Image as ImageIcon, 
  Sliders, 
  Layers, 
  Move, 
  Grid3X3,
  Sparkles
} from 'lucide-react';
import { GraphicSettings, PlacementPresetId, PlacementSide } from '../types/sablon';
import { SAMPLE_ARTWORKS, SampleArtwork } from '../data/sampleArtworks';
import { PLACEMENT_PRESETS } from '../data/fabricData';

interface GraphicControlPanelProps {
  graphic: GraphicSettings;
  currentSide: PlacementSide;
  onChange: (updated: Partial<GraphicSettings>) => void;
  onSideChange: (side: PlacementSide) => void;
}

export const GraphicControlPanel: React.FC<GraphicControlPanelProps> = ({
  graphic,
  currentSide,
  onChange,
  onSideChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      onChange({
        imageUrl: dataUrl,
        imageName: file.name,
        preset: 'custom'
      });
    };
    reader.readAsDataURL(file);
  };

  // Preset Selection
  const applyPreset = (presetId: PlacementPresetId) => {
    const preset = PLACEMENT_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    if (preset.side !== currentSide) {
      onSideChange(preset.side);
    }

    onChange({
      preset: presetId,
      side: preset.side,
      scale: preset.defaultScale,
      x: preset.defaultX,
      y: preset.defaultY,
      rotation: 0
    });
  };

  // Sample artwork selection
  const selectSampleArtwork = (sample: SampleArtwork) => {
    applyPreset(sample.suggestedPreset);
    onChange({
      imageUrl: sample.dataUrl,
      imageName: sample.name
    });
  };

  const getSideLabel = (side: PlacementSide) => {
    switch (side) {
      case 'front': return 'Tampak Depan';
      case 'back': return 'Tampak Belakang';
      case 'sleeve_left': return 'Lengan Kiri';
      case 'sleeve_right': return 'Lengan Kanan';
    }
  };

  return (
    <div className="flex flex-col gap-6 text-zinc-200">
      {/* 1. Upload & Active Artwork */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Gambar Desain Sablon
          </label>
          {graphic.imageUrl && (
            <span className="text-[11px] text-amber-400 font-mono truncate max-w-[140px]">
              {graphic.imageName}
            </span>
          )}
        </div>

        {/* Upload Drop Zone / Button */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-800 hover:border-amber-500/60 bg-zinc-900/60 hover:bg-zinc-900 transition-all rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer group text-center"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFileUpload}
            className="hidden"
          />
          <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-amber-500/20 text-zinc-400 group-hover:text-amber-400 flex items-center justify-center mb-2 transition-colors">
            <Upload className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-zinc-200 group-hover:text-white">
            Upload Gambar / Foto Sendiri
          </span>
          <span className="text-[10px] text-zinc-500 mt-1">
            Mendukung PNG transparan, JPG, WebP, SVG (Maks 15MB)
          </span>
        </div>
      </div>

      {/* 2. Sample Artwork Library */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Pustaka Desain Contoh
          </label>
          <span className="text-[10px] text-zinc-500">Klik untuk langsung uji coba</span>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {SAMPLE_ARTWORKS.map((sample) => {
            const isSelected = graphic.imageName === sample.name;
            return (
              <button
                key={sample.id}
                onClick={() => selectSampleArtwork(sample)}
                className={`group relative aspect-square rounded-lg p-1.5 border transition-all flex flex-col items-center justify-center bg-zinc-900 ${
                  isSelected
                    ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-md'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
                title={sample.name}
              >
                <img
                  src={sample.dataUrl}
                  alt={sample.name}
                  className="w-full h-full object-contain filter group-hover:scale-105 transition-transform"
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Placement Side Selector */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Posisi Bagian Kaos
          </label>
          <span className="text-[10px] font-mono text-amber-400 font-semibold">
            {getSideLabel(graphic.side)}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
          <button
            onClick={() => {
              onSideChange('front');
              onChange({ side: 'front', preset: 'custom' });
            }}
            className={`min-h-[36px] py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
              graphic.side === 'front' 
                ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Depan
          </button>
          <button
            onClick={() => {
              onSideChange('sleeve_left');
              onChange({ side: 'sleeve_left', preset: 'custom' });
            }}
            className={`min-h-[36px] py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
              graphic.side === 'sleeve_left' 
                ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Lengan Kiri
          </button>
          <button
            onClick={() => {
              onSideChange('back');
              onChange({ side: 'back', preset: 'custom' });
            }}
            className={`min-h-[36px] py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
              graphic.side === 'back' 
                ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Belakang
          </button>
          <button
            onClick={() => {
              onSideChange('sleeve_right');
              onChange({ side: 'sleeve_right', preset: 'custom' });
            }}
            className={`min-h-[36px] py-1.5 px-2 text-xs font-medium rounded-lg transition-all ${
              graphic.side === 'sleeve_right' 
                ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm' 
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
                    ? 'bg-zinc-800 border-amber-500/60 text-amber-300 shadow-sm'
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
            className="text-[11px] text-zinc-500 hover:text-amber-400 flex items-center gap-1 transition-colors"
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
            className="w-full accent-amber-500 h-1.5 bg-zinc-850 rounded-lg appearance-none cursor-pointer"
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
            className="w-full accent-amber-500 h-1.5 bg-zinc-850 rounded-lg appearance-none cursor-pointer"
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
            className="w-full accent-amber-500 h-1.5 bg-zinc-850 rounded-lg appearance-none cursor-pointer"
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
            className="w-full accent-amber-500 h-1.5 bg-zinc-850 rounded-lg appearance-none cursor-pointer"
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
                ? 'border-amber-400 bg-amber-400/10 text-white font-medium'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Warna Asli Gambar
          </button>
          <button
            onClick={() => onChange({ colorFilter: 'monochrome_white' })}
            className={`p-2 rounded-lg border text-left transition-colors ${
              graphic.colorFilter === 'monochrome_white'
                ? 'border-amber-400 bg-amber-400/10 text-white font-medium'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sablon Putih (Monokrom)
          </button>
          <button
            onClick={() => onChange({ colorFilter: 'monochrome_black' })}
            className={`p-2 rounded-lg border text-left transition-colors ${
              graphic.colorFilter === 'monochrome_black'
                ? 'border-amber-400 bg-amber-400/10 text-white font-medium'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Sablon Hitam (Pekat)
          </button>
          <button
            onClick={() => onChange({ colorFilter: 'vintage_warm' })}
            className={`p-2 rounded-lg border text-left transition-colors ${
              graphic.colorFilter === 'vintage_warm'
                ? 'border-amber-400 bg-amber-400/10 text-white font-medium'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Vintage Sepia Tone
          </button>
        </div>
      </div>
    </div>
  );
};
