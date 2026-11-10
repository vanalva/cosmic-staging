/* services-featured: the review cover of the "Featured work" slider.
   The slider itself is flwr's swiper component (runtime.js). This file only adds what the runtime does not:
   - the blue review cover: enters from the right edge, opens by click/Enter on the Google tab or by dragging it
     left (settles open past halfway or on a flick), closes with the tab, Escape or the cream arrow;
   - the tab is hidden on the title slide and follows the photo's top edge on case slides;
   - small Swiper tweaks: auto height per slide, a class hook on the dots, own arrow-key handling (off while the cover is open).
   - on a fine pointer, the tab glides vertically to follow the mouse while it is in the right-hand zone of the case
     slide and eases back to rest outside it (off while the cover is open or dragged, and under reduced motion).
   Runtime state is three custom properties on .services-carousel_stage: --cover-p (0 closed .. 1 open),
   --cover-dur (only set to 0ms while dragging or under prefers-reduced-motion) and --services-carousel-tab-y
   (the tab's follow offset in px). No dependencies; idempotent. */
(function () {
  'use strict';

  var FLICK = 0.4; /* px per ms */
  var DRAG_SLOP = 4; /* px before a press becomes a drag */

  function init(stage) {
    if (stage.__servicesFeatured) return;
    var frame = stage.querySelector('.services-carousel_frame');
    var cover = stage.querySelector('.services-carousel_2_cover');
    var tab = cover && cover.querySelector('.services-carousel_badge');
    var sheet = cover && cover.querySelector('.services-carousel_2_section');
    var closeBtn = sheet && sheet.querySelector('.services-carousel_2_close');
    var viewport = frame && frame.querySelector('.flwr_swiper_wrap');
    if (!frame || !cover || !tab || !sheet || !viewport) return;
    stage.__servicesFeatured = true;

    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reduced = !!(mq && mq.matches);
    if (mq && mq.addEventListener) mq.addEventListener('change', function (e) { reduced = e.matches; applyDuration(false); });

    var p = 0;
    var isOpen = false;
    var sw = null;

    function applyDuration(instant) {
      if (instant || reduced) stage.style.setProperty('--cover-dur', '0ms');
      else stage.style.removeProperty('--cover-dur');
    }
    function setP(v) {
      p = Math.max(0, Math.min(1, v));
      stage.style.setProperty('--cover-p', String(p));
    }

    function openCover() {
      if (cover.hidden) return;
      isOpen = true;
      applyDuration(false);
      setP(1);
      sheet.inert = false;
      frame.inert = true;
      tab.setAttribute('aria-expanded', 'true');
      tab.setAttribute('aria-label', 'Close this project’s review');
      sheet.focus({ preventScroll: true });
    }
    function closeCover() {
      var wasOpen = isOpen;
      isOpen = false;
      applyDuration(false);
      setP(0);
      sheet.inert = true;
      frame.inert = false;
      tab.setAttribute('aria-expanded', 'false');
      tab.setAttribute('aria-label', 'Open this project’s review');
      if (wasOpen || stage.contains(document.activeElement)) tab.focus({ preventScroll: true });
      resumeFollow();
    }

    /* ---- tab: click / Enter toggles, drag pulls the cover ---- */
    var drag = null;
    var suppressClick = false;

    tab.addEventListener('pointerdown', function (e) {
      tab.classList.add('is-pointer'); /* no focus ring for pointer use; keyboard use removes this */
      if (e.button !== undefined && e.button !== 0) return;
      drag = { id: e.pointerId, x0: e.clientX, p0: p, moved: false, w: stage.clientWidth || 1, trail: [{ x: e.clientX, t: e.timeStamp }] };
      try { tab.setPointerCapture(e.pointerId); } catch (err) { /* no-op */ }
    });
    tab.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x0;
      if (!drag.moved && Math.abs(dx) > DRAG_SLOP) {
        drag.moved = true;
        applyDuration(true);
      }
      if (!drag.moved) return;
      drag.trail.push({ x: e.clientX, t: e.timeStamp });
      if (drag.trail.length > 8) drag.trail.shift();
      setP(drag.p0 - dx / drag.w);
    });
    function endDrag(e) {
      if (!drag || e.pointerId !== drag.id) return;
      var d = drag;
      drag = null;
      try { tab.releasePointerCapture(e.pointerId); } catch (err) { /* no-op */ }
      if (!d.moved) return; /* a plain tap: the click handler toggles */
      suppressClick = true;
      setTimeout(function () { suppressClick = false; }, 0);
      /* velocity over the last 100 ms before release only: a pause before letting go is not a flick */
      var recent = d.trail.filter(function (s) { return s.t >= e.timeStamp - 100; });
      var v = 0; /* px per ms, negative = leftwards */
      if (recent.length > 1) {
        var dt = recent[recent.length - 1].t - recent[0].t;
        if (dt > 0) v = (recent[recent.length - 1].x - recent[0].x) / dt;
      }
      var target;
      if (e.type === 'pointercancel') target = isOpen ? 1 : 0;
      else if (v < -FLICK) target = 1;
      else if (v > FLICK) target = 0;
      else target = p > 0.5 ? 1 : 0;
      if (target) openCover(); else closeCover();
    }
    tab.addEventListener('pointerup', endDrag);
    tab.addEventListener('pointercancel', endDrag);
    tab.addEventListener('click', function () {
      if (suppressClick) return;
      if (isOpen) closeCover(); else openCover();
    });

    if (closeBtn) closeBtn.addEventListener('click', closeCover);
    document.addEventListener('keydown', function () { tab.classList.remove('is-pointer'); }, true);
    tab.addEventListener('blur', function () { tab.classList.remove('is-pointer'); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !isOpen) return;
      if (document.querySelector('dialog[open]')) return; /* the Read More dialog handles its own Escape */
      closeCover();
    });

    /* ---- slider hooks (Swiper is created by flwr's runtime.js) ---- */
    /* Arrow keys: Swiper's own keyboard module only reacts when the whole slider fits in the window, which a tall
       (stacked) case study never does, so it is switched off and replaced by this handler. */
    document.addEventListener('keydown', function (e) {
      if (!sw || isOpen || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], dialog')) return;
      var r = stage.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= window.innerHeight) return; /* slider not on screen */
      e.preventDefault();
      if (e.key === 'ArrowRight') sw.slideNext(); else sw.slidePrev();
    });

    function markBullets() {
      var bullets = frame.querySelectorAll('.flwr_swiper_bullet');
      for (var i = 0; i < bullets.length; i++) {
        bullets[i].classList.add('services-carousel_bullet');
        if (!bullets[i].getAttribute('aria-label')) bullets[i].setAttribute('aria-label', 'Slide ' + (i + 1));
      }
    }
    function placeTab() {
      var slide = sw && sw.slides ? sw.slides[sw.activeIndex] : null;
      var media = slide && slide.querySelector('.services-carousel_media');
      if (!media) return;
      var top = media.getBoundingClientRect().top - stage.getBoundingClientRect().top;
      stage.style.setProperty('--cover-tab-top', Math.round(top) + 'px');
    }
    /* ---- tab follows the pointer along the right edge (mouse only) ---- */
    var fineMq = window.matchMedia ? window.matchMedia('(pointer: fine)') : null;
    var cur = 0; /* current offset from the rest position, px */
    var last = null; /* last mouse position */
    var ptr = null; /* last mouse position {y} while over the case slide's right-hand zone, else null */
    var raf = 0;
    var lastT = 0;
    var tau = 80;
    (function readTau() {
      var d = parseFloat(getComputedStyle(stage).getPropertyValue('--_motion---duration-base')); /* e.g. 240ms */
      if (d > 0) tau = d / 3;
    })();
    function followAllowed() { return !reduced && !!(fineMq && fineMq.matches) && !cover.hidden; }
    function frozen() { return isOpen || p > 0 || !!drag; }
    function writeY() { stage.style.setProperty('--services-carousel-tab-y', cur.toFixed(1) + 'px'); }
    function targetOffset() {
      if (!ptr) return 0;
      var slide = sw && sw.slides ? sw.slides[sw.activeIndex] : null;
      if (!slide) return 0;
      var sr = slide.getBoundingClientRect();
      var tr = tab.getBoundingClientRect();
      var h = tr.height;
      var radius = parseFloat(getComputedStyle(frame).borderTopLeftRadius) || 0;
      var minC = sr.top + h / 2 + radius;
      var maxC = sr.bottom - h / 2 - radius;
      if (maxC < minC) return 0;
      var c = Math.max(minC, Math.min(maxC, ptr.y));
      var restCenter = tr.top - cur + h / 2;
      return c - restCenter;
    }
    function tick(t) {
      raf = 0;
      if (frozen()) { lastT = 0; return; }
      var dt = lastT ? Math.min(64, t - lastT) : 16;
      lastT = t;
      var target = followAllowed() ? targetOffset() : 0;
      cur += (target - cur) * (1 - Math.exp(-dt / tau));
      if (Math.abs(target - cur) < 0.3) cur = target;
      writeY();
      if (cur !== target || ptr) raf = requestAnimationFrame(tick);
      else lastT = 0;
    }
    function kick() { if (!raf) raf = requestAnimationFrame(tick); }
    function zoneHit(e) {
      var slide = sw && sw.slides ? sw.slides[sw.activeIndex] : null;
      if (!slide) return false;
      var sr = slide.getBoundingClientRect();
      if (e.clientY < sr.top || e.clientY > sr.bottom || e.clientX > sr.right || e.clientX < sr.left) return false;
      return e.clientX >= sr.right - Math.min(sr.width * 0.25, 240);
    }
    stage.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      last = { x: e.clientX, y: e.clientY };
      if (!followAllowed() || frozen()) return;
      ptr = zoneHit(e) ? { y: e.clientY } : null;
      kick();
    });
    stage.addEventListener('pointerleave', function () { ptr = null; kick(); });
    window.addEventListener('scroll', function () { if (ptr) kick(); }, { passive: true });
    tab.addEventListener('pointerdown', function () { ptr = null; });
    function resumeFollow() { /* after the cover closes: keep following if the mouse is still in the zone */
      ptr = last && followAllowed() && zoneHit({ clientX: last.x, clientY: last.y }) ? { y: last.y } : null;
      kick();
    }
    function resetFollow() { ptr = null; cur = 0; writeY(); }

    function onSlide() {
      resetFollow();
      var onTitle = !sw || sw.activeIndex === 0;
      if (onTitle && isOpen) closeCover();
      cover.hidden = onTitle;
      placeTab();
    }
    function settleLayout() {
      if (!sw || sw.destroyed) return;
      try { sw.updateAutoHeight(0); } catch (err) { /* no-op */ }
      placeTab();
    }

    function attach(instance) {
      sw = instance;
      if (sw.keyboard && sw.keyboard.disable) sw.keyboard.disable();
      sw.params.autoHeight = true; /* the title slide is much shorter than a case study */
      if (reduced) sw.params.speed = 0;
      sw.on('slideChange', onSlide);
      sw.on('paginationRender', markBullets);
      sw.on('paginationUpdate', markBullets);
      sw.on('transitionStart', function () { try { sw.updateAutoHeight(sw.params.speed); } catch (err) { /* no-op */ } });
      markBullets();
      onSlide();
      settleLayout();
      if (window.ResizeObserver) {
        var ro = new ResizeObserver(settleLayout);
        for (var i = 0; i < sw.slides.length; i++) ro.observe(sw.slides[i]);
        ro.observe(stage);
      }
      window.addEventListener('load', settleLayout);
      window.addEventListener('resize', settleLayout);
    }

    var tries = 0;
    (function wait() {
      if (viewport.swiper) attach(viewport.swiper);
      else if (tries++ < 120) setTimeout(wait, 50);
    })();
  }

  function boot() {
    var stages = document.querySelectorAll('.services-carousel_stage');
    for (var i = 0; i < stages.length; i++) init(stages[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
