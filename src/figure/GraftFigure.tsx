import { useEffect, useRef } from 'react';
import { theme } from '../lib/prefs';
import { ARM, AXES, CLIP, LAYERS, MOVES, HOME, STATIC, UP, REF, VIEW, WIPE } from './graft.generated';
import './iso.css';
import './graft.css';

type V3 = [number, number, number];
const tr = ([x, y, z]: V3) =>
  `translate(${(x * AXES.x[0] + y * AXES.y[0] + z * AXES.z[0]).toFixed(2)} ${(x * AXES.x[1] + y * AXES.y[1] + z * AXES.z[1]).toFixed(2)})`;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

// timeline (seconds)
const WIPE_AT = 1.1, WIPE_T = 1.2, START = 2.7, PER = 2.5, HOLD = 3.2;
const TOTAL = START + MOVES.length * PER + HOLD;
const CLONED = MOVES.filter((m) => m.cloned).length, FONT = MOVES.length - CLONED;

interface Pose { x: number; y: number; z: number; held: number; set: number; wipe: number; text: string }

function poseAt(t: number): Pose {
  const wipe = clamp01((t - WIPE_AT) / WIPE_T);
  if (t < START) return { x: HOME.x, y: HOME.y, z: UP, held: -1, set: 0, wipe, text: wipe <= 0 ? 'scanned page · “October”' : wipe < 1 ? 'erasing “October”' : 'reading letters from the scan' };
  const k = Math.min(MOVES.length - 1, Math.floor((t - START) / PER));
  const u = t - START - k * PER;
  const m = MOVES[k];
  const prev = k === 0 ? [HOME.x + ARM, HOME.y] : MOVES[k - 1].to;
  const count = (n: number) => { const done = MOVES.slice(0, n); return `${done.filter((d) => d.cloned).length}/${CLONED} cloned · ${done.filter((d) => !d.cloned).length}/${FONT} font`; };
  if (t >= START + MOVES.length * PER) return { x: HOME.x, y: HOME.y, z: UP, held: -1, set: MOVES.length, wipe: 1, text: `“November” set · ${count(MOVES.length)}` };
  const src = m.cloned ? 'cloned from scan' : 'font (no plain N)';
  const seg = (a: number, b: number) => ease(clamp01((u - a) / (b - a)));
  let x: number, y: number, z = UP, held = -1, set = k;
  if (u < 0.75) { const s = seg(0, 0.75); x = lerp(prev[0], m.from[0], s); y = lerp(prev[1], m.from[1], s); }
  else if (u < 1.3) { x = m.from[0]; y = m.from[1]; const s = u < 1.0 ? seg(0.75, 1.0) : 1 - seg(1.05, 1.3); z = lerp(UP, m.pickZ, s); held = u >= 1.0 ? k : -1; }
  else if (u < 2.0) { const s = seg(1.3, 2.0); x = lerp(m.from[0], m.to[0], s); y = lerp(m.from[1], m.to[1], s); held = k; }
  else { x = m.to[0]; y = m.to[1]; const s = u < 2.22 ? seg(2.0, 2.22) : 1 - seg(2.27, 2.5); z = lerp(UP, m.putZ, s); held = u < 2.22 ? k : -1; set = u < 2.22 ? k : k + 1; }
  return { x: x - ARM, y, z, held, set, wipe: 1, text: `“${m.ch}” · ${src} · ${count(set)}` };
}

