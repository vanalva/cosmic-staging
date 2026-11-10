/* map_: the Cosmic Greater Austin sticker map (components/map.html, notes/components/map.md). No library.
   The base map is one drawn SVG in an <img> (assets/map-greater-austin.svg, built from OpenStreetMap by
   .prep/tools/map/build_map.py). Over it, in HTML: neighborhood stickers (buttons) and a few names, placed from
   data-x / data-y (% of the map), and one small card per sticker.
   - Zoom and pan are one CSS transform on .map_plane (translate + scale). Stickers, names and cards keep their
     screen size (--map-inv counter-scales them), so they stay >= 44 px and readable at every zoom.
   - The smallest zoom is the one where (a) the map fills the frame and (b) no two stickers overlap, computed from
     the real sticker sizes on every resize. Desktop shows all of Austin; a phone starts on central Austin.
   - Page scroll is never trapped: the wheel zooms only with Ctrl (and a trackpad pinch); on touch the frame is
     touch-action: pan-y, so a one-finger vertical swipe scrolls the page; a sideways drag moves the map, two
     fingers pinch and move it. The mouse drags.
   - A sticker opens its card by click, tap, Enter or Space; Escape, a tap outside, or focus leaving it closes it.
     Tab walks the stickers in reading order (north to south); a focused sticker off the view is panned into view.
   State is combo classes: .map_item.is-active + .map_spot.is-active, .map_card.is-hidden, .map_label.is-hidden, .map_plane.is-easing,
   .map_frame.is-dragging. Several maps per page are fine. window.cosmicMaps holds their APIs (tests). */
