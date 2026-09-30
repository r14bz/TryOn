import React, { useState } from 'react';
import { X, Sparkles, Check, Droplets, Wind, ShieldAlert, Cpu } from 'lucide-react';
import { FabricInfo, TshirtColor } from '../types/sablon';
import { FABRICS } from '../data/fabricData';
import { createFabricTexturePattern } from '../utils/fabricRenderer';

interface TextureInspectModalProps {
  fabric: FabricInfo;
  color: TshirtColor;
  onClose: () => void;
  onSelectFabric: (f: FabricInfo) => void;
}

export const TextureInspectModal: React.FC<TextureInspectModalProps> = ({
  fabric,
  color,
  onClose,
  onSelectFabric
}) => {
  const [zoomLevel, setZoomLevel] = useState<2 | 4 | 8>(4);
  const [activeFabric, setActiveFabric] = useState<FabricInfo>(fabric);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="max-w-2xl w-full bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[88dvh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-white font-display">
                Inspeksi Makro Serat Kain
              </h2>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                {activeFabric.gsm}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
              Gambaran tekstur fisik dan karakter kain kaos polos
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-colors touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
          {/* Fabric switcher buttons inside modal */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {FABRICS.map(f => {
              const isActive = f.id === activeFabric.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFabric(f)}
                  className={`min-h-[44px] p-2.5 rounded-xl border text-left text-xs transition-all touch-manipulation active:scale-[0.98] ${
                    isActive
                      ? 'bg-zinc-800 border-amber-500 text-white font-semibold shadow-sm'
                      : 'border-zinc-800 text-zinc-400 hover:text-white bg-zinc-950/40'
                  }`}
                >
                  <div className="truncate">{f.shortName}</div>
                  <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{f.gsm}</div>
                </button>
              );
            })}
          </div>

          {/* Micro Weave Simulation Window */}
          <div className="relative rounded-xl overflow-hidden border border-zinc-750 bg-zinc-950 p-6 flex flex-col items-center justify-center min-h-[220px]">
            {/* Visual Weave Simulation Background */}
            <div 
              className="absolute inset-0 opacity-80"
              style={{
                backgroundColor: color.hex,
                backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255,255,255,${activeFabric.sheen * 0.3}) 0%, rgba(0,0,0,0.4) 100%)`
              }}
            />

            {/* Weave Knit Rib Overlay */}
            <div 
              className="absolute inset-0 mix-blend-overlay opacity-60"
              style={{
                backgroundImage: activeFabric.id === 'heavyweight_16s' 
                  ? 'repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 0, transparent 6px)' 
                  : activeFabric.id === 'slub_cotton'
                  ? 'repeating-linear-gradient(0deg, #fff 0, #fff 1.5px, transparent 0, transparent 8px)'
                  : activeFabric.id === 'cotton_bamboo'
                  ? 'radial-gradient(ellipse at center, rgba(255,255,255,0.4) 0%, transparent 70%)'
                  : 'repeating-linear-gradient(90deg, #000 0, #000 1px, transparent 0, transparent 3px)'
              }}
            />

            {/* Central Macro Loupe Badge */}
            <div className="relative z-10 bg-zinc-950/80 backdrop-blur-md border border-zinc-700/80 rounded-xl p-4 text-center max-w-sm">
              <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 block mb-1">
                Visual Makro: {activeFabric.name}
              </span>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {activeFabric.textureCharacteristics}
              </p>
              <div className="mt-2 text-[10px] text-zinc-400 font-mono">
                Warna Kaos: {color.name} ({color.hex})
              </div>
            </div>
          </div>

          {/* Fabric Characteristic Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                <Wind className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-zinc-200">Sirkulasi Tropis</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {activeFabric.breathability >= 4 
                  ? 'Sangat adem, menyerap keringat optimal untuk cuaca panas.'
                  : 'Lebih tebal & padat, cocok untuk ruangan ber-AC atau malam hari.'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                <Droplets className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-zinc-200">Daya Ikat Sablon</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {activeFabric.id === 'cotton_bamboo' 
                  ? 'Permukaan licin mewah, paling cocok dengan sablon DTF & Rubber.'
                  : 'Serat kapas kokoh, mengikat sablon Plastisol & Discharge dengan kuat.'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800">
              <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-zinc-200">Karakter Jatuh (Drape)</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {activeFabric.thickness >= 4
                  ? 'Struktur kaku & boxy fit khas potongan streetwear oversized.'
                  : 'Jatuh lemas mengikuti lekuk bahu dengan siluet kasual.'}
              </p>
            </div>
          </div>

          {/* Description & Recommended For */}
          <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              Rekomendasi Pemakaian
            </h4>
            <p className="text-xs text-zinc-300 leading-relaxed mb-2">
              {activeFabric.description}
            </p>
            <div className="text-xs text-amber-400/90 font-medium">
              💡 Rekomendasi: {activeFabric.recommendedFor}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between bg-zinc-950/50">
          <div className="text-xs">
            <span className="text-zinc-500">Estimasi Dasar Bahan: </span>
            <span className="font-mono font-bold text-white">
              Rp {activeFabric.basePrice.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white"
            >
              Tutup
            </button>
            <button
              onClick={() => {
                onSelectFabric(activeFabric);
                onClose();
              }}
              className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Gunakan Bahan Ini
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
