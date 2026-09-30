import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  RotateCcw, 
  ZoomIn, 
  ZoomOut,
  ChevronDown,
  ChevronUp,
  Sliders,
  RotateCw
} from 'lucide-react';
import { 
  FabricInfo, 
  TshirtColor, 
  GraphicSettings, 
  PrintTechniqueInfo, 
  GarmentSize,
  PlacementSide,
  StudioBgColor
} from '../types/sablon';
import { 
  PrintLayer,
  BODY_DRAG_RANGE,
  SLEEVE_DRAG_RANGE,
  hitTestLayer,
  loadPrintLayers,
  renderRealisticTshirt,
  prepareShirtAssets
} from '../utils/fabricRenderer';

interface StudioMockupProps {
  fabric: FabricInfo;
  color: TshirtColor;
  graphics: GraphicSettings[];
  activeGraphic: GraphicSettings | null;
  technique: PrintTechniqueInfo;
  currentSide: PlacementSide;
  garmentSize: GarmentSize;
  studioBgColor?: StudioBgColor;
  onSideChange: (side: PlacementSide) => void;
  onGraphicChange: (updated: Partial<GraphicSettings>) => void;
  onStudioBgChange?: (bg: StudioBgColor) => void;
  onSelectGraphic: (id: string) => void;
  onCanvasRendered?: (canvas: HTMLCanvasElement) => void;
  onOpenInspect: () => void;
  onSwitchTo3D?: () => void;
}

