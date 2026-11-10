/* mascot_: Arlo walks along a strip and does things when asked (components/mascot.html).

   Clips are Realizer flipbook sprites (assets/arlo-motion-v2/), one data-clip-<name> path each on the root. One
   shared viewBox; every frame is <g data-t0 data-t1 data-v data-foot data-lift data-x>: its window in seconds,
   its ground speed (viewBox units per second, measured from the planted foot in the source video), its ground
   footprint, how high the ink is off the ground, and the snout x. This script inlines the clips and shows one
   frame at a time, and everything physical follows the frames:
   - he moves exactly as fast as his feet push (v), so feet never skate and nothing slides while he is still;
     clips never play backwards while walking (a get-up is the sit-down reversed only after the walk-in is cut);
   - clips are joined at frames whose silhouettes match (data-in / data-out / data-stops / data-exit, found at
     build time), so there is no morph and no jump;
   - the shadow is a flat ellipse under the frame's footprint, lighter and narrower when he is off the ground,
     interpolated between frames.
   Poses are a graph: walk <-> sit <-> lie, walk <-> stand, walk -> hop -> walk. A command plans a path from
   where he is (even mid-transition: it turns round in place) and plays it.
   Hover / focus / tap on Arlo stops him at a standing frame and shows five bubbles (one cecf1_ button each)
   scattered over his head. Left alone he does something by himself now and then. Offscreen he pauses. Under
   reduced motion he stands still and a command shows the pose's end frame; bubbles do not drift.
*/
(function () {
  var root = document.querySelector('[data-mascot]');
  if (!root || !window.fetch || !window.DOMParser) return;

  var CLIPS = ['walk', 'sit', 'stand', 'lie', 'hop', 'idle-sit', 'idle-stand', 'idle-lie'];
  var base = root.getAttribute('data-mascot-src') || 'assets/arlo-motion-v2/';
  function clipUrl(name) { return root.getAttribute('data-clip-' + name) || base + 'arlo-' + name + '.svg'; }

  var track = root.querySelector('[data-mascot-track]');
  var arlo = root.querySelector('[data-mascot-arlo]');
  var stage = root.querySelector('[data-mascot-stage]');
  var hit = root.querySelector('[data-mascot-hit]');
  var group = root.querySelector('[data-mascot-bubbles]');
  var bubbles = root.querySelectorAll('[data-mascot-bubble]');
  var floats = root.querySelectorAll('[data-mascot-float]');
  var buttons = root.querySelectorAll('[data-mascot-do]');
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  var RATE = { sit: 1.25, stand: 1.25, lie: 1.35, hop: 1.1 };
  var SHADOW = { alpha: 0.16, flat: 0.085, pad: 18 };
  var clips = {}, vb = null, shadow = null;
  var shown = null;           // { clip, g }
  var play = null;            // { clip, t, rate, loop, done }
  var plan = [];              // steps still to run (see planTo)
  var node = 'walk';          // where he is in the pose graph: walk | sit | stand | lie, or the edge being played
  var x = null, last = null, visible = false, raf = 0, gone = 0;
  var attention = false, stopping = false, stopped = false, dwell = 0, leaveEase = 0;
  var autoTimer = 0, poseTimer = 0, closeTimer = 0, openedAt = 0, lastPointer = 'mouse';

  /* ---- clips ---- */
  function load(name) {
    return fetch(clipUrl(name)).then(function (r) {
      if (!r.ok) throw new Error(name);
      return r.text();
    }).then(function (text) {
      var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      var svg = document.importNode(doc.documentElement, true);
      svg.setAttribute('class', 'mascot_svg');
      svg.style.display = 'none';
      stage.appendChild(svg);
      if (!vb) {
        vb = svg.getAttribute('viewBox').split(/\s+/).map(parseFloat);
        arlo.style.aspectRatio = vb[2] + ' / ' + vb[3];
        makeShadow(parseFloat(svg.getAttribute('data-ground')));
      }
      var gs = svg.querySelectorAll('svg > g'), frames = [];
      for (var i = 0; i < gs.length; i++) {
        var g = gs[i], foot = (g.getAttribute('data-foot') || '0,0').split(',');
        g.setAttribute('display', 'none');
        frames.push({ g: g, t0: +g.getAttribute('data-t0'), t1: +g.getAttribute('data-t1'), v: +g.getAttribute('data-v') || 0,
          f0: +foot[0], f1: +foot[1], lift: +g.getAttribute('data-lift') || 0, x: +g.getAttribute('data-x') || 0 });
      }
      var list = function (a) { var s = svg.getAttribute(a); return s ? s.split(',').map(parseFloat) : []; };
      var pair = function (a) { var p = list(a); return p.length >= 2 ? { t: p[0], tw: p[1], iou: p.length > 2 ? p[2] : 1 } : null; };
      clips[name] = { frames: frames, svg: svg, dur: +svg.getAttribute('data-dur'), stops: list('data-stops'),
        exits: list('data-exit'), inPt: pair('data-in'), outPt: pair('data-out') };
    });
  }

  function makeShadow(ground) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', vb.join(' '));
    svg.setAttribute('class', 'mascot_shadow');
    svg.setAttribute('aria-hidden', 'true');
    var e = document.createElementNS(ns, 'ellipse');
    e.setAttribute('cy', ground);
    e.setAttribute('fill', 'currentColor');
    svg.appendChild(e);
    stage.insertBefore(svg, stage.firstChild);
    shadow = { el: e, ground: ground };
  }

  function indexAt(c, t) {
    var f = c.frames;
    if (t <= f[0].t0) return 0;
    for (var i = 0; i < f.length; i++) if (t < f[i].t1) return i;
    return f.length - 1;
  }

  function show(name, t) {
    var c = clips[name], f = c.frames[indexAt(c, t)];
    if (shown && shown.g === f.g) return;
    if (shown) { shown.g.setAttribute('display', 'none'); if (shown.clip !== name && !(fade && fade.svg === clips[shown.clip].svg)) clips[shown.clip].svg.style.display = 'none'; }
    if (fade && fade.svg === c.svg) endFade();
    c.svg.style.display = '';
    f.g.setAttribute('display', 'inline');
    shown = { clip: name, g: f.g };
  }

  // the physical reading of clip `name` at time t, blended between neighbouring frames (shadow glides)
  function ground(name, t) {
    var c = clips[name], i = indexAt(c, t), a = c.frames[i], b = c.frames[Math.min(i + 1, c.frames.length - 1)];
    var u = a.t1 > a.t0 ? Math.max(0, Math.min(1, (t - a.t0) / (a.t1 - a.t0))) : 0;
    u = u * u * (3 - 2 * u);
    var L = function (p, q) { return p + (q - p) * u; };
    return { f0: L(a.f0, b.f0), f1: L(a.f1, b.f1), lift: L(a.lift, b.lift), x: a.x };
  }

  function drawShadow(name, t) {
    if (!shadow) return;
    var g = ground(name, t);
    var h = Math.max(0, Math.min(1, g.lift / 140));
    var rx = ((g.f1 - g.f0) / 2 + SHADOW.pad) * (1 - 0.4 * h);
    var ry = Math.max(9, rx * SHADOW.flat);
    shadow.el.setAttribute('cx', ((g.f0 + g.f1) / 2).toFixed(1));
    shadow.el.setAttribute('rx', rx.toFixed(1));
    shadow.el.setAttribute('ry', ry.toFixed(1));
    shadow.el.setAttribute('fill-opacity', (SHADOW.alpha * (1 - 0.65 * h)).toFixed(3));
  }

  // switch clips at matched frames: keep the snout where it is on screen
  var fade = null; // { svg, g, left } the old frame dissolving over a weak cut
  function cut(toClip, toT, iou) {
    // anchor: the centre of the ground contact (his feet stay put across a matched cut); the snout when airborne
    var anchor = function (f) { return f.lift > 25 ? f.x : (f.f0 + f.f1) / 2; };
    var fromX = shown ? anchor(clips[shown.clip].frames[indexAt(clips[shown.clip], play ? play.t : 0)]) : null;
    var toX = anchor(clips[toClip].frames[indexAt(clips[toClip], toT)]);
    if (fromX !== null && x !== null) x += (fromX - toX) * scale();
    if (shown && iou !== undefined && iou < 0.85 && shown.clip !== toClip && !mq.matches) {
      endFade();
      fade = { svg: clips[shown.clip].svg, g: shown.g, left: 0.12, total: 0.12 };
      shown = null; // the old frame stays up while it fades; show() must not hide it
    }
  }
  function endFade() {
    if (!fade) return;
    fade.g.setAttribute('display', 'none');
    if (!shown || clips[shown.clip].svg !== fade.svg) fade.svg.style.display = 'none';
    fade.svg.style.opacity = '';
    fade = null;
  }
  function tickFade(dt) {
    if (!fade) return;
    fade.left -= dt;
    if (fade.left <= 0) { endFade(); return; }
    fade.svg.style.opacity = (fade.left / fade.total).toFixed(3);
  }

  function scale() { return arlo.clientWidth / vb[2]; }

  /* ---- the pose graph and plans ---- */
  // edges: clip that takes you from a to b (dir +1) or back (dir -1)
  var EDGES = [
    { from: 'walk', to: 'sit', clip: 'sit' }, { from: 'walk', to: 'stand', clip: 'stand' },
    { from: 'sit', to: 'lie', clip: 'lie' }, { from: 'walk', to: 'walk', clip: 'hop' }
  ];
  var IDLE = { sit: 'idle-sit', stand: 'idle-stand', lie: 'idle-lie' };

  function edgesFrom(n) {
    var out = [];
    EDGES.forEach(function (e) {
      if (e.from === n && e.clip !== 'hop') out.push({ to: e.to, clip: e.clip, dir: 1 });
      if (e.to === n && e.clip !== 'hop') out.push({ to: e.from, clip: e.clip, dir: -1 });
    });
    return out;
  }

  function path(from, to) { // BFS over the pose graph -> list of {clip, dir}
    var q = [{ n: from, steps: [] }], seen = {};
    seen[from] = true;
    while (q.length) {
      var cur = q.shift();
      if (cur.n === to) return cur.steps;
      edgesFrom(cur.n).forEach(function (e) {
        if (seen[e.to]) return;
        seen[e.to] = true;
        q.push({ n: e.to, steps: cur.steps.concat([{ clip: e.clip, dir: e.dir, to: e.to }]) });
      });
    }
    return null;
  }

  // Build the plan to reach `target` (a node, or 'hop') from the current situation.
  function planTo(target) {
    plan = [];
    stopping = false;
    if (play && play.loop) play.pending = null; // a previous request still waiting for its frame is dropped
    var here = node, mid = null;
    if (typeof node === 'object') { // on an edge
      mid = node;
      var onward = path(mid.to, target === 'hop' ? 'walk' : target) || [];
      var backward = path(mid.from, target === 'hop' ? 'walk' : target) || [];
      if (onward.length <= backward.length) { here = mid.to; } // let the current transition finish; arrive() takes the plan on
      else { plan.push({ run: mid.clip, dir: -mid.dir, to: mid.from, reverseInPlace: true }); here = mid.from; }
    }
    var steps = path(here, target === 'hop' ? 'walk' : target) || [];
    steps.forEach(function (s) { plan.push({ run: s.clip, dir: s.dir, to: s.to }); });
    if (target === 'hop') plan.push({ run: 'hop', dir: 1, to: 'walk' });
    next();
  }

  // Start the next step when the current loop reaches a matching frame; called every tick while a plan waits.
  function next() {
    if (!plan.length) return;
    var step = plan[0];
    if (step.reverseInPlace) { // turn round where he is
      plan.shift();
      play.rate = -Math.abs(play.rate);
      play.done = function () { arrive(step.to); };
      return;
    }
    if (play && play.loop && play.clip === 'walk') {
      var c = clips[step.run], tw = c.inPt ? c.inPt.tw : 0;
      var go = function () { plan.shift(); cut(step.run, 0, c.inPt ? c.inPt.iou : 1); begin(step); };
      if (step.run === 'hop') { if (!play.pending) play.pending = { at: tw, then: go }; }
      else if (!stopping || !stopping.then) { stopped = false; play.rate = 1; stopping = { at: null, then: go }; } // any standing frame matches the transition's first frame
      return;
    }
    if (play && play.loop) { // an idle: leave at a frame that matches the pose
      var idle = clips[play.clip];
      if (!play.pending) play.pending = { at: null, exits: idle.exits, minT: 0.35, then: function () {
        plan.shift();
        var t0 = step.dir > 0 ? 0 : clips[step.run].dur - 0.0001;
        cut(step.run, t0, 1); begin(step);
      } };
      return;
    }
    if (!play) { plan.shift(); cut(step.run, step.dir > 0 ? 0 : clips[step.run].dur - 0.0001, 1); begin(step); }
    // otherwise a transition is playing: arrive() continues the plan when it ends
  }

  function begin(step) {
    var c = clips[step.run], rate = (RATE[step.run] || 1.2) * step.dir;
    node = { clip: step.run, dir: step.dir, from: step.dir > 0 ? edgeOf(step.run).from : edgeOf(step.run).to, to: step.to };
    play = { clip: step.run, t: step.dir > 0 ? 0 : c.dur - 0.0001, rate: rate, loop: false, done: function () { arrive(step.to); } };
    if (step.run === 'hop') play.out = c.outPt;
    show(step.run, play.t);
  }

  function edgeOf(clip) { for (var i = 0; i < EDGES.length; i++) if (EDGES[i].clip === clip) return EDGES[i]; }

  function arrive(n) {
    node = n;
    if (n === 'walk') {
      var c = clips[shown.clip], back = c.outPt || c.inPt, tw = back ? back.tw : 0;
      cut('walk', tw, back ? back.iou : 1);
      play = { clip: 'walk', t: tw, rate: 1, loop: true };
      leaveEase = 0;
      stopped = false;
      if (plan.length) next(); else if (attention) stopHere(); else scheduleAuto();
    } else {
      cut(IDLE[n], 0, 1);
      play = { clip: IDLE[n], t: 0, rate: 1, loop: true };
      dwell = 0;
      setButtons(n);
      if (plan.length) next();
      else {
        clearTimeout(poseTimer);
        if (!attention) poseTimer = setTimeout(function () { if (!attention) planTo('walk'); }, 4500 + Math.random() * 3000);
      }
    }
  }

  /* ---- walking: stop at a standing frame, ease in and out ---- */
  function stopHere() {
    if (node !== 'walk' || !play || play.clip !== 'walk' || stopped || stopping) return;
    stopping = { at: null, then: null };
  }

  function resume() {
    if (node !== 'walk' || !stopped) { if (stopping && !stopping.then) stopping = false; return; }
    stopped = false; stopping = false;
    play = { clip: 'walk', t: play ? play.t : 0, rate: 1, loop: true };
    leaveEase = 0;
    scheduleAuto();
  }

  function nextStop(c, t) { // next stop time after t (wrapping)
    var best = null;
    for (var i = 0; i < c.stops.length; i++) {
      var s = c.stops[i], d = s - t; if (d <= 0) d += c.dur;
      if (best === null || d < best.d) best = { s: s, d: d };
    }
    return best;
  }

  /* ---- the loop ---- */
  function tick(now) {
    raf = 0;
    if (!visible || !vb) { last = null; return; }
    var dt = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
    last = now;
    var W = track.clientWidth, w = arlo.clientWidth, sc = scale();
    if (x === null) x = W * 0.62;
    if (play) {
      var c = clips[play.clip], prev = play.t, rate = play.rate;
      if (play.clip === 'walk' && play.loop) {
        if (stopping) { // slow into the stop frame (the next one, or the one a transition starts from)
          var tgt = stopping.at !== null ? stopping.at : (nextStop(c, prev) || { s: prev }).s, d = tgt - prev;
          if (d < 0) d += c.dur;
          if (d < 0.45) rate = 1 - 0.5 * (1 - d / 0.45);
          if (d <= dt * rate + 0.001) {
            play.t = tgt; show('walk', play.t);
            var th = stopping.then; stopping = false; rate = 0;
            if (th) { th(); c = clips[play.clip]; } else { stopped = true; play.rate = 0; }
          }
        } else if (leaveEase < 0.4) { leaveEase += dt; rate = 0.5 + 0.5 * (leaveEase / 0.4); }
        play.rate = stopped ? 0 : play.rate;
      }
      if (rate !== 0) {
        play.t += dt * rate;
        // pending cut out of a loop at a matching frame
        if (play.pending && play.loop) {
          var p = play.pending, hitAt = null;
          if (p.at !== null && p.at !== undefined) { var a = p.at; if ((prev < a && play.t >= a) || (prev > play.t && (a >= prev || a <= play.t))) hitAt = a; }
          else if (p.exits) { dwell += dt; if (dwell >= p.minT) for (var i = 0; i < p.exits.length; i++) { var e = p.exits[i]; if ((prev < e && play.t >= e) || (prev > play.t && (e >= prev || e <= play.t))) { hitAt = e; break; } } }
          if (hitAt !== null) { play.t = hitAt; var then = p.then; play.pending = null; then(); c = clips[play.clip]; }
        }
        if (play && play.out && play.t >= play.out.t) { play.out = null; play.done = null; arrive('walk'); c = clips[play.clip]; }
        if (play) {
          if (play.loop) { if (play.t >= c.dur || play.t < 0) play.t = ((play.t % c.dur) + c.dur) % c.dur; }
          else if (play.t >= c.dur || play.t < 0) {
            play.t = Math.max(0, Math.min(play.t, c.dur - 0.0001));
            show(play.clip, play.t);
            var done = play.done; play = null;
            if (done) done();
          }
          if (play) show(play.clip, play.t);
        }
      }
      // ground speed: only forward play moves him, at the planted foot's speed
      if (play && rate > 0) {
        var f = c.frames[indexAt(c, play.t)];
        x -= f.v * sc * dt * rate;
      }
      if (play) drawShadow(play.clip, play.t);
    }
    tickFade(dt);
    if (x < -w * 1.05) { gone += dt; if (gone > 1.4) { x = W + w * 0.05; gone = 0; } }
    arlo.style.transform = 'translateX(' + x.toFixed(2) + 'px)';
    if (attention) placeBubbles(W, w);
    raf = requestAnimationFrame(tick);
  }

  function run() { if (!raf && visible) { last = null; raf = requestAnimationFrame(tick); } }

  /* ---- commands ---- */
  function command(what) {
    clearTimeout(autoTimer); clearTimeout(poseTimer);
    if (mq.matches) { still(what); return; }
    if (what === 'walk') { if (node === 'walk') { plan = []; if (stopping && stopping.then) stopping = false; resume(); return; } planTo('walk'); return; }
    if (what === 'hop') { if (stopped) resume(); planTo('hop'); return; }
    if (node === what) return;
    if (stopped) resume();
    planTo(what);
  }

  function scheduleAuto() {
    clearTimeout(autoTimer);
    if (mq.matches) return;
    autoTimer = setTimeout(function () {
      if (attention || node !== 'walk' || plan.length) { scheduleAuto(); return; }
      command(['sit', 'stand', 'lie', 'hop', 'sit', 'stand'][Math.floor(Math.random() * 6)]);
    }, 9000 + Math.random() * 7000);
  }

  /* ---- reduced motion: poses only, no movement ---- */
  function still(what) {
    plan = []; play = null; stopped = false; stopping = false;
    for (var i = 0; i < floats.length; i++) floats[i].classList.add('is-still');
    var name = IDLE[what] ? IDLE[what] : 'walk';
    var t = IDLE[what] ? 0 : (clips.walk.stops[0] || 0);
    show(name, t); drawShadow(name, t);
    node = IDLE[what] ? what : 'walk';
    setButtons(IDLE[what] ? what : null);
  }

  /* ---- bubbles ---- */
  // slots around his head, in Arlo widths from his box's bottom-left (x right, y up)
  var SLOTS = [[-0.34, 0.76], [0.06, 1.1], [0.5, 0.86], [0.96, 1.14], [1.36, 0.8]];
  var jitter = [];
  function scatter() { jitter = SLOTS.map(function () { return [(Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.08]; }); }

  function placeBubbles(W, w) {
    var pad = 8, gap = 10, H = track.clientHeight, boxH = arlo.clientHeight, r = [], i, j;
    for (i = 0; i < bubbles.length; i++) {
      var b = bubbles[i], s = SLOTS[i] || SLOTS[0], jt = jitter[i] || [0, 0];
      r.push({ el: b, w: b.offsetWidth, h: b.offsetHeight, x: x + (s[0] + jt[0]) * w - b.offsetWidth / 2, y: H - (s[1] + jt[1]) * w - b.offsetHeight });
    }
    var clamp = function (q) {
      q.x = Math.max(pad, Math.min(q.x, W - q.w - pad));
      q.y = Math.max(pad, Math.min(q.y, H - boxH * 0.9 - q.h));
    };
    if (W < 640) { // narrow strip: rows above his head, centred on him, bottom row first
      var maxW = W - 2 * pad, rows = [[]], rw = 0;
      for (i = 0; i < r.length; i++) {
        if (rw + r[i].w + (rows[rows.length - 1].length ? gap : 0) > maxW && rows[rows.length - 1].length) { rows.push([]); rw = 0; }
        rows[rows.length - 1].push(r[i]); rw += r[i].w + gap;
      }
      var yb = H - boxH - gap;
      for (i = 0; i < rows.length; i++) {
        var row = rows[i], tw = 0;
        for (j = 0; j < row.length; j++) tw += row[j].w + (j ? gap : 0);
        var cxr = Math.max(pad + tw / 2, Math.min(x + w / 2, W - pad - tw / 2)), cur = cxr - tw / 2, rh = 0;
        for (j = 0; j < row.length; j++) { row[j].x = cur; row[j].y = yb - row[j].h; cur += row[j].w + gap; rh = Math.max(rh, row[j].h); }
        yb -= rh + gap;
      }
      for (i = 0; i < r.length; i++) { r[i].x = Math.max(pad, Math.min(r[i].x, W - r[i].w - pad)); r[i].y = Math.max(pad, r[i].y); r[i].el.style.transform = 'translate(' + r[i].x.toFixed(1) + 'px,' + r[i].y.toFixed(1) + 'px)'; }
      return;
    }
    r.forEach(clamp);
    // push overlapping bubbles apart (a few passes), mostly sideways, then keep them on the strip
    for (var pass = 0; pass < 6; pass++) {
      for (i = 0; i < r.length; i++) for (j = i + 1; j < r.length; j++) {
        var a = r[i], c = r[j];
        var ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x) + gap;
        var oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y) + gap;
        if (ox <= 0 || oy <= 0) continue;
        if (ox < oy * 1.6) { var sx = a.x < c.x ? -1 : 1; a.x += sx * ox / 2; c.x -= sx * ox / 2; }
        else { var sy = a.y < c.y ? -1 : 1; a.y += sy * oy / 2; c.y -= sy * oy / 2; }
      }
      r.forEach(clamp);
    }
    for (i = 0; i < r.length; i++) r[i].el.style.transform = 'translate(' + r[i].x.toFixed(1) + 'px,' + r[i].y.toFixed(1) + 'px)';
  }

  function setButtons(active) {
    for (var i = 0; i < buttons.length; i++) {
      var d = buttons[i].getAttribute('data-mascot-do');
      buttons[i].setAttribute('aria-pressed', d === active ? 'true' : 'false');
    }
  }

  function open() {
    clearTimeout(closeTimer);
    if (attention) return;
    attention = true;
    openedAt = Date.now();
    scatter();
    placeBubbles(track.clientWidth, arlo.clientWidth);
    group.classList.add('is-open');
    hit.setAttribute('aria-expanded', 'true');
    for (var i = 0; i < bubbles.length; i++) (function (b, f, i) {
      var go = function () { if (attention) { b.classList.add('is-open'); f.classList.add('is-open'); } };
      if (i === 0 || mq.matches) go(); else setTimeout(go, 40 * i); // the first is focusable at once
    })(bubbles[i], floats[i], i);
    clearTimeout(autoTimer); clearTimeout(poseTimer);
    if (!mq.matches && node === 'walk' && !plan.length) stopHere();
  }

  function close(delay, now) {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      // the pointer may have been left behind while he walks to his spot or does what was asked: wait for that
      if (!now && (plan.length || (stopping && stopping.then) || typeof node === 'object')) { close(500); return; }
      attention = false;
      group.classList.remove('is-open');
      for (var i = 0; i < bubbles.length; i++) { bubbles[i].classList.remove('is-open'); floats[i].classList.remove('is-open'); }
      hit.setAttribute('aria-expanded', 'false');
      if (mq.matches) return;
      if (node === 'walk' && stopped) resume();
      else if (typeof node === 'string' && node !== 'walk' && !plan.length) { clearTimeout(poseTimer); poseTimer = setTimeout(function () { if (!attention && !plan.length) planTo('walk'); }, 3000); }
      else if (node === 'walk') scheduleAuto();
    }, delay || 0);
  }

  function wire() {
    arlo.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') open(); });
    arlo.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') close(900); });
    group.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') clearTimeout(closeTimer); });
    group.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') close(900); });
    arlo.addEventListener('pointerdown', function (e) { lastPointer = e.pointerType; });
    hit.addEventListener('click', function () {
      if (!attention) open();
      else if (lastPointer !== 'mouse' && Date.now() - openedAt > 400) close(0);
    });
    var quietFocus = false;
    root.addEventListener('focusin', function () { if (!quietFocus) open(); });
    root.addEventListener('focusout', function (e) { if (!root.contains(e.relatedTarget)) close(300); });
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && attention) { close(0, true); quietFocus = true; hit.focus(); quietFocus = false; } });
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (e) {
        var what = e.currentTarget.getAttribute('data-mascot-do');
        setButtons(IDLE[what] ? what : null);
        command(what);
      });
    }
    if (mq.addEventListener) mq.addEventListener('change', function () { if (mq.matches) still(null); else { for (var i = 0; i < floats.length; i++) floats[i].classList.remove('is-still'); x = null; shown = null; play = { clip: 'walk', t: 0, rate: 1, loop: true }; show('walk', 0); node = 'walk'; scheduleAuto(); } });
  }

  function boot() {
    Promise.all(CLIPS.map(load)).then(function () {
      root.classList.add('is-ready');
      if (mq.matches) still(null); else { play = { clip: 'walk', t: 0, rate: 1, loop: true }; show('walk', 0); scheduleAuto(); }
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
  root.mascot = { command: command, state: function () { return { attention: attention, stopping: !!stopping, node: node, play: play && { clip: play.clip, t: play.t, rate: play.rate }, x: x, stopped: stopped, plan: plan.length }; } };
})();
