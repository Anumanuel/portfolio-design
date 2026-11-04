/* ==========================================================================
   CONTACT FORM — validation + honest delivery
   --------------------------------------------------------------------------
   Delivery is configured in js/config.js → contactForm:
     • Formspree  — POST FormData to your endpoint (JSON response)
     • Netlify    — AJAX POST (urlencoded) to "/" with form-name=contact
     • none/local — nothing is sent; the visitor is told so and offered a
                    pre-filled email instead. Success is only ever shown after
                    a genuine 2xx response.
   ========================================================================== */
window.Sketchbook = window.Sketchbook || {};

(function (SB) {
  'use strict';

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const MAX_MESSAGE = 2000;
  const RULES = {
    name: (v) => (!v ? 'Please tell me your name.' : v.length < 2 ? 'That name looks a little short.' : ''),
    email: (v) => (!v ? 'I need an email address to write back to you.' : !EMAIL_RE.test(v) ? "Hmm, that email doesn't look quite right." : ''),
    subject: (v) => (!v ? 'Add a short subject, please.' : v.length < 3 ? 'Just a few more letters, please.' : ''),
    message: (v) => (!v ? "Don't forget the message!" : v.length < 10 ? 'A little more detail, please (' + (10 - v.length) + ' more characters).' : v.length > MAX_MESSAGE ? 'Please keep it under ' + MAX_MESSAGE + ' characters.' : ''),
  };

  let form, status, postcard, submitBtn, counter, fields;

  function init() {
    form = document.getElementById('contact-form');
    if (!form) return;
    status = document.getElementById('form-status');
    postcard = form.closest('.postcard');
    submitBtn = form.querySelector('[type="submit"]');
    counter = document.getElementById('cf-count');
    fields = ['name', 'email', 'subject', 'message'].map((n) => form.elements[n]).filter(Boolean);

    fields.forEach((input) => {
      input.addEventListener('blur', () => { if (input.value.trim() || input.dataset.touched) validate(input); input.dataset.touched = '1'; });
      input.addEventListener('input', () => {
        if (input.getAttribute('aria-invalid') === 'true') validate(input);
        if (input.name === 'message') updateCount();
      });
    });
    form.addEventListener('submit', onSubmit);
    updateCount();
  }

  function updateCount() {
    if (!counter || !form.elements.message) return;
    counter.textContent = form.elements.message.value.length + ' / ' + MAX_MESSAGE;
  }

  function validate(input) {
    const value = input.value.trim();
    const msg = RULES[input.name] ? RULES[input.name](value) : '';
    const field = input.closest('.field');
    const err = document.getElementById(input.id + '-err');
    if (err) err.textContent = msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (field) {
      field.classList.toggle('is-invalid', !!msg);
      field.classList.toggle('is-valid', !msg && value !== '');
    }
    return !msg;
  }

  function setStatus(html, kind) {
    status.className = 'form-status' + (kind ? ' is-' + kind : '');
    status.innerHTML = html;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function setLoading(on) {
    form.classList.toggle('is-loading', on);
    form.setAttribute('aria-busy', String(on));
    submitBtn.disabled = on;
    submitBtn.querySelector('.btn__label').textContent = on ? 'Sending…' : 'Send it';
  }

  function resolveProvider() {
    const cfg = (window.SITE_CONFIG && window.SITE_CONFIG.contactForm) || {};
    const provider = String(cfg.provider || 'auto').toLowerCase();
    const endpoint = (cfg.formspreeEndpoint || '').trim();
    if (provider === 'formspree') return endpoint ? { type: 'formspree', endpoint: endpoint } : { type: 'none', reason: 'missing-endpoint' };
    if (provider === 'netlify') return { type: 'netlify' };
    if (provider === 'none') return { type: 'none' };
    if (endpoint) return { type: 'formspree', endpoint: endpoint };
    if (/\.netlify\.app$/i.test(location.hostname)) return { type: 'netlify' };
    return { type: 'none' };
  }

  function mailtoLink() {
    const email = (window.SITE_CONFIG && window.SITE_CONFIG.email) || '';
    const v = (n) => (form.elements[n] ? form.elements[n].value.trim() : '');
    const body = v('message') + '\n\n— ' + v('name') + (v('email') ? ' (' + v('email') + ')' : '');
    return 'mailto:' + email + '?subject=' + encodeURIComponent(v('subject')) + '&body=' + encodeURIComponent(body);
  }

  function fetchWithTimeout(url, options, ms) {
    if (!('AbortController' in window)) return fetch(url, options);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms || 15000);
    return fetch(url, Object.assign({}, options, { signal: ctrl.signal })).finally(() => clearTimeout(t));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (form.classList.contains('is-loading')) return;

    // Honeypot: real people never fill this hidden field.
    if (form.elements['bot-field'] && form.elements['bot-field'].value) return;

    const results = fields.map(validate);
    const firstInvalid = fields[results.indexOf(false)];
    if (firstInvalid) {
      setStatus('Almost! Please fix the highlighted lines ↑', 'error');
      firstInvalid.focus();
      return;
    }

    const provider = resolveProvider();
    if (provider.type === 'none') {
      setStatus(
        "This form isn't connected to a mail service yet, so <strong>nothing was sent</strong>. " +
        'You can <a href="' + esc(mailtoLink()) + '">send it from your email app instead</a>.',
        'error'
      );
      if (window.console) console.info('[contact-form] No form backend configured — see README → "Configuring the contact form".');
      return;
    }

    setLoading(true);
    setStatus('Folding your postcard & sending it off…');
    try {
      const data = new FormData(form);
      let res;
      if (provider.type === 'formspree') {
        res = await fetchWithTimeout(provider.endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      } else {
        res = await fetchWithTimeout('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(data).toString(),
        });
      }
      if (!res.ok) {
        let detail = '';
        try {
          const json = await res.json();
          detail = json && json.errors ? json.errors.map((x) => x.message).join(', ') : (json && json.error) || '';
        } catch (err) { /* non-JSON response */ }
        throw new Error(detail || 'the server replied with status ' + res.status);
      }
      onSuccess();
    } catch (err) {
      const reason = err && err.name === 'AbortError' ? 'the request timed out' : (err && err.message) || 'a network error';
      setStatus(
        "Oh no — your message didn't send (" + esc(reason) + '). Please try again, or ' +
        '<a href="' + esc(mailtoLink()) + '">email me directly</a>.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }

  function onSuccess() {
    const name = form.elements.name ? form.elements.name.value.trim().split(' ')[0] : '';
    setStatus('Message sent! Thank you' + (name ? ', ' + esc(name) : '') + " — I'll write back soon ✿", 'success');
    submitBtn.classList.add('is-flying');
    if (postcard) postcard.classList.add('is-sent');
    form.reset();
    fields.forEach((input) => {
      input.removeAttribute('aria-invalid');
      delete input.dataset.touched;
      const field = input.closest('.field');
      if (field) field.classList.remove('is-valid', 'is-invalid');
    });
    updateCount();
    setTimeout(() => {
      submitBtn.classList.remove('is-flying');
      if (postcard) postcard.classList.remove('is-sent');
    }, 4200);
  }

  SB.contactForm = { init: init };
})(window.Sketchbook);
