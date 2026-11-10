/* menu: the mobile menu (menu_), on every page. Template components/menu.html, note notes/components/menu.md.
   - Opens from any [data-menu-open] (the header's Menu button, shown at <= 991) as a modal <dialog id="menu">.
   - Open state: .is-open on the dialog, the link list and Arlo, set one frame after showModal() so the entry runs as a
     CSS transition (no motion under prefers-reduced-motion: the CSS sets the durations to 0).
   - Focus goes to the Close button, Tab and Shift+Tab stay inside, Escape (native cancel) or Close closes, and focus
     returns to the Menu button. Body scroll is locked while open (same as the estimate dialog).
   - The current page's link gets .is-current + aria-current="page" (data-menu-match: file names, "x-" = prefix).
   - Get an estimate closes the menu and opens the estimate dialog (window.cosmicEstimate), whose focus then returns to
     the Menu button. Cookie settings closes the menu and opens consent.js's preferences (window.cosmicConsent).
   - Widening past 991 closes the menu (the desktop header has the links). */
(function () {
  'use strict';
  var dlg = document.getElementById('menu');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  var parts = [dlg].concat([].slice.call(dlg.querySelectorAll('[data-menu-links], [data-menu-arlo]')));
  var closeBtn = dlg.querySelector('[data-menu-close]');
  var opener = null, returnFocus = true;
  var wide = window.matchMedia('(min-width: 992px)');

  function triggers() { return document.querySelectorAll('[data-menu-open]'); }
  function setExpanded(v) {
    [].forEach.call(triggers(), function (t) { t.setAttribute('aria-expanded', v ? 'true' : 'false'); });
  }

  /* current page */
  var file = (location.pathname.split('/').pop() || 'index.html').replace(/\.html?$/, '') || 'index';
  [].forEach.call(dlg.querySelectorAll('[data-menu-match]'), function (a) {
    var hit = a.getAttribute('data-menu-match').split(/\s+/).some(function (m) {
      return m && (m === file || (m.slice(-1) === '-' && file.indexOf(m) === 0));
    });
    a.classList.toggle('is-current', hit);
    if (hit) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });

  function open(trigger) {
    if (dlg.open) return;
    opener = trigger || null;
    returnFocus = true;
    dlg.showModal();
    shown = true;
    document.body.style.overflow = 'hidden';
    setExpanded(true);
    dlg.scrollTop = 0;
    void dlg.offsetWidth;                 // commit the closed styles, so .is-open transitions
    parts.forEach(function (e) { e.classList.add('is-open'); });
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  }
  /* cleanup runs synchronously inside close() (the native 'close' event comes a task later, after the estimate or
     the consent preferences may already have locked the scroll or taken focus); the event only covers Escape */
  var shown = false;
  function cleanup() {
    if (!shown) return;
    shown = false;
    parts.forEach(function (e) { e.classList.remove('is-open'); });
    document.body.style.overflow = '';
    setExpanded(false);
    if (returnFocus && opener && opener.focus) opener.focus({ preventScroll: true });
  }
  function close(focusBack) {
    returnFocus = focusBack !== false;
    if (dlg.open) dlg.close();
    cleanup();
  }
  dlg.addEventListener('close', cleanup);

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-menu-open]');
    if (t) { e.preventDefault(); open(t); }
  });
  if (closeBtn) closeBtn.addEventListener('click', function () { close(true); });

  dlg.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('a, button') : null;
    if (!t || !dlg.contains(t)) return;
    if (t.hasAttribute('data-menu-estimate')) {
      // the estimate dialog takes over: its close returns focus to the Menu button, not to this hidden button
      e.preventDefault();
      e.stopPropagation();
      var back = opener;
      close(false);
      if (window.cosmicEstimate) window.cosmicEstimate.open(back);
      else location.hash = 'estimate';
    } else if (t.hasAttribute('data-consent-open')) {
      // focus back on the Menu button first, so consent.js returns there when its preferences close
      if (window.cosmicConsent && window.cosmicConsent.open) {
        e.preventDefault();
        e.stopPropagation();
        close(true);
        window.cosmicConsent.open();
      } else close(false);               // consent.js missing: nothing else to open
    } else if (t.tagName === 'A' && !t.hasAttribute('target')) {
      close(false);                      // same-page anchors must not leave the menu open
    }
  });

  /* keep Tab inside (a modal dialog makes the page inert, but Tab can still leave to the browser chrome) */
  dlg.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var f = [].filter.call(dlg.querySelectorAll('a[href], button:not([disabled])'), function (el) {
      return el.offsetWidth || el.offsetHeight;
    });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  function onWide() { if (wide.matches && dlg.open) close(false); }
  if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);

  window.cosmicMenu = { open: open, close: close };
})();
