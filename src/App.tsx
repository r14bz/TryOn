import React, { useState, useCallback, lazy, Suspense } from 'react';
import { 
  Download, 
  Image as ImageIcon, 
  Layers, 
  Palette, 
  Calculator,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  FabricInfo, 
  TshirtColor, 
  GraphicSettings, 
  PrintTechniqueInfo, 
  GarmentSize,
  PlacementSide,
  PlacementPresetId,
  StudioBgColor,
  MAX_GRAPHICS
} from './types/sablon';
import { FABRICS, PRINT_TECHNIQUES, GARMENT_SIZES, PLACEMENT_PRESETS } from './data/fabricData';
import { TSHIRT_COLORS } from './data/colorData';
import { SAMPLE_ARTWORKS } from './data/sampleArtworks';
import { Header } from './components/Header';
import { StudioToolbar } from './components/StudioToolbar';
import { StudioMockup } from './components/StudioMockup';
import { GraphicControlPanel } from './components/GraphicControlPanel';
import { FabricColorSelector } from './components/FabricColorSelector';
import { PrintTechniqueSelector } from './components/PrintTechniqueSelector';
import { TextureInspectModal } from './components/TextureInspectModal';
import { PriceQuoteModal } from './components/PriceQuoteModal';
import { ExportModal } from './components/ExportModal';
import { forgetCachedImage } from './utils/fabricRenderer';
import { isDesktopViewport } from './utils/viewport';

// Studio 3D dimuat belakangan (three.js besar) agar halaman awal cepat
const ThreeDStudio = lazy(() =>
  import('./components/ThreeDStudio').then((m) => ({ default: m.ThreeDStudio }))
);

