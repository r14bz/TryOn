import React, { useState } from 'react';
import { X, Layers, Shirt, Microscope } from 'lucide-react';
import { FabricInfo, GarmentSize, PrintTechniqueInfo, TshirtColor } from '../types/sablon';
import { PrintTechniqueSelector } from './PrintTechniqueSelector';
import { FabricColorSelector } from './FabricColorSelector';

interface ProductionSheetProps {
  selectedTechnique: PrintTechniqueInfo;
  selectedFabric: FabricInfo;
  selectedColor: TshirtColor;
  selectedSize: GarmentSize;
  onTechniqueSelect: (t: PrintTechniqueInfo) => void;
  onFabricSelect: (f: FabricInfo) => void;
  onSizeSelect: (s: GarmentSize) => void;
  onInspectFabric: (f: FabricInfo) => void;
  onClose: () => void;
}

/**
 * Lembar "Teknik Sablon": jenis sablon + bahan kain + ukuran. Dibuka dari tombol di header agar
 * tidak memakan ruang panel bawah.
 */
export const ProductionSheet: React.FC<ProductionSheetProps> = ({
  selectedTechnique,
  selectedFabric,
  selectedColor,
  selectedSize,
  onTechniqueSelect,
  onFabricSelect,
  onSizeSelect,
  onInspectFabric,
  onClose
}) => {
  const [tab, setTab] = useState<'technique' | 'material'>('technique');
  const tabCls = (active: boolean) =>
    `flex-1 min-h-[44px] text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 touch-manipulation transition-colors ${
      active ? 'border-brand text-white font-bold' : 'border-transparent text-zinc-400 hover:text-zinc-200'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Teknik sablon dan bahan"
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[88dvh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center border-b border-zinc-850 px-2 shrink-0">
          <button className={tabCls(tab === 'technique')} onClick={() => setTab('technique')}>
            <Layers className="w-3.5 h-3.5" />
            Teknik Sablon
          </button>
          <button className={tabCls(tab === 'material')} onClick={() => setTab('material')}>
            <Shirt className="w-3.5 h-3.5" />
            Bahan &amp; Ukuran
          </button>
          <button onClick={onClose} aria-label="Tutup" className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white touch-manipulation">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {tab === 'technique' ? (
            <PrintTechniqueSelector selectedTechnique={selectedTechnique} onSelect={onTechniqueSelect} />
          ) : (
            <>
              <FabricColorSelector
                show="material"
                selectedFabric={selectedFabric}
                selectedColor={selectedColor}
                selectedSize={selectedSize}
                onFabricSelect={onFabricSelect}
                onColorSelect={() => undefined}
                onSizeSelect={onSizeSelect}
                onInspectDetail={onInspectFabric}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
