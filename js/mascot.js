/* mascot_: Arlo walks along a strip and does things when asked (components/mascot.html).

   Clips are Realizer flipbook sprites, one data-clip-<name> path each on the root: one shared viewBox, every
   frame a <g data-t0 data-t1> (seconds). This script inlines them and shows one frame at a time, so a clip
   can loop, play once, hold its last frame or play backwards (standing back up = a transition reversed).

   States: walk (loop, moving left; re-enters from the right) -> at a clean exit point (walk data-cuts) ->
   transition forward (sit | stand | lie) -> idle loop -> transition backward -> walk. hop plays in stride.
   Hover / focus / tap on Arlo stops him and opens the bubble (cecf1_ buttons, data-mascot-do="<clip>|walk").
   Left alone he does something by himself every so often. Offscreen he pauses. Under reduced motion he
   stands still on the walking pose and a command shows the pose's end frame, no motion.
*/
(function () {
  var root = document.querySelector('[data-mascot]');
  if (!root || !window.fetch || !window.DOMParser) return;

  // Each clip's path is a data-clip-<name> attribute on the root (so build-web and /convert see the files);
  // a missing one falls back to data-mascot-src + arlo-<name>.svg.
  var base = root.getAttribute('data-mascot-src') || 'assets/arlo-motion/';
  function clipUrl(name) { return root.getAttribute('data-clip-' + name) || base + 'arlo-' + name + '.svg'; }
  var POSES = { sit: 'idle-sit', stand: 'idle-stand', lie: 'idle-lie' };
  var CLIPS = ['walk', 'sit', 'stand', 'lie', 'hop', 'idle-sit', 'idle-stand', 'idle-lie'];
  var track = root.querySelector('[data-mascot-track]');
  var arlo = root.querySelector('[data-mascot-arlo]');
  var stage = root.querySelector('[data-mascot-stage]');
  var hit = root.querySelector('[data-mascot-hit]');
  var bubble = root.querySelector('[data-mascot-bubble]');
  var buttons = root.querySelectorAll('[data-mascot-do]');
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  var STEP = 0.18;          // walking speed, in Arlo-widths per second
  var TRANSITION_RATE = 1.6; // transitions are 5 s clips; play them faster
  var clips = {};
  var shown = null;          // { clip, g }
  var play = null;           // { clip, t, rate, loop, done }
  var x = null, last = null, visible = false, raf = 0;
  var state = 'walk', pose = null, queue = null, attention = false;
  var autoTimer = 0, poseTimer = 0, closeTimer = 0, openedAt = 0;

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
      var gs = svg.querySelectorAll('svg > g');
      var frames = [];
      for (var i = 0; i < gs.length; i++) {
        gs[i].setAttribute('display', 'none');
        frames.push({ g: gs[i], t0: parseFloat(gs[i].getAttribute('data-t0')), t1: parseFloat(gs[i].getAttribute('data-t1')) });
      }
      var cuts = (svg.getAttribute('data-cuts') || '0').split(',').map(parseFloat);
      clips[name] = { svg: svg, frames: frames, dur: parseFloat(svg.getAttribute('data-dur')) || 5, cuts: cuts };
    });
  }

  function frameAt(c, t) {
    for (var i = 0; i < c.frames.length; i++) if (t >= c.frames[i].t0 && t < c.frames[i].t1) return c.frames[i];
    return t <= 0 ? c.frames[0] : c.frames[c.frames.length - 1];
  }

  function show(name, t) {
    var c = clips[name];
    if (!c) return;
    var f = frameAt(c, t);
    if (shown && shown.g === f.g) return;
    if (shown) {
      shown.g.setAttribute('display', 'none');
      if (shown.clip !== name) clips[shown.clip].svg.style.display = 'none';
    }
    c.svg.style.display = '';
    f.g.setAttribute('display', 'inline');
    shown = { clip: name, g: f.g };
  }

  function start(name, opts) {
    var c = clips[name];
    opts = opts || {};
    var rate = opts.rate || 1;
    play = { clip: name, t: rate < 0 ? c.dur - 0.0001 : 0, rate: rate, loop: !!opts.loop, done: opts.done || null };
    show(name, play.t);
  }

  /* ---- state machine ---- */
  function walk() {
    pose = null;
    if (queue) { var fn = queue; queue = null; state = 'stopped'; start('walk', {}); play = null; fn(); return; }
    state = 'walk';
    start('walk', { loop: true });
    scheduleAuto();
  }

  function enterPose(name) {
    state = 'to-pose'; pose = name;
    start(name, { rate: TRANSITION_RATE, done: function () {
      state = 'pose';
      start(POSES[name], { loop: true });
      clearTimeout(poseTimer);
      poseTimer = setTimeout(function () { if (!attention) leavePose(walk); }, 4000 + Math.random() * 3000);
    } });
  }

  function leavePose(then) {
    clearTimeout(poseTimer);
    var name = pose;
    var from = play && play.clip === name ? play.t : null; // mid-transition: turn round where he is
    state = 'from-pose';
    start(name, { rate: -TRANSITION_RATE, done: function () { pose = null; then(); } });
    if (from !== null) { play.t = from; show(name, from); }
  }

  function hop() {
    state = 'hop';
    start('hop', { rate: 1.3, done: walk });
  }

  // From whatever he is doing, go to the walking pose, then run fn.
  function viaWalkPose(fn) {
    if (state === 'pose' || state === 'to-pose') { leavePose(fn); return; }
    if (state === 'walk') { queue = fn; return; } // taken at the next clean exit point
    if (state === 'stopped') { fn(); return; }
    queue = fn; // hop / from-pose: when it ends (walk() then takes the queue at the first cut)
  }

  function command(what) {
    clearTimeout(autoTimer);
    if (mq.matches) { still(what); return; }
    if (what === 'walk') { viaWalkPose(walk); return; }
    if (what === 'hop') { viaWalkPose(hop); return; }
    if (POSES[what]) {
      if (pose === what && (state === 'pose' || state === 'to-pose')) return;
      viaWalkPose(function () { enterPose(what); });
    }
  }

  function stopHere() { // stand still on the walking pose (hover)
    state = 'stopped';
    start('walk', {});
    play = null;
  }

  function scheduleAuto() {
    clearTimeout(autoTimer);
    if (mq.matches) return;
    autoTimer = setTimeout(function () {
      if (attention || state !== 'walk') { scheduleAuto(); return; }
      var pick = ['sit', 'stand', 'lie', 'hop', 'sit'][Math.floor(Math.random() * 5)];
      command(pick);
    }, 7000 + Math.random() * 7000);
  }

  /* ---- reduced motion: poses only, no movement ---- */
  function still(what) {
    state = 'still';
    var name = POSES[what] ? what : 'walk';
    var c = clips[name];
    show(name, POSES[what] ? c.dur - 0.0001 : 0);
    setButtons(POSES[what] ? what : null);
  }

  /* ---- the loop ---- */
  function tick(now) {
    raf = 0;
    if (!visible) { last = null; return; }
    var dt = last === null ? 0 : Math.min((now - last) / 1000, 0.1);
    last = now;
    var W = track.clientWidth, w = arlo.clientWidth;
    if (x === null) x = W * 0.62;
    if (play) {
      var c = clips[play.clip];
      var prev = play.t;
      play.t += dt * play.rate;
      if (play.clip === 'walk' && queue) {
        for (var i = 0; i < c.cuts.length; i++) {
          var cut = c.cuts[i];
          if ((prev < cut && play.t >= cut) || (cut === 0 && play.t >= c.dur)) {
            var fn = queue; queue = null; play.t = cut; show('walk', cut); play = null; state = 'stopped'; fn();
            break;
          }
        }
      }
      if (play) {
        if (play.t >= c.dur || play.t < 0) {
          if (play.loop) play.t = ((play.t % c.dur) + c.dur) % c.dur;
          else {
            play.t = Math.max(0, Math.min(play.t, c.dur - 0.0001));
            show(play.clip, play.t);
            var done = play.done; play = null;
            if (done) done();
          }
        }
        if (play) show(play.clip, play.t);
      }
    }
    if ((state === 'walk' || state === 'hop') && play) {
      x -= STEP * w * dt;
      if (x < -w) x = W;
    }
    arlo.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
    if (attention) place(W, w);
    raf = requestAnimationFrame(tick);
  }

  function place(W, w) { // bubble tail (square bottom-left corner) over his head, kept inside the strip
    var pad = 12, bw = bubble.offsetWidth;
    var left = Math.max(pad, Math.min(x + w * 0.06, W - bw - pad));
    bubble.style.transform = 'translateX(' + left.toFixed(1) + 'px)';
  }

  function run() { if (!raf && visible) { last = null; raf = requestAnimationFrame(tick); } }

  /* ---- bubble ---- */
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
    bubble.classList.add('is-open');
    hit.setAttribute('aria-expanded', 'true');
    if (!mq.matches && state === 'walk') {
      queue = stopHere; // finish the step, then stand still
    }
  }

  function close(delay) {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      attention = false;
      bubble.classList.remove('is-open');
      hit.setAttribute('aria-expanded', 'false');
      if (mq.matches) return;
      if (state === 'stopped') walk();
      else if (state === 'pose') { clearTimeout(poseTimer); poseTimer = setTimeout(function () { if (!attention) leavePose(walk); }, 2500); }
    }, delay || 0);
  }

  function wire() {
    arlo.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') open(); });
    arlo.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') close(900); });
    bubble.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') clearTimeout(closeTimer); });
    bubble.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') close(900); });
    var lastPointer = 'mouse';
    arlo.addEventListener('pointerdown', function (e) { lastPointer = e.pointerType; });
    hit.addEventListener('click', function () {
      if (!bubble.classList.contains('is-open')) open();
      else if (lastPointer !== 'mouse' && Date.now() - openedAt > 400) close(0); // hover or the tap's own focus just opened it
    });
    root.addEventListener('focusin', function () { open(); });
    root.addEventListener('focusout', function (e) { if (!root.contains(e.relatedTarget)) close(300); });
    root.addEventListener('keydown', function (e) { if (e.key === 'Escape' && bubble.classList.contains('is-open')) { close(0); hit.focus(); } });
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (e) {
        var what = e.currentTarget.getAttribute('data-mascot-do');
        setButtons(POSES[what] ? what : null);
        command(what);
      });
    }
    if (mq.addEventListener) mq.addEventListener('change', function () { if (mq.matches) still(null); else walk(); });
  }

  function boot() {
    load('walk').then(function () {
      root.classList.add('is-ready');
      if (mq.matches) still(null); else walk();
      wire();
      run();
      return Promise.all(CLIPS.slice(1).map(load));
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
})();
