import React, { useState } from 'react';
import { X, Download, FileText, Check, Package, Calculator, ShieldCheck } from 'lucide-react';
import { FabricInfo, TshirtColor, GraphicSettings, PrintTechniqueInfo, GarmentSize } from '../types/sablon';

interface PriceQuoteModalProps {
  fabric: FabricInfo;
  color: TshirtColor;
  graphics: GraphicSettings[];
  technique: PrintTechniqueInfo;
  size: GarmentSize;
  renderedCanvas: HTMLCanvasElement | null;
  onClose: () => void;
}

export const PriceQuoteModal: React.FC<PriceQuoteModalProps> = ({
  fabric,
  color,
  graphics,
  technique,
  size,
  renderedCanvas,
  onClose
}) => {
  const [quantity, setQuantity] = useState<number>(12);
  const [isExporting, setIsExporting] = useState(false);

  // Price Calculation
  const baseTshirtPrice = fabric.basePrice;
  const basePrintPrice = technique.costModifier;
  
  // Every visible print is charged on its own (A3 has higher ink volume than a pocket print)
  const printed = graphics.filter((g) => g.visible && g.imageUrl);
  const sizeMultiplierOf = (scale: number) => (scale > 1.2 ? 1.4 : scale > 0.8 ? 1.2 : 1.0);
  const printCostPerPcs = Math.round(
    printed.reduce((sum, g) => sum + basePrintPrice * sizeMultiplierOf(g.scale), 0)
  );

  // Bulk discount
  let discountPct = 0;
  if (quantity >= 50) discountPct = 0.20;
  else if (quantity >= 24) discountPct = 0.12;
  else if (quantity >= 12) discountPct = 0.08;

  const unitPriceBeforeDiscount = baseTshirtPrice + printCostPerPcs;
  const unitPrice = Math.round(unitPriceBeforeDiscount * (1 - discountPct));
  const subtotal = unitPrice * quantity;

  const largestScale = printed.reduce((m, g) => Math.max(m, g.scale), 0);
  const printWidthCm = (largestScale * 21).toFixed(1);
  const printHeightCm = (largestScale * 28).toFixed(1);

  // Generate & Download Spec Sheet PNG
  const downloadSpecSheet = () => {
    setIsExporting(true);
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsExporting(false);
      return;
    }

    // 1. Dark Studio Spec Background
    ctx.fillStyle = '#09090B';
    ctx.fillRect(0, 0, 1200, 900);

    // Decorative grid lines
    ctx.strokeStyle = '#27272A';
    ctx.lineWidth = 1;
    for (let x = 0; x < 1200; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 900);
      ctx.stroke();
    }
    for (let y = 0; y < 900; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1200, y);
      ctx.stroke();
    }

    // 2. Draw Rendered Mockup on Left
    if (renderedCanvas) {
      ctx.fillStyle = '#18181B';
      ctx.fillRect(60, 140, 520, 680);
      ctx.drawImage(renderedCanvas, 60, 140, 520, 680);
      ctx.strokeStyle = '#3F3F46';
      ctx.strokeRect(60, 140, 520, 680);
    }

    // 3. Header Spec Title
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 32px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('LEMBAR SPESIFIKASI PRODUKSI SABLON', 60, 80);

    ctx.fillStyle = '#A1A1AA';
    ctx.font = '16px "JetBrains Mono", monospace';
    ctx.fillText('Try-D Production Sheet', 60, 110);

    // 4. Right Side Specs Panel
    const rx = 620;
    let ry = 160;

    const drawSpecRow = (label: string, value: string, highlight = false) => {
      ctx.fillStyle = '#71717A';
      ctx.font = '14px "JetBrains Mono", monospace';
      ctx.fillText(label.toUpperCase(), rx, ry);

      ctx.fillStyle = highlight ? '#F59E0B' : '#FFFFFF';
      ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(value, rx, ry + 24);

      ctx.strokeStyle = '#27272A';
      ctx.beginPath();
      ctx.moveTo(rx, ry + 36);
      ctx.lineTo(1140, ry + 36);
      ctx.stroke();

      ry += 60;
    };

    drawSpecRow('Bahan Kaos Polos', `${fabric.name} (${fabric.gsm})`);
    drawSpecRow('Warna Kaos', `${color.name} [HEX: ${color.hex.toUpperCase()}]`);
    drawSpecRow('Teknologi Sablon', `${technique.name} (${technique.tagline})`);
    drawSpecRow(
      'Jumlah Gambar Sablon',
      printed.length === 0 ? 'Tanpa sablon' : `${printed.length} gambar (terbesar ${printWidthCm} × ${printHeightCm} cm)`
    );
    const sideLabels: Record<string, string> = {
      front: 'Depan',
      back: 'Belakang',
      sleeve_left: 'Lengan Kiri',
      sleeve_right: 'Lengan Kanan'
    };
    const sidesUsed = Array.from(new Set(printed.map((g) => sideLabels[g.side])));
    drawSpecRow('Posisi / Sisi Kaos', sidesUsed.length ? sidesUsed.join(', ') : '-');
    drawSpecRow('Estimasi Biaya Satuan', `Rp ${unitPrice.toLocaleString('id-ID')} / pcs (Qty: ${quantity} pcs)`, true);
    drawSpecRow('Total Estimasi Produksi', `Rp ${subtotal.toLocaleString('id-ID')} (Diskon: ${discountPct * 100}%)`, true);

    // Date and footer
    ctx.fillStyle = '#52525B';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(`Dokumen dihasilkan pada ${new Date().toLocaleString('id-ID')}`, rx, 800);

    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `spesifikasi-sablon-${fabric.id}-${color.id}.png`;
    a.click();
    setIsExporting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="max-w-xl w-full bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90dvh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Calculator className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white font-display">
                Kalkulator &amp; Estimasi Biaya Sablon
              </h2>
              <p className="text-[11px] sm:text-xs text-zinc-400">
                Transparansi rincian biaya bahan kaos polos &amp; sablon
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-colors touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto">
          {/* Quantity Selector */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
              Pilih Jumlah Pesanan (Pcs)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { qty: 1, label: '1 pcs (Sample)' },
                { qty: 12, label: '12 pcs (1 Lusin)' },
                { qty: 24, label: '24 pcs (2 Lusin)' },
                { qty: 50, label: '50 pcs (Wholesale)' }
              ].map(item => (
                <button
                  key={item.qty}
                  onClick={() => setQuantity(item.qty)}
                  className={`min-h-[50px] p-2 rounded-xl border text-center transition-all touch-manipulation active:scale-[0.98] ${
                    quantity === item.qty
                      ? 'bg-zinc-800 border-amber-500 text-white font-bold shadow-sm'
                      : 'border-zinc-800 text-zinc-400 hover:text-white bg-zinc-950/40'
                  }`}
                >
                  <div className="text-sm font-mono">{item.qty} pcs</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{item.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Cost Breakdown */}
          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2.5 text-xs">
            <div className="flex justify-between items-center text-zinc-300">
              <span>Bahan Kaos: {fabric.name}</span>
              <span className="font-mono">Rp {baseTshirtPrice.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-300">
              <span>Biaya Sablon ({technique.name})</span>
              <span className="font-mono">Rp {printCostPerPcs.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center text-zinc-400 text-[11px]">
              <span>Dimensi Cetak Sablon:</span>
              <span className="font-mono">{printWidthCm} × {printHeightCm} cm</span>
            </div>
            {discountPct > 0 && (
              <div className="flex justify-between items-center text-emerald-400 font-medium">
                <span>Diskon Kuantitas ({quantity} pcs):</span>
                <span className="font-mono">-{discountPct * 100}%</span>
              </div>
            )}
            <div className="pt-2.5 border-t border-zinc-800 flex justify-between items-center text-sm font-bold text-white">
              <span>Harga Satuan Net:</span>
              <span className="font-mono text-amber-400">
                Rp {unitPrice.toLocaleString('id-ID')} / pcs
              </span>
            </div>
            <div className="flex justify-between items-center text-base font-bold text-white pt-1">
              <span>Total Estimasi ({quantity} pcs):</span>
              <span className="font-mono text-amber-400">
                Rp {subtotal.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {/* Lead time guarantee */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Estimasi Pengerjaan: {quantity <= 1 ? '1 - 2 hari kerja' : quantity <= 24 ? '3 - 5 hari kerja' : '5 - 7 hari kerja'}. Kualitas sablon terjamin lolos QC.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white"
          >
            Tutup
          </button>
          <button
            onClick={downloadSpecSheet}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-amber-400/20"
          >
            <Download className="w-4 h-4" />
            <span>Download Lembar Spesifikasi (PNG)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
