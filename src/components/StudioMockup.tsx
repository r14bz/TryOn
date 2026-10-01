import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  RotateCcw, 
  ZoomIn, 
  ZoomOut
} from 'lucide-react';
import { CanvasEditDock } from './CanvasEditDock';
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
  onToggleGraphicVisible?: (id: string) => void;
  onRemoveGraphic?: (id: string) => void;
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
  onToggleGraphicVisible,
  onRemoveGraphic,
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

      {/* Dock bawah: daftar Gambar di Kaos + panel Atur Posisi & Ukuran */}
      <CanvasEditDock
        graphics={graphics}
        graphic={graphic}
        onSelect={onSelectGraphic}
        onToggleVisible={onToggleGraphicVisible}
        onRemove={onRemoveGraphic}
        onGraphicChange={onGraphicChange}
      />

      {/* Floating Right Control Strip (Zoom & Reset) */}
      <div className={`absolute right-2 top-2 sm:right-3 sm:top-1/2 sm:-translate-y-1/2 z-20 flex flex-row sm:flex-col items-center gap-1 sm:gap-1.5 p-1 rounded-xl shadow-xl border backdrop-blur ${
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

        <div className={`w-[1px] h-5 sm:w-5 sm:h-[1px] ${studioBgColor === 'white' ? 'bg-zinc-200' : 'bg-zinc-800'}`} />

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
