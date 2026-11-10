/* services-fan: turns the five service cards at the top of the Services page into a radial wheel.
   Every card hangs on ONE shared pivot far below it (CSS: rotate(angle) translate(-50%, -50% - radius)),
   and its angle is (index - position) * step. Moving the wheel changes `position`, so each card travels along
   the arc and turns as it moves. This script only writes --services-hero-a (degrees) per card and the roving
   tabindex; geometry (radius, step, card width, pivot) lives in project.css on .services-hero_strip.
   Cards wrap at +/-2.5 steps, which is always off screen, so five real cards make an endless ring without clones.
   Input: click a side card, arrow keys, drag (pointer delta -> wheel angle, then snap), auto-step every 5 s while
   on screen until the first interaction. Reduced motion: no auto-step, no animation. No dependencies. */
(function () {
  'use strict';
  var root = document.querySelector('.services-hero_strip');
  if (!root) return;
  var cards = Array.prototype.slice.call(root.querySelectorAll('.services-hero_card'));
  var N = cards.length;
  if (N < 2) return;

  var mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduced = !!(mq && mq.matches);
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { reduced = mq.matches; });

  var pos = 0;          // wheel position in cards (float while moving)
  var target = 0;       // integer destination
  var raf = 0, dragging = false, interacted = false, seen = false, swallow = false;
  var pxPerStep = 600;
  var links = cards.map(function (c) { return Array.prototype.slice.call(c.querySelectorAll('a')); });

  function mod(n) { return ((n % N) + N) % N; }
  function cssVar(name, fallback) {
    var v = getComputedStyle(root).getPropertyValue(name).trim();
    return v || fallback;
  }
  function ms(v) { var n = parseFloat(v); return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : NaN; }

  /* cubic-bezier(x1,y1,x2,y2) from a flwr easing token */
  function bezier(str) {
    var m = /cubic-bezier\(([^)]+)\)/.exec(str);
    var p = m ? m[1].split(',').map(parseFloat) : [0.2, 0, 0, 1];
    function ax(t) { return 3 * p[0] * t * (1 - t) * (1 - t) + 3 * p[2] * t * t * (1 - t) + t * t * t; }
    function ay(t) { return 3 * p[1] * t * (1 - t) * (1 - t) + 3 * p[3] * t * t * (1 - t) + t * t * t; }
    return function (x) {
      var lo = 0, hi = 1, t = x;
      for (var i = 0; i < 24; i++) { t = (lo + hi) / 2; if (ax(t) < x) lo = t; else hi = t; }
      return ay(t);
    };
  }

  function render() {
    var step = parseFloat(cssVar('--services-hero-step', '27')) || 27;
    for (var i = 0; i < N; i++) {
      var o = i - pos;
      o -= N * Math.round(o / N);              // wrap into [-2.5, 2.5]: the seam is off screen
      cards[i].style.setProperty('--services-hero-a', (o * step).toFixed(3));
      cards[i].style.zIndex = String(20 - Math.round(Math.abs(o) * 4));
    }
  }

  function measure() {
    var a = cards[mod(Math.round(pos))].getBoundingClientRect();
    var b = cards[mod(Math.round(pos) + 1)].getBoundingClientRect();
    var d = Math.abs((b.left + b.width / 2) - (a.left + a.width / 2));
    if (d > 20) pxPerStep = d;
  }

  function mark() {
    var c = mod(target);
    cards.forEach(function (card, i) {
      var on = i === c;
      card.classList.toggle('is-current', on);
      if (on) card.setAttribute('aria-current', 'true'); else card.removeAttribute('aria-current');
      card.tabIndex = on ? 0 : -1;
      links[i].forEach(function (a) { if (on) a.removeAttribute('tabindex'); else a.tabIndex = -1; });
    });
  }

  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  function goTo(t) {
    target = t;
    mark();
    stop();
    var from = pos, dist = t - from;
    var dur = reduced ? 0 : (ms(cssVar('--_motion---duration-slower', '600ms')) || 600);
    if (!dur || !dist) { pos = t; render(); return; }
    var ease = bezier(cssVar('--_motion---ease-emphasized', 'cubic-bezier(0.2, 0, 0, 1)'));
    var t0 = performance.now();
    function tick(now) {
      var k = Math.min(1, (now - t0) / dur);
      pos = k < 1 ? from + dist * ease(k) : t;
      render();
      raf = k < 1 ? requestAnimationFrame(tick) : 0;
    }
    raf = requestAnimationFrame(tick);
  }

  function by(n) { goTo(target + n); }
  function focusCurrent() { cards[mod(target)].focus({ preventScroll: true }); }

  function touched() {
    if (interacted) return;
    interacted = true;
    root.setAttribute('aria-live', 'polite');
  }

  /* click a side card -> rotate it to the centre; links on the centre card stay normal */
  root.addEventListener('click', function (e) {
    if (swallow) { e.preventDefault(); e.stopPropagation(); return; }
    var card = e.target.closest ? e.target.closest('.services-hero_card') : null;
    if (!card) return;
    var i = cards.indexOf(card);
    if (i === mod(target)) return;
    e.preventDefault();
    touched();
    var d = i - mod(target);
    d -= N * Math.round(d / N);
    by(d);
  }, true);

  root.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    touched();
    by(e.key === 'ArrowRight' ? 1 : -1);
    focusCurrent();
  });
  root.addEventListener('focusin', touched);

  /* drag: pointer delta -> wheel angle, release snaps to the nearest card */
  var drag = null;
  root.addEventListener('pointerdown', function (e) {
    var card = e.target.closest ? e.target.closest('.services-hero_card') : null;
    if (!card || (e.pointerType === 'mouse' && e.button !== 0)) return;
    touched();
    drag = { id: e.pointerId, card: card, x: e.clientX, pos0: pos, moved: false, v: 0, lx: e.clientX, lt: e.timeStamp };
  });
  root.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < 6) return;
      drag.moved = true; dragging = true; stop();
      drag.pos0 = pos; drag.x = e.clientX; dx = 0;
      try { drag.card.setPointerCapture(e.pointerId); } catch (x) {}
      measure();
    }
    var dt = e.timeStamp - drag.lt;
    if (dt > 0) drag.v = 0.8 * drag.v + 0.2 * ((e.clientX - drag.lx) / dt);
    drag.lx = e.clientX; drag.lt = e.timeStamp;
    pos = drag.pos0 - dx / pxPerStep;
    render();
  });
  function release(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null;
    if (!d.moved) return;
    dragging = false;
    swallow = true; setTimeout(function () { swallow = false; }, 0);
    var t = Math.round(pos - (d.v * 160) / pxPerStep);
    t = Math.max(Math.round(d.pos0) - 2, Math.min(Math.round(d.pos0) + 2, t));
    goTo(t);
  }
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);
  /* a press on a card is a swipe, not a text selection or a link drag (CSS user-select covers most browsers;
     this covers Safari, which still wants the -webkit- prefix, and native link/image dragging) */
  root.addEventListener('selectstart', function (e) { if (drag) e.preventDefault(); });
  root.addEventListener('dragstart', function (e) { e.preventDefault(); });

  /* auto-step: every 5 s while the wheel is on screen, until the person touches it */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { seen = en[en.length - 1].isIntersecting; }, { threshold: 0.35 }).observe(root);
  } else { seen = true; }
  setInterval(function () {
    if (interacted || reduced || !seen || document.hidden || dragging) return;
    by(1);
  }, 5000);

  /* every card takes the height of the tallest one, so the ring reads as one set of equal cards whatever the copy
     or the width (CSS cannot do it: each card is positioned on its own, there is no shared row to stretch to) */
  function equalize() {
    var i, max = 0;
    for (i = 0; i < N; i++) cards[i].style.height = '';
    for (i = 0; i < N; i++) max = Math.max(max, cards[i].offsetHeight);
    for (i = 0; i < N; i++) cards[i].style.height = max + 'px';
  }

  window.addEventListener('resize', function () { equalize(); render(); measure(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(equalize);
  window.addEventListener('load', equalize);
  equalize();
  mark();
  render();
  measure();
})();
