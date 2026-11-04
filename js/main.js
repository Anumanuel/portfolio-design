/* ==========================================================================
   MAIN — boots the sketchbook
   ========================================================================== */
(function (SB) {
  'use strict';

  const cfg = window.SITE_CONFIG || {};
  const safe = (label, fn) => {
    try { fn(); } catch (err) { if (window.console) console.warn('[sketchbook] ' + label + ' failed:', err); }
  };

  /* Apply js/config.js values to the page */
  function applyConfig() {
    if (cfg.email) {
      document.querySelectorAll('[data-config-email]').forEach((a) => { a.href = 'mailto:' + cfg.email; });
      document.querySelectorAll('[data-config-email-text]').forEach((el) => { el.textContent = cfg.email; });
    }
    if (cfg.social) {
      document.querySelectorAll('[data-social]').forEach((a) => {
        const key = a.dataset.social;
        if (!(key in cfg.social)) return;
        const url = cfg.social[key];
        if (!url) { (a.closest('li') || a).remove(); return; }
        a.href = url;
      });
    }
  }

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cover = document.querySelector('.cover');
  const coverOn = !!cover && !reduce && getComputedStyle(cover).display !== 'none';

  safe('config', applyConfig);
  safe('sketch', () => SB.sketch.init());
  safe('storyboard', () => SB.storyboard.init({ revealDelay: coverOn ? 1250 : 0 }));
  safe('journey', () => SB.journey.init());
  safe('interactions', () => SB.interactions.init());
  safe('contact form', () => SB.contactForm.init());

  /* The cover opens by itself (CSS); remove it afterwards, or on first input */
  if (cover) {
    const remove = () => { if (cover.parentNode) cover.parentNode.removeChild(cover); };
    if (!coverOn) remove();
    else {
      cover.addEventListener('animationend', (e) => { if (e.animationName === 'coverGone') remove(); });
      setTimeout(remove, 3200);
      const skip = () => cover.classList.add('is-skipped');
      window.addEventListener('pointerdown', skip, { once: true });
      window.addEventListener('keydown', skip, { once: true });
    }
  }

  document.documentElement.classList.add('is-ready');
})(window.Sketchbook);