export default function GraftFigure() {
  const th = theme.use();
  const root = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current!;
    const q = (s: string) => el.querySelector<SVGGElement>(s)!;
    const bridge = [q('[data-g="postBack"]'), q('[data-g="crossbar"]'), q('[data-g="postFront"]')];
    const car = q('[data-g="carriage"]'), carRod = q('[data-g="carRod"]'), rod = q('[data-g="rod"]'), tip = q('[data-g="tip"]');
    const held = [...el.querySelectorAll<SVGGElement>('[data-part="held"]')];
    const set = [...el.querySelectorAll<SVGGElement>('[data-part="set"]')].sort((a, b) => +a.dataset.i! - +b.dataset.i!);
    const old = q('[data-part="old"]'), wipe = q('[data-part="wipe"]');
    const still = matchMedia('(prefers-reduced-motion: reduce)');
    let last = '', frame = 0, t0 = 0, visible = false;

    const draw = (p: Pose) => {
      const b = tr([p.x, 0, 0]);
      bridge.forEach((g) => g.setAttribute('transform', b));
      car.setAttribute('transform', tr([p.x, p.y, 0]));
      carRod.setAttribute('transform', tr([p.x, p.y, 0]));
      rod.setAttribute('transform', tr([0, 0, p.z - REF]));
      tip.setAttribute('transform', tr([p.x, p.y, p.z - REF]));
      held.forEach((g, i) => { g.style.display = i === p.held ? '' : 'none'; });
      set.forEach((g, i) => { g.style.display = i < p.set ? '' : 'none'; });
      const [sx, sy] = WIPE.start, L = WIPE.length * p.wipe, D = WIPE.depth;
      const pt = (a: number, b: number) => `${(sx + WIPE.x[0] * a + WIPE.y[0] * b).toFixed(1)} ${(sy + WIPE.x[1] * a + WIPE.y[1] * b).toFixed(1)}`;
      wipe.innerHTML = p.wipe > 0 ? `<path class="graft-wipe" d="M${pt(0, 0)}L${pt(L, 0)}L${pt(L, D)}L${pt(0, D)}Z"/>` : '';
      old.style.opacity = p.wipe >= 1 ? '0' : '1';
      if (p.text !== last && readout.current) { readout.current.textContent = p.text; last = p.text; }
    };
    const tick = (now: number) => {
      if (!t0) t0 = now;
      const t = ((now - t0) / 1000) % TOTAL;
      draw(poseAt(t));
      frame = visible ? requestAnimationFrame(tick) : 0;
    };
    const run = () => { if (still.matches) { draw(poseAt(TOTAL - HOLD / 2)); return; } if (!frame && visible) frame = requestAnimationFrame(tick); };
    const replay = () => { t0 = 0; run(); };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) run(); else { cancelAnimationFrame(frame); frame = 0; } });
    io.observe(el);
    const key = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); replay(); } };
    el.addEventListener('click', replay); el.addEventListener('keydown', key);
    draw(poseAt(0));
    return () => { io.disconnect(); cancelAnimationFrame(frame); el.removeEventListener('click', replay); el.removeEventListener('keydown', key); };
  }, []);

  const html = (s: string) => ({ __html: s }); // our own build-time SVG, no user content
  return (
    <figure className="graft iso" data-theme={th}>
      <div
        ref={root} tabIndex={0} role="img" className="graft-stage"
        aria-label="The graft press: a gantry lifts letters cloned from a scanned page out of a type case and sets them into the page line, replacing October with November. Press Enter to replay."
      >
        <svg className="iso-svg" viewBox={`0 0 ${VIEW.width} ${VIEW.height}`} aria-hidden>
          <defs><clipPath id="graft-rod"><path d={CLIP} /></clipPath></defs>
          <g dangerouslySetInnerHTML={html(STATIC.back)} />
          <g data-g="postBack" dangerouslySetInnerHTML={html(LAYERS.postBack)} />
          <g dangerouslySetInnerHTML={html(STATIC.content)} />
          <g dangerouslySetInnerHTML={html(LAYERS.placed)} />
          <g data-g="crossbar" dangerouslySetInnerHTML={html(LAYERS.crossbar)} />
          <g data-g="carRod"><g clipPath="url(#graft-rod)"><g data-g="rod" dangerouslySetInnerHTML={html(LAYERS.rod)} /></g></g>
          <g data-g="carriage" dangerouslySetInnerHTML={html(LAYERS.carriage)} />
          <g data-g="tip" dangerouslySetInnerHTML={html(LAYERS.tip)} />
          <g dangerouslySetInnerHTML={html(STATIC.front)} />
          <g data-g="postFront" dangerouslySetInnerHTML={html(LAYERS.postFront)} />
        </svg>
      </div>
      <figcaption className="graft-bar">
        <span>Fig 1 · the graft press</span>
        <span ref={readout} aria-live="off" className="graft-readout">erasing “October”</span>
      </figcaption>
    </figure>
  );
}
