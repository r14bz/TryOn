/**
 * Visibilitas sablon per-vertex.
 *
 * Sablon diproyeksikan lurus (orthographic) sepanjang satu sumbu. Tanpa pengecekan
 * oklusi, proyeksi juga mengenai kain di BELAKANG lengan (dinding badan yang terlihat
 * lewat lubang lengan), sehingga gambar tampak "tembus" ke bagian dalam kaos.
 *
 * Fungsi ini menandai tiap vertex: 1 jika tidak ada permukaan lain di depannya
 * sepanjang sumbu proyeksi, 0 jika tertutup. Hasilnya dipakai shader untuk
 * membatasi sablon pada permukaan luar yang pertama terkena proyektor.
 *
 * Modul ini murni (tanpa three.js) sehingga mudah diuji.
 */

export type Vec3 = [number, number, number];

export interface VisibilityOptions {
  /** ukuran sel grid 2D (satuan model) */
  cell?: number;
  /** selisih kedalaman minimum agar dianggap menutupi (mengabaikan permukaan sendiri) */
  eps?: number;
  /** batas dalam segitiga; > 0 mengabaikan vertex yang tepat di tepi segitiga tetangga */
  margin?: number;
}

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * @param positions xyz berurutan per vertex
 * @param indices   tiga indeks vertex per segitiga
 * @param axis      arah proyeksi (menuju kamera/proyektor)
 * @returns Float32Array sepanjang jumlah vertex, bernilai 1 (terlihat) atau 0 (tertutup)
 */
export function computeAxisVisibility(
  positions: ArrayLike<number>,
  indices: ArrayLike<number>,
  axis: Vec3,
  opts: VisibilityOptions = {}
): Float32Array {
  const cell = opts.cell ?? 0.01;
  const eps = opts.eps ?? 0.006;
  const margin = opts.margin ?? 1e-4;

  const vCount = Math.floor(positions.length / 3);
  const tCount = Math.floor(indices.length / 3);
  const out = new Float32Array(vCount).fill(1);
  if (vCount === 0 || tCount === 0) return out;

  // Basis: a = sumbu proyeksi, (u, v) = bidang tegak lurus
  const a = normalize(axis);
  let u = cross(a, [0, 1, 0]);
  if (Math.hypot(u[0], u[1], u[2]) < 1e-6) u = cross(a, [1, 0, 0]);
  u = normalize(u);
  const v = cross(a, u);

  const X = new Float32Array(vCount);
  const Y = new Float32Array(vCount);
  const Z = new Float32Array(vCount);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < vCount; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];
    const x = px * u[0] + py * u[1] + pz * u[2];
    const y = px * v[0] + py * v[1] + pz * v[2];
    X[i] = x;
    Y[i] = y;
    Z[i] = px * a[0] + py * a[1] + pz * a[2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const gw = Math.floor((maxX - minX) / cell) + 2;
  const gh = Math.floor((maxY - minY) / cell) + 2;
  const cellOf = (x: number, y: number) =>
    Math.floor((x - minX) / cell) * gh + Math.floor((y - minY) / cell);

  // Grid CSR: segitiga dimasukkan ke setiap sel yang disentuh bbox-nya
  const counts = new Uint32Array(gw * gh + 1);
  const bbox = new Int32Array(tCount * 4);
  for (let t = 0; t < tCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];
    const gx0 = Math.floor((Math.min(X[i0], X[i1], X[i2]) - minX) / cell);
    const gx1 = Math.floor((Math.max(X[i0], X[i1], X[i2]) - minX) / cell);
    const gy0 = Math.floor((Math.min(Y[i0], Y[i1], Y[i2]) - minY) / cell);
    const gy1 = Math.floor((Math.max(Y[i0], Y[i1], Y[i2]) - minY) / cell);
    bbox[t * 4] = gx0;
    bbox[t * 4 + 1] = gx1;
    bbox[t * 4 + 2] = gy0;
    bbox[t * 4 + 3] = gy1;
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) counts[gx * gh + gy + 1]++;
    }
  }
  for (let c = 0; c < gw * gh; c++) counts[c + 1] += counts[c];
  const fill = counts.slice(0, gw * gh);
  const items = new Uint32Array(counts[gw * gh]);
  for (let t = 0; t < tCount; t++) {
    for (let gx = bbox[t * 4]; gx <= bbox[t * 4 + 1]; gx++) {
      for (let gy = bbox[t * 4 + 2]; gy <= bbox[t * 4 + 3]; gy++) {
        items[fill[gx * gh + gy]++] = t;
      }
    }
  }

  for (let i = 0; i < vCount; i++) {
    const c = cellOf(X[i], Y[i]);
    const px = X[i];
    const py = Y[i];
    for (let k = counts[c]; k < counts[c + 1]; k++) {
      const t = items[k];
      const i0 = indices[t * 3];
      const i1 = indices[t * 3 + 1];
      const i2 = indices[t * 3 + 2];
      if (i0 === i || i1 === i || i2 === i) continue; // segitiga milik vertex sendiri

      const d = (Y[i1] - Y[i2]) * (X[i0] - X[i2]) + (X[i2] - X[i1]) * (Y[i0] - Y[i2]);
      if (Math.abs(d) < 1e-14) continue;
      const l0 = ((Y[i1] - Y[i2]) * (px - X[i2]) + (X[i2] - X[i1]) * (py - Y[i2])) / d;
      const l1 = ((Y[i2] - Y[i0]) * (px - X[i2]) + (X[i0] - X[i2]) * (py - Y[i2])) / d;
      const l2 = 1 - l0 - l1;
      if (l0 < margin || l1 < margin || l2 < margin) continue;

      const z = l0 * Z[i0] + l1 * Z[i1] + l2 * Z[i2];
      if (z > Z[i] + eps) {
        out[i] = 0;
        break;
      }
    }
  }
  return out;
}
