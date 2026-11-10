/* diy-guide: the working guide, on any page whose [data-flwr] wrapper carries data-diy-item="<id>".
   - recent: every DIY detail page (guide, answer, tool) adds itself to localStorage "cosmic-diy:v1:recent"
     ([{id, type, title, url, at}], newest first, 12 max), which the DIY landing reads for "continue where you left off".
   - steps (.step_root with an [data-step-check] checkbox): done / current state, saved per guide in
     "cosmic-diy:v1:<id>" as {steps: [stepId], owned: [supplyId], updated}. Current = the first step not done.
     State is shown three ways, never by colour alone: a tick replaces the number, the state line reads
     "Done" / "You're here", and the contents list adds "(done)" / "(current step)" for screen readers.
   - guidenav_ (sticky progress + contents): count, flwr progress bar, stepper ticks, "Go to step N",
     the mobile "Steps" toggle (Escape / outside click / link closes it), keep-screen-on, clear progress.
   - supply_ ("what you'll need"): "Have it" toggles (saved), to-buy count, copy list, print list.
   - before/after: "Show before" / "Show after" buttons drive the flwr compare candidate (keyboard fallback).
   Every storage access is in try/catch: without storage the page works and simply forgets on reload.
   Needs controls.js (check_ selected states). */
(function () {
  'use strict';
  var root = document.querySelector('[data-diy-item]');
  if (!root) return;
  var ID = root.getAttribute('data-diy-item');
  var KEY = 'cosmic-diy:v1:' + ID, RECENT = 'cosmic-diy:v1:recent';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function read(k) { try { var v = window.localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function write(k, v) { try { window.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function drop(k) { try { window.localStorage.removeItem(k); } catch (e) {} }

  /* ---- recent ---- */
  (function () {
    var list = read(RECENT);
    if (!Array.isArray(list)) list = [];
    list = list.filter(function (x) { return x && x.id !== ID; });
    list.unshift({
      id: ID, type: root.getAttribute('data-diy-type') || 'guide',
      title: root.getAttribute('data-diy-title') || document.title,
      url: location.pathname.split('/').pop(), at: new Date().toISOString()
    });
    write(RECENT, list.slice(0, 12));
  })();

  var state = read(KEY) || {};
  var done = {}, owned = {};
  (state.steps || []).forEach(function (s) { done[s] = true; });
  (state.owned || []).forEach(function (s) { owned[s] = true; });
  function save() {
    write(KEY, {
      steps: Object.keys(done).filter(function (k) { return done[k]; }),
      owned: Object.keys(owned).filter(function (k) { return owned[k]; }),
      updated: new Date().toISOString()
    });
  }

  /* ---- steps ---- */
  var steps = $$('.step_root[data-step-id]');
  var total = steps.length;
  var navSteps = $$('[data-guidenav-step]');
  var countEl = $('[data-guidenav-count]'), track = $('[data-guidenav-track]'), fill = $('[data-guidenav-fill]');
  var resume = $('[data-guidenav-resume]'), resumeLabel = $('[data-guidenav-resume-label]');
  var start = $('[data-guide-start]'), startLabel = $('[data-guide-start-label]');
  var TICK = '<svg class="guidenav_dot_tick" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function paint() {
    var n = 0, current = -1;
    steps.forEach(function (el, i) {
      var id = el.getAttribute('data-step-id'), isDone = !!done[id];
      if (isDone) n++;
      else if (current < 0) current = i;
      var box = $('[data-step-check]', el);
      if (box && box.checked !== isDone) { box.checked = isDone; if (window.cosmicControls) window.cosmicControls.paint(box); }
    });
    steps.forEach(function (el, i) {
      var isDone = !!done[el.getAttribute('data-step-id')], isCur = i === current;
      el.classList.toggle('is-done', isDone);
      el.classList.toggle('is-current', isCur);
      var digits = $('.step_digits', el), tick = $('.step_tick', el), st = $('[data-step-state]', el);
      if (digits) digits.classList.toggle('is-hidden', isDone);
      if (tick) tick.classList.toggle('is-hidden', !isDone);
      if (st) {
        st.classList.toggle('is-done', isDone);
        st.classList.toggle('is-current', isCur);
        st.textContent = (isDone ? 'Done · ' : isCur ? 'You’re here · ' : '') + 'Step ' + (i + 1) + ' of ' + total;
      }
      var lbl = $('[data-step-check-label]', el);
      if (lbl) lbl.textContent = isDone ? 'Step ' + (i + 1) + ' done' : 'Mark step ' + (i + 1) + ' done';
      if (isCur) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
    });
    navSteps.forEach(function (a, i) {
      var isDone = steps[i] && !!done[steps[i].getAttribute('data-step-id')], isCur = i === current;
      a.classList.toggle('is-complete', isDone);
      a.classList.toggle('is-active', isCur);
      if (isCur) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
      var dot = $('.guidenav_dot', a);
      if (dot) dot.innerHTML = isDone ? TICK : String(i + 1);
      var sr = $('[data-guidenav-sr]', a);
      if (sr) sr.textContent = isDone ? ' (done)' : isCur ? ' (current step)' : '';
    });
    if (countEl) countEl.innerHTML = '<span class="guidenav_count_num">' + n + '</span> of ' + total + ' done';
    var pct = total ? Math.round((n / total) * 100) : 0;
    if (track) {
      track.setAttribute('aria-valuenow', String(n));
      track.setAttribute('aria-valuetext', n + ' of ' + total + ' steps done');
    }
    if (fill) fill.style.setProperty('--flwr-progress', pct + '%');
    var target = current < 0 ? 0 : current;
    if (resume && steps[target]) {
      resume.setAttribute('href', '#' + steps[target].id);
      if (resumeLabel) resumeLabel.textContent = current < 0 ? 'All ' + total + ' done' : 'Go to step ' + (current + 1);
    }
    if (start && steps[target]) {
      start.setAttribute('href', n === 0 ? '#steps' : '#' + steps[target].id);
      if (startLabel) startLabel.textContent = n === 0 ? 'Start the steps' : current < 0 ? 'Review the steps' : 'Continue: step ' + (current + 1);
    }
  }

  steps.forEach(function (el) {
    var box = $('[data-step-check]', el);
    if (!box) return;
    box.addEventListener('change', function () {
      done[el.getAttribute('data-step-id')] = box.checked;
      save();
      paint();
    });
  });

  /* ---- guidenav: mobile toggle, links, keep screen on, reset ---- */
  var nav = $('[data-guidenav]'), toggle = $('[data-guidenav-toggle]'), panel = $('[data-guidenav-panel]');
  var toggleIcon = toggle && $('.guidenav_toggle_icon', toggle);
  function setOpen(open, focusBack) {
    if (!toggle || !panel) return;
    panel.classList.toggle('is-open', open);
    toggle.classList.toggle('is-open', open);
    if (toggleIcon) toggleIcon.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open && focusBack) toggle.focus();
  }
  if (toggle && panel) {
    toggle.addEventListener('click', function () { setOpen(!panel.classList.contains('is-open')); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) { setOpen(false, true); }
    });
    document.addEventListener('pointerdown', function (e) {
      if (panel.classList.contains('is-open') && nav && !nav.contains(e.target)) setOpen(false);
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a[href^="#"]')) setOpen(false);
    });
  }

  /* moving to a step or section by link: put focus on its heading so keyboard and screen-reader users land there */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    if (!id || id === 'estimate') return;
    var t = document.getElementById(id);
    if (!t || !t.closest('[data-diy-item]')) return;
    var h = t.matches('h1,h2,h3') ? t : $('h2, h3', t);
    if (h) {
      if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
      setTimeout(function () { try { h.focus({ preventScroll: true }); } catch (x) { h.focus(); } }, 0);
    }
  });

  var reset = $('[data-guidenav-reset]'), armed = 0;
  if (reset) {
    var resetText = reset.textContent;
    reset.addEventListener('click', function () {
      if (!armed) {
        reset.textContent = 'Click again to clear your ticks';
        reset.classList.add('is-armed');
        armed = setTimeout(function () { armed = 0; reset.textContent = resetText; reset.classList.remove('is-armed'); }, 4000);
        return;
      }
      clearTimeout(armed); armed = 0;
      reset.textContent = resetText; reset.classList.remove('is-armed');
      done = {}; owned = {};
      drop(KEY);
      paintSupply(); paint();
      status('Progress cleared.');
    });
  }
  var navStatus = $('[data-guidenav-status]');
  function status(t) { if (navStatus) navStatus.textContent = t; }

  var wakeRow = $('[data-guidenav-wake]'), wakeBox = $('[data-guidenav-wake-input]'), lock = null;
  if (wakeRow && wakeBox && navigator.wakeLock && typeof navigator.wakeLock.request === 'function') {
    wakeRow.classList.remove('is-hidden');
    var getLock = function () {
      return navigator.wakeLock.request('screen').then(function (l) {
        lock = l;
        l.addEventListener('release', function () { lock = null; });
      }).catch(function () {
        wakeBox.checked = false;
        if (window.cosmicControls) window.cosmicControls.paint(wakeBox);
        status('This browser would not keep the screen on.');
      });
    };
    wakeBox.addEventListener('change', function () {
      if (wakeBox.checked) getLock();
      else if (lock) lock.release();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && wakeBox.checked && !lock) getLock();
    });
  }

  /* ---- supply: have it, copy, print ---- */
  var items = $$('.supply_item[data-supply-id]');
  var toBuy = $('[data-supply-count]'), supplyStatus = $('[data-supply-status]');
  function paintSupply() {
    var need = 0;
    items.forEach(function (li) {
      var id = li.getAttribute('data-supply-id'), has = !!owned[id];
      var box = $('[data-supply-own]', li);
      if (box && box.checked !== has) { box.checked = has; if (window.cosmicControls) window.cosmicControls.paint(box); }
      li.classList.toggle('is-owned', has);
      if (!has) need++;
    });
    if (toBuy) toBuy.innerHTML = '<span class="supply_count_num">' + need + '</span> of ' + items.length + ' to get · tick what you already have';
  }
  items.forEach(function (li) {
    var box = $('[data-supply-own]', li);
    if (!box) return;
    box.addEventListener('change', function () {
      owned[li.getAttribute('data-supply-id')] = box.checked;
      save();
      paintSupply();
    });
  });
  function listText() {
    var title = root.getAttribute('data-diy-title') || document.title;
    var lines = ['Shopping list: ' + title];
    $$('[data-supply-group]').forEach(function (g) {
      var rows = $$('.supply_item[data-supply-id]', g).filter(function (li) { return !owned[li.getAttribute('data-supply-id')]; });
      if (!rows.length) return;
      lines.push('', g.getAttribute('data-supply-group'));
      rows.forEach(function (li) {
        var n = $('.supply_name', li), d = $('.supply_note', li);
        lines.push('- ' + (n ? n.textContent.trim() : '') + (d ? ': ' + d.textContent.trim() : ''));
      });
    });
    if (lines.length === 1) lines.push('', 'You have everything on the list.');
    lines.push('', 'Guide: ' + location.href.split('#')[0]);
    return lines.join('\n');
  }
  function say(t) {
    if (!supplyStatus) return;
    supplyStatus.textContent = t;
    supplyStatus.classList.remove('is-hidden');
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'f-sr-only';
    document.body.appendChild(ta); ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return ok;
  }
  var copyBtn = $('[data-supply-copy]');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var text = listText(), n = text.split('\n').filter(function (l) { return l.indexOf('- ') === 0; }).length;
    var msg = n ? 'Copied ' + n + ' item' + (n === 1 ? '' : 's') + '. Paste it into your notes or a message.' : 'Copied: you have everything.';
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { say(msg); }, function () { say(fallbackCopy(text) ? msg : 'Could not copy here. Use Print list instead.'); });
    } else say(fallbackCopy(text) ? msg : 'Could not copy here. Use Print list instead.');
  });
  var printBtn = $('[data-supply-print]');
  if (printBtn) printBtn.addEventListener('click', function () {
    var w = window.open('', '_blank');
    if (!w) { say('Your browser blocked the print window. Allow pop-ups for this site, or use Copy list.'); return; }
    var esc = function (s) { return s.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };
    var body = listText().split('\n').map(function (l) {
      return l.indexOf('- ') === 0 ? '<li>☐ ' + esc(l.slice(2)) + '</li>' : l ? '<p>' + esc(l) + '</p>' : '';
    }).join('');
    w.document.write('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Shopping list</title>' +
      '<style>body{font-family:Archivo,Arial,sans-serif;color:#171726;margin:2rem;line-height:1.5}li{list-style:none;margin:.35rem 0}p:first-child{font-weight:900;font-size:1.4rem}</style>' +
      '</head><body>' + body.replace(/<\/p><li>/g, '</p><ul><li>').replace(/<\/li><p>/g, '</li></ul><p>') + '</body></html>');
    w.document.close();
    w.focus();
    w.print();
  });

  /* ---- before/after fallback buttons ---- */
  $$('[data-compare-show]').forEach(function (b) {
    b.addEventListener('click', function () {
      var c = $('[data-flwr="compare"]', b.closest('figure') || document);
      var api = c && c.__flwrCompare;
      if (api) api.set(b.getAttribute('data-compare-show') === 'before' ? 100 : 0);
    });
  });

  paintSupply();
  paint();
})();
