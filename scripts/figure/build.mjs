// Builds the hero figure "the graft press" with the anatomy iso kit and writes src/figure/graft.generated.ts.
// A flatbed holds a scanned page; a type case holds letters harvested from that scan. An x/y gantry's plunger
// lifts a copy of each letter of "November" and sets it into the page line where "October" was erased. The
// page has no regular capital N, so that one sort comes from the font die instead: 7 cloned + 1 font, as in
// the real edit. Run: node scripts/figure/build.mjs
import { writeFileSync } from 'node:fs';
import * as k from './kit/iso-kit.mjs';

const W = 640, H = 430;

// ---- world layout (units ≈ px, x/y on the floor, z up; +x and +y face the viewer) ----
const BED = { x: -132, y: -70, w: 264, d: 140, r: 8 };
const BED_H = 10, FOOT_H = 5;
const PAPER = { x: -8, y: -56, w: 132, d: 104, r: 1.2 };
const PAPER_T = 0.8;
const CASE = { x: -124, y: -56, w: 100, d: 88, r: 3 };
const CASE_FLOOR = 3, CASE_WALL = 10, WALL_T = 2.4;
const COLS = 4, ROWS = 3;
const SORT = 12, SORT_H = 9;
const LINE_Y = -6;            // the page line being edited
const SLOT_X0 = 4, PITCH = 14.2;
const DIE = [-96, 50];        // font die (fallback letters)
const DIE_R = 8, DIE_H = 6;
const RAIL_Y = [-66, 60], RAIL_D = 5, RAIL_H = 3;
const POST = { w: 10, d: 7 }, BAR_Z = 66, BAR_H = 7;
const CAR = { dx: -5, w: 22, d: 16 }, CAR_Z = BAR_Z + BAR_H, CAR_H = 9;
const ARM = 11;               // plunger axis offset from the crossbar, toward the viewer in x
const UP = 40;                // plunger tip height when travelling
const REF = UP;               // plunger group is built at this tip height

const WORD = 'November';
const CASE_LETTERS = ['o', 'v', 'e', 'm', 'b', 'r', 'c', 't', 'a', 'h', 'n', 'd'];

const cell = (i) => {
  const cw = (CASE.w - WALL_T * 2) / COLS, cd = (CASE.d - WALL_T * 2) / ROWS;
  const c = i % COLS, r = Math.floor(i / COLS);
  return [CASE.x + WALL_T + cw * (c + 0.5), CASE.y + WALL_T + cd * (r + 0.5)];
};
const slot = (i) => [SLOT_X0 + PITCH * i + SORT / 2, LINE_Y];
const sortPlan = ([x, y]) => ({ x: x - SORT / 2, y: y - SORT / 2, w: SORT, d: SORT, r: 0.8 });

const P = k.fitProjection(
  [...k.boxCorners(BED, -BED_H - FOOT_H, 0), [BED.x, RAIL_Y[0], CAR_Z + CAR_H], [BED.x + BED.w, RAIL_Y[1] + RAIL_D, CAR_Z + CAR_H], [BED.x + BED.w, BED.y, CAR_Z + CAR_H]],
  W, H, { pad: 26, azimuth: 45 },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (pts, style) => k.dotsSvg(pts, style);
const depth = (x, y, z = 0) => k.depthOf([x, y, z], P);
const byDepth = (list, f) => [...list].sort((a, b) => depth(...f(a)) - depth(...f(b)));

// ---- static parts ----
function bed() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BED, -BED_H - FOOT_H, BED_H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(BED, 24), (p) => p)) {
    out.push(S(k.cylinder(x, y, 8, -BED_H - FOOT_H, 1.6, P, 28), { tone: 'lo' }));
    out.push(S(k.cylinder(x, y, 6, -BED_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: 'mid' }));
  }
  out.push(S(k.slabOf(BED, -BED_H, BED_H, P, 8, 1.4), { tone: 'mid' }));
  out.push(L(k.planOutline(k.insetPlan(BED, 4), 0, P), { tone: 'lo' }));
  const screws = k.corners(BED, 10);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(''), { tone: 'lo' }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the front edge, under the page
  const strip = { x: PAPER.x, y: PAPER.y + PAPER.d + 2.5, w: PAPER.w, d: 5, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: 'lo', crease: 'none' }));
  const ticks = k.topTicks(strip.x + 3, strip.x + strip.w - 3, 4, 5, strip.y + 0.6, 0.6, [1.8, 3.4], P);
  out.push(L(ticks.minor, { tone: 'lo' }), L(ticks.major, { tone: 'mid' }));
  return out.join('');
}

