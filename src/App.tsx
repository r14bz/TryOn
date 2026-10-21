import React, { useState, useCallback, lazy, Suspense } from 'react';
import { 
  Image as ImageIcon, 
  Palette, 
  Sliders,
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
  GarmentModel,
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
import { ProductionSheet } from './components/ProductionSheet';
import { PlacementPanel } from './components/PlacementPanel';
import { TextureInspectModal } from './components/TextureInspectModal';
import { PriceQuoteModal } from './components/PriceQuoteModal';
import { ExportModal } from './components/ExportModal';
import { GARMENT_MODELS } from './data/garmentModels';
import { forgetCachedImage } from './utils/fabricRenderer';
import { isDesktopViewport } from './utils/viewport';

// Studio 3D dimuat belakangan (three.js besar) agar halaman awal cepat
const ThreeDStudio = lazy(() =>
  import('./components/ThreeDStudio').then((m) => ({ default: m.ThreeDStudio }))
);

type SidebarTab = 'graphic' | 'color' | 'position';

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
  const [garmentModel, setGarmentModel] = useState<GarmentModel>('shirt');
  // Navigasi sisi (Depan/Lengan/Belakang) di atas kanvas: bisa disembunyikan, pilihan diingat
  const [showSideNav, setShowSideNav] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tryd.sideNav') !== '0';
    } catch {
      return true;
    }
  });
  const toggleSideNav = () =>
    setShowSideNav((v) => {
      try {
        localStorage.setItem('tryd.sideNav', v ? '0' : '1');
      } catch {
        // penyimpanan tidak tersedia: abaikan
      }
      return !v;
    });
  
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
  const [isProductionOpen, setIsProductionOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('graphic');

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

    // Hoodie saja: sisi yang sedang dipilih di toolbar diutamakan dibanding preset depan dari
    // contoh gambar. Kaos tetap memakai perilaku produksi (presetId ?? fallback).
    const resolvedPresetId: PlacementPresetId =
      garmentModel === 'hoodie' && currentSide !== 'front' ? fallback : (presetId ?? fallback);
    const preset = PLACEMENT_PRESETS.find((p) => p.id === resolvedPresetId) ?? PLACEMENT_PRESETS[0];
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

  const handleTabClick = (tab: SidebarTab) => {
    if (activeSidebarTab === tab && isCustomizerExpanded) {
      // Mengetuk tab yang sedang aktif menutup panel
      setIsCustomizerExpanded(false);
    } else {
      setActiveSidebarTab(tab);
      setIsCustomizerExpanded(true);
    }
  };

  const unitEstimate = selectedFabric.basePrice + selectedTechnique.costModifier;
  const has2D = GARMENT_MODELS.find((m) => m.id === garmentModel)?.has2D ?? false;

  const TABS: Array<{ id: SidebarTab; label: string; Icon: typeof ImageIcon }> = [
    { id: 'graphic', label: 'Desain', Icon: ImageIcon },
    { id: 'color', label: 'Warna', Icon: Palette },
    { id: 'position', label: 'Posisi', Icon: Sliders }
  ];

  return (
    <div className="flex flex-col h-[100dvh] w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      <Header
        onOpenExport={() => setIsExportOpen(true)}
        onOpenQuote={() => setIsQuoteModalOpen(true)}
        onOpenProduction={() => setIsProductionOpen(true)}
      />

      {/* Main Studio Workspace */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 relative">
        {/* Studio Viewport */}
        <section className={`relative border-b lg:border-b-0 lg:border-r border-zinc-800 flex flex-col min-w-0 transition-all duration-300 ${
          studioBgColor === 'white' ? 'bg-white' : 'bg-zinc-950'
        } ${
          isCustomizerExpanded
            ? 'h-[44dvh] sm:h-[48dvh] lg:h-full lg:flex-1 shrink-0 lg:shrink'
            : 'flex-1 h-full'
        }`}>
          <div className="shrink-0 z-30">
            <StudioToolbar
              studioMode={studioMode}
              onModeChange={setStudioMode}
              garmentModel={garmentModel}
              onGarmentModelChange={setGarmentModel}
              currentSide={currentSide}
              onSideChange={handleSideChange}
              showSideNav={showSideNav}
              onToggleSideNav={toggleSideNav}
              studioBgColor={studioBgColor}
              onStudioBgChange={setStudioBgColor}
            />
          </div>

          <div className="w-full flex-1 min-h-0 relative">
            {studioMode === '3d' ? (
              <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">Memuat studio 3D…</div>}>
                <ThreeDStudio
                  key={garmentModel}
                  garmentModel={garmentModel}
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
                  onStudioBgChange={setStudioBgColor}
                  onCanvasRendered={setRenderedCanvas}
                  onOpenInspect={() => setIsTextureModalOpen(true)}
                  onSwitchTo2D={() => setStudioMode('2d')}
                />
              </Suspense>
            ) : has2D ? (
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
                onCanvasRendered={setRenderedCanvas}
                onOpenInspect={() => setIsTextureModalOpen(true)}
                onSwitchTo3D={() => setStudioMode('3d')}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-zinc-500">
                <span>Tampilan 2D untuk model ini belum tersedia.</span>
                <button
                  onClick={() => setStudioMode('3d')}
                  className="h-9 px-4 rounded-lg bg-brand text-zinc-950 text-xs font-bold touch-manipulation"
                >
                  Lihat 3D
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Panel bawah: Desain / Warna / Posisi */}
        {isCustomizerExpanded ? (
          <aside className="flex-1 lg:flex-none lg:w-[420px] xl:w-[460px] h-full bg-zinc-925 flex flex-col min-h-0 overflow-hidden shadow-2xl z-20 transition-all duration-300 border-t lg:border-t-0 lg:border-l border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-850 px-2 sm:px-3 bg-zinc-950/90 shrink-0">
              <div className="flex-1 flex items-center">
                {TABS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => handleTabClick(id)}
                    className={`flex-1 min-h-[44px] py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors touch-manipulation ${
                      activeSidebarTab === id
                        ? 'border-brand text-white font-bold'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsCustomizerExpanded(false)}
                title="Sembunyikan panel"
                aria-label="Sembunyikan panel"
                className="ml-1 w-9 min-h-[36px] text-zinc-400 hover:text-brand hover:bg-zinc-900 rounded-lg flex items-center justify-center transition-colors shrink-0 touch-manipulation"
              >
                <ChevronDown className="w-4 h-4 lg:hidden text-brand" />
                <ChevronRight className="w-4 h-4 hidden lg:block text-brand" />
              </button>
            </div>

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

              {activeSidebarTab === 'color' && (
                <FabricColorSelector
                  show="color"
                  selectedFabric={selectedFabric}
                  selectedColor={selectedColor}
                  selectedSize={selectedSize}
                  onFabricSelect={setSelectedFabric}
                  onColorSelect={setSelectedColor}
                  onSizeSelect={setSelectedSize}
                  onInspectDetail={() => undefined}
                />
              )}

              {activeSidebarTab === 'position' && (
                <PlacementPanel
                  graphics={graphics}
                  graphic={activeGraphic}
                  onSelect={handleSelectGraphic}
                  onGraphicChange={handleGraphicChange}
                />
              )}
            </div>

            <div className="px-4 py-2 border-t border-zinc-850 bg-zinc-950/95 flex items-baseline justify-between shrink-0">
              <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Estimasi</span>
              <span className="text-sm font-bold font-mono text-brand">
                Rp {unitEstimate.toLocaleString('id-ID')}
                <span className="text-[10px] font-normal text-zinc-400"> / pcs</span>
              </span>
            </div>
          </aside>
        ) : (
          <>
            {/* Dock ringkas (mobile): tiga tab + tombol buka */}
            <div className="lg:hidden shrink-0 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur px-3 py-2 flex items-center justify-between gap-2 z-30 shadow-2xl">
              <div className="flex items-center gap-1 min-w-0">
                {TABS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => handleTabClick(id)}
                    className="h-9 px-2.5 rounded-lg border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-300 hover:text-white flex items-center gap-1.5 touch-manipulation"
                  >
                    <Icon className="w-3.5 h-3.5 text-brand" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsCustomizerExpanded(true)}
                title="Buka panel"
                aria-label="Buka panel"
                className="h-9 w-11 shrink-0 bg-brand text-zinc-950 rounded-lg flex items-center justify-center shadow-md touch-manipulation"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
            </div>

            {/* Rel samping (desktop) */}
            <aside className="hidden lg:flex w-14 h-full bg-zinc-950 border-l border-zinc-800 flex-col items-center py-3 gap-3 z-20 shrink-0">
              <button
                onClick={() => setIsCustomizerExpanded(true)}
                title="Buka panel"
                aria-label="Buka panel"
                className="w-10 h-10 rounded-xl bg-brand text-zinc-950 flex items-center justify-center shadow-md hover:bg-brand/85 transition-all touch-manipulation"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="w-8 h-[1px] bg-zinc-800 my-1" />
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => handleTabClick(id)}
                  title={label}
                  aria-label={label}
                  className="w-10 h-10 rounded-xl border border-zinc-800 hover:border-brand/60 bg-zinc-900/60 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                >
                  <Icon className="w-4 h-4 text-brand" />
                </button>
              ))}
            </aside>
          </>
        )}
      </main>

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

      {isProductionOpen && (
        <ProductionSheet
          selectedTechnique={selectedTechnique}
          selectedFabric={selectedFabric}
          selectedColor={selectedColor}
          selectedSize={selectedSize}
          onTechniqueSelect={setSelectedTechnique}
          onFabricSelect={setSelectedFabric}
          onSizeSelect={setSelectedSize}
          onInspectFabric={(fab) => {
            setSelectedFabric(fab);
            setIsProductionOpen(false);
            setIsTextureModalOpen(true);
          }}
          onClose={() => setIsProductionOpen(false)}
        />
      )}

      {isTextureModalOpen && (
        <TextureInspectModal
          fabric={selectedFabric}
          color={selectedColor}
          onClose={() => setIsTextureModalOpen(false)}
          onSelectFabric={setSelectedFabric}
        />
      )}

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
