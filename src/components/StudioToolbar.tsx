import React from 'react';
import { 
  Box, 
  Image, 
  Sun, 
  Moon, 
  Maximize2, 
  Minimize2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { PlacementSide, StudioBgColor, GarmentSize } from '../types/sablon';

interface StudioToolbarProps {
  studioMode: '3d' | '2d';
  onModeChange: (mode: '3d' | '2d') => void;
  currentSide: PlacementSide;
  onSideChange: (side: PlacementSide) => void;
  studioBgColor: StudioBgColor;
  onStudioBgChange: (bg: StudioBgColor) => void;
  garmentSize: GarmentSize;
  printWidthCm: string;
  printHeightCm: string;
  isCustomizerExpanded: boolean;
  onToggleCustomizer: () => void;
}

export const StudioToolbar: React.FC<StudioToolbarProps> = ({
  studioMode,
  onModeChange,
  currentSide,
  onSideChange,
  studioBgColor,
  onStudioBgChange,
  garmentSize,
  printWidthCm,
  printHeightCm,
  isCustomizerExpanded,
  onToggleCustomizer
}) => {
  const isDarkStudio = studioBgColor === 'black';

  return (
    <div className="w-full z-20 pointer-events-none p-2 sm:p-3">
      {/* Container: 2-tier on mobile, single flex row on desktop to PREVENT ANY OVERLAP */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-full">
        
        {/* Row 1 (Mobile) / Left Group (Desktop): Mode Switcher + Background & Panel Toggle on mobile */}
        <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2 pointer-events-auto">
          {/* 3D vs 2D Mode Toggle */}
          <div className={`flex items-center p-0.5 rounded-xl border shadow-sm backdrop-blur text-xs font-semibold ${
            isDarkStudio 
              ? 'bg-zinc-900/90 border-zinc-800 text-zinc-300' 
              : 'bg-white/90 border-zinc-200 text-zinc-700'
          }`}>
            <button
              onClick={() => onModeChange('3d')}
              className={`min-h-[32px] px-2.5 sm:px-3 rounded-lg flex items-center gap-1.5 transition-all touch-manipulation ${
                studioMode === '3d'
                  ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                  : isDarkStudio ? 'hover:text-amber-400 text-zinc-400' : 'hover:text-zinc-900 text-zinc-600'
              }`}
            >
              <Box className="w-3.5 h-3.5 shrink-0" />
              <span>3D (360°)</span>
            </button>
            <button
              onClick={() => onModeChange('2d')}
              className={`min-h-[32px] px-2.5 sm:px-3 rounded-lg flex items-center gap-1.5 transition-all touch-manipulation ${
                studioMode === '2d'
                  ? 'bg-amber-400 text-zinc-950 font-bold shadow-sm'
                  : isDarkStudio ? 'hover:text-amber-400 text-zinc-400' : 'hover:text-zinc-900 text-zinc-600'
              }`}
            >
              <Image className="w-3.5 h-3.5 shrink-0" />
              <span>2D Foto</span>
            </button>
          </div>

          {/* Mobile-only right cluster: Background theme & Expand/Collapse toggle */}
          <div className="flex sm:hidden items-center gap-1.5 pointer-events-auto">
            <button
              onClick={() => onStudioBgChange(isDarkStudio ? 'white' : 'black')}
              title={`Ubah background studio ke ${isDarkStudio ? 'Putih' : 'Hitam'}`}
              className={`h-8 px-2 rounded-lg border text-xs flex items-center gap-1 shadow-sm transition-all ${
                isDarkStudio 
                  ? 'bg-zinc-900/90 border-zinc-800 text-zinc-200' 
                  : 'bg-white/90 border-zinc-200 text-zinc-800'
              }`}
            >
              {isDarkStudio ? (
                <Moon className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              )}
            </button>

            <button
              onClick={onToggleCustomizer}
              title={isCustomizerExpanded ? "Tutup panel (Kanvas Penuh)" : "Buka panel kustomisasi"}
              className={`h-8 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1 shadow-sm transition-all ${
                !isCustomizerExpanded
                  ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-amber-400/20'
                  : isDarkStudio 
                  ? 'bg-zinc-900/90 border-zinc-800 text-zinc-300' 
                  : 'bg-white/90 border-zinc-200 text-zinc-700'
              }`}
            >
              {!isCustomizerExpanded ? (
                <>
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Panel</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-amber-500" />
                  <span className="hidden xs:inline">Penuh</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Row 2 (Mobile) / Center Group (Desktop): Angle / Side View Switcher */}
        <div className="w-full sm:w-auto flex items-center justify-center pointer-events-auto overflow-x-auto py-0.5 scrollbar-none">
          <div className={`flex items-center p-0.5 rounded-xl border shadow-sm backdrop-blur text-xs font-semibold shrink-0 ${
            isDarkStudio 
              ? 'bg-zinc-900/90 border-zinc-800 text-zinc-300' 
              : 'bg-white/90 border-zinc-200 text-zinc-700'
          }`}>
            <button
              onClick={() => onSideChange('front')}
              className={`min-h-[30px] sm:min-h-[32px] px-2.5 sm:px-3 rounded-lg transition-all touch-manipulation whitespace-nowrap ${
                currentSide === 'front'
                  ? isDarkStudio ? 'bg-zinc-800 text-amber-300 font-bold shadow-sm' : 'bg-zinc-900 text-white font-bold shadow-sm'
                  : 'hover:text-amber-500'
              }`}
            >
              Depan
            </button>

            {studioMode === '3d' && (
              <button
                onClick={() => onSideChange('sleeve_left')}
                className={`min-h-[30px] sm:min-h-[32px] px-2.5 sm:px-3 rounded-lg transition-all touch-manipulation whitespace-nowrap ${
                  currentSide === 'sleeve_left'
                    ? isDarkStudio ? 'bg-zinc-800 text-amber-300 font-bold shadow-sm' : 'bg-zinc-900 text-white font-bold shadow-sm'
                    : 'hover:text-amber-500'
                }`}
              >
                Lengan Kiri
              </button>
            )}

            <button
              onClick={() => onSideChange('back')}
              className={`min-h-[30px] sm:min-h-[32px] px-2.5 sm:px-3 rounded-lg transition-all touch-manipulation whitespace-nowrap ${
                currentSide === 'back'
                  ? isDarkStudio ? 'bg-zinc-800 text-amber-300 font-bold shadow-sm' : 'bg-zinc-900 text-white font-bold shadow-sm'
                  : 'hover:text-amber-500'
              }`}
            >
              Belakang
            </button>

            {studioMode === '3d' && (
              <button
                onClick={() => onSideChange('sleeve_right')}
                className={`min-h-[30px] sm:min-h-[32px] px-2.5 sm:px-3 rounded-lg transition-all touch-manipulation whitespace-nowrap ${
                  currentSide === 'sleeve_right'
                    ? isDarkStudio ? 'bg-zinc-800 text-amber-300 font-bold shadow-sm' : 'bg-zinc-900 text-white font-bold shadow-sm'
                    : 'hover:text-amber-500'
                }`}
              >
                Lengan Kanan
              </button>
            )}
          </div>
        </div>

        {/* Right Group (Desktop): Background toggle + Dimension Metric + Expand Panel button */}
        <div className="hidden sm:flex items-center gap-2 pointer-events-auto">
          {/* Dimension Metric */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-mono shadow-sm border ${
            isDarkStudio ? 'bg-zinc-900/90 border-zinc-800 text-zinc-300' : 'bg-white/90 border-zinc-200 text-zinc-700'
          }`}>
            <span className="font-bold text-amber-500">{printWidthCm}×{printHeightCm} cm</span>
            <span className="text-zinc-400">·</span>
            <span>{garmentSize.size}</span>
          </div>

          {/* Background Toggle */}
          <button
            onClick={() => onStudioBgChange(isDarkStudio ? 'white' : 'black')}
            title={`Ubah background studio ke ${isDarkStudio ? 'Putih' : 'Hitam'}`}
            className={`min-h-[32px] px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold shadow-sm transition-all touch-manipulation ${
              isDarkStudio 
                ? 'bg-zinc-900/90 text-white border-zinc-800 hover:bg-zinc-800' 
                : 'bg-white/90 text-zinc-900 border-zinc-200 hover:bg-zinc-100'
            }`}
          >
            {isDarkStudio ? (
              <>
                <Moon className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Studio Hitam</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden md:inline">Studio Putih</span>
              </>
            )}
          </button>

          {/* Desktop Expand / Collapse Panel Toggle */}
          <button
            onClick={onToggleCustomizer}
            title={isCustomizerExpanded ? "Sembunyikan panel kustomisasi (Kanvas Penuh)" : "Tampilkan panel kustomisasi"}
            className={`min-h-[32px] px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold shadow-sm transition-all touch-manipulation ${
              !isCustomizerExpanded
                ? 'bg-amber-400 text-zinc-950 border-amber-400 font-bold shadow-amber-400/20'
                : isDarkStudio 
                ? 'bg-zinc-900/90 text-zinc-300 border-zinc-800 hover:bg-zinc-800' 
                : 'bg-white/90 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
            }`}
          >
            {!isCustomizerExpanded ? (
              <>
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Buka Panel</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden lg:inline">Kanvas Penuh</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
