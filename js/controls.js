/* controls: shared behaviour for Cosmic's form controls, on any page.
   - choice_card / check_item / segmented_option: each wraps a real radio or checkbox (f-sr-only). The browser owns
     the checked state; this script mirrors it as the .is-selected combo class on the label (and on .check_box), which
     is what the styles read. Webflow-safe: a class, no :checked + sibling selector.
   - range_root [data-range]: writes the live value into [data-range-value] (thousands separators, "+" at max when
     data-range-plus is set) and the filled part of the track into --range-p on the input.
   - navbar fit (second block below): sets .is-stacked on the header parts on desktop when the one-row header does
     not fit (it lives here because every page loads this file).
   API: window.cosmicControls.paint(input) re-paints a group after a script changes .checked;
        window.cosmicControls.range(root) re-reads a range after a script changes min/max/value. */
(function () {
  'use strict';
  var SEL = '.choice_input, .check_input, .segmented_input';

  function label(input) { return input.closest('.choice_card, .check_item, .segmented_option'); }

  function paintOne(input) {
    var l = label(input);
    if (!l) return;
    l.classList.toggle('is-selected', input.checked);
    var box = l.querySelector('.check_box');
    if (box) box.classList.toggle('is-selected', input.checked);
  }

  function paint(input) {
    if (input.type === 'radio' && input.name) {
      var scope = input.form || document;
      scope.querySelectorAll('input[type="radio"][name="' + input.name + '"]').forEach(paintOne);
    } else paintOne(input);
  }

  function fmt(n) { return Number(n).toLocaleString('en-US'); }

  function range(root) {
    var input = root.querySelector('[data-range-input]');
    var out = root.querySelector('[data-range-value]');
    if (!input) return;
    var min = +input.min || 0, max = +input.max || 100, v = +input.value;
    var p = max > min ? ((v - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--range-p', p.toFixed(2) + '%');
    if (out) out.textContent = fmt(v) + (root.hasAttribute('data-range-plus') && v >= max ? '+' : '');
  }

  /* keyboard focus ring: .is-focus on the label only when the inner input matches :focus-visible, so a mouse click
     does not leave a ring (a label's :focus-within cannot tell the two apart) */
  document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (!t.matches || !t.matches(SEL)) return;
    var l = label(t), fv = false;
    try { fv = t.matches(':focus-visible'); } catch (x) { fv = true; }
    if (l) l.classList.toggle('is-focus', fv);
  });
  document.addEventListener('focusout', function (e) {
    var t = e.target;
    if (t.matches && t.matches(SEL)) { var l = label(t); if (l) l.classList.remove('is-focus'); }
  });

  document.addEventListener('change', function (e) {
    if (e.target.matches && e.target.matches(SEL)) paint(e.target);
  });
  document.addEventListener('input', function (e) {
    var r = e.target.closest && e.target.closest('[data-range]');
    if (r && e.target.matches('[data-range-input]')) range(r);
  });
  /* forms restored by the browser (back button) keep their checked state: paint on load */
  function init() {
    document.querySelectorAll(SEL).forEach(paintOne);
    document.querySelectorAll('[data-range]').forEach(range);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.cosmicControls = { paint: paint, range: range, paintAll: init };
})();

/* navbar + contact band fit (lead, 2026-11-10). The one-row header (logo | nav pill | icons) needs about 1600px at the nav's type
   size. On desktop (>= 992px) below that, the header parts get .is-stacked: the tablet layout, nav pill on its own
   row. Measured, not a breakpoint: remove the class, test, set it again in the same frame (no flicker). */
(function () {
  'use strict';
  var mq = window.matchMedia('(min-width: 992px)');
  var PARTS = '.cbd83_nav, .cbd83_actions, .cbd83_brand, .c8577_root, .c8577_menu';

  function fits(root) {
    var menu = root.querySelector('.c8577_menu'), act = root.querySelector('.c8577_actions');
    if (!menu) return true;
    var links = menu.querySelectorAll('.c8577_link'), last = links[links.length - 1];
    return !last || !act || last.getBoundingClientRect().right <= act.getBoundingClientRect().left;
  }
  function fit() {
    document.querySelectorAll('.cbd83_root').forEach(function (root) {
      var parts = [root].concat([].slice.call(root.querySelectorAll(PARTS)));
      parts.forEach(function (e) { e.classList.remove('is-stacked'); });
      if (mq.matches && !fits(root)) parts.forEach(function (e) { e.classList.add('is-stacked'); });
    });
    // contact band (cdd6d_): on desktop the form wraps to a second row below ~1700px; then the divider has nothing to
    // divide and the contact block drops its indent (.is-wrapped on root, divider, contact)
    document.querySelectorAll('.cdd6d_root').forEach(function (band) {
      var lock = band.querySelector('.cdd6d_lockup'), form = band.querySelector('.cdd6d_form');
      var parts = [band].concat([].slice.call(band.querySelectorAll('.cdd6d_divider, .cdd6d_contact')));
      parts.forEach(function (e) { e.classList.remove('is-wrapped'); });
      if (mq.matches && lock && form && form.getBoundingClientRect().top >= lock.getBoundingClientRect().bottom) {
        parts.forEach(function (e) { e.classList.add('is-wrapped'); });
      }
    });
  }
  var raf = 0;
  function queue() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; fit(); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fit); else fit();
  window.addEventListener('load', fit);
  window.addEventListener('resize', queue, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
})();
