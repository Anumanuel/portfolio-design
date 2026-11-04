/* ==========================================================================
   INTERACTIONS — the little delights
   parallax stickers · card tilt · cursor buddy · tool notes · doodle notes
   portrait note · coffee & snail easter eggs · copy email · case-study dialog
   ========================================================================== */
window.Sketchbook = window.Sketchbook || {};

(function (SB) {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const canDelight = () => fine.matches && !reduce.matches;
  const announce = (msg) => { const sr = document.getElementById('sr-status'); if (sr) sr.textContent = msg; };

  /* ---------- 1. Intro stickers drift with the mouse ---------- */
  function initParallax() {
    const scene = document.getElementById('intro');
    const art = scene && scene.querySelector('[data-parallax]');
    if (!art) return;
    const items = Array.from(art.querySelectorAll('[data-depth]'));
    let raf = 0, mx = 0, my = 0;
    const apply = () => {
      raf = 0;
      items.forEach((el) => {
        const d = parseFloat(el.dataset.depth) || 0;
        el.style.setProperty('--px', (-mx * d * 14).toFixed(1) + 'px');
        el.style.setProperty('--py', (-my * d * 10).toFixed(1) + 'px');
      });
    };
    scene.addEventListener('pointermove', (e) => {
      if (!canDelight() || e.pointerType !== 'mouse') return;
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    scene.addEventListener('pointerleave', () => { mx = 0; my = 0; if (!raf) raf = requestAnimationFrame(apply); });
  }

  /* ---------- 2. Project cards tilt gently towards the cursor ---------- */
  function initTilt() {
    document.querySelectorAll('.project').forEach((card) => {
      let rect = null, raf = 0, ev = null;
      card.addEventListener('pointerenter', () => { rect = card.getBoundingClientRect(); });
      card.addEventListener('pointermove', (e) => {
        if (!canDelight() || e.pointerType !== 'mouse' || window.innerWidth < 900) return;
        ev = e;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          if (!rect) rect = card.getBoundingClientRect();
          const x = (ev.clientX - rect.left) / rect.width - 0.5;
          const y = (ev.clientY - rect.top) / rect.height - 0.5;
          card.style.setProperty('--ry', (x * 5).toFixed(2) + 'deg');
          card.style.setProperty('--rx', (-y * 4).toFixed(2) + 'deg');
          card.classList.add('is-tilting');
        });
      });
      card.addEventListener('pointerleave', () => {
        rect = null;
        card.classList.remove('is-tilting');
        card.style.removeProperty('--rx');
        card.style.removeProperty('--ry');
      });
    });
  }

  /* ---------- 3. Cursor buddy: a doodled star that tags along ---------- */
  const BUDDY_LABELS = [
    ['.sticker', 'drag me!'],
    ['.tool', 'tap for a note'],
    ['.project__media, .phone-frame', 'peek inside ✦'],
    ['.coffee', 'sip?'],
    ['.snail', 'psst…'],
    ['.portrait', 'hi there!'],
    ['.socials a', 'say hi'],
    ['.btn--send', 'whoosh ✈'],
    ['.interests__list li', 'tell me more'],
  ];
  function initBuddy() {
    const buddy = document.querySelector('.buddy');
    if (!buddy) return;
    const label = buddy.querySelector('.buddy__label');
    let x = -100, y = -100, tx = -100, ty = -100, spin = 0, raf = 0, on = false;
    const loop = () => {
      raf = 0;
      const dx = tx - x, dy = ty - y;
      x += dx * 0.18; y += dy * 0.18; spin += dx * 0.5;
      buddy.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      buddy.style.setProperty('--spin', spin.toFixed(1) + 'deg');
      if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) raf = requestAnimationFrame(loop);
    };
    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !canDelight()) {
        if (on) { buddy.classList.remove('is-on'); on = false; }
        return;
      }
      tx = e.clientX + 16; ty = e.clientY + 18;
      if (!on) { x = tx; y = ty; buddy.classList.add('is-on'); on = true; }
      const hit = e.target.closest ? BUDDY_LABELS.find((pair) => e.target.closest(pair[0])) : null;
      const text = hit ? hit[1] : '';
      if (label.textContent !== text) label.textContent = text;
      buddy.classList.toggle('has-label', !!text);
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) { buddy.classList.remove('is-on'); on = false; } });
  }

  /* Doodle confetti: little dots, stars and dashes flying out of a point */
  function burst(x, y, colors, n, dist) {
    if (reduce.matches) return;
    const shapes = ['', 'spark--star', 'spark--line'];
    const list = Array.isArray(colors) ? colors : [colors];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = ('spark ' + shapes[i % 3]).trim();
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const d = dist * (0.55 + Math.random() * 0.6);
      s.style.setProperty('--c', list[i % list.length]);
      s.style.setProperty('--x0', x.toFixed(1) + 'px');
      s.style.setProperty('--y0', y.toFixed(1) + 'px');
      s.style.setProperty('--x1', (x + Math.cos(a) * d).toFixed(1) + 'px');
      s.style.setProperty('--y1', (y + Math.sin(a) * d).toFixed(1) + 'px');
      s.style.setProperty('--a', Math.round(a * 180 / Math.PI) + 'deg');
      s.addEventListener('animationend', () => s.remove());
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1400);
    }
  }

  /* ---------- 4. Toolbox notes (hover, focus or tap) + "peeked at" counter ---------- */
  function initToolTips() {
    const items = Array.from(document.querySelectorAll('.tools li'));
    if (!items.length) return;
    const legend = document.querySelector('.legend');
    const countEl = document.querySelector('.explored__count');
    const totalEl = document.querySelector('.explored__total');
    const fill = document.querySelector('.explored__fill');
    const seen = new Set();
    if (totalEl) totalEl.textContent = items.length;

    const markSeen = (li) => {
      if (seen.has(li)) return;
      seen.add(li);
      li.classList.add('is-seen');
      if (countEl) countEl.textContent = seen.size;
      if (fill) fill.style.setProperty('--p', (seen.size / items.length).toFixed(3));
      if (seen.size === items.length && legend && !legend.classList.contains('is-complete')) {
        legend.classList.add('is-complete');
        const r = legend.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, ['#EE7F45', '#F3D77B', '#8EAFBF', '#A8B49A', '#24231F'], 26, 130);
        announce('Toolbox master! You have peeked at every tool.');
      }
    };
    const place = (li) => {
      const tip = li.querySelector('.tool__tip');
      if (!tip) return;
      tip.classList.remove('tip--right');
      tip.style.removeProperty('--tip-shift');
      let r = tip.getBoundingClientRect();
      if (r.right > window.innerWidth - 12) { tip.classList.add('tip--right'); r = tip.getBoundingClientRect(); }
      // still clipped on a narrow screen? nudge it back on-screen
      if (r.left < 12) tip.style.setProperty('--tip-shift', Math.round(12 - r.left) + 'px');
      else if (r.right > window.innerWidth - 12) tip.style.setProperty('--tip-shift', Math.round(window.innerWidth - 12 - r.right) + 'px');
    };
    const closeAll = (except) => items.forEach((o) => { if (o !== except) o.classList.remove('is-open'); });
    items.forEach((li) => {
      const btn = li.querySelector('.tool');
      let dwell = 0;
      li.addEventListener('pointerenter', () => { place(li); dwell = setTimeout(() => markSeen(li), 350); });
      li.addEventListener('pointerleave', () => clearTimeout(dwell));
      btn.addEventListener('focus', () => { place(li); markSeen(li); });
      btn.addEventListener('click', () => {
        const willOpen = !li.classList.contains('is-open');
        closeAll(li);
        if (willOpen) { place(li); li.classList.add('is-open'); } else li.classList.remove('is-open');
        markSeen(li);
        const icon = btn.querySelector('.tool__icon') || btn;
        const r = icon.getBoundingClientRect();
        const brand = getComputedStyle(li).getPropertyValue('--brand').trim() || '#EE7F45';
        burst(r.left + r.width / 2, r.top + r.height / 2, [brand, '#24231F', brand, '#F3D77B'], 10, 46);
      });
    });
    document.addEventListener('click', (e) => { if (!e.target.closest || !e.target.closest('.tools')) closeAll(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
    if (SB.storyboard) SB.storyboard.on('change', () => closeAll());
  }

  /* ---------- 4b. Peel-off software stickers you can drag around the page ---------- */
  function initStickers() {
    const stickers = Array.from(document.querySelectorAll('[data-sticker]'));
    if (!stickers.length) return;
    const reset = document.querySelector('.stickers-reset');
    let z = 10;
    stickers.forEach((s) => {
      s.dataset.r0 = s.style.getPropertyValue('--r') || '0deg';
      let drag = null;
      s.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        try { s.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
        const scene = s.closest('.scene') || document.body;
        drag = {
          id: e.pointerId, x: e.clientX, y: e.clientY, moved: false,
          dx: parseFloat(s.style.getPropertyValue('--dx')) || 0,
          dy: parseFloat(s.style.getPropertyValue('--dy')) || 0,
          bounds: scene.getBoundingClientRect(), rect: s.getBoundingClientRect(),
        };
        s.classList.add('is-dragging');
        if (s.parentElement) s.parentElement.style.zIndex = String(++z);   // carry it above neighbouring cards
      });
      s.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        let mx = e.clientX - drag.x, my = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(mx, my) < 4) return;
        drag.moved = true;
        const b = drag.bounds, r = drag.rect, pad = 6;   // keep it on the page
        mx = Math.max(b.left + pad - r.left, Math.min(b.right - pad - r.right, mx));
        my = Math.max(b.top + pad - r.top, Math.min(b.bottom - pad - r.bottom, my));
        s.style.setProperty('--dx', (drag.dx + mx).toFixed(1) + 'px');
        s.style.setProperty('--dy', (drag.dy + my).toFixed(1) + 'px');
      });
      const end = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        s.classList.remove('is-dragging');
        if (drag.moved) {
          s.style.setProperty('--r', (Math.random() * 30 - 15).toFixed(1) + 'deg');
          if (reset) reset.hidden = false;
        } else {
          const r = s.getBoundingClientRect();
          burst(r.left + r.width / 2, r.top + r.height / 2, ['#EE7F45', '#F3D77B', '#8EAFBF'], 8, 50);
        }
        s.classList.remove('is-slapped');
        void s.offsetWidth;
        s.classList.add('is-slapped');
        drag = null;
      };
      s.addEventListener('pointerup', end);
      s.addEventListener('pointercancel', end);
    });
    if (reset) {
      reset.addEventListener('click', () => {
        stickers.forEach((s) => {
          s.style.removeProperty('--dx');
          s.style.removeProperty('--dy');
          s.style.setProperty('--r', s.dataset.r0);
        });
        reset.hidden = true;
      });
    }
  }

  /* ---------- 5. Doodle notes on the "things I love" icons ---------- */
  function initDoodleNotes() {
    const tip = document.getElementById('doodle-tip');
    const items = document.querySelectorAll('[data-doodle-note]');
    if (!tip || !items.length) return;
    let timer = 0;
    const hide = () => { tip.hidden = true; };
    const show = (el) => {
      tip.textContent = el.dataset.doodleNote;
      tip.hidden = false;
      const r = el.getBoundingClientRect();
      tip.style.left = Math.min(window.innerWidth - 120, Math.max(120, r.left + r.width / 2)) + 'px';
      tip.style.top = Math.max(70, r.top) + 'px';
    };
    items.forEach((el) => {
      const sr = document.createElement('span');
      sr.className = 'visually-hidden';
      sr.textContent = ' — ' + el.dataset.doodleNote;
      el.appendChild(sr);
      el.addEventListener('pointerenter', () => show(el));
      el.addEventListener('pointerleave', hide);
      el.addEventListener('click', () => { show(el); clearTimeout(timer); timer = setTimeout(hide, 2600); });
    });
    document.addEventListener('scroll', hide, true);
    if (SB.storyboard) SB.storyboard.on('change', hide);
  }

  /* ---------- 6. The portrait's annotation answers back ---------- */
  function initPortraitNote() {
    const btn = document.querySelector('[data-cycle-note]');
    if (!btn) return;
    let notes = [];
    try { notes = JSON.parse(btn.dataset.notes || '[]'); } catch (e) { notes = []; }
    let i = 0;
    btn.addEventListener('click', () => {
      if (!notes.length) return;
      i = (i + 1) % notes.length;
      btn.textContent = notes[i];
      btn.classList.remove('is-bumped');
      void btn.offsetWidth;
      btn.classList.add('is-bumped');
      announce(notes[i].replace('←', '').trim());
    });
  }

  /* ---------- 7. Easter egg: the coffee cup ---------- */
  function initCoffee() {
    const cup = document.querySelector('.coffee');
    const note = document.querySelector('.coffee__note');
    if (!cup || !note) return;
    const lines = [
      '☕ ×1 — fuelled up!',
      '☕ ×2 — pixels are aligning…',
      "☕ ×3 — that's how this site got built.",
      '☕ ×4 — okay, switching to chai 🫖',
      '🫖 chai mode: activated ✦',
    ];
    let n = 0, t1 = 0, t2 = 0;
    cup.addEventListener('click', () => {
      note.textContent = lines[n % lines.length];
      n++;
      cup.classList.add('is-hot');
      clearTimeout(t1); clearTimeout(t2);
      t1 = setTimeout(() => cup.classList.remove('is-hot'), 1400);
      t2 = setTimeout(() => { note.textContent = ''; }, 3800);
    });
  }

  /* ---------- 8. Easter egg: the snail's secret note ---------- */
  function initSnail() {
    const btn = document.querySelector('.snail');
    const note = document.getElementById('snail-note');
    if (!btn || !note) return;
    btn.addEventListener('click', () => {
      const open = note.hidden;
      note.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
  }

  /* ---------- 9. Copy email ---------- */
  function initCopyEmail() {
    const btn = document.querySelector('[data-copy-email]');
    if (!btn) return;
    const label = btn.querySelector('.copy-btn__label');
    let timer = 0;
    btn.addEventListener('click', async () => {
      const textEl = btn.closest('li') && btn.closest('li').querySelector('[data-config-email-text]');
      const email = (window.SITE_CONFIG && window.SITE_CONFIG.email) || (textEl ? textEl.textContent.trim() : '');
      let ok = false;
      try {
        if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(email); ok = true; }
      } catch (e) { ok = false; }
      if (!ok) {
        const ta = document.createElement('textarea');
        ta.value = email;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        ta.remove();
      }
      label.textContent = ok ? 'copied!' : 'select & copy';
      btn.classList.toggle('is-copied', ok);
      announce(ok ? 'Email address copied to clipboard' : 'Could not copy automatically. The address is ' + email);
      clearTimeout(timer);
      timer = setTimeout(() => { label.textContent = 'copy'; btn.classList.remove('is-copied'); }, 2200);
    });
  }

  /* ---------- 10. Case-study dialog ---------- */
  function initCase() {
    const dialog = document.getElementById('case');
    if (!dialog || typeof dialog.showModal !== 'function') return;
    const cards = Array.from(document.querySelectorAll('.project[data-project]'));
    const q = (s) => dialog.querySelector(s);
    const sheet = q('.case__sheet');
    const media = q('.case__media');
    let current = -1, trigger = null, closing = false;

    const fill = (i) => {
      const card = cards[i];
      const tpl = card && card.querySelector('template.project__details');
      if (!tpl) return;
      const frag = tpl.content.cloneNode(true);
      const img = frag.querySelector('.case__img');
      media.querySelectorAll('img').forEach((n) => n.remove());
      if (img) { img.removeAttribute('class'); img.decoding = 'async'; media.insertBefore(img, media.firstChild); }
      const pick = (sel) => card.querySelector(sel);
      q('.case__no').textContent = pick('.project__no') ? pick('.project__no').textContent : '';
      q('.case__cat').innerHTML = pick('.project__cat') ? pick('.project__cat').innerHTML : '';
      q('.case__title').textContent = pick('.project__title') ? pick('.project__title').textContent : '';
      q('.case__desc').textContent = pick('.project__desc') ? pick('.project__desc').textContent : '';
      q('.case__tags').innerHTML = pick('.tags') ? pick('.tags').innerHTML : '';
      const details = q('.case__details');
      details.textContent = '';
      details.appendChild(frag);
      sheet.scrollTop = 0;
      media.classList.remove('is-swapping');
      void media.offsetWidth;
      media.classList.add('is-swapping');
      current = i;
    };
    const step = (dir) => fill((current + dir + cards.length) % cards.length);
    const open = (i, from) => {
      trigger = from || document.activeElement;
      fill(i);
      if (!dialog.open) dialog.showModal();
      const closeBtn = q('.case__close');
      if (closeBtn) closeBtn.focus();
    };
    const close = () => {
      if (!dialog.open || closing) return;
      closing = true;
      dialog.classList.add('is-closing');
      const done = () => { dialog.classList.remove('is-closing'); closing = false; dialog.close(); };
      if (reduce.matches) done(); else setTimeout(done, 200);
    };

    dialog.addEventListener('close', () => { if (trigger && trigger.focus) trigger.focus({ preventScroll: true }); });
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog || e.target.closest('[data-close-case]')) { close(); return; }
      const s = e.target.closest('[data-case-step]');
      if (s) step(Number(s.dataset.caseStep));
    });
    dialog.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      step(e.key === 'ArrowRight' ? 1 : -1);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest) return;
      const btn = e.target.closest('[data-open-project]');
      if (btn) {
        const i = cards.findIndex((c) => c.dataset.project === btn.dataset.openProject);
        if (i >= 0) open(i, btn);
        return;
      }
      const m = e.target.closest('.project .project__media, .project .phone-frame');
      if (m) {
        const card = m.closest('.project');
        const i = cards.indexOf(card);
        if (i >= 0) open(i, card.querySelector('[data-open-project]'));
      }
    });
  }

  /* ---------- 11. Today's date on the letter ---------- */
  function initToday() {
    document.querySelectorAll('[data-today]').forEach((el) => {
      try { el.textContent = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { /* keep default */ }
    });
  }

  function init() {
    [initParallax, initTilt, initBuddy, initToolTips, initStickers, initDoodleNotes, initPortraitNote,
      initCoffee, initSnail, initCopyEmail, initCase, initToday].forEach((fn) => {
      try { fn(); } catch (err) { if (window.console) console.warn('[sketchbook] ' + fn.name + ' failed:', err); }
    });
  }

  SB.interactions = { init: init };
})(window.Sketchbook);
