/* ==========================================================================
   JOURNEY PATH
   --------------------------------------------------------------------------
   1. The route: one continuous, hand-drawn dotted road that runs along the
      bottom of every page, loops the loop between chapters, carries chapter
      markers + little landmarks, and ends at a mailbox on the last page.
      A paper plane travels along it with your scroll position and inks the
      road behind it.
   2. The road on the "Journey" page, threaded through the milestone pins
      (horizontal on desktop, vertical on phones).
   ========================================================================== */
window.Sketchbook = window.Sketchbook || {};

(function (SB) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const LABELS = ['hello', 'about me', 'toolbox', 'the work', 'journey', 'say hi'];
  const SKY = { 'd-sun': 1, 'd-cloud': 1, 'd-bird': 1 };
  const FIRST = ['d-sun', 'd-house', 'd-mountain', 'd-cloud', 'd-bird', 'd-tent', 'd-heart'];
  const SECOND = ['d-tree', 'd-tree', 'd-bird', 'd-tree', 'd-mountain', 'd-tree'];
  const SIZES = {
    'd-sun': [26, 26], 'd-house': [32, 32], 'd-mountain': [56, 35], 'd-cloud': [46, 23], 'd-bird': [26, 13],
    'd-tent': [38, 32], 'd-heart': [18, 18], 'd-tree': [30, 36], 'd-mailbox': [30, 35], 'd-flag': [22, 28],
  };

  let scroller, scenes, svg, base, ink, plane, marks, doodles, probe;
  let lut = { L: [], X: [], Y: [] };
  let total = 0;
  let anchors = [];
  let markEls = [];
  let lastChange = null;
  let lastSize = '';

  const mk = (name, attrs, parent) => {
    const n = document.createElementNS(NS, name);
    if (attrs) Object.keys(attrs).forEach((k) => n.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(n);
    return n;
  };
  const f1 = (n) => (Math.round(n * 10) / 10).toString();

  function init() {
    if (!SB.storyboard || !SB.storyboard.scroller || !SB.sketch) return;
    scroller = SB.storyboard.scroller;
    scenes = SB.storyboard.scenes;
    const track = document.getElementById('track');

    svg = mk('svg', { class: 'route', 'aria-hidden': 'true', focusable: 'false' });
    doodles = mk('g', { class: 'route__doodles' }, svg);
    base = mk('path', { class: 'route__base' }, svg);
    ink = mk('path', { class: 'route__ink' }, svg);
    marks = mk('g', { class: 'route__marks' }, svg);
    plane = mk('g', { class: 'route__plane' }, svg);
    mk('use', { href: '#d-plane', x: -15, y: -15, width: 30, height: 30 }, plane);
    track.insertBefore(svg, track.firstChild);

    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:var(--bottom);visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);

    build();
    SB.storyboard.on('scroll', render);
    SB.storyboard.on('change', (e) => { lastChange = e; highlight(); });
    if ('ResizeObserver' in window) new ResizeObserver(() => { build(); render(); }).observe(scroller);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { lastSize = ''; build(); render(); });
    render();

    initRoad();
  }

  /* ---------- build the route for the current viewport ---------- */
  function build() {
    const W = scroller.clientWidth, H = scroller.clientHeight, N = scenes.length;
    if (!W || !H) return;
    const key = W + 'x' + H;
    if (key === lastSize && total) return;
    lastSize = key;

    const zone = probe.offsetHeight || 90;
    const mobile = W < 900;
    const yMid = H - zone * 0.5;
    const amp = zone * (mobile ? 0.1 : 0.17);
    const r = Math.max(6, Math.min(20, (zone * 0.5 - 9) / 2.3));
    const rand = SB.sketch.rng(606);
    const jit = (s) => (rand() * 2 - 1) * s;
    const markX = mobile ? 0.25 : 0.1;
    const endX = mobile ? 0.7 : 0.64;

    const pts = [];
    const markAt = [];
    const spots = [];
    pts.push([W * (mobile ? 0.17 : 0.032), yMid + amp * 0.5]);

    for (let i = 0; i < N; i++) {
      const x0 = i * W;
      markAt[i] = pts.length;
      pts.push([x0 + W * markX, yMid]);
      if (mobile) pts.push([x0 + W * 0.4, yMid + jit(amp)]);
      else { pts.push([x0 + W * 0.22, yMid + jit(amp)]); pts.push([x0 + W * 0.34, yMid + jit(amp)]); }

      if (i === N - 1) {
        pts.push([x0 + W * (endX - 0.14), yMid + jit(amp)]);
        pts.push([x0 + W * endX, yMid]);
        if (!mobile) spots.push({ sym: FIRST[i] || 'd-heart', x: x0 + W * 0.28 });
        spots.push({ sym: 'd-mailbox', x: x0 + W * endX + 6, end: true });
        break;
      }

      // loop-the-loop in the middle of the page
      const cx = x0 + W * (mobile ? 0.57 : 0.5), cy = yMid;
      pts.push(
        [cx - 2.6 * r, cy + 0.3 * r], [cx + 0.7 * r, cy - 0.3 * r], [cx + 1.05 * r, cy - 1.45 * r],
        [cx, cy - 2.25 * r], [cx - 1.05 * r, cy - 1.45 * r], [cx - 0.55 * r, cy - 0.15 * r], [cx + 2.6 * r, cy + 0.35 * r]
      );
      if (mobile) pts.push([x0 + W * 0.84, yMid + jit(amp)]);
      else {
        pts.push([x0 + W * 0.68, yMid + jit(amp)]);
        pts.push([x0 + W * 0.85, yMid + jit(amp)]);
        spots.push({ sym: FIRST[i], x: x0 + W * 0.28 }, { sym: SECOND[i], x: x0 + W * 0.72 });
      }
    }

    const curve = SB.sketch.curveThrough(pts, 1 / 6);
    base.setAttribute('d', curve.d);
    ink.setAttribute('d', curve.d);
    const segStart = buildLut(curve.segs);
    ink.setAttribute('pathLength', total.toFixed(1));

    const ahead = mobile ? 24 : 32;
    anchors = markAt.map((k, i) => (i === N - 1 ? Math.max(0, total - 2) : Math.min(total, segStart[k] + ahead)));

    const fullW = W * N;
    svg.setAttribute('viewBox', '0 0 ' + fullW + ' ' + H);
    svg.setAttribute('width', fullW);
    svg.setAttribute('height', H);
    svg.style.width = fullW + 'px';

    drawMarks(markAt.map((k) => pts[k]), mobile);
    drawDoodles(spots, mobile, zone, pts[0]);
    highlight();
  }

  function buildLut(segs) {
    const L = [0], X = [segs[0][0][0]], Y = [segs[0][0][1]];
    const segStart = [0];
    let acc = 0, px = X[0], py = Y[0];
    for (const s of segs) {
      const p0 = s[0], c1 = s[1], c2 = s[2], p1 = s[3];
      const steps = Math.max(6, Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 7));
      for (let k = 1; k <= steps; k++) {
        const t = k / steps, mt = 1 - t;
        const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
        const x = a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0];
        const y = a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1];
        acc += Math.hypot(x - px, y - py);
        px = x; py = y;
        L.push(acc); X.push(x); Y.push(y);
      }
      segStart.push(acc);
    }
    lut = { L: L, X: X, Y: Y };
    total = acc;
    return segStart;
  }

  function pointAt(len) {
    const L = lut.L;
    if (!L.length) return { x: 0, y: 0 };
    if (len <= 0) return { x: lut.X[0], y: lut.Y[0] };
    if (len >= total) return { x: lut.X[L.length - 1], y: lut.Y[L.length - 1] };
    let lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (L[mid] < len) lo = mid; else hi = mid; }
    const t = (len - L[lo]) / ((L[hi] - L[lo]) || 1);
    return { x: lut.X[lo] + (lut.X[hi] - lut.X[lo]) * t, y: lut.Y[lo] + (lut.Y[hi] - lut.Y[lo]) * t };
  }
  function yAtX(x) {
    // first sample at/after x (fine for the monotonic stretches where doodles sit)
    const X = lut.X;
    for (let i = 0; i < X.length; i++) if (X[i] >= x) return lut.Y[i];
    return lut.Y[lut.Y.length - 1];
  }

  /* ---------- chapter markers ---------- */
  function drawMarks(points, mobile) {
    marks.textContent = '';
    markEls = [];
    const R = mobile ? 10 : 13;
    const chapters = SB.storyboard.chapters;
    points.forEach((p, i) => {
      const ch = scenes[i].dataset.chapter;
      const first = i === 0 || scenes[i - 1].dataset.chapter !== ch;
      const g = mk('g', { class: 'route__mark', 'data-chapter': ch, transform: 'translate(' + f1(p[0]) + ' ' + f1(p[1]) + ')' }, marks);
      if (first) {
        mk('path', { class: 'route__mark-ring', d: SB.sketch.ellipsePath(R * 2, R * 2, { seed: 40 + i, inset: 1, rough: 1.2 }), transform: 'translate(' + -R + ' ' + -R + ')' }, g);
        mk('text', { class: 'route__mark-num', x: 0, y: 0.5 }, g).textContent = ch;
        if (!mobile) {
          const label = mk('text', { class: 'route__mark-label', x: 0, y: R + 17, 'text-anchor': 'middle' }, g);
          label.textContent = LABELS[chapters.indexOf(ch)] || '';
        }
      } else {
        mk('use', { href: '#d-star', x: -8, y: -8, width: 16, height: 16, class: 'route__doodle' }, g);
      }
      markEls.push(g);
    });
  }

  /* ---------- landmarks along the road ---------- */
  function drawDoodles(spots, mobile, zone, start) {
    doodles.textContent = '';
    const k = Math.min(1.1, zone / 100);
    if (!mobile) {
      mk('use', { href: '#d-flag', class: 'route__doodle', x: f1(start[0] - 4), y: f1(start[1] - 30 * k), width: f1(22 * k), height: f1(28 * k) }, doodles);
      mk('text', { class: 'route__text', x: f1(start[0] + 22 * k), y: f1(start[1] - 12 * k) }, doodles).textContent = 'start';
    }
    spots.forEach((s) => {
      const size = SIZES[s.sym] || [24, 24];
      const w = size[0] * k * (mobile ? 0.8 : 1), h = size[1] * k * (mobile ? 0.8 : 1);
      const y = yAtX(s.x);
      const top = SKY[s.sym] ? y - h - zone * 0.16 : y - h + 1.5;
      mk('use', { href: '#' + s.sym, class: 'route__doodle', x: f1(s.x - w / 2), y: f1(top), width: f1(w), height: f1(h) }, doodles);
    });
  }

  function highlight() {
    if (!lastChange || !markEls.length) return;
    const chapters = SB.storyboard.chapters;
    const cur = chapters.indexOf(lastChange.chapter);
    markEls.forEach((g) => {
      const ci = chapters.indexOf(g.dataset.chapter);
      g.classList.toggle('is-current', ci === cur);
      g.classList.toggle('is-visited', ci < cur);
    });
  }

  /* ---------- per-frame: move the plane, ink the road ---------- */
  function render(e) {
    if (!total || !anchors.length) return;
    const W = (e && e.width) || scroller.clientWidth || 1;
    const sl = e ? e.scrollLeft : scroller.scrollLeft;
    const f = Math.max(0, sl / W);
    const N = anchors.length;
    let len;
    if (N === 1) len = anchors[0];
    else {
      const i = Math.min(N - 2, Math.floor(f));
      const t = Math.min(1, Math.max(0, f - i));
      len = anchors[i] + (anchors[i + 1] - anchors[i]) * t;
    }
    const p = pointAt(len);
    const a = pointAt(Math.max(0, len - 3));
    const b = pointAt(Math.min(total, len + 3));
    const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    plane.setAttribute('transform', 'translate(' + f1(p.x) + ' ' + f1(p.y) + ') rotate(' + f1(ang + 42) + ')');
    ink.style.strokeDasharray = f1(len) + ' ' + f1(total + 10);
  }

  /* ---------- the road on the Journey page ---------- */
  function offsetIn(el, ancestor) {
    let x = 0, y = 0, n = el;
    while (n && n !== ancestor) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { x: x, y: y };
  }
  function initRoad() {
    const map = document.getElementById('road-map');
    if (!map) return;
    const roadSvg = map.querySelector('.road-map__road');
    const paths = roadSvg.querySelectorAll('path');
    const pins = Array.from(map.querySelectorAll('[data-road-pin]'));
    const draw = () => {
      if (!map.offsetWidth) return;
      const pts = pins.map((p) => {
        const o = offsetIn(p, map);
        return [o.x + p.offsetWidth / 2, o.y + p.offsetHeight / 2];
      });
      if (pts.length < 2) return;
      const first = pts[0], last = pts[pts.length - 1];
      const vertical = Math.abs(last[1] - first[1]) > Math.abs(last[0] - first[0]);
      const ext = vertical
        ? [[first[0], first[1] - 46]].concat(pts, [[last[0], last[1] + 40]])
        : [[first[0] - 110, first[1] + 46]].concat(pts, [[last[0] + 110, last[1] - 30]]);
      const d = SB.sketch.curveThrough(ext, 1 / 6).d;
      paths.forEach((p) => p.setAttribute('d', d));
      map.classList.toggle('is-vertical', vertical);
    };
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(map);
    draw();
  }

  SB.journey = { init: init };
})(window.Sketchbook);
