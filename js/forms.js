/* forms: the small forms that live in shared chrome (lead, 2026-11-10).
   - form[data-quick-form="contact"]: the contact band's "Just want to connect?" (email, name, phone) on every page.
   - form[data-quick-form="club"]: "Join the circle" on Home / About (email).
   They used to post to action="#" (nothing locally; a 405 on Webflow). Now, as in js/estimate.js:
   inside Webflow (window.Webflow) the native form handler posts them; outside Webflow they POST FormData to
   data-endpoint when one is set, else they show the sent state only (static prototype).
   Sent state: inputs and button are disabled, the button label reads "Sent", and a visually hidden status line
   (aria-live) says what happened. No layout change. Validation: the email field is required and checked by the browser
   API; the first invalid field gets focus. Dispatches `cosmic:quickform` { kind, ok }. */
(function () {
  'use strict';
  var DONE = { contact: 'Thanks, we got your message. We will be in touch.', club: 'Thanks, you are on the list for the Cosmic Club.' };

  function status(form) {
    var s = form.querySelector('[data-quick-status]');
    if (!s) {
      s = document.createElement('p');
      s.className = 'f-sr-only';
      s.setAttribute('data-quick-status', '');
      s.setAttribute('role', 'status');
      s.setAttribute('aria-live', 'polite');
      form.appendChild(s);
    }
    return s;
  }

  function sent(form, kind, ok) {
    var btn = form.querySelector('button[type="submit"], button:not([type])');
    var label = btn && (btn.querySelector('[data-slot="label"]') || btn);
    if (ok) {
      [].forEach.call(form.elements, function (el) { el.disabled = true; });
      if (label) label.textContent = 'Sent';
      status(form).textContent = DONE[kind] || 'Thanks, it was sent.';
    } else {
      status(form).textContent = 'That did not go through. Please try again, or use the estimate.';
      if (btn) btn.disabled = false;
    }
    document.dispatchEvent(new CustomEvent('cosmic:quickform', { detail: { kind: kind, ok: ok } }));
  }

  function init(form) {
    var kind = form.getAttribute('data-quick-form');
    var email = form.querySelector('input[type="email"]');
    if (email) email.required = true;
    form.addEventListener('submit', function (e) {
      if (window.Webflow) return;              /* Webflow's own handler posts the form */
      e.preventDefault();
      if (!form.checkValidity()) {
        var bad = form.querySelector(':invalid');
        if (bad) { bad.focus(); if (bad.reportValidity) bad.reportValidity(); }
        return;
      }
      var endpoint = form.getAttribute('data-endpoint');
      if (!endpoint) { sent(form, kind, true); return; }
      fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (r) { sent(form, kind, r.ok); })
        .catch(function () { sent(form, kind, false); });
    });
  }

  function boot() { [].forEach.call(document.querySelectorAll('form[data-quick-form]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
