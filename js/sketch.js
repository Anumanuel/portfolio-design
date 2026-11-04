/* ==========================================================================
   SKETCH — tiny hand-drawn shape generator
   --------------------------------------------------------------------------
   Any element with [data-sketch] gets an absolutely positioned SVG outline
   that looks drawn by hand: bowed edges, crossed corners and a second,
   lighter "pencil pass". Shapes are seeded, so they stay the same between
   visits, and are redrawn when the element resizes.

     data-sketch="box | circle | underline"
     data-sketch-pad="6"      outset in px
     data-sketch-passes="2"   number of strokes
     data-sketch-seed="name"  stable randomness
     data-sketch-rough="1"    roughness multiplier
   ========================================================================== */
window.Sketchbook = window.Sketchbook || {};

(function (SB) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const r1 = (n) => Math.round(n * 10) / 10;
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  /* Seeded PRNG (mulberry32) + string hash (FNV-1a) */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(str) {
    let h = 2166136261;
    const s = String(str);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* One slightly bowed cubic from p to q */
  function edge(p, q, rand, rough) {
    const dx = q[0] - p[0], dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const bow = Math.min(len * 0.016, 3.2) * rough;
    const t1 = 0.26 + rand() * 0.14, t2 = 0.6 + rand() * 0.14;
    const b1 = (rand() * 2 - 1) * bow, b2 = (rand() * 2 - 1) * bow;
    return 'C' + r1(p[0] + dx * t1 + nx * b1) + ' ' + r1(p[1] + dy * t1 + ny * b1) + ' ' +
      r1(p[0] + dx * t2 + nx * b2) + ' ' + r1(p[1] + dy * t2 + ny * b2) + ' ' + r1(q[0]) + ' ' + r1(q[1]);
  }

  /* Rough rectangle drawn as one continuous pen stroke with crossed corners */
  function rectPath(w, h, o) {
    o = o || {};
    const rough = o.rough == null ? 1 : o.rough;
    const inset = o.inset == null ? 2 : o.inset;
    const rand = rng((o.seed || 1) + (o.pass || 0) * 7919);
    const j = (s) => (rand() * 2 - 1) * s * rough;
    const c = Math.min(2.4, Math.min(w, h) * 0.05);
    const P = [
      [inset + j(c), inset + j(c)],
      [w - inset + j(c), inset + j(c)],
      [w - inset + j(c), h - inset + j(c)],
      [inset + j(c), h - inset + j(c)],
    ];
    const st = 0.04 + rand() * 0.1;
    const start = lerp(P[0], P[1], st);
    let d = 'M' + r1(start[0]) + ' ' + r1(start[1] + j(1));
    let prev = start;
    for (let k = 0; k < 4; k++) {
      const a = P[k], b = P[(k + 1) % 4];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const os = Math.min(len * 0.04, (1.2 + rand() * 3.2)) * rough;   // overshoot past the corner
      const target = [b[0] + ((b[0] - a[0]) / len) * os, b[1] + ((b[1] - a[1]) / len) * os];
      d += edge(prev, target, rand, rough);
      prev = target;
    }
    const end = lerp(P[0], P[1], st + 0.06 + rand() * 0.14);
    d += edge(prev, [end[0], end[1] + j(1.6)], rand, rough);
    return d;
  }

  /* Smooth curve through points (uniform Catmull-Rom → cubic Béziers) */
  function curveThrough(pts, tension) {
    const t = tension == null ? 1 / 6 : tension;
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      segs.push([
        p1,
        [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t],
        [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t],
        p2,
      ]);
    }
    let d = pts.length ? 'M' + r1(pts[0][0]) + ' ' + r1(pts[0][1]) : '';
    for (const s of segs) {
      d += 'C' + r1(s[1][0]) + ' ' + r1(s[1][1]) + ' ' + r1(s[2][0]) + ' ' + r1(s[2][1]) + ' ' + r1(s[3][0]) + ' ' + r1(s[3][1]);
    }
    return { d: d, segs: segs };
  }

  /* Hand-drawn ellipse that overshoots its starting point (like a quick circle) */
  function ellipsePath(w, h, o) {
    o = o || {};
    const rough = o.rough == null ? 1 : o.rough;
    const inset = o.inset == null ? 2 : o.inset;
    const rand = rng((o.seed || 1) + (o.pass || 0) * 104729);
    const cx = w / 2, cy = h / 2;
    const rx = Math.max(2, w / 2 - inset), ry = Math.max(2, h / 2 - inset);
    const n = 11;
    const turns = 1.05 + rand() * 0.12;
    const start = -Math.PI * (0.55 + rand() * 0.35);
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const a = start + t * turns * Math.PI * 2;
      const k = 1 + (rand() * 2 - 1) * 0.03 * rough + (t - 0.5) * 0.07 * rough;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return curveThrough(pts).d;
  }

  /* Scribbled underline (pass 0 = main stroke, pass 1 = short return stroke) */
  function underlinePath(w, h, o) {
    o = o || {};
    const rand = rng((o.seed || 1) + (o.pass || 0) * 31);
    const j = (s) => (rand() * 2 - 1) * s;
    const y = h + 2;
    if (o.pass === 1) {
      return 'M' + r1(w * 0.12 + j(3)) + ' ' + r1(y + 5 + j(1)) + ' C' + r1(w * 0.4) + ' ' + r1(y + 2.5 + j(1)) + ' ' +
        r1(w * 0.7) + ' ' + r1(y + 6 + j(1)) + ' ' + r1(w * 0.94 + j(3)) + ' ' + r1(y + 3.5 + j(1));
    }
    return 'M' + r1(-3 + j(2)) + ' ' + r1(y + j(1.4)) + ' C' + r1(w * 0.3) + ' ' + r1(y - 3 + j(1.4)) + ' ' +
      r1(w * 0.68) + ' ' + r1(y + 2.5 + j(1.4)) + ' ' + r1(w + 4 + j(2)) + ' ' + r1(y - 1.5 + j(1.4));
  }

  const GEN = { box: rectPath, circle: ellipsePath, underline: underlinePath };
  const DEFAULTS = { box: { pad: 3, passes: 2 }, circle: { pad: 8, passes: 2 }, underline: { pad: 0, passes: 2 } };
  const states = new WeakMap();
  let ro = null;
  let counter = 0;

  function draw(el) {
    const s = states.get(el);
    if (!s) return;
    const w = el.offsetWidth + s.pad * 2;
    const h = el.offsetHeight + s.pad * 2;
    if (!el.offsetWidth || !el.offsetHeight) return;
    if (Math.abs(w - s.w) < 0.5 && Math.abs(h - s.h) < 0.5) return;
    s.w = w; s.h = h;
    s.svg.setAttribute('viewBox', '0 0 ' + r1(w) + ' ' + r1(h));
    s.paths.forEach(function (p, i) {
      p.setAttribute('d', GEN[s.type](w, h, { seed: s.seed, pass: i, rough: s.rough, inset: 2 }));
    });
  }

  function attach(el) {
    if (states.has(el)) return;
    const type = GEN[el.dataset.sketch] ? el.dataset.sketch : 'box';
    const def = DEFAULTS[type];
    const pad = el.dataset.sketchPad != null ? parseFloat(el.dataset.sketchPad) : def.pad;
    const passes = el.dataset.sketchPasses != null ? parseInt(el.dataset.sketchPasses, 10) : def.passes;
    const rough = el.dataset.sketchRough != null ? parseFloat(el.dataset.sketchRough) : 1;
    const seed = hash(el.dataset.sketchSeed || type + '-' + (counter++));

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'sketch sketch--' + type);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.style.setProperty('--pad', pad + 'px');
    const paths = [];
    for (let i = 0; i < passes; i++) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('pathLength', '1');
      p.style.setProperty('--i', i);
      svg.appendChild(p);
      paths.push(p);
    }
    el.appendChild(svg);
    states.set(el, { type: type, pad: pad, seed: seed, rough: rough, svg: svg, paths: paths, w: 0, h: 0 });
    draw(el);
    if (ro) ro.observe(el);
  }

  function init(root) {
    if (!ro && 'ResizeObserver' in window) {
      ro = new ResizeObserver(function (entries) { entries.forEach(function (e) { draw(e.target); }); });
    }
    (root || document).querySelectorAll('[data-sketch]').forEach(attach);
  }

  SB.sketch = {
    init: init, attach: attach, redraw: draw,
    rng: rng, hash: hash,
    rectPath: rectPath, ellipsePath: ellipsePath, underlinePath: underlinePath, curveThrough: curveThrough,
  };
})(window.Sketchbook);
