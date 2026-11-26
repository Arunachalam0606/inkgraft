// Perspective correction: a homography from 4 point pairs, solved by Gaussian elimination. Pure; tests/warp.test.ts.
export type Pt = [number, number];

/** 3x3 matrix (row-major, h33 = 1) mapping each `from[i]` to `to[i]`. */
export function homography(from: Pt[], to: Pt[]): number[] {
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i], [u, v] = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  // Gaussian elimination with partial pivoting on the 8x8 system
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-12) throw new Error('Corners are degenerate (three in a line?)');
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return [...b.map((v, i) => v / A[i][i]), 1];
}

export const apply = (h: number[], x: number, y: number): Pt => {
  const w = h[6] * x + h[7] * y + h[8];
  return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
};

/** Warp the quad `corners` (TL, TR, BR, BL in source pixels) of `src` into a W x H RGBA buffer (bilinear). */
export function warp(src: { data: Uint8ClampedArray; width: number; height: number }, corners: Pt[], W: number, H: number) {
  const h = homography([[0, 0], [W, 0], [W, H], [0, H]], corners);
  const out: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(W * H * 4), { data, width, height } = src;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [sx, sy] = apply(h, x + 0.5, y + 0.5);
    const x0 = Math.min(width - 2, Math.max(0, Math.floor(sx - 0.5))), y0 = Math.min(height - 2, Math.max(0, Math.floor(sy - 0.5)));
    const fx = Math.min(1, Math.max(0, sx - 0.5 - x0)), fy = Math.min(1, Math.max(0, sy - 0.5 - y0));
    const o = (y * W + x) * 4;
    for (let c = 0; c < 4; c++) {
      const i = (y0 * width + x0) * 4 + c;
      const top = data[i] * (1 - fx) + data[i + 4] * fx, bot = data[i + width * 4] * (1 - fx) + data[i + width * 4 + 4] * fx;
      out[o + c] = top * (1 - fy) + bot * fy;
    }
  }
  return out;
}

/** Document clean-up: greyscale, or a "scanned" look that whitens paper and deepens ink (per-tile normalisation). */
export function enhance(px: Uint8ClampedArray<ArrayBuffer>, W: number, H: number, mode: 'color' | 'gray' | 'doc') {
  if (mode === 'color') return px;
  const g = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  if (mode === 'doc') {
    // estimate the paper brightness on a coarse grid, then divide it out (removes shadows and uneven light)
    const T = 48, gw = Math.ceil(W / T), gh = Math.ceil(H / T), bg = new Float32Array(gw * gh);
    for (let ty = 0; ty < gh; ty++) for (let tx = 0; tx < gw; tx++) {
      const vals: number[] = [];
      for (let y = ty * T; y < Math.min(H, ty * T + T); y += 3) for (let x = tx * T; x < Math.min(W, tx * T + T); x += 3) vals.push(g[y * W + x]);
      vals.sort((a, b) => a - b); bg[ty * gw + tx] = Math.max(40, vals[Math.floor(vals.length * 0.9)]);
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // background samples sit at tile centres
      const fx = Math.min(gw - 1, Math.max(0, x / T - 0.5)), fy = Math.min(gh - 1, Math.max(0, y / T - 0.5)), x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1);
      const ax = fx - x0, ay = fy - y0;
      const b = (bg[y0 * gw + x0] * (1 - ax) + bg[y0 * gw + x1] * ax) * (1 - ay) + (bg[y1 * gw + x0] * (1 - ax) + bg[y1 * gw + x1] * ax) * ay;
      const v = g[y * W + x] / b; // 1 = as bright as the local paper
      g[y * W + x] = 255 * Math.min(1, Math.max(0, (v - 0.45) / 0.43)); // paper (>= 88% of local) -> white, ink -> dark
    }
  }
  for (let i = 0; i < W * H; i++) { px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = g[i]; }
  return px;
}
