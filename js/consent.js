/* consent: Cosmic's cookie consent banner + preferences (component consent_, notes/components/consent.md).
   Markup: the block between <!-- consent:start --> and <!-- consent:end --> (components/consent.html), once per page.
   - No stored choice: the banner shows (bar: Accept all / Only necessary / Preferences).
   - The choice is stored in localStorage under "cosmic-consent" as {v, necessary, analytics, marketing, at}. Every
     read and write is wrapped in try/catch: with storage blocked the choice lives for this page view only and the
     banner asks again on the next page.
   - Any element with [data-consent-open] opens the preferences (e.g. "Change cookie settings" on legal.html#cookies).
   - Non-modal: it never traps focus and sits below the estimate dialog (a top-layer <dialog>). While it is open it
     sets scroll-padding-bottom on <html> so a focused control is not scrolled under it. Escape closes the
     preferences (back to the bar, or closed if a choice already exists) and returns focus to the opener.
   API: window.cosmicConsent.get()  -> {necessary:true, analytics, marketing, at} or null (no choice yet)
        window.cosmicConsent.set({analytics, marketing}) stores a choice; .open() opens preferences; .reset() forgets.
   Event: document 'cosmic:consent' (detail = the stored choice) after every save, and once on load when a stored
   choice exists. Scripts that need analytics/marketing wait for it: nothing here loads any tracker. */
(function () {
  'use strict';
  var KEY = 'cosmic-consent', VERSION = 1;
  var memory = null;   // the choice when storage is blocked

  function read() {
    var raw = null;
    try { raw = window.localStorage.getItem(KEY); } catch (e) { return memory; }
    if (!raw) return memory;
    try {
      var c = JSON.parse(raw);
      if (!c || c.v !== VERSION) return null;
      return { necessary: true, analytics: !!c.analytics, marketing: !!c.marketing, at: c.at || null };
    } catch (e) { return null; }
  }

  function write(choice) {
    var c = { v: VERSION, necessary: true, analytics: !!choice.analytics, marketing: !!choice.marketing,
              at: new Date().toISOString() };
    memory = { necessary: true, analytics: c.analytics, marketing: c.marketing, at: c.at };
    try { window.localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* blocked: memory only */ }
    return memory;
  }

  function announce(choice) {
    var ev;
    try { ev = new CustomEvent('cosmic:consent', { detail: choice }); }
    catch (e) { ev = document.createEvent('CustomEvent'); ev.initCustomEvent('cosmic:consent', false, false, choice); }
    document.dispatchEvent(ev);
  }

  var api = {
    get: function () { var c = read(); return c ? { necessary: true, analytics: c.analytics, marketing: c.marketing, at: c.at } : null; },
    set: function (choice) { var c = write(choice || {}); announce(c); return api.get(); },
    open: function () {}, reset: function () {
      memory = null;
      try { window.localStorage.removeItem(KEY); } catch (e) { /* blocked */ }
    }
  };
  window.cosmicConsent = api;

  function init() {
    var root = document.querySelector('[data-consent]');
    if (!root) return;
    var bar = root.querySelector('[data-consent-bar]');
    var prefs = root.querySelector('[data-consent-prefs]');
    var prefsBtn = root.querySelector('[data-consent-prefs-open]');
    var analytics = root.querySelector('[data-consent-analytics]');
    var marketing = root.querySelector('[data-consent-marketing]');
    var status = root.querySelector('[data-consent-status]');
    var opener = null;
    var ro = null;

    function paint(input) {
      if (window.cosmicControls && window.cosmicControls.paint) window.cosmicControls.paint(input);
      else {
        var l = input.closest('.check_item');
        if (l) { l.classList.toggle('is-selected', input.checked); var b = l.querySelector('.check_box'); if (b) b.classList.toggle('is-selected', input.checked); }
      }
    }
    function fill() {
      var c = read();
      analytics.checked = !!(c && c.analytics);
      marketing.checked = !!(c && c.marketing);
      paint(analytics); paint(marketing);
    }
    function pad() {
      var h = root.classList.contains('is-hidden') ? 0 : root.getBoundingClientRect().height;
      document.documentElement.style.scrollPaddingBottom = h ? Math.ceil(h) + 'px' : '';
      // lead 2026-11-10: also make room at the end of the page, so the footer (and its legal row) can scroll above
      // the open banner instead of sitting under it
      document.body.style.paddingBottom = h ? Math.ceil(h) + 'px' : '';
    }
    function show(view) {
      root.classList.remove('is-hidden');
      bar.classList.toggle('is-hidden', view === 'prefs');
      prefs.classList.toggle('is-hidden', view !== 'prefs');
      root.classList.toggle('is-prefs', view === 'prefs');
      if (prefsBtn) prefsBtn.setAttribute('aria-expanded', view === 'prefs' ? 'true' : 'false');
      pad();
    }
    function hide() {
      root.classList.add('is-hidden');
      root.classList.remove('is-prefs');
      pad();
    }
    function done(choice, msg) {
      var c = api.set(choice);
      hide();
      if (status) status.textContent = msg;
      var back = opener && document.contains(opener) && !root.contains(opener) ? opener : null;
      opener = null;
      if (back) back.focus();
      return c;
    }
    function openPrefs(from) {
      opener = from || document.activeElement;
      fill();
      show('prefs');
      var t = prefs.querySelector('#consent-prefs-title') || prefs;
      t.focus({ preventScroll: true });
    }
    function closePrefs() {
      if (read()) {
        hide();
        var back = opener && document.contains(opener) ? opener : null;
        opener = null;
        if (back) back.focus();
      } else {
        show('bar');
        if (prefsBtn) prefsBtn.focus();
      }
    }
    api.open = function () { openPrefs(document.activeElement); };

    root.addEventListener('click', function (e) {
      var t = e.target.closest('button');
      if (!t || !root.contains(t)) return;
      if (t.hasAttribute('data-consent-accept')) done({ analytics: true, marketing: true }, 'All cookies allowed.');
      else if (t.hasAttribute('data-consent-necessary')) done({ analytics: false, marketing: false }, 'Only necessary cookies.');
      else if (t.hasAttribute('data-consent-prefs-open')) openPrefs(t);
      else if (t.hasAttribute('data-consent-close')) closePrefs();
    });
    prefs.addEventListener('submit', function (e) {
      e.preventDefault();
      done({ analytics: analytics.checked, marketing: marketing.checked }, 'Cookie choices saved.');
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !root.classList.contains('is-hidden') && root.classList.contains('is-prefs')) {
        e.stopPropagation();
        closePrefs();
      }
    });
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-consent-open]');
      if (!t || root.contains(t)) return;
      e.preventDefault();
      openPrefs(t);
    });
    if (window.ResizeObserver) { ro = new ResizeObserver(pad); ro.observe(root); }
    else window.addEventListener('resize', pad);

    var stored = read();
    if (stored) announce(api.get());
    else show('bar');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
