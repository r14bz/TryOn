import React, { useState } from 'react';
import { Check, Sparkles, Sliders, Info, ShieldCheck, Flame } from 'lucide-react';
import { FabricInfo, TshirtColor, GarmentSize } from '../types/sablon';
import { FABRICS, GARMENT_SIZES } from '../data/fabricData';
import { TSHIRT_COLORS } from '../data/colorData';

interface FabricColorSelectorProps {
  selectedFabric: FabricInfo;
  selectedColor: TshirtColor;
  selectedSize: GarmentSize;
  onFabricSelect: (fabric: FabricInfo) => void;
  onColorSelect: (color: TshirtColor) => void;
  onSizeSelect: (size: GarmentSize) => void;
  onInspectDetail: (fabric: FabricInfo) => void;
}

export const FabricColorSelector: React.FC<FabricColorSelectorProps> = ({
  selectedFabric,
  selectedColor,
  selectedSize,
  onFabricSelect,
  onColorSelect,
  onSizeSelect,
  onInspectDetail
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'monochrome' | 'earth' | 'streetwear' | 'pastel'>('all');
  const [customHex, setCustomHex] = useState(selectedColor.hex);

  const filteredColors = activeCategory === 'all'
    ? TSHIRT_COLORS
    : TSHIRT_COLORS.filter(c => c.category === activeCategory);

  const handleCustomHexChange = (hex: string) => {
    setCustomHex(hex);
    if (/^#[0-9A-F]{6}$/i.test(hex)) {
      onColorSelect({
        id: `custom_${hex.replace('#', '')}`,
        name: `Custom (${hex.toUpperCase()})`,
        hex: hex,
        category: 'streetwear',
        dark: true
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 text-zinc-200">
      {/* 1. Color Selection Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Warna Kaos Polos
          </label>
          <span className="text-xs text-brand font-medium">
            {selectedColor.name}
          </span>
        </div>

        {/* Color Palette Tabs */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-lg border border-zinc-800 text-[11px] mb-3 overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'monochrome', label: 'Basic & Mono' },
            { id: 'earth', label: 'Earth Tone' },
            { id: 'streetwear', label: 'Distro' },
            { id: 'pastel', label: 'Pastel' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id as any)}
              className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors ${
                activeCategory === tab.id
                  ? 'bg-zinc-800 text-white font-medium shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Color Swatch Grid */}
        <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 mb-3">
          {filteredColors.map((col) => {
            const isSelected = selectedColor.hex.toLowerCase() === col.hex.toLowerCase();
            return (
              <button
                key={col.id}
                onClick={() => onColorSelect(col)}
                title={col.name}
                className={`relative min-h-[44px] aspect-square rounded-xl transition-transform border flex items-center justify-center touch-manipulation active:scale-95 ${
                  isSelected
                    ? 'ring-2 ring-brand ring-offset-2 ring-offset-zinc-950 scale-105 border-white shadow-md'
                    : 'border-zinc-800 hover:scale-105'
                }`}
                style={{ backgroundColor: col.hex }}
              >
                {isSelected && (
                  <Check
                    className={`w-4 h-4 ${
                      col.dark ? 'text-white' : 'text-zinc-900'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Custom Hex Color Picker */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800">
          <input
            type="color"
            value={selectedColor.hex}
            onChange={(e) => handleCustomHexChange(e.target.value)}
            className="w-7 h-7 rounded border-none cursor-pointer bg-transparent"
          />
          <div className="flex-1 text-xs">
            <span className="text-zinc-400 block text-[10px]">Warna Bebas Kustom (Hex)</span>
            <input
              type="text"
              value={customHex}
              onChange={(e) => handleCustomHexChange(e.target.value)}
              className="bg-transparent text-white font-mono text-xs w-full focus:outline-none"
              placeholder="#161618"
            />
          </div>
        </div>
      </div>

      {/* 2. Fabric Material Selection Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Jenis Bahan &amp; Tekstur Kain
          </label>
          <span className="text-[11px] text-zinc-500">Tekstur simulasi fisik</span>
        </div>

        <div className="space-y-2.5">
          {FABRICS.map((fab) => {
            const isSelected = selectedFabric.id === fab.id;
            return (
              <div
                key={fab.id}
                onClick={() => onFabricSelect(fab)}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-zinc-900 border-brand ring-1 ring-brand/30 shadow-lg shadow-brand/5'
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/80'
                }`}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{fab.name}</span>
                      <span className="text-[10px] font-mono text-brand bg-brand/10 px-1.5 py-0.5 rounded">
                        {fab.gsm}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                      {fab.recommendedFor}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-zinc-200">
                    Rp {fab.basePrice.toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Tactile Rating Indicators */}
                <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-zinc-800/80 text-[10px]">
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Kelembutan:</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`w-2.5 h-1.5 rounded-sm ${
                            i <= fab.softness ? 'bg-brand' : 'bg-zinc-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Ketebalan:</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`w-2.5 h-1.5 rounded-sm ${
                            i <= fab.thickness ? 'bg-brand' : 'bg-zinc-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Sirkulasi Adem:</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`w-2.5 h-1.5 rounded-sm ${
                            i <= fab.breathability ? 'bg-brand' : 'bg-zinc-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick inspect button */}
                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500 text-[10px] italic">
                    {fab.textureCharacteristics}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onInspectDetail(fab);
                    }}
                    className="text-brand hover:text-brand/80 font-medium underline underline-offset-2 flex items-center gap-0.5"
                  >
                    Detail Serat →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Garment Size Selection */}
      <div className="pt-2 border-t border-zinc-850">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Ukuran Kaos (Size Chart)
          </label>
          <span className="text-[11px] font-mono text-zinc-400">
            {selectedSize.chestWidthCm} cm × {selectedSize.bodyLengthCm} cm
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {GARMENT_SIZES.map((sz) => {
            const isSelected = selectedSize.size === sz.size;
            return (
              <button
                key={sz.size}
                onClick={() => onSizeSelect(sz)}
                className={`min-h-[44px] py-1.5 rounded-xl border text-center transition-all touch-manipulation active:scale-95 ${
                  isSelected
                    ? 'bg-zinc-800 border-brand text-white font-bold shadow-sm'
                    : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="text-xs">{sz.size}</div>
                <div className="text-[9px] font-mono text-zinc-500 mt-0.5">{sz.chestWidthCm}cm</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