function rail(y) {
  const out = [S(k.slabOf({ x: BED.x + 8, y, w: BED.w - 16, d: RAIL_D, r: 1 }, 0, RAIL_H, P, 3, 0.4), { tone: 'mid' })];
  for (const x of [BED.x + 4, BED.x + BED.w - 8]) out.push(S(k.slabOf({ x, y: y - 1.5, w: 4, d: RAIL_D + 3, r: 1 }, 0, 6, P, 3, 0.4), { tone: 'mid' }));
  out.push(D([BED.x + 16, 0, BED.x + BED.w - 16].map((x) => at([x, y + RAIL_D / 2, RAIL_H])), { size: 0.4 }));
  return out.join('');
}

// a gantry post standing on rail y, built at bridge x = 0
function post(y) {
  const plan = { x: -POST.w / 2, y: y + RAIL_D / 2 - POST.d / 2, w: POST.w, d: POST.d, r: 1.2 };
  const out = [S(k.slabOf(k.insetPlan(plan, -1.6), RAIL_H, 4, P, 3, 0.5), { tone: 'mid' })]; // bushing block on the rail
  out.push(S(k.slabOf(plan, RAIL_H + 4, BAR_Z - RAIL_H - 4, P, 3, 0.5), { tone: 'mid' }));
  out.push(L(k.sideSeam(plan, 30, P, 3), { tone: 'faint' }));
  return out.join('');
}

function paper() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PAPER, 0, 0.3, P)}" style="filter:blur(3px)"/>`];
  out.push(S(k.slabOf(PAPER, 0, PAPER_T, P, 3), { tone: 'hi', crease: 'none', flat: true, className: 'graft-paper' }));
  out.push('<g class="graft-print">');
  // printed text as rule lines, row by row (free: they stand for print)
  const rows = [-46, -37, -28, -19, 8, 17, 26, 35, 44];
  const words = [[0, 22, 26, 40, 44, 70, 74, 92], [0, 30, 34, 48, 52, 86], [0, 18, 22, 60, 64, 112], [0, 34, 38, 66], [0, 40, 44, 56, 60, 98, 102, 114], [0, 26, 30, 74], [0, 52, 56, 84, 88, 110], [0, 20, 24, 64], [0, 36]];
  rows.forEach((y, r) => {
    const w = words[r];
    for (let i = 0; i < w.length; i += 2) out.push(L(k.lineOnTop([PAPER.x + 8 + w[i], y], [PAPER.x + 8 + w[i + 1], y], PAPER_T, P), { tone: 'lo', free: true }));
  });
  // the edited line: "Date :26th" stays, "October" is erased and reset
  out.push(`<g data-part="old">${k.faceTextSvg(k.topMatrix([SLOT_X0 + 2, LINE_Y + 5.4], PAPER_T, P, 'x'), 'October', { size: 19, tone: 'mid' })}</g>`);
  // erase wipe: paper-coloured patch whose width the live code animates
  out.push(`<g data-part="wipe"></g>`, '</g>');
  return out.join('');
}