export const StudioMockup: React.FC<StudioMockupProps> = ({
  fabric,
  color,
  graphics,
  activeGraphic,
  technique,
  currentSide,
  garmentSize,
  studioBgColor = 'white',
  onSideChange,
  onGraphicChange,
  onStudioBgChange,
  onSelectGraphic,
  onCanvasRendered,
  onOpenInspect,
  onSwitchTo3D
}) => {
  // The layer being edited by sliders / drag (may be null when there are no layers)
  const graphic = activeGraphic;
  // Layers currently drawn on the canvas (used to pick a layer by tapping it)
  const layersRef = useRef<PrintLayer[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewZoom, setViewZoom] = useState(1.0);
  const [isSlidersExpanded, setIsSlidersExpanded] = useState(true);

  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0
  });

  const renderIdRef = useRef(0);
  const dragRangeRef = useRef(BODY_DRAG_RANGE);

  const drawMockup = useCallback(async () => {
    const renderId = ++renderIdRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      setIsLoading(true);
      const width = canvas.width;
      const height = canvas.height;

      const side = currentSide === 'back' ? 'back' : 'front';
      // Photo + its own silhouette mask + cloth-fold maps (black uses the black photo)
      const assets = await prepareShirtAssets(side, color.id === 'black', width, height);

      const layers = await loadPrintLayers(graphics, side);

      // A newer render started while assets were loading: drop this one
      if (renderId !== renderIdRef.current) return;

      // Render realistic 2D catalog photo with guaranteed pure studio background
      renderRealisticTshirt(
        ctx, 
        width, 
        height, 
        assets,
        color, 
        fabric, 
        false, 
        studioBgColor, 
        layers, 
        technique
      );
      layersRef.current = layers;

      if (onCanvasRendered) {
        onCanvasRendered(canvas);
      }
      setIsLoading(false);
    } catch (err) {
      console.error('Mockup render error:', err);
      setIsLoading(false);
    }
  }, [fabric, color, graphics, technique, currentSide, studioBgColor, onCanvasRendered]);

  useEffect(() => {
    drawMockup();
  }, [drawMockup]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Tap on a print to select that layer (top-most wins)
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const cy = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const hitId = hitTestLayer(cx, cy, canvas.width, canvas.height, layersRef.current);
    const target = hitId ? graphics.find((g) => g.id === hitId) ?? null : graphic;
    if (hitId && hitId !== graphic?.id) onSelectGraphic(hitId);
    if (!target) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: target.x,
      startY: target.y
    };
    dragRangeRef.current =
      target.side === 'sleeve_left' || target.side === 'sleeve_right' ? SLEEVE_DRAG_RANGE : BODY_DRAG_RANGE;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !isDragging) return;
    const rect = canvas.getBoundingClientRect();

    // Pointer travel as a fraction of the canvas, converted to the slider unit
    // (placement moves by `range` of the canvas width per 100 units), so the
    // print follows the finger 1:1.
    const range = dragRangeRef.current;
    const dx = (e.clientX - dragStartRef.current.mouseX) / rect.width;
    const dy = (e.clientY - dragStartRef.current.mouseY) / rect.height;

    const newX = Math.max(-50, Math.min(50, dragStartRef.current.startX + (dx * 100) / range));
    const newY = Math.max(-50, Math.min(50, dragStartRef.current.startY + (dy * 100) / range));

    onGraphicChange({ x: newX, y: newY, preset: 'custom' });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`relative flex flex-col items-center justify-center w-full h-full select-none overflow-hidden transition-colors duration-300 ${
        studioBgColor === 'white' ? 'bg-white text-zinc-900' : 'bg-zinc-950 text-white'
      }`}
    >
      {/* Main Canvas Container with Interactive Zoom Scaling */}
      <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={900}
          height={900}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ transform: `scale(${viewZoom})` }}
          className="max-h-full max-w-full aspect-square object-contain cursor-move touch-none transition-transform duration-150 drop-shadow-md"
        />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/20 backdrop-blur-[2px] pointer-events-none">
            <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* FLOATING ON-CANVAS SLIDERS: ALWAYS VISIBLE EVEN WHEN BOTTOM PANEL IS CLOSED */}
      {graphic && (
      <div className="absolute bottom-2 left-2 right-14 sm:left-4 sm:right-16 z-20 pointer-events-auto">
        <div className="bg-zinc-950/95 border border-zinc-800 text-zinc-200 p-2.5 rounded-2xl shadow-2xl backdrop-blur-md max-w-sm mx-auto">
          <div className="flex items-center justify-between pb-1.5 border-b border-zinc-850 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <Sliders className="w-3.5 h-3.5" />
              <span>Atur Posisi &amp; Ukuran Sablon</span>
            </div>
            <button
              onClick={() => setIsSlidersExpanded(!isSlidersExpanded)}
              className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-850 transition-colors"
              title={isSlidersExpanded ? 'Kecilkan Kontrol' : 'Buka Kontrol'}
            >
              {isSlidersExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>

          {isSlidersExpanded && (
            <div className="flex flex-col gap-2 pt-2 text-[11px]">
              {/* Horizontal Slider */}
              <div className="flex items-center gap-2">
                <span className="w-16 text-zinc-400 shrink-0 font-medium">Kiri / Kanan:</span>
                <button
                  onClick={() => onGraphicChange({ x: Math.max(-50, graphic.x - 2), preset: 'custom' })}
                  className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-xs font-bold text-amber-400"
                >
                  ◀
                </button>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={Math.round(graphic.x)}
                  onChange={(e) => onGraphicChange({ x: Number(e.target.value), preset: 'custom' })}
                  className="flex-1 accent-amber-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <button
                  onClick={() => onGraphicChange({ x: Math.min(50, graphic.x + 2), preset: 'custom' })}
                  className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-xs font-bold text-amber-400"
                >
                  ▶
                </button>
                <span className="w-9 font-mono text-[10px] text-right text-zinc-300">
                  {Math.round(graphic.x)}%
                </span>
              </div>

              {/* Vertical Slider */}
              <div className="flex items-center gap-2">
                <span className="w-16 text-zinc-400 shrink-0 font-medium">Atas / Bwh:</span>
                <button
                  onClick={() => onGraphicChange({ y: Math.max(-50, graphic.y - 2), preset: 'custom' })}
                  className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-xs font-bold text-amber-400"
                >
                  ▲
                </button>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={Math.round(graphic.y)}
                  onChange={(e) => onGraphicChange({ y: Number(e.target.value), preset: 'custom' })}
                  className="flex-1 accent-amber-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                />
                <button
                  onClick={() => onGraphicChange({ y: Math.min(50, graphic.y + 2), preset: 'custom' })}
                  className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-xs font-bold text-amber-400"
                >
                  ▼
                </button>
                <span className="w-9 font-mono text-[10px] text-right text-zinc-300">
                  {Math.round(graphic.y)}%
                </span>
              </div>

              {/* Scale & Rotate Row */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-850/60">
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-zinc-400 font-medium">Ukuran:</span>
                  <button
                    onClick={() => onGraphicChange({ scale: Math.max(0.35, Number((graphic.scale - 0.1).toFixed(2))), preset: 'custom' })}
                    className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-xs font-bold text-amber-400"
                  >
                    −
                  </button>
                  <input
                    type="range"
                    min="0.35"
                    max="2.0"
                    step="0.05"
                    value={graphic.scale}
                    onChange={(e) => onGraphicChange({ scale: Number(e.target.value), preset: 'custom' })}
                    className="w-16 accent-amber-400 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                  <button
                    onClick={() => onGraphicChange({ scale: Math.min(2.0, Number((graphic.scale + 0.1).toFixed(2))), preset: 'custom' })}
                    className="w-6 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-xs font-bold text-amber-400"
                  >
                    +
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onGraphicChange({ rotation: (graphic.rotation + 15) % 360, preset: 'custom' })}
                    className="px-2 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 flex items-center gap-1"
                    title="Putar Sablon 15°"
                  >
                    <RotateCw className="w-3 h-3 text-amber-400" />
                    <span>{graphic.rotation}°</span>
                  </button>
                  <button
                    onClick={() => onGraphicChange({ x: 0, y: 0, rotation: 0, preset: 'custom' })}
                    className="px-2 h-6 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-400 hover:text-white"
                    title="Reset Posisi ke Tengah"
                  >
                    Tengah
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      )}

      {/* Floating Right Control Strip (Zoom & Reset) */}
      <div className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5 p-1 rounded-xl shadow-xl border backdrop-blur ${
        studioBgColor === 'white' ? 'bg-white/95 border-zinc-200 text-zinc-700' : 'bg-zinc-900/95 border-zinc-800 text-zinc-300'
      }`}>
        <button
          onClick={() => setViewZoom(prev => Math.min(1.6, prev + 0.15))}
          title="Perbesar Tampilan Kaos (Zoom In)"
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors touch-manipulation"
        >
          <ZoomIn className="w-4 h-4 text-amber-500" />
        </button>

        <button
          onClick={() => setViewZoom(prev => Math.max(0.8, prev - 0.15))}
          title="Perkecil Tampilan Kaos (Zoom Out)"
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors touch-manipulation"
        >
          <ZoomOut className="w-4 h-4 text-amber-500" />
        </button>

        <div className={`w-5 h-[1px] mx-auto ${studioBgColor === 'white' ? 'bg-zinc-200' : 'bg-zinc-800'}`} />

        <button
          onClick={() => {
            setViewZoom(1.0);
            if (graphic) onGraphicChange({ x: 0, y: graphic.side === 'front' ? 2 : 0, preset: 'custom' });
          }}
          title="Reset Tampilan ke Posisi Normal"
          className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors touch-manipulation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