const createGraphicId = () => `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export default function App() {
  // Application State
  const [selectedFabric, setSelectedFabric] = useState<FabricInfo>(FABRICS[0]); // Cotton Combed 30s
  const [selectedColor, setSelectedColor] = useState<TshirtColor>(TSHIRT_COLORS[0]); // Jet Black
  const [selectedTechnique, setSelectedTechnique] = useState<PrintTechniqueInfo>(PRINT_TECHNIQUES[0]); // DTF
  const [selectedSize, setSelectedSize] = useState<GarmentSize>(GARMENT_SIZES[2]); // L (53x73cm)
  const [currentSide, setCurrentSide] = useState<PlacementSide>('front');

  // Studio Viewing Mode: 3D Rotatable Model or 2D Studio Photo Mockup
  const [studioMode, setStudioMode] = useState<'3d' | '2d'>('3d');
  
  // Studio Background Theme: Pure White or Deep Studio Black
  const [studioBgColor, setStudioBgColor] = useState<StudioBgColor>('white');

  // Expand / Collapse state for the customization tabs panel
  // Panel kustomisasi: terbuka di desktop, tertutup saat pertama dibuka di mobile
  const [isCustomizerExpanded, setIsCustomizerExpanded] = useState(() => isDesktopViewport());

  // Graphic layers (several images can sit on the shirt). Last item = top-most print.
  const [graphics, setGraphics] = useState<GraphicSettings[]>(() => [
    {
      id: createGraphicId(),
      visible: true,
      imageUrl: SAMPLE_ARTWORKS[0].dataUrl,
      imageName: SAMPLE_ARTWORKS[0].name,
      side: 'front',
      x: 0,
      y: 2,
      scale: 1.35,
      rotation: 0,
      opacity: 1.0,
      blendMode: 'normal',
      colorFilter: 'original',
      preset: 'front_a3'
    }
  ]);
  const [activeGraphicId, setActiveGraphicId] = useState<string | null>(() => null);
  const activeGraphic = graphics.find((g) => g.id === activeGraphicId) ?? graphics[graphics.length - 1] ?? null;

  // Rendered canvas reference for the price/spec sheet
  const [renderedCanvas, setRenderedCanvas] = useState<HTMLCanvasElement | null>(null);

  // Active Modals & Views
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isTextureModalOpen, setIsTextureModalOpen] = useState(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'graphic' | 'fabric' | 'technique'>('graphic');

  // Edits the active layer. Changing its side also moves the studio view there
  // (kept outside the state updater: updaters must be pure).
  const handleGraphicChange = useCallback(
    (updated: Partial<GraphicSettings>) => {
      if (!activeGraphic) return;
      const id = activeGraphic.id;
      if (updated.side) setCurrentSide(updated.side);
      setGraphics((prev) => prev.map((g) => (g.id === id ? { ...g, ...updated } : g)));
    },
    [activeGraphic?.id]
  );

  // The studio view only changes what is shown; it never moves existing prints.
  const handleSideChange = (side: PlacementSide) => {
    setCurrentSide(side);
  };

  const handleSelectGraphic = (id: string) => {
    const g = graphics.find((x) => x.id === id);
    setActiveGraphicId(id);
    if (g) setCurrentSide(g.side);
  };

  const handleAddImage = (image: { url: string; name: string }, presetId?: PlacementPresetId) => {
    if (graphics.length >= MAX_GRAPHICS) {
      if (image.url.startsWith('blob:')) URL.revokeObjectURL(image.url);
      return;
    }
    const fallback: PlacementPresetId =
      currentSide === 'back' ? 'back_a3'
      : currentSide === 'sleeve_left' ? 'sleeve_left'
      : currentSide === 'sleeve_right' ? 'sleeve_right'
      : 'chest_center';
    const preset = PLACEMENT_PRESETS.find((p) => p.id === (presetId ?? fallback)) ?? PLACEMENT_PRESETS[0];
    const layer: GraphicSettings = {
      id: createGraphicId(),
      visible: true,
      imageUrl: image.url,
      imageName: image.name,
      side: preset.side,
      x: preset.defaultX,
      y: preset.defaultY,
      scale: preset.defaultScale,
      rotation: 0,
      opacity: 1.0,
      blendMode: 'normal',
      colorFilter: 'original',
      preset: preset.id
    };
    setGraphics((prev) => [...prev, layer]);
    setActiveGraphicId(layer.id);
    setCurrentSide(preset.side);
  };

  const handleRemoveGraphic = (id: string) => {
    const target = graphics.find((g) => g.id === id);
    if (!target) return;
    const remaining = graphics.filter((g) => g.id !== id);
    setGraphics(remaining);
    if (activeGraphic?.id === id) {
      setActiveGraphicId(remaining[remaining.length - 1]?.id ?? null);
    }
    if (target.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(target.imageUrl);
      forgetCachedImage(target.imageUrl);
    }
  };

  const handleToggleGraphic = (id: string) => {
    setGraphics((prev) => prev.map((g) => (g.id === id ? { ...g, visible: !g.visible } : g)));
  };

  // direction 1 = up (drawn on top of others), -1 = down
  const handleMoveGraphic = (id: string, direction: -1 | 1) => {
    setGraphics((prev) => {
      const i = prev.findIndex((g) => g.id === id);
      const j = i + direction;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const handleTabClick = (tab: 'graphic' | 'fabric' | 'technique') => {
    if (activeSidebarTab === tab && isCustomizerExpanded) {
      // Tapping already active tab collapses it
      setIsCustomizerExpanded(false);
    } else {
      setActiveSidebarTab(tab);
      setIsCustomizerExpanded(true);
    }
  };

  const printWidthCm = activeGraphic ? (activeGraphic.scale * 21).toFixed(1) : '0.0';
  const printHeightCm = activeGraphic ? (activeGraphic.scale * 28).toFixed(1) : '0.0';
  const unitEstimate = selectedFabric.basePrice + selectedTechnique.costModifier;

  return (
    <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* Responsive Top Navigation Bar */}
      <Header
        onOpenExport={() => setIsExportOpen(true)}
        onOpenQuote={() => setIsQuoteModalOpen(true)}
        onOpenTextureModal={() => setIsTextureModalOpen(true)}
        activeSidebarTab={activeSidebarTab}
        onSelectSidebarTab={(tab) => {
          setActiveSidebarTab(tab);
          setIsCustomizerExpanded(true);
        }}
      />

      {/* Main Studio Workspace */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 relative">
        {/* Studio Viewport: Expands smoothly when customizer is collapsed */}
        <section className={`relative border-b lg:border-b-0 lg:border-r border-zinc-800 flex flex-col min-w-0 transition-all duration-300 ${
          studioBgColor === 'white' ? 'bg-white' : 'bg-zinc-950'
        } ${
          isCustomizerExpanded 
            ? 'h-[44dvh] sm:h-[48dvh] lg:h-full lg:flex-1 shrink-0 lg:shrink' 
            : 'flex-1 h-full'
        }`}>
          {/* Unified Non-Overlapping Studio Toolbar */}
          <div className="shrink-0 z-30">
            <StudioToolbar
              studioMode={studioMode}
              onModeChange={setStudioMode}
              currentSide={currentSide}
              onSideChange={handleSideChange}
              studioBgColor={studioBgColor}
              onStudioBgChange={setStudioBgColor}
              garmentSize={selectedSize}
              printWidthCm={printWidthCm}
              printHeightCm={printHeightCm}
              isCustomizerExpanded={isCustomizerExpanded}
              onToggleCustomizer={() => setIsCustomizerExpanded(!isCustomizerExpanded)}
            />
          </div>

          {/* Render Active Studio Canvas */}
          <div className="w-full flex-1 min-h-0 relative">
            {studioMode === '3d' ? (
              <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">Memuat studio 3D…</div>}>
              <ThreeDStudio
                fabric={selectedFabric}
                color={selectedColor}
                graphics={graphics}
                activeGraphic={activeGraphic}
                technique={selectedTechnique}
                currentSide={currentSide}
                garmentSize={selectedSize}
                studioBgColor={studioBgColor}
                onSideChange={handleSideChange}
                onGraphicChange={handleGraphicChange}
                onSelectGraphic={handleSelectGraphic}
                onToggleGraphicVisible={handleToggleGraphic}
                onRemoveGraphic={handleRemoveGraphic}
                onStudioBgChange={setStudioBgColor}
                onCanvasRendered={setRenderedCanvas}
                onOpenInspect={() => setIsTextureModalOpen(true)}
                onSwitchTo2D={() => setStudioMode('2d')}
              />
              </Suspense>
            ) : (
              <StudioMockup
                fabric={selectedFabric}
                color={selectedColor}
                graphics={graphics}
                activeGraphic={activeGraphic}
                technique={selectedTechnique}
                currentSide={currentSide}
                garmentSize={selectedSize}
                studioBgColor={studioBgColor}
                onSideChange={handleSideChange}
                onGraphicChange={handleGraphicChange}
                onStudioBgChange={setStudioBgColor}
                onSelectGraphic={handleSelectGraphic}
                onToggleGraphicVisible={handleToggleGraphic}
                onRemoveGraphic={handleRemoveGraphic}
                onCanvasRendered={setRenderedCanvas}
                onOpenInspect={() => setIsTextureModalOpen(true)}
                onSwitchTo3D={() => setStudioMode('3d')}
              />
            )}
          </div>
        </section>

        {/* Customizer Panel: Expandable & Collapsible */}
        {isCustomizerExpanded ? (
          <aside className="flex-1 lg:flex-none lg:w-[420px] xl:w-[460px] h-full bg-zinc-925 flex flex-col min-h-0 overflow-hidden shadow-2xl z-20 transition-all duration-300 border-t lg:border-t-0 lg:border-l border-zinc-800">
            {/* Tab Navigation Controls with Collapse Button */}
            <div className="flex items-center justify-between border-b border-zinc-850 px-2 sm:px-3 bg-zinc-950/90 shrink-0">
              <div className="flex-1 flex items-center">
                <button
                  onClick={() => handleTabClick('graphic')}
                  className={`flex-1 min-h-[44px] py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors touch-manipulation ${
                    activeSidebarTab === 'graphic'
                      ? 'border-amber-400 text-white font-bold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Desain Sablon</span>
                </button>
                <button
                  onClick={() => handleTabClick('fabric')}
                  className={`flex-1 min-h-[44px] py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors touch-manipulation ${
                    activeSidebarTab === 'fabric'
                      ? 'border-amber-400 text-white font-bold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Warna &amp; Bahan</span>
                </button>
                <button
                  onClick={() => handleTabClick('technique')}
                  className={`flex-1 min-h-[44px] py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors touch-manipulation ${
                    activeSidebarTab === 'technique'
                      ? 'border-amber-400 text-white font-bold'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Teknik Sablon</span>
                </button>
              </div>

              {/* Collapse Button (Tutup Panel) */}
              <button
                onClick={() => setIsCustomizerExpanded(false)}
                title="Sembunyikan panel (tampilan kanvas penuh)"
                className="ml-1 min-h-[36px] px-2 text-zinc-400 hover:text-amber-400 hover:bg-zinc-900 rounded-lg flex items-center gap-1 transition-colors text-xs shrink-0 touch-manipulation"
              >
                <span className="hidden sm:inline text-[11px] font-medium">Tutup</span>
                <ChevronDown className="w-4 h-4 sm:hidden text-amber-400" />
                <ChevronRight className="w-4 h-4 hidden sm:inline text-amber-400" />
              </button>
            </div>

            {/* Scrollable Customization Content Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 scrollbar-thin scrollbar-thumb-zinc-800">
              {activeSidebarTab === 'graphic' && (
                <GraphicControlPanel
                  graphics={graphics}
                  activeGraphic={activeGraphic}
                  onSelect={handleSelectGraphic}
                  onAddImage={handleAddImage}
                  onRemove={handleRemoveGraphic}
                  onToggleVisible={handleToggleGraphic}
                  onMove={handleMoveGraphic}
                  onChange={handleGraphicChange}
                />
              )}

              {activeSidebarTab === 'fabric' && (
                <FabricColorSelector
                  selectedFabric={selectedFabric}
                  selectedColor={selectedColor}
                  selectedSize={selectedSize}
                  onFabricSelect={setSelectedFabric}
                  onColorSelect={setSelectedColor}
                  onSizeSelect={setSelectedSize}
                  onInspectDetail={(fab) => {
                    setSelectedFabric(fab);
                    setIsTextureModalOpen(true);
                  }}
                />
              )}

              {activeSidebarTab === 'technique' && (
                <PrintTechniqueSelector
                  selectedTechnique={selectedTechnique}
                  onSelect={setSelectedTechnique}
                />
              )}
            </div>

            {/* Sticky Bottom Thumb Zone / Action Bar */}
            <div className="p-3.5 sm:p-4 border-t border-zinc-850 bg-zinc-950/95 backdrop-blur flex items-center justify-between shrink-0 z-10">
              <div>
                <span className="text-[10px] text-zinc-500 block uppercase font-mono tracking-wider">
                  Estimasi Satuan
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm sm:text-base font-bold font-mono text-amber-400">
                    Rp {unitEstimate.toLocaleString('id-ID')}
                  </span>
                  <span className="text-[10px] text-zinc-400">/ pcs</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsQuoteModalOpen(true)}
                  className="min-h-[40px] px-3 text-xs font-medium text-zinc-300 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 rounded-xl transition-colors touch-manipulation flex items-center gap-1.5"
                >
                  <Calculator className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Rincian</span>
                </button>

                <button
                  onClick={() => setIsExportOpen(true)}
                  className="min-h-[40px] px-3.5 sm:px-4 text-xs font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-md shadow-amber-400/20 active:scale-95 transition-all touch-manipulation flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>Simpan Gambar</span>
                </button>
              </div>
            </div>
          </aside>
        ) : (
          /* COLLAPSED STATE: Minimal compact dock that does not obstruct the canvas */
          <>
            {/* Mobile Collapsed Bottom Dock */}
            <div className="lg:hidden shrink-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur px-3 py-2 flex items-center justify-between z-30 shadow-2xl">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleTabClick('graphic')}
                  className="h-9 px-2.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-300 hover:text-white flex items-center gap-1.5 touch-manipulation"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Desain</span>
                </button>
                <button
                  onClick={() => handleTabClick('fabric')}
                  className="h-9 px-2.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-300 hover:text-white flex items-center gap-1.5 touch-manipulation"
                >
                  <Palette className="w-3.5 h-3.5 text-amber-400" />
                  <span>Warna</span>
                </button>
                <button
                  onClick={() => handleTabClick('technique')}
                  className="h-9 px-2.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-300 hover:text-white flex items-center gap-1.5 touch-manipulation"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sablon</span>
                </button>
              </div>

              <button
                onClick={() => setIsCustomizerExpanded(true)}
                className="h-9 px-3 bg-amber-400 text-zinc-950 rounded-lg text-xs font-bold flex items-center gap-1 shadow-md touch-manipulation"
              >
                <ChevronUp className="w-4 h-4" />
                <span>Buka Panel</span>
              </button>
            </div>

            {/* Desktop Collapsed Side Rail */}
            <aside className="hidden lg:flex w-14 h-full bg-zinc-950 border-l border-zinc-800 flex-col items-center py-3 justify-between z-20 shrink-0">
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={() => setIsCustomizerExpanded(true)}
                  title="Buka Panel Kustomisasi"
                  className="w-10 h-10 rounded-xl bg-amber-400 text-zinc-950 flex items-center justify-center shadow-md hover:bg-amber-300 transition-all touch-manipulation"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <div className="w-8 h-[1px] bg-zinc-800 my-1" />

                <button
                  onClick={() => handleTabClick('graphic')}
                  title="Buka Tab Desain Sablon"
                  className="w-10 h-10 rounded-xl border border-zinc-800 hover:border-amber-400/60 bg-zinc-900/60 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                </button>

                <button
                  onClick={() => handleTabClick('fabric')}
                  title="Buka Tab Warna & Bahan"
                  className="w-10 h-10 rounded-xl border border-zinc-800 hover:border-amber-400/60 bg-zinc-900/60 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <Palette className="w-4 h-4 text-amber-400" />
                </button>

                <button
                  onClick={() => handleTabClick('technique')}
                  title="Buka Tab Teknik Sablon"
                  className="w-10 h-10 rounded-xl border border-zinc-800 hover:border-amber-400/60 bg-zinc-900/60 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <Layers className="w-4 h-4 text-amber-400" />
                </button>
              </div>

              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => setIsExportOpen(true)}
                  title="Simpan Gambar Desain (Resolusi Tinggi)"
                  className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-400 text-amber-400 flex items-center justify-center transition-all"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </aside>
          </>
        )}
      </main>

      {/* High-resolution export */}
      {isExportOpen && (
        <ExportModal
          fabric={selectedFabric}
          color={selectedColor}
          technique={selectedTechnique}
          graphics={graphics}
          initialView={currentSide}
          initialMode={studioMode}
          onClose={() => setIsExportOpen(false)}
        />
      )}

      {/* Fabric Texture Macro Inspect Modal */}
      {isTextureModalOpen && (
        <TextureInspectModal
          fabric={selectedFabric}
          color={selectedColor}
          onClose={() => setIsTextureModalOpen(false)}
          onSelectFabric={setSelectedFabric}
        />
      )}

      {/* Price Calculator & Spec Sheet Modal */}
      {isQuoteModalOpen && (
        <PriceQuoteModal
          fabric={selectedFabric}
          color={selectedColor}
          graphics={graphics}
          technique={selectedTechnique}
          size={selectedSize}
          renderedCanvas={renderedCanvas}
          onClose={() => setIsQuoteModalOpen(false)}
        />
      )}
    </div>
  );
}