function caseTray() {
  const out = [`<path class="iso-halo" d="${k.haloOf(CASE, 0, 2, P)}"/>`];
  out.push(S(k.slabOf(CASE, 0, CASE_FLOOR, P, 4, 0.6), { tone: 'mid' }));
  const back = { x: CASE.x, y: CASE.y, w: CASE.w, d: WALL_T, r: 0.6 };
  const left = { x: CASE.x, y: CASE.y, w: WALL_T, d: CASE.d, r: 0.6 };
  out.push(S(k.slabOf(back, CASE_FLOOR, CASE_WALL, P, 2, 0.3), { tone: 'mid' }));
  out.push(S(k.slabOf(left, CASE_FLOOR, CASE_WALL, P, 2, 0.3), { tone: 'mid' }));
  // dividers and sorts, back to front
  const cw = (CASE.w - WALL_T * 2) / COLS, cd = (CASE.d - WALL_T * 2) / ROWS;
  const items = [];
  for (let c = 1; c < COLS; c++) { const x = CASE.x + WALL_T + cw * c - 0.6; items.push({ at: [x + 0.6, CASE.y + CASE.d / 2, 0], svg: S(k.slabOf({ x, y: CASE.y + WALL_T, w: 1.2, d: CASE.d - WALL_T * 2, r: 0.3 }, CASE_FLOOR, CASE_WALL - 2, P, 2), { tone: 'lo' }), bias: -40 }); }
  for (let r = 1; r < ROWS; r++) { const y = CASE.y + WALL_T + cd * r - 0.6; items.push({ at: [CASE.x + CASE.w / 2, y + 0.6, 0], svg: S(k.slabOf({ x: CASE.x + WALL_T, y, w: CASE.w - WALL_T * 2, d: 1.2, r: 0.3 }, CASE_FLOOR, CASE_WALL - 2, P, 2), { tone: 'lo' }), bias: -40 }); }
  CASE_LETTERS.forEach((ch, i) => {
    const [x, y] = cell(i);
    items.push({ at: [x, y, 0], svg: sortSvg([x, y], CASE_FLOOR, ch, { lit: false }), bias: 0 });
  });
  // painter's order: dividers of a row go before the sorts in front of them
  items.sort((a, b) => depth(...a.at) + (a.bias > -40 ? 0 : 0) - depth(...b.at));
  out.push(...items.map((i) => i.svg));
  const right = { x: CASE.x + CASE.w - WALL_T, y: CASE.y, w: WALL_T, d: CASE.d, r: 0.6 };
  const front = { x: CASE.x, y: CASE.y + CASE.d - WALL_T, w: CASE.w, d: WALL_T, r: 0.6 };
  out.push(S(k.slabOf(right, CASE_FLOOR, CASE_WALL, P, 2, 0.3), { tone: 'mid' }));
  out.push(S(k.slabOf(front, CASE_FLOOR, CASE_WALL, P, 2, 0.3), { tone: 'mid' }));
  // brass label holder and pull on the front wall
  out.push(S(k.slabOf({ x: CASE.x + CASE.w / 2 - 9, y: CASE.y + CASE.d, w: 18, d: 1, r: 0.3 }, CASE_FLOOR + 2, 5, P, 2), { tone: 'lo' }));
  out.push(D([at([CASE.x + CASE.w / 2 - 7.5, CASE.y + CASE.d + 1, CASE_FLOOR + 4.5]), at([CASE.x + CASE.w / 2 + 7.5, CASE.y + CASE.d + 1, CASE_FLOOR + 4.5])], { size: 0.4 }));
  return out.join('');
}

function sortSvg([x, y], z, ch, { lit = false, dotted = false } = {}) {
  const plan = sortPlan([x, y]);
  const out = [S(k.slabOf(plan, z, SORT_H, P, 2, 0.4), { tone: 'hi', crease: 'lo', lit })];
  out.push(L(k.sideSeam(plan, z + SORT_H - 2.6, P, 2), { tone: 'faint' })); // the nick
  out.push(k.faceTextSvg(k.topMatrix([x - 3.4, y + 3.4], z + SORT_H, P, 'x'), ch, { size: 10, tone: dotted ? 'mid' : 'hi' }));
  if (dotted) out.push(L(k.planOutline(k.insetPlan(plan, 0.9), z + SORT_H, P, 2), { tone: 'lo', dotted: true }));
  return out.join('');
}

function die() {
  const [x, y] = DIE;
  const out = [S(k.cylinder(x, y, DIE_R + 2, 0, 1.4, P, 40), { tone: 'lo' })];
  out.push(S(k.cylinder(x, y, DIE_R, 1.4, DIE_H - 1.4, P, 40, 0.5), { tone: 'mid' }));
  out.push(L(k.knurl(x, y, DIE_R, 2.4, DIE_H - 0.8, 48, P), { tone: 'lo' }));
  out.push(sortSvg([x, y], DIE_H, 'N', { dotted: true }));
  return out.join('');
}

// ---- moving parts, built at bridge x = 0, carriage y = 0, plunger tip z = REF ----
function crossbar() {
  const plan = { x: -POST.w / 2 + 1, y: RAIL_Y[0] + RAIL_D / 2 - POST.d / 2, w: POST.w - 2, d: RAIL_Y[1] - RAIL_Y[0] + POST.d, r: 1.4 };
  const out = [S(k.slabOf(plan, BAR_Z, BAR_H, P, 3, 0.5), { tone: 'mid' })];
  const t = k.topTicks(plan.y + 6, plan.y + plan.d - 6, 4, 5, plan.x + 1, BAR_Z + BAR_H, [1.2, 2.4], P, 'y');
  out.push(L(t.minor, { tone: 'lo' }), L(t.major, { tone: 'mid' }));
  out.push(D([at([0, plan.y + 3, BAR_Z + BAR_H]), at([0, plan.y + plan.d - 3, BAR_Z + BAR_H])], { size: 0.45 }));
  return out.join('');
}

