import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  Camera, 
  FlipHorizontal, 
  Sparkles, 
  Download, 
  RotateCcw, 
  Move, 
  AlertCircle,
  SwitchCamera,
  X,
  Sliders,
  SunMedium,
  Layers
} from 'lucide-react';
import { FabricInfo, TshirtColor, GraphicSettings, PrintTechniqueInfo } from '../types/sablon';
import { renderShirtCutout } from '../utils/fabricRenderer';

interface ARCameraViewProps {
  fabric: FabricInfo;
  color: TshirtColor;
  graphic: GraphicSettings;
  technique: PrintTechniqueInfo;
  onClose: () => void;
}

export const ARCameraView: React.FC<ARCameraViewProps> = ({
  fabric,
  color,
  graphic,
  technique,
  onClose
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Transparent, garment-only render (no studio backdrop) that sits on top of the camera feed
  const [shirtCutout, setShirtCutout] = useState<HTMLCanvasElement | null>(null);
  const [shirtCutoutUrl, setShirtCutoutUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const side = graphic.side === 'back' ? 'back' : 'front';
    renderShirtCutout(fabric, color, graphic, technique, side)
      .then((c) => {
        if (cancelled) return;
        setShirtCutout(c);
        setShirtCutoutUrl(c.toDataURL('image/png'));
      })
      .catch((e) => console.error('Failed to render AR shirt cutout:', e));
    return () => {
      cancelled = true;
    };
  }, [fabric, color, graphic, technique]);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isMirrored, setIsMirrored] = useState(true);
  
  // AR Overlay Position & Alignment
  const [arScale, setArScale] = useState(1.0);
  const [arOffsetY, setArOffsetY] = useState(10); // % offset from center down to chest
  const [arOffsetX, setArOffsetX] = useState(0);
  const [arTiltX, setArTiltX] = useState(0); // perspective tilt
  const [arBlendMode, setArBlendMode] = useState<'normal' | 'multiply' | 'soft-light'>('normal');
  const [arOpacity, setArOpacity] = useState(0.92);
  const [ambientLightBoost, setAmbientLightBoost] = useState(1.05);
  
  // UI States
  const [showBodyGuide, setShowBodyGuide] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'fit' | 'lighting' | 'effect'>('fit');
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; startOffsetX: number; startOffsetY: number }>({ 
    x: 0, 
    y: 0, 
    startOffsetX: 0, 
    startOffsetY: 0 
  });

  // Initialize Camera
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err: unknown) {
      console.warn('Camera access error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Kamera tidak dapat diakses';
      setCameraError(
        errorMessage.includes('Permission') || errorMessage.includes('denied')
          ? 'Izin kamera ditolak. Aktifkan izin kamera di browser untuk menggunakan fitur Virtual Try-On AR.'
          : 'Kamera tidak terdeteksi atau sedang digunakan aplikasi lain. Pastikan browser memiliki izin akses kamera.'
      );
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [facingMode]);

  // Pointer drag to reposition shirt in AR view
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startOffsetX: arOffsetX,
      startOffsetY: arOffsetY
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const pctX = (dx / rect.width) * 100;
      const pctY = (dy / rect.height) * 100;
      setArOffsetX(Math.max(-40, Math.min(40, dragStartRef.current.startOffsetX + pctX)));
      setArOffsetY(Math.max(-20, Math.min(45, dragStartRef.current.startOffsetY + pctY)));
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // High-Res AR Photo Capture
  const captureARSnapshot = () => {
    setIsCapturing(true);
    const canvas = compositeCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) {
      setIsCapturing(false);
      return;
    }

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsCapturing(false);
      return;
    }

    // 1. Draw video frame (with mirror compensation if active)
    ctx.save();
    if (isMirrored) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    // 2. Draw t-shirt overlay in exact screen proportion
    if (shirtCutout) {
      ctx.save();
      const shirtW = w * 0.63 * arScale;
      const shirtH = shirtW * (shirtCutout.height / shirtCutout.width);
      const posX = (w - shirtW) / 2 + (arOffsetX / 100) * w;
      const posY = (h - shirtH) / 2 + (arOffsetY / 100) * h;

      ctx.globalAlpha = arOpacity;
      ctx.globalCompositeOperation = arBlendMode === 'normal' ? 'source-over' : (arBlendMode as GlobalCompositeOperation);
      ctx.filter = `brightness(${ambientLightBoost * 100}%)`;

      ctx.drawImage(shirtCutout, posX, posY, shirtW, shirtH);
      ctx.restore();
    }

    // 3. Watermark footer
    ctx.save();
    const bannerH = 64;
    ctx.fillStyle = 'rgba(10, 10, 12, 0.75)';
    ctx.fillRect(0, h - bannerH, w, bannerH);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('SablonAR Studio • Live AR Preview', 24, h - bannerH + 28);

    ctx.fillStyle = '#A1A1AA';
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.fillText(`${fabric.name} · ${color.name} · Sablon ${technique.name}`, 24, h - bannerH + 50);

    const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, w - 24, h - bannerH + 40);
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedPhotoUrl(dataUrl);
    setIsCapturing(false);
  };

  const downloadPhoto = () => {
    if (!capturedPhotoUrl) return;
    const a = document.createElement('a');
    a.href = capturedPhotoUrl;
    a.download = `sablon-ar-preview-${color.id}-${Date.now()}.jpg`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white h-[100dvh] w-screen overflow-hidden">
      {/* Top Header Bar: Responsive and Compact */}
      <div className="flex items-center justify-between px-3 sm:px-6 h-14 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur z-20 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors touch-manipulation"
            title="Tutup AR"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-semibold tracking-tight truncate flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>AR Try-On Kaos</span>
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 truncate">
              <span className="truncate">{fabric.shortName}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{color.name}</span>
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={() => setIsMirrored(!isMirrored)}
            title="Cermin"
            className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors touch-manipulation ${
              isMirrored ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>

          <button
            onClick={() => setFacingMode(facingMode === 'user' ? 'environment' : 'user')}
            title="Ganti Kamera"
            className="w-9 h-9 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors touch-manipulation"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowBodyGuide(!showBodyGuide)}
            title="Panduan Dada"
            className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors touch-manipulation ${
              showBodyGuide ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main AR Video Viewport */}
      <div 
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative flex-1 overflow-hidden bg-zinc-950 flex items-center justify-center cursor-move select-none touch-none"
      >
        {/* Video feed */}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-transform ${
            isMirrored ? 'scale-x-[-1]' : ''
          }`}
        />

        {/* Fallback Warning if Camera Error */}
        {cameraError && (
          <div className="absolute z-30 max-w-sm p-5 mx-4 rounded-2xl bg-zinc-900/95 border border-zinc-800 text-center shadow-2xl">
            <AlertCircle className="w-8 h-8 mx-auto mb-2.5 text-amber-400" />
            <h3 className="text-sm font-semibold text-white mb-1.5">Akses Kamera Diperlukan</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-4">{cameraError}</p>
            <button
              onClick={startCamera}
              className="w-full py-2.5 text-xs font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors touch-manipulation"
            >
              Hubungkan Kamera Lagi
            </button>
          </div>
        )}

        {/* Chest Alignment Reticle / Body Guide */}
        {showBodyGuide && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10 p-4">
            <div className="relative w-64 h-80 sm:w-80 sm:h-96 border-2 border-dashed border-amber-400/40 rounded-3xl flex flex-col items-center justify-between p-3.5">
              <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-amber-300/90 bg-black/70 px-2 py-0.5 rounded-full">
                Posisikan Dada &amp; Bahu di Sini
              </span>
              <div className="w-full flex justify-between px-2 text-[10px] text-amber-400/60 font-mono">
                <span>[Bahu Kiri]</span>
                <span>[Bahu Kanan]</span>
              </div>
              <div className="w-7 h-7 rounded-full border border-amber-400/40 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-amber-400/70" />
              </div>
              <span className="text-[9px] font-mono text-amber-300/70 bg-black/70 px-2 py-0.5 rounded-full">
                Area Sablon Kaos
              </span>
            </div>
          </div>
        )}

        {/* Rendered T-Shirt AR Overlay */}
        {shirtCutout && shirtCutoutUrl && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(${arOffsetX}%, ${arOffsetY}%) scale(${arScale}) rotateX(${arTiltX}deg)`,
              transformOrigin: 'center center',
              width: 'min(68vw, 400px)',
              aspectRatio: `${shirtCutout.width} / ${shirtCutout.height}`,
              opacity: arOpacity,
              mixBlendMode: arBlendMode,
              filter: `brightness(${ambientLightBoost})`,
              pointerEvents: 'none',
              transition: isDragging ? 'none' : 'transform 0.12s ease-out'
            }}
            className="flex items-center justify-center"
          >
            <img
              src={shirtCutoutUrl}
              alt="AR T-Shirt Preview"
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>
        )}

        {/* Floating Quick Hint on Screen */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-zinc-950/75 backdrop-blur border border-zinc-800/80 rounded-full px-3 py-1 flex items-center gap-2 text-[10px] text-zinc-300 shadow">
          <Move className="w-3 h-3 text-amber-400 shrink-0" />
          <span>Geser layar untuk menyesuaikan kaos</span>
        </div>

        {/* Capture Snapshot Action Button in Thumb Zone */}
        <div className="absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={captureARSnapshot}
            disabled={isCapturing}
            className="relative flex items-center justify-center w-16 h-16 rounded-full bg-amber-400 hover:bg-amber-300 active:scale-95 text-zinc-950 shadow-xl shadow-amber-400/30 transition-all touch-manipulation focus:outline-none ring-4 ring-black/40"
            title="Ambil Foto AR"
          >
            <Camera className="w-7 h-7" />
          </button>
        </div>
      </div>

      {/* Bottom AR Control Panel */}
      <div className="border-t border-zinc-800 bg-zinc-950/95 backdrop-blur px-4 sm:px-6 py-3 z-20 shrink-0">
        <div className="max-w-xl mx-auto flex flex-col gap-2.5">
          {/* Segmented Sub Tabs */}
          <div className="flex items-center gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800 text-xs font-medium">
            <button
              onClick={() => setActiveTab('fit')}
              className={`flex-1 min-h-[36px] py-1 rounded-lg transition-colors touch-manipulation ${
                activeTab === 'fit' ? 'bg-zinc-800 text-white font-semibold shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Ukuran &amp; Posisi
            </button>
            <button
              onClick={() => setActiveTab('lighting')}
              className={`flex-1 min-h-[36px] py-1 rounded-lg transition-colors touch-manipulation ${
                activeTab === 'lighting' ? 'bg-zinc-800 text-white font-semibold shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Cahaya Kain
            </button>
            <button
              onClick={() => setActiveTab('effect')}
              className={`flex-1 min-h-[36px] py-1 rounded-lg transition-colors touch-manipulation ${
                activeTab === 'effect' ? 'bg-zinc-800 text-white font-semibold shadow-sm' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Mode Blend
            </button>
          </div>

          {/* Active Tab Controls */}
          <div className="w-full">
            {activeTab === 'fit' && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="flex justify-between text-zinc-400 mb-1 text-[11px]">
                    <span>Ukuran Kaos</span>
                    <span className="font-mono text-zinc-200">{Math.round(arScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.6"
                    step="0.02"
                    value={arScale}
                    onChange={(e) => setArScale(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-zinc-400 mb-1 text-[11px]">
                    <span>Kemiringan Postur</span>
                    <span className="font-mono text-zinc-200">{arTiltX}°</span>
                  </div>
                  <input
                    type="range"
                    min="-25"
                    max="25"
                    step="1"
                    value={arTiltX}
                    onChange={(e) => setArTiltX(parseInt(e.target.value))}
                    className="w-full accent-amber-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}

            {activeTab === 'lighting' && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="flex justify-between text-zinc-400 mb-1 text-[11px]">
                    <span>Kecerahan Kain</span>
                    <span className="font-mono text-zinc-200">{Math.round(ambientLightBoost * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.5"
                    step="0.05"
                    value={ambientLightBoost}
                    onChange={(e) => setAmbientLightBoost(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-zinc-400 mb-1 text-[11px]">
                    <span>Transparansi Kaos</span>
                    <span className="font-mono text-zinc-200">{Math.round(arOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="1.0"
                    step="0.05"
                    value={arOpacity}
                    onChange={(e) => setArOpacity(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}

            {activeTab === 'effect' && (
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'normal', label: 'Solid Virtual' },
                  { id: 'multiply', label: 'X-Ray Blend' },
                  { id: 'soft-light', label: 'Soft Shadow' }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setArBlendMode(m.id as any)}
                    className={`flex-1 min-h-[38px] py-1 text-xs rounded-xl border text-center transition-colors touch-manipulation ${
                      arBlendMode === m.id
                        ? 'bg-zinc-800 border-amber-500/60 text-amber-300 font-medium'
                        : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden Composite Canvas for taking photos */}
      <canvas ref={compositeCanvasRef} className="hidden" />

      {/* Photo Captured Preview Modal */}
      {capturedPhotoUrl && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-3.5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-white">Hasil Foto Try-On AR</h3>
                <p className="text-[11px] text-zinc-400">Pratinjau sablon presisi di tubuh Anda</p>
              </div>
              <button
                onClick={() => setCapturedPhotoUrl(null)}
                className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-zinc-950 flex items-center justify-center">
              <img
                src={capturedPhotoUrl}
                alt="Captured AR Preview"
                className="w-full max-h-[55vh] object-contain rounded-xl border border-zinc-850"
              />
            </div>

            <div className="p-3.5 border-t border-zinc-800 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setCapturedPhotoUrl(null)}
                className="min-h-[40px] px-3 text-xs font-medium text-zinc-400 hover:text-white touch-manipulation"
              >
                Ambil Ulang
              </button>
              <button
                onClick={downloadPhoto}
                className="min-h-[40px] px-4 text-xs font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-xl flex items-center gap-2 transition-colors touch-manipulation"
              >
                <Download className="w-3.5 h-3.5" />
                Simpan (JPG)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