(function () {
  'use strict';
  var GAP = 6;          /* px kept between two stickers at the smallest zoom */
  var ZOOM_STEP = 1.6;
  var MAX_ZOOM = 5;     /* x the smallest zoom */
  var DRAG = 6;         /* px of movement that turns a press into a drag (and cancels the click) */
  var maps = window.cosmicMaps = window.cosmicMaps || [];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function init(root) {
    var frame = root.querySelector('[data-map-frame]');
    var plane = root.querySelector('[data-map-plane]');
    var items = [].slice.call(root.querySelectorAll('[data-map-item]'));
    var labels = [].slice.call(root.querySelectorAll('[data-map-label]'));
    var hint = root.querySelector('[data-map-hint]');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var fw = 0, fh = 0, pw = 0, ph = 0, kMin = 1, k = 1, tx = 0, ty = 0;
    var active = null, easeTimer = 0;
    var pointers = {}, gesture = null, dragged = false;

    if (hint && coarse) hint.textContent = 'Tap a sticker to see the work there. Swipe up and down to scroll the page; drag sideways or use two fingers to move and zoom the map.';

    function pos(el) { return [parseFloat(el.getAttribute('data-x')) / 100, parseFloat(el.getAttribute('data-y')) / 100]; }
    items.forEach(function (it) {
      var p = pos(it);
      it._p = p; it._spot = it.querySelector('[data-map-spot]'); it._card = it.querySelector('[data-map-card]');
      it.style.left = (p[0] * 100) + '%'; it.style.top = (p[1] * 100) + '%';
    });
    labels.forEach(function (l) { var p = pos(l); l._p = p; l.style.left = (p[0] * 100) + '%'; l.style.top = (p[1] * 100) + '%'; });
    /* the view the map opens on: data-map-home="x,y" (%), else the centre of the stickers */
    var home = items.length ? [items.reduce(function (s, it) { return s + it._p[0]; }, 0) / items.length,
                               items.reduce(function (s, it) { return s + it._p[1]; }, 0) / items.length] : [0.5, 0.5];
    if (root.hasAttribute('data-map-home')) home = root.getAttribute('data-map-home').split(',').map(function (v) { return parseFloat(v) / 100; });

    /* smallest zoom with no overlapping stickers: for each pair, the zoom that separates them on x or on y */
    function overlapZoom() {
      var s = items.map(function (it) { return [it._p[0] * pw, it._p[1] * ph, it._spot.offsetWidth, it._spot.offsetHeight]; });
      var worst = 0;
      for (var i = 0; i < s.length; i++) for (var j = i + 1; j < s.length; j++) {
        var dx = Math.abs(s[i][0] - s[j][0]), dy = Math.abs(s[i][1] - s[j][1]);
        var kx = dx ? ((s[i][2] + s[j][2]) / 2 + GAP) / dx : Infinity;
        var ky = dy ? ((s[i][3] + s[j][3]) / 2 + GAP) / dy : Infinity;
        worst = Math.max(worst, Math.min(kx, ky));
      }
      return worst;
    }

    function apply() {
      tx = clamp(tx, fw - pw * k, 0);
      ty = ph * k <= fh ? (fh - ph * k) / 2 : clamp(ty, fh - ph * k, 0);
      plane.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + k + ')';
      plane.style.setProperty('--map-inv', String(1 / k));
      if (active) placeCard(active);
    }

    function ease() {
      if (reduce) return;
      plane.classList.add('is-easing');
      clearTimeout(easeTimer);
      easeTimer = setTimeout(function () { plane.classList.remove('is-easing'); }, 320);
    }

    function zoomAt(nk, px, py) {
      nk = clamp(nk, kMin, kMin * MAX_ZOOM);
      tx = px - (px - tx) * nk / k;
      ty = py - (py - ty) * nk / k;
      k = nk;
      apply();
    }

    function centreOn(p, nk) {
      k = nk; tx = fw / 2 - p[0] * pw * k; ty = fh / 2 - p[1] * ph * k; apply();
    }

    function reset() { centreOn(home, kMin); }

    /* names that would sit on a sticker, or run off the frame, at this view are hidden (decoration only) */
    function declutter() {
      var boxes = items.map(function (it) { return it._spot.getBoundingClientRect(); });
      var f = frame.getBoundingClientRect();
      labels.forEach(function (l) {
        l.classList.remove('is-hidden');
        var r = l.getBoundingClientRect();
        var hit = boxes.some(function (b) { return r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top; });
        var cut = r.left < f.left || r.right > f.right || r.top < f.top || r.bottom > f.bottom;   /* half off the frame */
        l.classList.toggle('is-hidden', hit || cut);
      });
    }

    function measure(first) {
      var oldK = kMin, rel = fw ? [(fw / 2 - tx) / (pw * k), (fh / 2 - ty) / (ph * k)] : home;
      fw = frame.clientWidth; fh = frame.clientHeight; pw = fw; ph = fw * 2 / 3;   /* inside the border */
      kMin = Math.max(1, fh / ph, overlapZoom());
      if (first) { reset(); } else { centreOn(rel, clamp(k / oldK * kMin, kMin, kMin * MAX_ZOOM)); }
      declutter();
    }

    /* ---- the cards */
    function placeCard(it) {
      var c = it._card;
      var sx = tx + it._p[0] * pw * k, sy = ty + it._p[1] * ph * k;      /* sticker centre in frame px */
      var cw = c.offsetWidth, ch = c.offsetHeight, half = it._spot.offsetHeight / 2, pad = 8;
      var left = clamp(-cw / 2, pad - sx, fw - pad - cw - sx);
      var top = half + GAP;
      if (sy + top + ch > fh - pad) top = -half - GAP - ch;                   /* no room below: above */
      top = clamp(top, pad - sy, fh - pad - ch - sy);
      c.style.left = left + 'px'; c.style.top = top + 'px';
    }

    function open(it) {
      if (active && active !== it) close(false);
      active = it;
      it.classList.add('is-active'); it._spot.classList.add('is-active');
      it._card.classList.remove('is-hidden');
      it._spot.setAttribute('aria-expanded', 'true');
      placeCard(it);
    }

    function close(focus) {
      if (!active) return;
      var it = active;
      active = null;
      it.classList.remove('is-active'); it._spot.classList.remove('is-active');
      it._card.classList.add('is-hidden');
      it._spot.setAttribute('aria-expanded', 'false');
      if (focus) it._spot.focus({ preventScroll: true });
    }

    items.forEach(function (it) {
      it._spot.addEventListener('click', function (e) {
        if (dragged) { e.preventDefault(); return; }
        if (active === it) close(false); else open(it);
      });
      /* keyboard: a sticker outside the view is brought into it */
      it._spot.addEventListener('focus', function () {
        var sx = tx + it._p[0] * pw * k, sy = ty + it._p[1] * ph * k, m = 48;
        if (sx < m || sx > fw - m || sy < m || sy > fh - m) { ease(); centreOn(it._p, k); }
        frame.scrollLeft = 0; frame.scrollTop = 0;   /* focus must never scroll the clipped frame itself */
      });
      it.addEventListener('focusout', function (e) {
        if (active === it && e.relatedTarget && !it.contains(e.relatedTarget)) close(false);
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && active) { var inside = active.contains(document.activeElement); close(inside || document.activeElement === document.body); }
    });
    document.addEventListener('pointerdown', function (e) {
      if (active && !active.contains(e.target)) close(false);
    });

    /* ---- gestures */
    function local(e) { var r = frame.getBoundingClientRect(); return [e.clientX - r.left - frame.clientLeft, e.clientY - r.top - frame.clientTop]; }
    function two() {
      var ids = Object.keys(pointers);
      if (ids.length < 2) return null;
      var a = pointers[ids[0]], b = pointers[ids[1]];
      return { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
    }
    function startGesture() {
      var t = two(), ids = Object.keys(pointers);
      gesture = t ? { d: t.d, m: t.m, k: k, tx: tx, ty: ty } : { p: pointers[ids[0]], tx: tx, ty: ty, moved: 0 };
    }
    frame.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest && e.target.closest('[data-map-card]')) return;   /* links in a card stay links */
      pointers[e.pointerId] = local(e);
      dragged = false;
      startGesture();
    });
    frame.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId] || !gesture) return;
      pointers[e.pointerId] = local(e);
      var t = two();
      if (t && gesture.d) {
        var nk = clamp(gesture.k * t.d / gesture.d, kMin, kMin * MAX_ZOOM);
        tx = t.m[0] - (gesture.m[0] - gesture.tx) * nk / gesture.k;
        ty = t.m[1] - (gesture.m[1] - gesture.ty) * nk / gesture.k;
        k = nk; dragged = true; apply();
      } else if (!t && gesture.p) {
        var p = pointers[e.pointerId], dx = p[0] - gesture.p[0], dy = p[1] - gesture.p[1];
        if (!dragged && Math.hypot(dx, dy) < DRAG) return;
        /* one finger going mostly up or down is the page's scroll (touch-action: pan-y): leave it alone */
        if (!dragged && e.pointerType !== 'mouse' && Math.abs(dy) > Math.abs(dx)) { gesture = null; return; }
        if (!dragged) {
          dragged = true; frame.classList.add('is-dragging');
          /* capture only once it is a drag, so a plain click still lands on the sticker */
          try { frame.setPointerCapture(e.pointerId); } catch (x) {}
        }
        tx = gesture.tx + dx; ty = gesture.ty + dy; apply();
      }
    });
    function end(e) {
      if (!pointers[e.pointerId]) return;
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length) { startGesture(); return; }
      gesture = null;
      frame.classList.remove('is-dragging');
      if (dragged) { declutter(); setTimeout(function () { dragged = false; }, 0); }
    }
    frame.addEventListener('pointerup', end);
    frame.addEventListener('pointercancel', end);   /* the browser took a vertical swipe: the page scrolls */
    frame.addEventListener('wheel', function (e) {
      if (!e.ctrlKey) return;                         /* plain wheel: the page scrolls */
      e.preventDefault();
      var p = local(e);
      zoomAt(k * Math.pow(1.0018, -e.deltaY), p[0], p[1]);
      declutter();
    }, { passive: false });
    frame.addEventListener('dragstart', function (e) { e.preventDefault(); });

    [].forEach.call(root.querySelectorAll('[data-map-zoom]'), function (b) {
      b.addEventListener('click', function () {
        var z = b.getAttribute('data-map-zoom');
        ease();
        if (z === 'reset') reset();
        else zoomAt(z === 'in' ? k * ZOOM_STEP : k / ZOOM_STEP, fw / 2, fh / 2);
        declutter();
      });
    });

    var rt = 0;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { measure(false); }, 80); }, { passive: true });
    measure(true);
    root.classList.add('is-ready');
    maps.push({
      root: root,
      state: function () { return { k: k, kMin: kMin, tx: tx, ty: ty, fw: fw, fh: fh }; },
      zoom: function () { return k / kMin; },
      reset: reset
    });
  }

  function start() { [].forEach.call(document.querySelectorAll('[data-map]'), init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
