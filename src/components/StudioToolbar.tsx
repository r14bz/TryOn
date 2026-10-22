import React from 'react';
import { Box, Image, Sun, Moon, Compass, ChevronDown } from 'lucide-react';
import { PlacementSide, StudioBgColor, GarmentModel } from '../types/sablon';
import { GARMENT_MODELS } from '../data/garmentModels';

interface StudioToolbarProps {
  studioMode: '3d' | '2d';
  onModeChange: (mode: '3d' | '2d') => void;
  garmentModel: GarmentModel;
  onGarmentModelChange: (model: GarmentModel) => void;
  currentSide: PlacementSide;
  onSideChange: (side: PlacementSide) => void;
  /** navigasi sisi (Depan/Lengan/Belakang) ditampilkan atau disembunyikan */
  showSideNav: boolean;
  onToggleSideNav: () => void;
  studioBgColor: StudioBgColor;
  onStudioBgChange: (bg: StudioBgColor) => void;
}

const SIDES: Array<{ id: PlacementSide; label: string }> = [
  { id: 'front', label: 'Depan' },
  { id: 'sleeve_left', label: 'Lengan Kiri' },
  { id: 'back', label: 'Belakang' },
  { id: 'sleeve_right', label: 'Lengan Kanan' }
];

/**
 * Toolbar kanvas. Baris 1: mode 3D/2D, dropdown model, tombol navigasi sisi, tema gelap/terang.
 * Baris 2 (bisa disembunyikan): navigasi sisi yang mengikuti putaran model.
 */
export const StudioToolbar: React.FC<StudioToolbarProps> = ({
  studioMode,
  onModeChange,
  garmentModel,
  onGarmentModelChange,
  currentSide,
  onSideChange,
  showSideNav,
  onToggleSideNav,
  studioBgColor,
  onStudioBgChange
}) => {
  const dark = studioBgColor === 'black';
  const box = dark ? 'bg-zinc-900/90 border-zinc-800 text-zinc-300' : 'bg-white/90 border-zinc-200 text-zinc-700';
  const idle = dark ? 'hover:text-brand text-zinc-400' : 'hover:text-zinc-900 text-zinc-600';

  return (
    <div className="w-full z-20 p-1.5 sm:p-2 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {/* 3D / 2D */}
        <div className={`flex items-center p-0.5 rounded-xl border shadow-sm backdrop-blur text-xs font-semibold ${box}`}>
          {([['3d', Box, '3D'], ['2d', Image, '2D']] as const).map(([mode, Icon, label]) => (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              aria-pressed={studioMode === mode}
              className={`min-h-[32px] px-2.5 rounded-lg flex items-center gap-1.5 transition-all touch-manipulation ${
                studioMode === mode ? 'bg-brand text-zinc-950 font-bold shadow-sm' : idle
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Dropdown model pakaian */}
        <div className={`relative flex items-center rounded-xl border shadow-sm backdrop-blur ${box}`}>
          <select
            value={garmentModel}
            onChange={(e) => onGarmentModelChange(e.target.value as GarmentModel)}
            aria-label="Pilih model pakaian"
            className="appearance-none bg-transparent min-h-[36px] pl-3 pr-7 text-xs font-semibold focus:outline-none cursor-pointer touch-manipulation"
          >
            {GARMENT_MODELS.map((m) => (
              <option key={m.id} value={m.id} className="text-zinc-900">
                {m.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2 pointer-events-none text-brand" />
        </div>

        <div className="flex-1" />

        {/* Tampil/sembunyi navigasi sisi */}
        <button
          onClick={onToggleSideNav}
          aria-pressed={showSideNav}
          title={showSideNav ? 'Sembunyikan navigasi sisi' : 'Tampilkan navigasi sisi'}
          className={`h-9 w-9 rounded-xl border flex items-center justify-center shadow-sm backdrop-blur transition-all touch-manipulation ${
            showSideNav ? 'bg-brand text-zinc-950 border-brand' : box
          }`}
        >
          <Compass className="w-4 h-4" />
        </button>

        {/* Tema studio */}
        <button
          onClick={() => onStudioBgChange(dark ? 'white' : 'black')}
          title={`Ubah latar studio ke ${dark ? 'putih' : 'hitam'}`}
          aria-label="Ubah tema studio"
          className={`h-9 w-9 rounded-xl border flex items-center justify-center shadow-sm backdrop-blur transition-all touch-manipulation ${box}`}
        >
          {dark ? <Moon className="w-4 h-4 text-brand" /> : <Sun className="w-4 h-4 text-zinc-900" />}
        </button>
      </div>

      {showSideNav && (
        <div className="flex justify-center overflow-x-auto scrollbar-none">
          <div className={`flex items-center p-0.5 rounded-xl border shadow-sm backdrop-blur text-xs font-semibold shrink-0 ${box}`}>
            {SIDES.map((s) => (
              <button
                key={s.id}
                onClick={() => onSideChange(s.id)}
                className={`min-h-[30px] px-2.5 sm:px-3 rounded-lg transition-all touch-manipulation whitespace-nowrap ${
                  currentSide === s.id
                    ? dark ? 'bg-zinc-800 text-brand font-bold shadow-sm' : 'bg-zinc-900 text-white font-bold shadow-sm'
                    : idle
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
