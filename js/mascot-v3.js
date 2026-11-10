/* mascot_ v3: Arlo lives on his own (components/mascot-v3.html). No buttons.

   Clips are Realizer flipbook sprites (assets/arlo-motion-v3/), one data-clip-<name> path each on the root, one
   shared viewBox. Every frame is <g data-t0 data-t1 data-v data-lift data-x data-pud>: its window, the planted
   foot's ground speed (he moves exactly that fast, so feet never skate and nothing moves while he is still),
   his height off the ground, the snout x, and the ground contact of his front and back feet (two flat puddles in
   his own colour are drawn from it, shifting with the steps and shrinking apart in the jump).
   Every edge of the pose graph is its own clip played forward, joined on identical poses:
     walk (0..a start-up from standing, then the cycle [a,b)) · walk-stop (from the stride pose at a, to standing)
     stand-idle · sit (standing -> sitting) · sit-stand · lie (sitting -> lying) · lie-sit
     stand (standing -> upright on two legs) · up-stand · jump (from the stride pose at a, back to it) ·
     idle-sit · idle-lie · idle-up
   A small behaviour loop picks what he does next, never the same thing twice in a row, with unhurried random
   timing; he walks both ways (mirrored with scaleX(-1)) and only changes direction while off-screen. The pointer
   resting on him makes him stop and idle until it leaves; a tap does the same for a while. No UI.
   Offscreen he pauses. Under reduced motion he stands still.
*/
(function () {
  var root = document.querySelector('[data-mascot]');
  if (!root || !window.fetch || !window.DOMParser) return;

  var CLIPS = ['walk', 'walk-stop', 'stand-idle', 'sit', 'sit-stand', 'lie', 'lie-sit', 'stand', 'up-stand', 'jump', 'idle-sit', 'idle-lie', 'idle-up'];
  var base = root.getAttribute('data-mascot-src') || 'assets/arlo-motion-v3/';
  function clipUrl(name) { return root.getAttribute('data-clip-' + name) || base + 'arlo-' + name + '.svg'; }

  var track = root.querySelector('[data-mascot-track]');
  var arlo = root.querySelector('[data-mascot-arlo]');
  var stage = root.querySelector('[data-mascot-stage]');
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  var RATE = { sit: 1.15, 'sit-stand': 1.15, lie: 1.25, 'lie-sit': 1.15, stand: 1.15, 'up-stand': 1.15, jump: 1.05, 'walk-stop': 1 };
  var IDLE = { stand: 'stand-idle', sit: 'idle-sit', lie: 'idle-lie', up: 'idle-up' };
  // edges of the pose graph: clip that takes you from -> to
  var EDGES = { 'walk>stand': 'walk-stop', 'stand>walk': 'walk', 'stand>sit': 'sit', 'sit>stand': 'sit-stand',
    'sit>lie': 'lie', 'lie>sit': 'lie-sit', 'stand>up': 'stand', 'up>stand': 'up-stand', 'walk>walk': 'jump' };

  var clips = {}, vb = null, pud = null, ground = 0;
  var shown = null, play = null;
  var node = 'walk';          // walk | stand | sit | lie | up, or { from, to } while an edge plays
  var dir = -1;               // -1 walks left (as drawn), +1 walks right (mirrored)
  var x = null, last = null, visible = false, raf = 0, gone = 0;
  var plan = [], dwellT = 0, dwellFor = 0, history = [], attention = false, attnT = 0, tapTimer = 0, loopsLeft = 0;

  /* ---- clips ---- */
  function load(name) {
    return fetch(clipUrl(name)).then(function (r) { if (!r.ok) throw new Error(name); return r.text(); }).then(function (text) {
      var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      var svg = document.importNode(doc.documentElement, true);
      svg.setAttribute('class', 'mascot_svg');
      svg.style.display = 'none';
      stage.appendChild(svg);
      if (!vb) {
        vb = svg.getAttribute('viewBox').split(/\s+/).map(parseFloat);
        ground = parseFloat(svg.getAttribute('data-ground'));
        arlo.style.aspectRatio = vb[2] + ' / ' + vb[3];
        makePuddles();
      }
      var gs = svg.querySelectorAll('svg > g'), frames = [];
      for (var i = 0; i < gs.length; i++) {
        var g = gs[i], p = (g.getAttribute('data-pud') || '-1,-1,-1,-1').split(',').map(parseFloat);
        g.setAttribute('display', 'none');
        frames.push({ g: g, t0: +g.getAttribute('data-t0'), t1: +g.getAttribute('data-t1'), v: +g.getAttribute('data-v') || 0,
          lift: +g.getAttribute('data-lift') || 0, x: +g.getAttribute('data-x') || 0, f0: p[0], f1: p[1], b0: p[2], b1: p[3] });
      }
      var loop = (svg.getAttribute('data-loop') || '').split(',').map(parseFloat);
      clips[name] = { frames: frames, svg: svg, dur: +svg.getAttribute('data-dur'), loopA: loop.length === 2 ? loop[0] : 0, loopB: loop.length === 2 ? loop[1] : +svg.getAttribute('data-dur') };
    });
  }

  /* ---- puddles: two flat lenses in his own colour, under the front and back feet ---- */
  function makePuddles() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', vb.join(' '));
    svg.setAttribute('class', 'mascot_puddles');
    svg.setAttribute('aria-hidden', 'true');
    var a = document.createElementNS(ns, 'path'), b = document.createElementNS(ns, 'path');
    a.setAttribute('fill', 'currentColor'); b.setAttribute('fill', 'currentColor');
    svg.appendChild(a); svg.appendChild(b);
    stage.insertBefore(svg, stage.firstChild);
    pud = { a: a, b: b };
  }

  function lens(cx, rx, ry) { // a flat lens: shallow top, fuller belly
    if (rx < 1) return 'M0 0';
    var y = ground + ry * 0.35;
    return 'M' + (cx - rx).toFixed(1) + ' ' + y.toFixed(1) +
      'C' + (cx - rx * 0.5).toFixed(1) + ' ' + (y - ry * 0.9).toFixed(1) + ' ' + (cx + rx * 0.5).toFixed(1) + ' ' + (y - ry * 0.9).toFixed(1) + ' ' + (cx + rx).toFixed(1) + ' ' + y.toFixed(1) +
      'C' + (cx + rx * 0.55).toFixed(1) + ' ' + (y + ry * 1.1).toFixed(1) + ' ' + (cx - rx * 0.55).toFixed(1) + ' ' + (y + ry * 1.1).toFixed(1) + ' ' + (cx - rx).toFixed(1) + ' ' + y.toFixed(1) + 'Z';
  }

  function indexAt(c, t) {
    var f = c.frames;
    if (t <= f[0].t0) return 0;
    for (var i = 0; i < f.length; i++) if (t < f[i].t1) return i;
    return f.length - 1;
  }

  function span(f, which) { // {c, r} of a feet group, or null when airborne
    var s0 = which === 'f' ? f.f0 : f.b0, s1 = which === 'f' ? f.f1 : f.b1;
    if (s0 < 0) return null;
    return { c: (s0 + s1) / 2, r: (s1 - s0) / 2 + 26 };
  }

  var pudState = { f: null, b: null };
  function drawPuddles(name, t) {
    if (!pud) return;
    var c = clips[name], i = indexAt(c, t), a = c.frames[i], b = c.frames[Math.min(i + 1, c.frames.length - 1)];
    var u = a.t1 > a.t0 ? Math.max(0, Math.min(1, (t - a.t0) / (a.t1 - a.t0))) : 0;
    u = u * u * (3 - 2 * u);
    var h = Math.max(0, Math.min(1, ((1 - u) * a.lift + u * b.lift) / 160));
    ['f', 'b'].forEach(function (k) {
      var sa = span(a, k), sb = span(b, k), target;
      if (sa && sb) target = { c: sa.c + (sb.c - sa.c) * u, r: sa.r + (sb.r - sa.r) * u };
      else if (sa) target = { c: sa.c, r: sa.r * (1 - u) };
      else if (sb) target = { c: sb.c, r: sb.r * u };
      else target = pudState[k] ? { c: pudState[k].c, r: 0 } : { c: 0, r: 0 };
      // the puddle shrinks apart as he lifts off, and follows the feet a touch lazily
      var r = target.r * (1 - 0.55 * h), st = pudState[k];
      if (st && st.c) { st.c += (target.c - st.c) * 0.55; st.r += (r - st.r) * 0.55; } else st = { c: target.c, r: r };
      pudState[k] = st;
      pud[k === 'f' ? 'a' : 'b'].setAttribute('d', lens(st.c, st.r, Math.max(10, st.r * 0.16)));
    });
  }

  function show(name, t) {
    var c = clips[name], f = c.frames[indexAt(c, t)];
    if (shown && shown.g === f.g) return;
    if (shown) { shown.g.setAttribute('display', 'none'); if (shown.clip !== name) clips[shown.clip].svg.style.display = 'none'; }
    c.svg.style.display = '';
    f.g.setAttribute('display', 'inline');
    shown = { clip: name, g: f.g };
  }

  function scale() { return arlo.clientWidth / vb[2]; }

  // switch clips on matching poses: keep the feet (or the snout, when airborne) where they are on screen
  function cut(toClip, toT) {
    var anchor = function (f) { var s = span(f, 'f') || span(f, 'b'); return f.lift > 25 || !s ? f.x : (span(f, 'f') && span(f, 'b') ? (span(f, 'f').c + span(f, 'b').c) / 2 : s.c); };
    if (shown && play && x !== null) {
      var from = anchor(clips[shown.clip].frames[indexAt(clips[shown.clip], play.t)]);
      var to = anchor(clips[toClip].frames[indexAt(clips[toClip], toT)]);
      x += -dir * (from - to) * scale();
    }
  }

  /* ---- playing edges and idles ---- */
  function startEdge(from, to) {
    var name = EDGES[from + '>' + to], c = clips[name];
    node = { from: from, to: to, clip: name };
    cut(name, 0);
    play = { clip: name, t: 0, rate: RATE[name] || 1, loop: false, done: function () { arrive(to); } };
    show(name, 0);
  }

  function arrive(n) {
    node = n;
    if (n === 'walk') {
      // the walk clip itself continues: entering from standing starts at 0 (the start-up); from the jump at a
      var c = clips.walk, t = shown && shown.clip === 'jump' ? c.loopA : 0;
      cut('walk', t);
      play = { clip: 'walk', t: t, rate: 1, loop: true };
      loopsLeft = 2 + Math.floor(Math.random() * 4);
      show('walk', t);
    } else {
      cut(IDLE[n], 0);
      play = { clip: IDLE[n], t: 0, rate: 1, loop: true };
      dwellT = 0; dwellFor = dwell(n);
      show(IDLE[n], 0);
    }
    if (plan.length) { var next = plan.shift(); queueEdge(next); }
  }

  function dwell(n) { return { stand: 3 + Math.random() * 4, sit: 4 + Math.random() * 5, lie: 6 + Math.random() * 6, up: 3 + Math.random() * 3 }[n]; }

  // ask for the next edge: idles leave at the end of their loop (start = end pose); the walk leaves at a
  var pendingEdge = null;
  function queueEdge(to) { pendingEdge = to; }

  /* ---- behaviour: what next? ---- */
  function choose() {
    var options;
    if (node === 'walk') options = ['stand', 'stand', 'jump', 'walk'];      // walk: stop, or jump, or keep walking
    else if (node === 'stand') options = ['walk', 'walk', 'sit', 'up'];
    else if (node === 'sit') options = ['stand', 'lie', 'lie'];
    else if (node === 'lie') options = ['sit'];
    else if (node === 'up') options = ['stand'];
    else return null;
    // never the same move twice in a row (and no immediate undo of the last pose change)
    // never the same move twice in a row, and never straight back into the pose he just left
    var recent = history.slice(-2);
    var pick = options.filter(function (o) { return o === 'walk' || o === 'stand' || recent.indexOf(o) < 0; });
    if (node === 'stand' && recent[0] === 'walk' && recent[1] === 'stand') pick = pick.filter(function (o) { return o !== 'walk'; }); // just stopped: do something
    if (!pick.length) pick = options;
    var o = pick[Math.floor(Math.random() * pick.length)];
    history.push(o); if (history.length > 6) history.shift();
    return o;
  }

  /* ---- attention (no UI): the pointer on him makes him stop and stay ---- */
  function onAttention() {
    attention = true; attnT = 0;
    if (node === 'walk' && !pendingEdge) pendingEdge = 'stand';
  }

  /* ---- the loop ---- */
  function tick(now) {
    raf = 0;
    if (!visible || !vb) { last = null; return; }
    var dt = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
    last = now;
    var W = track.clientWidth, w = arlo.clientWidth, sc = scale();
    if (x === null) x = W * 0.62;
    if (attention) { attnT += dt; if (attnT > 1.6 && !tapTimer) attention = false; }

    if (play) {
      var c = clips[play.clip], prev = play.t;
      play.t += dt * play.rate;
      if (play.loop) {
        if (play.clip === 'walk') {
          // the cycle: wrap b -> a; decisions are taken when passing a
          if (play.t >= c.loopB) { play.t = c.loopA + (play.t - c.loopB); loopsLeft--; }
          var passA = (prev < c.loopA && play.t >= c.loopA) || (prev > play.t);
          if (passA) {
            if (!pendingEdge && loopsLeft <= 0 && !attention) { var ch = choose(); if (ch === 'walk') loopsLeft = 2 + Math.floor(Math.random() * 3); else pendingEdge = ch; }
            if (pendingEdge && onScreen(W, w)) { var to = pendingEdge; pendingEdge = null; play.t = c.loopA; startEdge('walk', to === 'jump' ? 'walk' : to); c = clips[play.clip]; }
          }
        } else {
          // an idle: loops; may leave only at its end (start = end)
          if (play.t >= c.dur) {
            play.t -= c.dur;
            dwellT += c.dur;
            if (!pendingEdge && !attention && dwellT >= dwellFor) { pendingEdge = choose(); }
            if (pendingEdge && !(attention && pendingEdge !== 'stand')) { var to2 = pendingEdge; pendingEdge = null; startEdge(node, to2); c = clips[play.clip]; }
          }
        }
      } else if (play.t >= c.dur) {
        play.t = c.dur - 0.0001; show(play.clip, play.t);
        var done = play.done; play = null; done();
        c = clips[play.clip];
      }
      if (play) show(play.clip, play.t);
      // ground speed, forward only, in his facing direction
      if (play) { var f = c.frames[indexAt(c, play.t)]; x += dir * f.v * sc * dt * play.rate; }
      if (play) drawPuddles(play.clip, play.t);
    }
    // off the strip: wait a moment, maybe turn round (only ever off-screen), come back from the other side
    if (x < -w * 1.05 || x > W + w * 0.05) {
      gone += dt;
      if (gone > 1 + Math.random() * 2) {
        if (Math.random() < 0.5) dir = -dir;
        x = dir < 0 ? W + w * 0.05 : -w * 1.05;
        gone = 0;
      }
    }
    arlo.style.transform = 'translateX(' + x.toFixed(2) + 'px) scaleX(' + (dir < 0 ? 1 : -1) + ')';
    raf = requestAnimationFrame(tick);
  }

  function onScreen(W, w) { return x > w * 0.1 && x + w * 0.9 < W; }
  function run() { if (!raf && visible) { last = null; raf = requestAnimationFrame(tick); } }

  /* ---- reduced motion: a still pose ---- */
  function still() {
    play = null; plan = []; pendingEdge = null;
    show('stand-idle', 0); drawPuddles('stand-idle', 0);
    arlo.style.transform = 'translateX(' + (x === null ? track.clientWidth * 0.62 : x).toFixed(2) + 'px)';
    node = 'stand';
  }

  function wire() {
    arlo.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') onAttention(); });
    arlo.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') { attention = true; attnT = 0; } });
    arlo.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') attnT = 0; });
    arlo.addEventListener('click', function () {
      onAttention();
      clearTimeout(tapTimer);
      tapTimer = setTimeout(function () { tapTimer = 0; attention = false; }, 5000);
    });
    if (mq.addEventListener) mq.addEventListener('change', function () { if (mq.matches) still(); else { arrive('walk'); } });
  }

  function boot() {
    Promise.all(CLIPS.map(load)).then(function () {
      root.classList.add('is-ready');
      if (mq.matches) still(); else arrive('walk');
      wire();
      run();
    }).catch(function () { root.classList.add('is-failed'); });
  }

  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    visible = es[0].isIntersecting;
    if (visible) {
      if (!root.classList.contains('is-ready') && !root.classList.contains('is-loading')) { root.classList.add('is-loading'); boot(); }
      run();
    }
  }, { rootMargin: '300px 0px' }) : null;
  if (io) io.observe(root); else { visible = true; boot(); }

  // test hook
  root.mascot = {
    state: function () { return { node: node, dir: dir, play: play && { clip: play.clip, t: play.t }, x: x, attention: attention, pending: pendingEdge, history: history.slice() }; },
    want: function (to) { pendingEdge = to; }, // force the next move (tests)
    place: function (px, d) { if (typeof px === 'number') x = px; if (d) dir = d; } // tests
  };
})();
