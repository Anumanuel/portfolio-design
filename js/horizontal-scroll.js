/* ==========================================================================
   HORIZONTAL STORYBOARD — navigation core
   --------------------------------------------------------------------------
   • native horizontal scrolling + scroll-snap (touch swipes, trackpads)
   • vertical mouse-wheel → one page per gesture (inertia-aware), but only
     after any vertically scrollable page content has reached its edge
   • ← → keys, PageUp/PageDown (when the page can't scroll), Home/End
   • chapter nav, dock (prev/next/progress), deep links (#projects)
   • keeps the right page aligned on resize and when focus moves by Tab
   ========================================================================== */
window.Sketchbook = window.Sketchbook || {};

(function (SB) {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = { change: [], scroll: [] };
  const state = { index: 0, target: null, targetTimer: 0, raf: 0, revealDelay: 0, userMoved: false };
  const wheel = { last: 0, lastAbs: 0, accum: 0, lockUntil: 0, afterNav: false, innerAt: 0 };
  let scroller = null;
  let scenes = [];
  let chapterIds = [];
  let ui = {};

  const clamp = (i) => Math.max(0, Math.min(scenes.length - 1, i));
  const emit = (type, detail) => listeners[type].forEach((fn) => fn(detail));

  function init(opts) {
    opts = opts || {};
    scroller = document.getElementById('storyboard');
    if (!scroller) return;
    scenes = Array.from(scroller.querySelectorAll('.scene'));
    chapterIds = Array.from(new Set(scenes.map((s) => s.dataset.chapter)));
    state.revealDelay = opts.revealDelay || 0;

    ui = {
      links: Array.from(document.querySelectorAll('.chapters__list a[data-goto]')),
      marker: document.querySelector('.chapters__marker'),
      nav: document.getElementById('chapters'),
      toggle: document.querySelector('.toc-toggle'),
      dock: document.querySelector('.dock'),
      prev: document.querySelector('.dock__prev'),
      next: document.querySelector('.dock__next'),
      num: document.querySelector('.dock__num'),
      of: document.querySelector('.dock__of'),
      title: document.querySelector('.dock__title'),
      topNum: document.querySelector('.topbar__num'),
      topTitle: document.querySelector('.topbar__title'),
      sr: document.getElementById('sr-status'),
      hint: document.querySelector('.hint'),
    };
    ui.links.forEach((a) => {
      const t = document.getElementById(a.dataset.goto);
      a._chapter = t ? t.dataset.chapter : null;
    });
    if (ui.of) ui.of.textContent = '/ ' + String(chapterIds.length).padStart(2, '0');

    scroller.addEventListener('scroll', onScroll, { passive: true });
    scroller.addEventListener('wheel', onWheel, { passive: false });
    scroller.addEventListener('focusin', onFocusIn);
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onGotoClick);
    if (ui.prev) ui.prev.addEventListener('click', () => { if (ui.prev.getAttribute('aria-disabled') !== 'true') go(-1); });
    if (ui.next) ui.next.addEventListener('click', () => { if (ui.next.getAttribute('aria-disabled') !== 'true') go(1); });
    window.addEventListener('hashchange', () => {
      const i = indexFromHash(location.hash);
      if (i >= 0 && i !== state.index) goTo(i, { focus: true });
    });
    initToc();

    if ('ResizeObserver' in window) {
      new ResizeObserver(onResize).observe(scroller);
      const sro = new ResizeObserver((entries) => entries.forEach((en) => {
        const s = en.target.closest('.scene');
        if (s) markScrollable(s);
      }));
      scenes.forEach((s) => { sro.observe(s); if (s.firstElementChild) sro.observe(s.firstElementChild); });
    }

    // Deep link: open straight on the requested page
    const fromHash = indexFromHash(location.hash);
    if (fromHash > 0) scroller.scrollLeft = scenes[fromHash].offsetLeft;
    state.index = currentFromScroll();
    applyIndex(state.index, true);
    emitScroll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => positionMarker(false));
  }

  /* ---------- helpers ---------- */
  function indexFromHash(hash) {
    if (!hash || hash.length < 2) return -1;
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch (e) { return -1; }
    const el = document.getElementById(id);
    const s = el && el.closest('.scene');
    return s ? scenes.indexOf(s) : -1;
  }
  function currentFromScroll() {
    const w = scroller.clientWidth || 1;
    return clamp(Math.round(scroller.scrollLeft / w));
  }
  function markScrollable(scene) {
    scene.classList.toggle('is-scrollable', scene.scrollHeight > scene.clientHeight + 4);
  }

  /* ---------- scroll tracking ---------- */
  function onScroll() {
    if (state.raf) return;
    state.raf = requestAnimationFrame(() => {
      state.raf = 0;
      emitScroll();
      const i = currentFromScroll();
      if (i !== state.index) applyIndex(i);
      if (state.target !== null && Math.abs(scroller.scrollLeft - scenes[state.target].offsetLeft) < 2) state.target = null;
    });
  }
  function emitScroll() {
    const max = scroller.scrollWidth - scroller.clientWidth;
    const progress = max > 0 ? Math.min(1, Math.max(0, scroller.scrollLeft / max)) : 0;
    if (ui.dock) ui.dock.style.setProperty('--progress', progress.toFixed(4));
    emit('scroll', { progress: progress, scrollLeft: scroller.scrollLeft, width: scroller.clientWidth });
  }

  function applyIndex(i, initial) {
    const prev = state.index;
    state.index = i;
    const scene = scenes[i];
    const chapter = scene.dataset.chapter;
    const title = scene.dataset.title || '';

    const reveal = () => {
      scenes.forEach((s, k) => s.classList.toggle('is-active', k === state.index));
      scenes[state.index].classList.add('is-visited');
    };
    if (initial && state.revealDelay) setTimeout(reveal, state.revealDelay); else reveal();

    ui.links.forEach((a) => {
      if (a._chapter === chapter) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    if (ui.num) ui.num.textContent = chapter;
    if (ui.title) ui.title.textContent = title;
    if (ui.topNum) ui.topNum.textContent = chapter;
    if (ui.topTitle) ui.topTitle.textContent = title;
    if (ui.prev) ui.prev.setAttribute('aria-disabled', String(i === 0));
    if (ui.next) ui.next.setAttribute('aria-disabled', String(i === scenes.length - 1));

    if (!initial) {
      const heading = scene.querySelector('h1, h2');
      if (ui.sr) ui.sr.textContent = 'Page ' + (i + 1) + ' of ' + scenes.length + ': ' + (heading ? heading.textContent.replace(/\s+/g, ' ').trim() : title);
      if (!state.userMoved) { state.userMoved = true; if (ui.hint) ui.hint.classList.add('is-hidden'); }
      if (location.hash.slice(1) !== scene.id) {
        try { history.replaceState(null, '', '#' + scene.id); } catch (e) { /* file:// in some browsers */ }
      }
    }
    if (initial || !scenes[prev] || scenes[prev].dataset.chapter !== chapter) positionMarker(!initial);
    emit('change', { index: i, prev: prev, scene: scene, chapter: chapter, chapterIndex: chapterIds.indexOf(chapter), initial: !!initial });
  }

  /* Hand-drawn ellipse that travels to the active chapter link */
  function positionMarker(animate) {
    const m = ui.marker;
    if (!m || !SB.sketch) return;
    const a = ui.links.find((l) => l.hasAttribute('aria-current'));
    if (!a || !a.offsetWidth || getComputedStyle(m).display === 'none') return;
    const padX = 2, padY = 1;
    const w = a.offsetWidth + padX * 2, h = a.offsetHeight + padY * 2;
    m.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    m.style.width = w + 'px';
    m.style.height = h + 'px';
    m.style.transform = 'translate(' + (a.offsetLeft - padX) + 'px,' + (a.offsetTop - padY) + 'px)';
    m.querySelector('path').setAttribute('d', SB.sketch.ellipsePath(w, h, { seed: SB.sketch.hash(a.dataset.goto), inset: 4, rough: 1.3 }));
    if (animate) {
      m.classList.remove('is-drawing');
      void m.getBoundingClientRect();
      m.classList.add('is-drawing');
    }
  }

  /* ---------- navigation ---------- */
  function goTo(i, opts) {
    opts = opts || {};
    if (!scenes.length) return false;
    i = clamp(i);
    const smooth = !reduceMotion.matches && !opts.instant;
    state.target = i;
    clearTimeout(state.targetTimer);
    state.targetTimer = setTimeout(() => { state.target = null; }, smooth ? 1100 : 60);
    scroller.scrollTo({ left: scenes[i].offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
    if (opts.focus) setTimeout(() => scenes[i].focus({ preventScroll: true }), smooth ? 650 : 0);
    return true;
  }
  function go(dir) {
    const base = state.target !== null ? state.target : state.index;
    const i = clamp(base + dir);
    if (i === base) return false;
    return goTo(i);
  }

  /* ---------- wheel: vertical gestures flip pages ---------- */
  function normDelta(e) {
    let dx = e.deltaX, dy = e.deltaY;
    if (e.deltaMode === 1) { dx *= 16; dy *= 16; }
    else if (e.deltaMode === 2) { dx *= scroller.clientHeight; dy *= scroller.clientHeight; }
    return { dx: dx, dy: dy };
  }
  function canScrollInside(target, dy) {
    let el = target instanceof Element ? target : null;
    while (el && el !== scroller) {
      if (el.scrollHeight > el.clientHeight + 1) {
        const oy = getComputedStyle(el).overflowY;
        if (oy === 'auto' || oy === 'scroll') {
          if (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
          if (dy < 0 && el.scrollTop > 0) return true;
        }
      }
      el = el.parentElement;
    }
    return false;
  }
  function onWheel(e) {
    if (e.ctrlKey || e.defaultPrevented) return;            // pinch-zoom / browser zoom
    const d = normDelta(e);
    if (Math.abs(d.dx) >= Math.abs(d.dy)) return;            // horizontal gestures stay native
    const now = performance.now();
    if (canScrollInside(e.target, d.dy)) { wheel.innerAt = now; wheel.last = now; return; }

    e.preventDefault();
    const gap = now - wheel.last;
    const abs = Math.abs(d.dy);
    wheel.last = now;
    if (now - wheel.innerAt < 380) { wheel.lastAbs = abs; return; }        // momentum from inner scroll
    if (now < wheel.lockUntil) { wheel.lastAbs = abs; return; }            // page is still turning
    if (wheel.afterNav && gap < 140 && abs <= wheel.lastAbs * 1.2 + 2) {   // trackpad inertia tail
      wheel.lastAbs = abs;
      return;
    }
    wheel.afterNav = false;
    wheel.lastAbs = abs;
    if (gap > 250) wheel.accum = 0;
    wheel.accum += d.dy;
    if (Math.abs(wheel.accum) >= 24) {
      const dir = wheel.accum > 0 ? 1 : -1;
      wheel.accum = 0;
      if (go(dir)) {
        wheel.lockUntil = now + (reduceMotion.matches ? 260 : 640);
        wheel.afterNav = true;
      }
    }
  }

  /* ---------- keyboard ---------- */
  function onKey(e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (ui.nav && ui.nav.classList.contains('is-open')) {
      if (e.key === 'Escape') { e.preventDefault(); closeToc(true); }
      return;
    }
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return;

    let dir = 0;
    switch (e.key) {
      case 'ArrowRight': dir = 1; break;
      case 'ArrowLeft': dir = -1; break;
      case 'PageDown':
      case 'PageUp': {
        const sc = scenes[state.index];
        const down = e.key === 'PageDown';
        const canInner = down ? sc.scrollTop + sc.clientHeight < sc.scrollHeight - 2 : sc.scrollTop > 0;
        if (canInner) return;
        dir = down ? 1 : -1;
        break;
      }
      case 'Home': e.preventDefault(); goTo(0); return;
      case 'End': e.preventDefault(); goTo(scenes.length - 1); return;
      default: return;
    }
    e.preventDefault();
    go(dir);
  }

  /* ---------- links with [data-goto="sceneId"] ---------- */
  function onGotoClick(e) {
    const a = e.target.closest && e.target.closest('[data-goto]');
    if (!a) return;
    const target = document.getElementById(a.dataset.goto);
    const s = target && target.closest('.scene');
    const i = s ? scenes.indexOf(s) : -1;
    if (i < 0) return;
    e.preventDefault();
    closeToc(false);
    goTo(i, { focus: true });
  }

  /* Keep keyboard users on the page that contains the focused element */
  function onFocusIn(e) {
    const s = e.target.closest && e.target.closest('.scene');
    if (!s) return;
    const i = scenes.indexOf(s);
    if (i === -1 || i === state.index || i === state.target) return;
    goTo(i, { instant: true });
  }

  function onResize() {
    const i = state.target !== null ? state.target : state.index;
    if (scenes[i]) scroller.scrollTo({ left: scenes[i].offsetLeft, behavior: 'auto' });
    positionMarker(false);
    emitScroll();
  }

  /* ---------- mobile "contents" page ---------- */
  function initToc() {
    if (!ui.toggle || !ui.nav) return;
    ui.toggle.addEventListener('click', () => (ui.nav.classList.contains('is-open') ? closeToc(true) : openToc()));
    const mq = window.matchMedia('(min-width: 900px)');
    const onMq = () => { if (mq.matches) closeToc(false); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else mq.addListener(onMq);
  }
  function setTocInert(on) {
    ['storyboard'].forEach((id) => { const el = document.getElementById(id); if (el) el.inert = on; });
    const dock = document.querySelector('.dock');
    if (dock) dock.inert = on;
  }
  function openToc() {
    ui.nav.classList.add('is-open');
    ui.toggle.setAttribute('aria-expanded', 'true');
    const label = ui.toggle.querySelector('span');
    if (label) label.textContent = 'Close';
    const use = ui.toggle.querySelector('use');
    if (use) use.setAttribute('href', '#i-close');
    document.body.classList.add('toc-open');
    setTocInert(true);
    setTimeout(() => {
      const a = ui.links.find((l) => l.hasAttribute('aria-current')) || ui.links[0];
      if (a) a.focus();
    }, 60);
  }
  function closeToc(returnFocus) {
    if (!ui.nav || !ui.nav.classList.contains('is-open')) return;
    ui.nav.classList.remove('is-open');
    ui.toggle.setAttribute('aria-expanded', 'false');
    const label = ui.toggle.querySelector('span');
    if (label) label.textContent = 'Contents';
    const use = ui.toggle.querySelector('use');
    if (use) use.setAttribute('href', '#i-menu');
    document.body.classList.remove('toc-open');
    setTocInert(false);
    if (returnFocus) ui.toggle.focus();
  }

  SB.storyboard = {
    init: init,
    goTo: goTo,
    go: go,
    on: function (type, fn) { if (listeners[type]) listeners[type].push(fn); },
    get index() { return state.index; },
    get scenes() { return scenes; },
    get scroller() { return scroller; },
    get chapters() { return chapterIds; },
  };
})(window.Sketchbook);
