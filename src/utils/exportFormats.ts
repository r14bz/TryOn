/**
 * Penulis format berkas tanpa dependensi: PDF (banyak halaman), PSD (berlapis), dan SVG.
 * Semuanya berjalan di browser dari canvas hasil render.
 */

export interface LayerCanvas {
  name: string;
  canvas: HTMLCanvasElement;
  /** posisi pojok kiri-atas layer pada kanvas penuh (piksel) */
  x: number;
  y: number;
  visible?: boolean;
}

// ---------------------------------------------------------------------------
// Utilitas byte
// ---------------------------------------------------------------------------

class ByteWriter {
  private chunks: Uint8Array[] = [];
  private size = 0;
  get length() {
    return this.size;
  }
  bytes(b: Uint8Array) {
    this.chunks.push(b);
    this.size += b.length;
  }
  ascii(s: string) {
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
    this.bytes(b);
  }
  u8(v: number) {
    this.bytes(Uint8Array.of(v & 0xff));
  }
  u16(v: number) {
    this.bytes(Uint8Array.of((v >> 8) & 0xff, v & 0xff));
  }
  i16(v: number) {
    this.u16(v < 0 ? v + 0x10000 : v);
  }
  u32(v: number) {
    this.bytes(Uint8Array.of((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff));
  }
  i32(v: number) {
    this.u32(v < 0 ? v + 0x100000000 : v);
  }
  pad(n: number) {
    if (n > 0) this.bytes(new Uint8Array(n));
  }
  toBytes(): Uint8Array {
    const all = new Uint8Array(this.size);
    let o = 0;
    for (const c of this.chunks) {
      all.set(c, o);
      o += c.length;
    }
    return all;
  }
  toBlob(type: string): Blob {
    return new Blob(this.chunks as BlobPart[], { type });
  }
}

const getRGBA = (canvas: HTMLCanvasElement): ImageData => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D tidak tersedia');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

const canvasToBytes = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      async (b) => (b ? resolve(new Uint8Array(await b.arrayBuffer())) : reject(new Error('Gagal membuat gambar'))),
      type,
      quality
    );
  });

