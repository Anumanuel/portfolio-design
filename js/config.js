/* ==========================================================================
   SITE CONFIG — edit your details here.
   These values are applied to the page on load (see js/main.js).
   ========================================================================== */
window.SITE_CONFIG = {
  name: 'Anush',

  // Your public email address (used by the email link, copy button and the
  // contact-form fallback). Replace the example address before deploying.
  email: 'anush@example.com',

  // Social profiles. Paste your full profile URLs. Remove a line (or set it
  // to '') to hide that link.
  social: {
    linkedin: 'https://www.linkedin.com/',
    github: 'https://github.com/',
    dribbble: 'https://dribbble.com/',
    instagram: 'https://www.instagram.com/',
  },

  // Contact form delivery — see README → "Configuring the contact form".
  //   provider: 'auto'      → Formspree if an endpoint is set, Netlify Forms on *.netlify.app,
  //                           otherwise the honest "not connected" fallback.
  //             'formspree' → always use formspreeEndpoint
  //             'netlify'   → always use Netlify Forms (use this on a custom domain hosted by Netlify)
  //             'none'      → never send; always show the email fallback
  contactForm: {
    provider: 'auto',
    formspreeEndpoint: '', // e.g. 'https://formspree.io/f/abcdwxyz'
  },
};