function carriage() {
  const plan = { x: CAR.dx, y: -CAR.d / 2, w: CAR.w, d: CAR.d, r: 2 };
  const out = [S(k.slabOf(plan, CAR_Z, CAR_H, P, 4, 0.6), { tone: 'mid' })];
  out.push(L(k.planOutline(k.insetPlan(plan, 2.4), CAR_Z + CAR_H, P, 3), { tone: 'faint' }));
  out.push(D(k.corners(plan, 2.2).map(([x, y]) => at([x, y, CAR_Z + CAR_H])), { size: 0.45 }));
  // gland the plunger slides through, then a knurled adjust knob
  out.push(S(k.cylinder(ARM, 0, 3.6, CAR_Z - 3, 3, P, 24), { tone: 'mid' }));
  out.push(S(k.cylinder(-1, 0, 3.4, CAR_Z + CAR_H, 3.6, P, 24), { tone: 'mid' }));
  out.push(L(k.knurl(-1, 0, 3.4, CAR_Z + CAR_H, CAR_Z + CAR_H + 3.6, 24, P), { tone: 'lo' }));
  return out.join('');
}

function plunger() {
  // the rod is long and clipped at the gland, so lowering the tip slides it out rather than stretching it
  const rod = S(k.cylinder(ARM, 0, 1.5, REF + 4, 60, P, 16), { tone: 'hi', crease: 'none', lit: true });
  const head = S(k.cylinder(ARM, 0, 3.4, REF, 4, P, 24, 0.4), { tone: 'hi', lit: true });
  const jaws = [-1, 1].map((s) => S(k.slabOf({ x: ARM - 0.8, y: s * 3.2 - 0.8, w: 1.6, d: 1.6, r: 0.3 }, REF - 1.6, 1.6, P, 2), { tone: 'mid' })).join('');
  const sorts = [...WORD].map((ch, i) => `<g data-part="held" data-i="${i}" style="display:none">${sortSvg([ARM, 0], REF - SORT_H - 1.6, ch, { lit: true, dotted: i === 0 })}</g>`).join('');
  return { rod, tip: sorts + jaws + head };
}

const placed = [...WORD].map((ch, i) => ({ i, ch, at: slot(i) }));
const placedSvg = byDepth(placed, (p) => [p.at[0], p.at[1], 0]).map((p) => `<g data-part="set" data-i="${p.i}" style="display:none">${sortSvg(p.at, PAPER_T, p.ch, { dotted: p.i === 0 })}</g>`).join('');

const pl = plunger();
// clip for the rod: everything below the gland's bottom, in carriage coordinates
const gland = at([ARM, 0, CAR_Z - 3]);
const clip = `M${gland[0] - 8} ${gland[1]} L${gland[0] + 8} ${gland[1]} L${gland[0] + 8} ${H + 200} L${gland[0] - 8} ${H + 200}Z`;

const static_ = {
  back: bed() + rail(RAIL_Y[0]),
  content: paper() + caseTray() + die(),
  front: rail(RAIL_Y[1]),
};
const layers = {
  postBack: post(RAIL_Y[0]),
  placed: placedSvg,
  crossbar: crossbar(),
  carriage: carriage(),
  rod: pl.rod,
  tip: pl.tip,
  postFront: post(RAIL_Y[1]),
};

// where each letter comes from and goes to, as plunger axis (x, y) and tip heights
const moves = [...WORD].map((ch, i) => {
  const from = i === 0 ? DIE : cell(CASE_LETTERS.indexOf(ch));
  const pickZ = (i === 0 ? DIE_H : CASE_FLOOR) + SORT_H + 1.6;
  return { ch, cloned: i !== 0, from, to: slot(i), pickZ, putZ: PAPER_T + SORT_H + 1.6 };
});
for (const m of moves) if (!m.from) throw new Error(`no source for ${m.ch}`);

const ax = (v) => k.axisVector(P, v).map((n) => Math.round(n * 10000) / 10000);
const wipeStart = at([SLOT_X0 - 1, LINE_Y - 10, PAPER_T]), wipe = { x: ax([1, 0, 0]), y: ax([0, 1, 0]) };

const out = `// Generated by scripts/figure/build.mjs — do not edit by hand.
export const VIEW = { width: ${W}, height: ${H} };
export const AXES = { x: ${JSON.stringify(ax([1, 0, 0]))}, y: ${JSON.stringify(ax([0, 1, 0]))}, z: ${JSON.stringify(ax([0, 0, 1]))} };
export const ARM = ${ARM}, UP = ${UP}, REF = ${REF};
export const MOVES = ${JSON.stringify(moves)};
export const HOME = { x: ${-40}, y: ${-30} };
export const WIPE = ${JSON.stringify({ start: wipeStart, x: wipe.x, y: wipe.y, length: WORD.length * PITCH + 4, depth: 17 })};
export const CLIP = ${JSON.stringify(clip)};
export const STATIC = ${JSON.stringify(static_)};
export const LAYERS = ${JSON.stringify(layers)};
`;
writeFileSync('src/figure/graft.generated.ts', out);
console.log('figure: wrote src/figure/graft.generated.ts', Math.round(out.length / 1024), 'KB');