/** zlib (deflate) via CompressionStream; null jika browser belum mendukung. */
async function deflate(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export interface PdfOptions {
  /** true = latar transparan dipertahankan (gambar RGB + SMask); false = JPEG biasa */
  transparent: boolean;
  /** kerapatan piksel yang dianggap pada halaman (menentukan ukuran fisik) */
  dpi?: number;
  title?: string;
}

/** Satu halaman per canvas. Ukuran halaman = piksel / dpi (default 150 dpi). */
export async function canvasesToPdf(pages: HTMLCanvasElement[], opts: PdfOptions): Promise<Blob> {
  if (pages.length === 0) throw new Error('Tidak ada halaman untuk PDF');
  const dpi = opts.dpi ?? 150;
  const out = new ByteWriter();
  const offsets: number[] = [];
  let objCount = 0;
  const newObj = () => ++objCount;

  const beginObj = (id: number) => {
    offsets[id] = out.length;
    out.ascii(`${id} 0 obj\n`);
  };
  const endObj = () => out.ascii('\nendobj\n');
  const writeStream = (id: number, dict: string, data: Uint8Array) => {
    beginObj(id);
    out.ascii(`<< ${dict} /Length ${data.length} >>\nstream\n`);
    out.bytes(data);
    out.ascii('\nendstream');
    endObj();
  };

  out.ascii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const catalogId = newObj();
  const pagesId = newObj();
  const infoId = newObj();
  const pageIds: number[] = [];

  for (let i = 0; i < pages.length; i++) {
    const canvas = pages[i];
    const w = canvas.width;
    const h = canvas.height;
    const wPt = +(w * 72 / dpi).toFixed(2);
    const hPt = +(h * 72 / dpi).toFixed(2);

    const imgId = newObj();
    let smaskId = 0;

    if (opts.transparent) {
      const rgba = getRGBA(canvas).data;
      const n = w * h;
      const rgb = new Uint8Array(n * 3);
      const alpha = new Uint8Array(n);
      for (let p = 0; p < n; p++) {
        rgb[p * 3] = rgba[p * 4];
        rgb[p * 3 + 1] = rgba[p * 4 + 1];
        rgb[p * 3 + 2] = rgba[p * 4 + 2];
        alpha[p] = rgba[p * 4 + 3];
      }
      const rgbZ = await deflate(rgb);
      const alphaZ = await deflate(alpha);
      smaskId = newObj();
      writeStream(
        smaskId,
        `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 8${alphaZ ? ' /Filter /FlateDecode' : ''}`,
        alphaZ ?? alpha
      );
      writeStream(
        imgId,
        `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /SMask ${smaskId} 0 R${rgbZ ? ' /Filter /FlateDecode' : ''}`,
        rgbZ ?? rgb
      );
    } else {
      const jpg = await canvasToBytes(canvas, 'image/jpeg', 0.92);
      writeStream(
        imgId,
        `/Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
        jpg
      );
    }

    const contentId = newObj();
    const content = new TextEncoder().encode(`q ${wPt} 0 0 ${hPt} 0 0 cm /Im0 Do Q`);
    writeStream(contentId, '', content);

    const pageId = newObj();
    pageIds.push(pageId);
    beginObj(pageId);
    out.ascii(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << /Im0 ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    endObj();
  }

  beginObj(catalogId);
  out.ascii(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  endObj();
  beginObj(pagesId);
  out.ascii(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  endObj();
  beginObj(infoId);
  const title = (opts.title ?? 'Try-D').replace(/[()\\]/g, '');
  out.ascii(`<< /Title (${title}) /Creator (Try-D) /Producer (Try-D) >>`);
  endObj();

  const xrefStart = out.length;
  out.ascii(`xref\n0 ${objCount + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= objCount; id++) {
    out.ascii(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  out.ascii(`trailer\n<< /Size ${objCount + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);
  return out.toBlob('application/pdf');
}

// ---------------------------------------------------------------------------
// PSD (8 bit RGB, layer berlapis, kompresi RLE)
// ---------------------------------------------------------------------------

/** PackBits per baris; mengembalikan panjang tiap baris dan data terkompresi. */
function packBitsPlane(plane: Uint8Array, w: number, h: number): { counts: number[]; data: Uint8Array } {
  const counts: number[] = [];
  const parts: Uint8Array[] = [];
  const row = new Uint8Array(w * 2 + 2);
  for (let y = 0; y < h; y++) {
    const base = y * w;
    let o = 0;
    let i = 0;
    while (i < w) {
      // jalur berulang
      let run = 1;
      while (i + run < w && run < 128 && plane[base + i + run] === plane[base + i]) run++;
      if (run >= 2) {
        row[o++] = (257 - run) & 0xff;
        row[o++] = plane[base + i];
        i += run;
      } else {
        // jalur literal sampai ketemu pengulangan
        let lit = 1;
        while (
          i + lit < w &&
          lit < 128 &&
          !(i + lit + 1 < w && plane[base + i + lit] === plane[base + i + lit + 1])
        ) {
          lit++;
        }
        row[o++] = lit - 1;
        for (let k = 0; k < lit; k++) row[o++] = plane[base + i + k];
        i += lit;
      }
    }
    counts.push(o);
    parts.push(row.slice(0, o));
  }
  const total = counts.reduce((a, b) => a + b, 0);
  const data = new Uint8Array(total);
  let p = 0;
  for (const part of parts) {
    data.set(part, p);
    p += part.length;
  }
  return { counts, data };
}

const asciiName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '?')
    .slice(0, 60) || 'Layer';

/** Satu channel layer: kompresi (2 byte) + jumlah byte per baris + data RLE. */
function layerChannelBytes(plane: Uint8Array, w: number, h: number): Uint8Array {
  const { counts, data } = packBitsPlane(plane, w, h);
  const out = new Uint8Array(2 + h * 2 + data.length);
  out[0] = 0;
  out[1] = 1; // RLE
  for (let y = 0; y < h; y++) {
    out[2 + y * 2] = (counts[y] >> 8) & 0xff;
    out[3 + y * 2] = counts[y] & 0xff;
  }
  out.set(data, 2 + h * 2);
  return out;
}

/**
 * Menulis PSD. `layers` urut dari paling bawah ke paling atas. `composite` = gambar gabungan
 * (diratakan di atas `flattenBackground`) untuk pratinjau dan program yang tidak membaca layer.
 */
export function buildPsd(
  width: number,
  height: number,
  layers: LayerCanvas[],
  composite: HTMLCanvasElement,
  flattenBackground: 'white' | 'black'
): Blob {
  const out = new ByteWriter();

  // Header
  out.ascii('8BPS');
  out.u16(1);
  out.pad(6);
  out.u16(3); // saluran: RGB
  out.u32(height);
  out.u32(width);
  out.u16(8);
  out.u16(3); // mode warna RGB
  out.u32(0); // color mode data
  out.u32(0); // image resources

  // Layer info
  const layerInfo = new ByteWriter();
  layerInfo.i16(layers.length);
  const channelData: Uint8Array[][] = [];
  for (const layer of layers) {
    const w = layer.canvas.width;
    const h = layer.canvas.height;
    const rgba = getRGBA(layer.canvas).data;
    const n = w * h;
    const planes = [new Uint8Array(n), new Uint8Array(n), new Uint8Array(n), new Uint8Array(n)]; // R,G,B,A
    for (let p = 0; p < n; p++) {
      planes[0][p] = rgba[p * 4];
      planes[1][p] = rgba[p * 4 + 1];
      planes[2][p] = rgba[p * 4 + 2];
      planes[3][p] = rgba[p * 4 + 3];
    }
    // urutan channel pada berkas: alpha (-1), R (0), G (1), B (2)
    const chans = [planes[3], planes[0], planes[1], planes[2]].map((pl) => layerChannelBytes(pl, w, h));
    channelData.push(chans);

    layerInfo.i32(layer.y); // top
    layerInfo.i32(layer.x); // left
    layerInfo.i32(layer.y + h); // bottom
    layerInfo.i32(layer.x + w); // right
    layerInfo.u16(4);
    const ids = [-1, 0, 1, 2];
    chans.forEach((c, i) => {
      layerInfo.i16(ids[i]);
      layerInfo.u32(c.length);
    });
    layerInfo.ascii('8BIM');
    layerInfo.ascii('norm');
    layerInfo.u8(255); // opacity
    layerInfo.u8(0); // clipping
    layerInfo.u8(layer.visible === false ? 2 : 0); // flags (bit 1 = tersembunyi)
    layerInfo.u8(0);
    const name = asciiName(layer.name);
    const nameBytes = 1 + name.length;
    const namePad = (4 - (nameBytes % 4)) % 4;
    layerInfo.u32(4 + 4 + nameBytes + namePad); // panjang data tambahan
    layerInfo.u32(0); // layer mask
    layerInfo.u32(0); // blending ranges
    layerInfo.u8(name.length);
    layerInfo.ascii(name);
    layerInfo.pad(namePad);
  }
  for (const chans of channelData) for (const c of chans) layerInfo.bytes(c);
  if (layerInfo.length % 2 === 1) layerInfo.pad(1);

  // Layer and mask information: [panjang seksi][panjang layer info][layer info][panjang global mask = 0]
  out.u32(4 + layerInfo.length + 4);
  out.u32(layerInfo.length);
  out.bytes(layerInfo.toBytes());
  out.u32(0);

  // Gambar gabungan: diratakan di atas latar, RLE planar RGB
  const flat = document.createElement('canvas');
  flat.width = width;
  flat.height = height;
  const fctx = flat.getContext('2d')!;
  fctx.fillStyle = flattenBackground === 'black' ? '#09090b' : '#ffffff';
  fctx.fillRect(0, 0, width, height);
  fctx.drawImage(composite, 0, 0, width, height);
  const rgba = fctx.getImageData(0, 0, width, height).data;
  const n = width * height;
  const planes = [new Uint8Array(n), new Uint8Array(n), new Uint8Array(n)];
  for (let p = 0; p < n; p++) {
    planes[0][p] = rgba[p * 4];
    planes[1][p] = rgba[p * 4 + 1];
    planes[2][p] = rgba[p * 4 + 2];
  }
  const packed = planes.map((pl) => packBitsPlane(pl, width, height));
  out.u16(1); // RLE
  for (const pk of packed) for (const c of pk.counts) out.u16(c);
  for (const pk of packed) out.bytes(pk.data);
  return out.toBlob('image/vnd.adobe.photoshop');
}

// ---------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** SVG berlapis: tiap gambar sablon menjadi grup bernama (layer di Inkscape/Illustrator/CorelDRAW). */
export async function buildSvg(
  width: number,
  height: number,
  layers: LayerCanvas[],
  background: 'transparent' | 'white' | 'black'
): Promise<Blob> {
  const parts: string[] = [];
  parts.push(
    `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
      `xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`
  );
  if (background !== 'transparent') {
    parts.push(
      `<g id="Latar" inkscape:groupmode="layer" inkscape:label="Latar"><rect width="${width}" height="${height}" fill="${background === 'black' ? '#09090b' : '#ffffff'}"/></g>\n`
    );
  }
  for (const layer of layers) {
    const bytes = await canvasToBytes(layer.canvas, 'image/png');
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
    const label = xmlEscape(layer.name);
    parts.push(
      `<g id="${label}" inkscape:groupmode="layer" inkscape:label="${label}"${layer.visible === false ? ' style="display:none"' : ''}>` +
        `<image x="${layer.x}" y="${layer.y}" width="${layer.canvas.width}" height="${layer.canvas.height}" ` +
        `preserveAspectRatio="none" xlink:href="data:image/png;base64,${btoa(bin)}"/></g>\n`
    );
  }
  parts.push('</svg>\n');
  return new Blob(parts, { type: 'image/svg+xml' });
}
