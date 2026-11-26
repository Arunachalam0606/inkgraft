import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apply, enhance, homography, warp } from '../src/lib/warp.ts';

test('homography maps the four corners exactly', () => {
  const from: [number, number][] = [[0, 0], [100, 0], [100, 140], [0, 140]];
  const to: [number, number][] = [[12, 8], [190, 20], [210, 260], [5, 240]];
  const h = homography(from, to);
  from.forEach((p, i) => { const [x, y] = apply(h, ...p); assert.ok(Math.hypot(x - to[i][0], y - to[i][1]) < 1e-6); });
  assert.throws(() => homography(from, [[0, 0], [1, 1], [2, 2], [3, 3]]), /degenerate/);
});

test('warp straightens a tilted dark square to the full output', () => {
  // 200x200 white image with a black quad; warping exactly that quad should give an all-dark output
  const W = 200, data = new Uint8ClampedArray(W * W * 4).fill(255);
  const quad: [number, number][] = [[50, 40], [150, 60], [140, 160], [40, 150]];
  const inside = (x: number, y: number) => { let s = 0; for (let i = 0; i < 4; i++) { const [ax, ay] = quad[i], [bx, by] = quad[(i + 1) % 4]; s += Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax)); } return Math.abs(s) === 4; };
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (inside(x, y)) data.fill(0, (y * W + x) * 4, (y * W + x) * 4 + 3);
  const out = warp({ data, width: W, height: W }, quad, 60, 60);
  let dark = 0; for (let i = 0; i < out.length; i += 4) if (out[i] < 128) dark++;
  assert.ok(dark / (60 * 60) > 0.9, `mostly dark, got ${dark / 3600}`);
});

test('doc enhance whitens a shaded background and keeps ink dark', () => {
  const W = 96, H = 96, px = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const shade = 160 + x * 0.6; const v = x > 40 && x < 50 ? 30 : shade; px.fill(v, (y * W + x) * 4, (y * W + x) * 4 + 3); px[(y * W + x) * 4 + 3] = 255; }
  enhance(px, W, H, 'doc');
  assert.ok(px[(10 * W + 5) * 4] > 200 && px[(10 * W + 90) * 4] > 200, 'paper near white on both sides');
  assert.ok(px[(10 * W + 45) * 4] < 60, 'ink stays dark');
});
