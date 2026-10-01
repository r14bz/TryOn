import React, { useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';
import { FabricInfo, TshirtColor, GraphicSettings, PrintTechniqueInfo, PlacementSide } from '../types/sablon';
import {
  BASE_SIZE,
  ExportBackground,
  ExportFormat,
  ExportMode,
  canvasToBlob,
  downloadBlob,
  renderExportCanvas
} from '../utils/exportDesign';
import { ShirtSide, graphicShownOnView } from '../utils/fabricRenderer';

interface ExportModalProps {
  fabric: FabricInfo;
  color: TshirtColor;
  technique: PrintTechniqueInfo;
  graphics: GraphicSettings[];
  /** sisi yang sedang dilihat di studio */
  initialView: PlacementSide;
  /** tampilan studio saat ini; menentukan jenis hasil awal */
  initialMode: '3d' | '2d';
  onClose: () => void;
}

type Scale = 1 | 2 | 3 | 4;
type ViewChoice = 'front' | 'back' | 'both' | 'sleeve_left' | 'sleeve_right' | 'all';

const SCALES_2D: { value: Scale; label: string }[] = [
  { value: 2, label: `${BASE_SIZE * 2}px` },
  { value: 3, label: `${BASE_SIZE * 3}px` },
  { value: 4, label: `${BASE_SIZE * 4}px` }
];

// WebGL di HP lebih terbatas, jadi 4096px tidak ditawarkan untuk hasil 3D
const SCALES_3D: { value: Scale; label: string }[] = [
  { value: 1, label: `${BASE_SIZE}px` },
  { value: 2, label: `${BASE_SIZE * 2}px` },
  { value: 3, label: `${BASE_SIZE * 3}px` }
];

const VIEW_OPTIONS_2D: { value: ViewChoice; label: string }[] = [
  { value: 'front', label: 'Depan' },
  { value: 'back', label: 'Belakang' },
  { value: 'both', label: 'Keduanya' }
];

const VIEW_OPTIONS_3D: { value: ViewChoice; label: string }[] = [
  { value: 'front', label: 'Depan' },
  { value: 'back', label: 'Belakang' },
  { value: 'sleeve_left', label: 'Kiri' },
  { value: 'sleeve_right', label: 'Kanan' },
  { value: 'all', label: 'Semua' }
];

const SIDE_FILE_LABEL: Record<PlacementSide, string> = {
  front: 'depan',
  back: 'belakang',
  sleeve_left: 'lengan-kiri',
  sleeve_right: 'lengan-kanan'
};

const SIDE_TEXT_LABEL: Record<PlacementSide, string> = {
  front: 'tampak depan',
  back: 'tampak belakang',
  sleeve_left: 'lengan kiri',
  sleeve_right: 'lengan kanan'
};

function viewsFor(choice: ViewChoice): PlacementSide[] {
  switch (choice) {
    case 'both': return ['front', 'back'];
    case 'all': return ['front', 'back', 'sleeve_left', 'sleeve_right'];
    default: return [choice];
  }
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-medium">
      {options.map((o) => (
        <button
          key={String(o.value)}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={`flex-1 min-h-[34px] px-2 rounded-lg transition-colors touch-manipulation disabled:opacity-30 ${
            value === o.value ? 'bg-amber-400 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const ExportModal: React.FC<ExportModalProps> = ({
  fabric,
  color,
  technique,
  graphics,
  initialView,
  initialMode,
  onClose
}) => {
  const [mode, setMode] = useState<ExportMode>(initialMode === '3d' ? '3d' : 'mockup');
  const [viewChoice, setViewChoice] = useState<ViewChoice>(() =>
    initialMode === '3d' || initialView === 'front' || initialView === 'back' ? initialView : 'front'
  );
  const [scale, setScale] = useState<Scale>(2);
  const [background, setBackground] = useState<ExportBackground>('transparent');
  const [format, setFormat] = useState<ExportFormat>('png');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const is3D = mode === '3d';
  const views = viewsFor(viewChoice);
  const size = BASE_SIZE * scale;

  // Pilihan sisi dan resolusi berbeda antara hasil 2D dan 3D; rapikan saat jenis hasil berganti
  const handleModeChange = (next: ExportMode) => {
    setMode(next);
    if (next === '3d') {
      if (viewChoice === 'both') setViewChoice('all');
      if (scale === 4) setScale(3);
    } else {
      if (viewChoice === 'all') setViewChoice('both');
      else if (viewChoice === 'sleeve_left' || viewChoice === 'sleeve_right') setViewChoice('front');
    }
  };
  const hasTransparentConflict = format === 'jpeg' && background === 'transparent';

  const handleSave = async () => {
    setMessage(null);
    const saved: string[] = [];
    try {
      if (is3D) {
        // Render 3D memakai WebGL; modul dimuat saat dibutuhkan agar halaman awal tetap ringan
        setBusy('Menyiapkan model 3D…');
        await new Promise((r) => setTimeout(r, 30));
        const { createShirt3DExporter } = await import('../utils/export3d');
        const exporter = await createShirt3DExporter(
          { fabric, color, technique, graphics },
          size,
          hasTransparentConflict ? 'white' : background
        );
        try {
          for (const view of views as PlacementSide[]) {
            setBusy(`Memproses ${SIDE_TEXT_LABEL[view]} 3D (${exporter.size}px)…`);
            await new Promise((r) => setTimeout(r, 30));
            const canvas = exporter.renderView(view);
            const blob = await canvasToBlob(canvas, format);
            const name = `sablon-3d-${color.id}-${SIDE_FILE_LABEL[view]}-${exporter.size}px.${format === 'png' ? 'png' : 'jpg'}`;
            downloadBlob(blob, name);
            saved.push(name);
            canvas.width = 0;
            canvas.height = 0;
          }
        } finally {
          exporter.dispose();
        }
      } else {
        for (const view of views as ShirtSide[]) {
          const hasPrints = graphics.some((g) => graphicShownOnView(g, view));
          if (mode === 'design' && !hasPrints) continue; // nothing to export for this side

          setBusy(`Memproses ${SIDE_TEXT_LABEL[view]} (${size}px)…`);
          // let the browser paint the progress text before the heavy work
          await new Promise((r) => setTimeout(r, 30));

          const canvas = await renderExportCanvas(
            view,
            { mode, views: views as ShirtSide[], scale, background, format },
            { fabric, color, technique, graphics }
          );
          const blob = await canvasToBlob(canvas, format);
          const name = `sablon-${mode === 'design' ? 'desain' : color.id}-${SIDE_FILE_LABEL[view]}-${size}px.${format === 'png' ? 'png' : 'jpg'}`;
          downloadBlob(blob, name);
          saved.push(name);
          // release the big bitmap right away
          canvas.width = 0;
          canvas.height = 0;
        }
      }

      setMessage(
        saved.length
          ? { kind: 'ok', text: `Tersimpan: ${saved.join(', ')}` }
          : { kind: 'error', text: 'Tidak ada gambar sablon pada sisi yang dipilih.' }
      );
    } catch (err) {
      console.error('Export failed:', err);
      setMessage({
        kind: 'error',
        text:
          'Gagal membuat gambar. Kemungkinan memori browser tidak cukup untuk resolusi ini, coba resolusi yang lebih kecil.'
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90dvh]">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Download className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-white font-display">Simpan Gambar Desain</h2>
              <p className="text-[11px] text-zinc-400">Hasil resolusi tinggi, langsung diunduh</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={!!busy}
            className="w-8 h-8 rounded-lg text-zinc-400 hover:text-white flex items-center justify-center disabled:opacity-40"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex flex-col gap-4 text-zinc-200">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
              Jenis hasil
            </label>
            <Segmented<ExportMode>
              value={mode}
              onChange={handleModeChange}
              options={[
                { value: '3d', label: 'Model 3D' },
                { value: 'mockup', label: 'Foto 2D' },
                { value: 'design', label: 'Desain saja' }
              ]}
            />
            <p className="text-[10px] text-zinc-500 mt-1">
              {mode === '3d'
                ? 'Persis tampilan model 3D (cahaya, lipatan, dan posisi sablon seperti di studio 3D).'
                : mode === 'mockup'
                  ? 'Kaos foto 2D lengkap dengan sablon mengikuti lipatan kain.'
                  : 'Hanya gambar sablon pada posisi di kaos, tanpa kaosnya (cocok untuk file cetak).'}
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
              Sisi kaos
            </label>
            <Segmented<ViewChoice>
              value={viewChoice}
              onChange={setViewChoice}
              options={is3D ? VIEW_OPTIONS_3D : VIEW_OPTIONS_2D}
            />
            <p className="text-[10px] text-zinc-500 mt-1">
              {is3D
                ? 'Kiri / Kanan = tampak lengan kaos. "Semua" menyimpan 4 file.'
                : 'Gambar lengan ikut tampil pada sisi depan.'}
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
              Resolusi (persegi)
            </label>
            <Segmented<Scale> value={scale} onChange={setScale} options={is3D ? SCALES_3D : SCALES_2D} />
            {scale === 4 && (
              <p className="text-[10px] text-amber-400/90 mt-1">
                4096px memakai banyak memori; di HP bisa gagal. Jika gagal, pilih resolusi lebih kecil.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
                Latar
              </label>
              <Segmented<ExportBackground>
                value={background}
                onChange={setBackground}
                options={[
                  { value: 'transparent', label: 'Kosong' },
                  { value: 'white', label: 'Putih' },
                  { value: 'black', label: 'Hitam' }
                ]}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block mb-1.5">
                Format
              </label>
              <Segmented<ExportFormat>
                value={format}
                onChange={setFormat}
                options={[
                  { value: 'png', label: 'PNG' },
                  { value: 'jpeg', label: 'JPG' }
                ]}
              />
            </div>
          </div>
          {hasTransparentConflict && (
            <p className="text-[10px] text-zinc-500 -mt-2">JPG tidak mendukung transparan, latar otomatis putih.</p>
          )}

          {message && (
            <p
              role={message.kind === 'error' ? 'alert' : 'status'}
              className={`text-[11px] break-words ${message.kind === 'error' ? 'text-red-400' : 'text-emerald-400'}`}
            >
              {message.text}
            </p>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800 shrink-0">
          <button
            onClick={handleSave}
            disabled={!!busy}
            className="w-full min-h-[44px] text-sm font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-70 rounded-xl flex items-center justify-center gap-2 transition-colors touch-manipulation"
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="truncate">{busy}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>
                  Simpan {views.length > 1 ? `${views.length} file` : 'gambar'} ({size}×{size}px)
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
