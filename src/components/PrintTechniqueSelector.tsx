import React from 'react';
import { Layers, Sparkles, ShieldCheck, Check, Clock } from 'lucide-react';
import { PrintTechniqueInfo } from '../types/sablon';
import { PRINT_TECHNIQUES } from '../data/fabricData';

interface PrintTechniqueSelectorProps {
  selectedTechnique: PrintTechniqueInfo;
  onSelect: (technique: PrintTechniqueInfo) => void;
}

export const PrintTechniqueSelector: React.FC<PrintTechniqueSelectorProps> = ({
  selectedTechnique,
  onSelect
}) => {
  return (
    <div className="flex flex-col gap-4 text-zinc-200">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Teknologi &amp; Jenis Sablon
          </label>
          <span className="text-[11px] text-brand font-medium">
            {selectedTechnique.name}
          </span>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed mb-4">
          Setiap jenis sablon memberikan efek visual, pantulan cahaya, dan ketebalan tinta yang berbeda pada serat kaos.
        </p>
      </div>

      <div className="space-y-3">
        {PRINT_TECHNIQUES.map((tech) => {
          const isSelected = selectedTechnique.id === tech.id;
          return (
            <div
              key={tech.id}
              onClick={() => onSelect(tech)}
              className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                isSelected
                  ? 'bg-zinc-900 border-brand ring-1 ring-brand/30 shadow-lg shadow-brand/5'
                  : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/80'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{tech.name}</span>
                    {tech.id === 'dtf' && (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                        Bisa Satuan (1 pcs)
                      </span>
                    )}
                    {tech.id === 'plastisol' && (
                      <span className="text-[10px] font-mono text-brand bg-brand/10 px-1.5 py-0.5 rounded">
                        Distro Standard
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">
                    {tech.tagline}
                  </span>
                </div>
                <span className="text-xs font-mono font-semibold text-zinc-200">
                  +Rp {tech.costModifier.toLocaleString('id-ID')}
                </span>
              </div>

              <p className="text-xs text-zinc-400/90 leading-relaxed mt-2">
                {tech.description}
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-3 pt-2 border-t border-zinc-800 text-[10px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                  {tech.durability}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  Min. Order: {tech.minOrder} pcs
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
