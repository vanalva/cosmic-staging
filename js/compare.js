/* candidate js: compare@0.2.0, copied by gen/candidates.py; removed when no page uses it */
/* flwr compare — before/after drag comparison (candidate, v0.1.0)
   Root: [data-flwr="compare"]. Hooks: data-flwr-target = range | knob | before-label | after-label.
   Position (0-100) is measured from the left/top edge and written to
   --_component---compare--position on the root. State: data-flwr-state = idle | dragging.
   Vanilla, idempotent, no dependencies. */
(function () {
  'use strict';
  var VAR = '--_component---compare--position';
  var KEY = '__flwrCompare';
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function clamp(n) { return Math.max(0, Math.min(100, n)); }

  function init(root) {
    if (!root) return null;
    if (root[KEY]) return root[KEY];
    var range = root.querySelector('[data-flwr-target="range"]');
    var knob = root.querySelector('[data-flwr-target="knob"]');
    if (!range) return null;
    var vertical = root.classList.contains('is-vertical') || root.getAttribute('data-flwr-compare-orientation') === 'vertical';
    var reversed = root.classList.contains('is-reversed');
    var bl = root.querySelector('[data-flwr-target="before-label"]');
    var al = root.querySelector('[data-flwr-target="after-label"]');
    // each label sits on its own side: before on the start (left/top), after on the end, swapped when reversed
    function place(el, atEnd) {
      if (!el) return;
      ['is-start', 'is-end', 'is-top', 'is-bottom'].forEach(function (c) { el.classList.remove(c); });
      el.classList.add(vertical ? (atEnd ? 'is-bottom' : 'is-top') : (atEnd ? 'is-end' : 'is-start'));
    }
    place(bl, reversed);
    place(al, !reversed);
    var pos = 50, rect = null, dragging = false, raf = 0, ro = null;
    var off = [];
    function on(el, ev, fn, opt) { el.addEventListener(ev, fn, opt); off.push(function () { el.removeEventListener(ev, fn, opt); }); }

    function text(el, fallback) { return (el && el.textContent.trim()) || fallback; }
    function set(p) {
      pos = Math.round(clamp(p) * 10) / 10;
      root.style.setProperty(VAR, pos + '%');
      range.value = String(Math.round(pos));
      var beforeShown = Math.round(reversed ? 100 - pos : pos);
      range.setAttribute('aria-valuetext', text(bl, 'Before') + ' ' + beforeShown + '%, ' + text(al, 'After') + ' ' + (100 - beforeShown) + '%');
    }
    function stopGlide() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    function glide(to) {
      stopGlide();
      if (reduce.matches) { set(to); return; }
      var from = pos, t0 = null, dur = 160;
      function step(t) {
        if (t0 === null) t0 = t;
        var k = Math.min(1, (t - t0) / dur);
        set(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        raf = k < 1 ? requestAnimationFrame(step) : 0;
      }
      raf = requestAnimationFrame(step);
    }
    function fromEvent(e) {
      var r = rect || root.getBoundingClientRect();
      var p = vertical ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
      return clamp(p * 100);
    }
    function state(s) {
      root.setAttribute('data-flwr-state', s);
      if (knob) knob.classList.toggle('is-dragging', s === 'dragging');
    }

    on(root, 'pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      rect = root.getBoundingClientRect();
      dragging = true;
      try { root.setPointerCapture(e.pointerId); } catch (_) {}
      state('dragging');
      try { range.focus({ preventScroll: true }); } catch (_) {}
      if (e.pointerType === 'mouse') e.preventDefault();
      glide(fromEvent(e));
    });
    on(root, 'pointermove', function (e) {
      if (!dragging) return;
      stopGlide();
      set(fromEvent(e));
    });
    function end(e) {
      if (!dragging) return;
      dragging = false;
      try { root.releasePointerCapture(e.pointerId); } catch (_) {}
      state('idle');
    }
    on(root, 'pointerup', end);
    on(root, 'pointercancel', end);
    on(root, 'lostpointercapture', end);

    on(range, 'keydown', function (e) {
      var s = e.shiftKey ? 10 : 1, to = null;
      switch (e.key) {
        case 'ArrowLeft': case 'ArrowUp': to = pos - s; break;
        case 'ArrowRight': case 'ArrowDown': to = pos + s; break;
        case 'PageUp': to = pos - 10; break;
        case 'PageDown': to = pos + 10; break;
        case 'Home': to = 0; break;
        case 'End': to = 100; break;
      }
      if (to === null) return;
      e.preventDefault();
      stopGlide();
      set(to);
    });
    on(range, 'input', function () { set(parseFloat(range.value)); });
    on(range, 'focus', function () {
      var vis = true;
      try { vis = range.matches(':focus-visible'); } catch (_) {}
      if (knob && vis) knob.classList.add('is-focus');
    });
    on(range, 'blur', function () { if (knob) knob.classList.remove('is-focus'); });

    if (vertical) range.setAttribute('aria-orientation', 'vertical');
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { rect = null; }); ro.observe(root); }
    else on(window, 'resize', function () { rect = null; });

    var start = parseFloat(root.getAttribute('data-flwr-compare-start'));
    set(isNaN(start) ? 50 : start);
    state('idle');

    var api = {
      set: set,
      get: function () { return pos; },
      destroy: function () {
        stopGlide();
        if (ro) ro.disconnect();
        off.forEach(function (f) { f(); });
        off = [];
        delete root[KEY];
      }
    };
    root[KEY] = api;
    return api;
  }

  function initAll(scope) {
    [].forEach.call((scope || document).querySelectorAll('[data-flwr="compare"]'), init);
  }
  function destroyAll(scope) {
    [].forEach.call((scope || document).querySelectorAll('[data-flwr="compare"]'), function (r) { if (r[KEY]) r[KEY].destroy(); });
  }

  window.flwr = window.flwr || {};
  window.flwr.compare = { init: initAll, destroy: destroyAll };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initAll(); });
  else initAll();
})();
