/* booking: the walkthrough booking (booking_, components/booking.html; note notes/components/booking.md).
   Needs js/booking-config.js (window.COSMIC_BOOKING) before it and js/controls.js (selected / focus states).
   - Every [data-booking] root gets a strip of days (the next working days, today marked; days with no free time are
     disabled) and the free times of the chosen day. Both are real radios inside choice_card labels, cloned from the
     sample day / slot in the markup (so the classes exist in Webflow; the samples are replaced on load).
   - Times are Austin time (config.timezone); the slots say so, and a visitor in another zone also sees their time.
   - The chosen slot is written to the root's hidden fields: visit_start / visit_end (UTC ISO), visit_when (readable,
     Austin time), visit_timezone. Each change fires `cosmic:booking-change` (bubbles) with the slot or null.
   - [data-booking-lazy] roots (the estimate step) wait for cosmicBooking.refresh(root) before building.
   - A form[data-booking-form] (the Contact block) validates and submits like the estimate: inside Webflow the native
     handler posts; outside it POSTs to data-endpoint when set, else (demo) it only shows the done state. Either way it
     fires `cosmic:booking` on document with the answers.
   - [data-booking-confirm] shows a booked slot with "Add to Google Calendar" (calendar.google.com TEMPLATE link) and
     "Add to Apple / Outlook" (an .ics file made in the browser, times in UTC).
   - Demo only: a booked slot is remembered in localStorage (when storage is allowed) so it shows as taken next time.
   Test hook: window.__cosmicBookingNow = '2026-11-10T15:00:00Z' (set before this script) fixes "now". */
(function () {
  'use strict';
  var CFG = window.COSMIC_BOOKING || {};
  var TZ = CFG.timezone || 'America/Chicago';
  var MIN = 60000, HOUR = 3600000;
  var DUR = (CFG.durationMin || 45) * MIN, STEP = (CFG.slotStepMin || 60) * MIN;
  var HOURS = CFG.hours || { start: '09:00', end: '17:00' };
  var WORK = CFG.workdays || [1, 2, 3, 4, 5];
  var LEAD = (CFG.leadHours == null ? 24 : CFG.leadHours) * HOUR;
  var AHEAD = CFG.daysAhead || 14;
  var ZONE = CFG.zoneLabel || 'Austin time';
  var TITLE = CFG.title || 'Cosmic walkthrough';
  var STORE = 'cosmic-booking-demo';
  var mqReduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;

  /* ---- storage is optional (private windows, blocked site data): every access is guarded ---- */
  function readStore() {
    try { var v = window.localStorage.getItem(STORE); var a = v ? JSON.parse(v) : []; return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function writeStore(list) { try { window.localStorage.setItem(STORE, JSON.stringify(list)); } catch (e) { /* blocked */ } }

  /* ---- time zone arithmetic (Austin wall time <-> UTC instants) ---- */
  var fmts = {};
  function fmt(o, local) {
    var k = JSON.stringify(o) + (local ? 'L' : '');
    if (!fmts[k]) {
      var x = {}; for (var p in o) x[p] = o[p];
      if (!local) x.timeZone = TZ;
      fmts[k] = new Intl.DateTimeFormat('en-US', x);
    }
    return fmts[k];
  }
  function parts(ms) {
    var o = {};
    fmt({ hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
      .formatToParts(new Date(ms)).forEach(function (p) { if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10); });
    o.hour = o.hour % 24;
    return o;
  }
  function offset(ms) { var p = parts(ms); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - (ms - ms % MIN); }
  function at(day, hm) {                               /* 'YYYY-MM-DD' + 'HH:MM' in Austin -> UTC ms */
    var d = day.split('-'), t = hm.split(':');
    var guess = Date.UTC(+d[0], d[1] - 1, +d[2], +t[0], +t[1]);
    var o1 = offset(guess), ms = guess - o1, o2 = offset(ms);
    return o1 === o2 ? ms : guess - o2;
  }
  function dayKey(y, m, d) { return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10); }
  function shift(day, n) { var d = day.split('-'); return dayKey(+d[0], +d[1], +d[2] + n); }
  function weekday(day) { var d = day.split('-'); return new Date(Date.UTC(+d[0], d[1] - 1, +d[2])).getUTCDay(); }
  function todayOf(ms) { var p = parts(ms); return dayKey(p.year, p.month, p.day); }
  function now() {
    var n = window.__cosmicBookingNow || CFG.now, t = n ? Date.parse(n) : NaN;
    return isNaN(t) ? Date.now() : t;
  }
  function iso(ms) { return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z'); }

  /* ---- labels ---- */
  function time(ms) { return fmt({ hour: 'numeric', minute: '2-digit' }).format(new Date(ms)); }
  function hm24(ms) { var p = parts(ms); return (p.hour < 10 ? '0' : '') + p.hour + ':' + (p.minute < 10 ? '0' : '') + p.minute; }
  function span(s) {
    var a = time(s.start), b = time(s.end);
    return (a.slice(-2) === b.slice(-2) ? a.slice(0, -3) : a) + '\u2013' + b;
  }
  function longDay(ms) { return fmt({ weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(ms)); }
  function yourTime(ms) {                               /* "10:00 AM your time" when the visitor is not on Austin time */
    var mine = fmt({ hour: 'numeric', minute: '2-digit' }, true).format(new Date(ms));
    return mine === time(ms) ? '' : mine + ' your time';
  }
  function info(s) {
    if (!s) return null;
    return {
      start: iso(s.start), end: iso(s.end), startMs: s.start, endMs: s.end, date: s.day, time24: hm24(s.start),
      day: longDay(s.start), time: span(s), zone: ZONE, timezone: TZ, title: TITLE,
      when: longDay(s.start) + ', ' + span(s) + ', ' + ZONE, local: yourTime(s.start)
    };
  }

  /* ---- availability ---- */
  function dayList(t) {
    var first = todayOf(t), out = [], n = 0, k = first, guard = 0;
    while (n < AHEAD && guard++ < 70) {
      var work = WORK.indexOf(weekday(k)) >= 0;
      if (work || k === first) out.push({ key: k, today: k === first, work: work, index: work ? n : -1 });
      if (work) n++;
      k = shift(k, 1);
    }
    return out;
  }
  function busyFor(day, remote) {
    var list = [];
    function local(pairs) { pairs.forEach(function (p) { list.push([at(day.key, p[0]), at(day.key, p[1])]); }); }
    if (CFG.busy && CFG.busy[day.key]) local(CFG.busy[day.key]);
    if (CFG.demo && CFG.demoPattern && CFG.demoPattern.length && day.index >= 0) {
      var p = CFG.demoPattern[day.index % CFG.demoPattern.length];
      if (p === 'full') local([[HOURS.start, HOURS.end]]); else if (p) local(p);
    }
    if (CFG.demo) readStore().forEach(function (b) { list.push([Date.parse(b.start), Date.parse(b.end)]); });
    (remote || []).forEach(function (b) { list.push(b); });
    return list;
  }
  function slotsFor(day, t, remote, free) {
    if (!day.work) return [];
    var from = at(day.key, HOURS.start), to = at(day.key, HOURS.end), earliest = t + LEAD;
    var busy = busyFor(day, remote), out = [];
    function clash(s, e) { return busy.some(function (b) { return s < b[1] && e > b[0]; }); }
    function offered(s, e) { return !free || free.some(function (f) { return s >= f[0] && e <= f[1]; }); }
    for (var s = from; s + DUR <= to; s += STEP) {
      var e = s + DUR;
      if (s >= earliest && !clash(s, e) && offered(s, e)) out.push({ start: s, end: e, day: day.key });
    }
    return out;
  }
  function intervals(list) {
    return (list || []).map(function (b) { return [Date.parse(b.start), Date.parse(b.end)]; })
      .filter(function (b) { return !isNaN(b[0]) && !isNaN(b[1]); });
  }

  /* ---- calendar files ---- */
  function stamp(ms) { return iso(ms).replace(/[-:]/g, ''); }          /* 20261117T160000Z */
  function esc(v) { return String(v).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) {                                 /* RFC 5545: lines of at most 75 octets */
    var out = '', n = 0;
    for (var i = 0; i < line.length; i++) {
      var c = line.charAt(i), code = line.charCodeAt(i), b;
      if (code >= 0xD800 && code <= 0xDBFF) { c = line.slice(i, i + 2); i++; b = 4; }
      else b = code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
      if (n + b > 75) { out += '\r\n '; n = 1; }
      out += c; n += b;
    }
    return out;
  }
  function details(s) { return (CFG.details || '') + '\n' + s.when + (s.local ? ' · ' + s.local : '') + '.'; }
  function ics(s, place) {
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cosmic//Walkthrough booking//EN', 'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:' + stamp(s.startMs) + '-' + Math.random().toString(36).slice(2, 10) + '@cosmic-walkthrough',
      'DTSTAMP:' + stamp(Date.now()), 'DTSTART:' + stamp(s.startMs), 'DTEND:' + stamp(s.endMs),
      'SUMMARY:' + esc(TITLE), 'DESCRIPTION:' + esc(details(s))];
    if (place) L.push('LOCATION:' + esc(place));
    L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT1H', 'DESCRIPTION:' + esc(TITLE), 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }
  function google(s, place) {
    var e = encodeURIComponent;
    var p = ['action=TEMPLATE', 'text=' + e(TITLE), 'dates=' + stamp(s.startMs) + '/' + stamp(s.endMs),
      'details=' + e(details(s)), 'ctz=' + e(TZ)];
    if (place) p.push('location=' + e(place));
    return 'https://calendar.google.com/calendar/render?' + p.join('&');
  }
  function download(text, host) {
    var url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
    var a = document.createElement('a');
    a.href = url; a.download = 'cosmic-walkthrough.ics'; a.className = 'f-sr-only'; a.tabIndex = -1;
    (host || document.body).appendChild(a);       /* inside the dialog: the page behind a modal is inert */
    a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 1500);
  }
  function confirm(el, s, place) {
    if (!el) return;
    el.__slot = s || null; el.__place = place || '';
    el.classList.toggle('is-hidden', !s);
    if (!s) return;
    function put(sel, v) { var x = el.querySelector(sel); if (x) { x.textContent = v; x.classList.toggle('is-hidden', !v); } }
    put('[data-booking-when]', s.day);
    put('[data-booking-time]', s.time + ', ' + s.zone + (s.local ? ' · ' + s.local : ''));
    put('[data-booking-where]', place || '');
    var g = el.querySelector('[data-booking-google]');
    if (g) g.href = google(s, place);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-booking-ics]');
    if (!b) return;
    var box = b.closest('[data-booking-confirm]');
    if (box && box.__slot) download(ics(box.__slot, box.__place), box);
  });

  /* ---- one booking root ---- */
  function setup(root) {
    if (root.__booking) return root.__booking;
    function q(s) { return root.querySelector(s); }
    var strip = q('[data-booking-days]'), grid = q('[data-booking-slots]');
    var dayTpl = q('[data-booking-day]').cloneNode(true), slotTpl = q('[data-booking-slot]').cloneNode(true);
    var dayName = dayTpl.querySelector('input').name, slotName = slotTpl.querySelector('input').name;
    strip.innerHTML = ''; grid.innerHTML = '';               /* the samples are templates, never shown */
    var prevB = q('[data-booking-prev]'), nextB = q('[data-booking-next]');
    var pick = q('[data-booking-pick]'), pickText = q('[data-booking-pick-text]'), clearB = q('[data-booking-clear]');
    var note = q('[data-booking-note]'), times = q('[data-booking-times]');
    var fields = {};
    Array.prototype.forEach.call(root.querySelectorAll('[data-booking-field]'), function (f) { fields[f.getAttribute('data-booking-field')] = f; });
    var zoneEl = q('[data-booking-zone]');
    if (zoneEl) zoneEl.textContent = ZONE + ' \u00b7 ' + (DUR / MIN) + '-minute visit';
    var st = { days: [], day: null, slot: null, remote: null, free: null, failed: false, loaded: false, built: false };

    function dayObj(k) { for (var i = 0; i < st.days.length; i++) if (st.days[i].key === k) return st.days[i]; return null; }
    function paint(i) { if (window.cosmicControls) window.cosmicControls.paint(i); }
    function dayInputs() { return Array.prototype.slice.call(strip.querySelectorAll('input[name="' + dayName + '"]')); }
    function say(msg) { if (!note) return; note.textContent = msg; note.classList.toggle('is-hidden', !msg); }

    function build() {
      var t = now();
      st.days = dayList(t);
      st.days.forEach(function (d) { d.slots = st.failed ? [] : slotsFor(d, t, st.remote, st.free); });
      strip.innerHTML = '';
      st.days.forEach(function (d) {
        var el = dayTpl.cloneNode(true), inp = el.querySelector('input'), lab = el.querySelector('label');
        var noon = at(d.key, '12:00'), n = d.slots.length;
        inp.value = d.key; inp.checked = false; inp.disabled = !n; inp.removeAttribute('id');
        inp.setAttribute('aria-label', longDay(noon) + (d.today ? ', today' : '') +
          (n ? ', ' + n + (n === 1 ? ' time free' : ' times free') : ', no free times'));
        lab.classList.remove('is-selected', 'is-focus');
        lab.classList.toggle('is-disabled', !n);
        el.querySelector('[data-booking-dow]').textContent = fmt({ weekday: 'short' }).format(new Date(noon));
        el.querySelector('[data-booking-date]').textContent = fmt({ day: 'numeric' }).format(new Date(noon));
        var meta = el.querySelector('[data-booking-meta]');
        meta.textContent = d.today ? 'Today' : n ? fmt({ month: 'short' }).format(new Date(noon)) : 'Full';
        meta.classList.toggle('f-text-bold', d.today);
        el.setAttribute('data-day', d.key);
        strip.appendChild(el);
      });
      st.built = true;
      var keep = st.day && dayObj(st.day) && dayObj(st.day).slots.length ? st.day : null;
      var first = st.days.filter(function (d) { return d.slots.length; })[0];
      if (st.failed) say('We couldn\u2019t load the free times. Skip for now and we\u2019ll set a time with you by email.');
      else if (!first) say('No free times in the next ' + AHEAD + ' working days. Skip for now and we\u2019ll find one with you.');
      else say(CFG.demo ? 'Sample times: this preview is not connected to Cosmic’s calendar yet.' : '');
      selectDay(keep || (first && first.key) || null, false);
      arrows();
    }

    function selectDay(k, scroll) {
      var d = k && dayObj(k);
      dayInputs().forEach(function (i) { i.checked = !!d && i.value === k; });
      var cur = d && strip.querySelector('[data-day="' + k + '"] input');
      if (cur) paint(cur); else dayInputs().forEach(paint);
      st.day = d ? k : null;
      if (st.slot && st.slot.day !== st.day) setSlot(null);
      if (scroll && cur) cur.closest('[data-day]').scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
      renderSlots();
    }

    function renderSlots() {
      var d = st.day && dayObj(st.day);
      grid.innerHTML = '';
      if (times) times.classList.toggle('is-hidden', !d);
      if (!d) return;
      grid.setAttribute('aria-label', 'Free times on ' + longDay(at(d.key, '12:00')));
      d.slots.forEach(function (s) {
        var el = slotTpl.cloneNode(true), inp = el.querySelector('input');
        inp.value = hm24(s.start); inp.removeAttribute('id');
        inp.checked = !!(st.slot && st.slot.start === s.start);
        inp.setAttribute('aria-label', time(s.start) + ' to ' + time(s.end) + ', ' + ZONE);
        el.classList.toggle('is-selected', inp.checked);
        el.classList.remove('is-focus');
        el.querySelector('[data-booking-time]').textContent = time(s.start);
        el.querySelector('[data-booking-until]').textContent = 'to ' + time(s.end);
        el.__slot = s;
        grid.appendChild(el);
      });
    }

    function setSlot(s) {
      st.slot = s || null;
      var i = info(st.slot);
      if (fields.start) fields.start.value = i ? i.start : '';
      if (fields.end) fields.end.value = i ? i.end : '';
      if (fields.when) fields.when.value = i ? i.when : '';
      if (fields.timezone) fields.timezone.value = i ? TZ : '';
      if (pick) pick.classList.toggle('is-hidden', !i);
      if (pickText) pickText.textContent = i ? i.when + (i.local ? ' · ' + i.local : '') : '';
      root.dispatchEvent(new CustomEvent('cosmic:booking-change', { bubbles: true, detail: i }));
    }

    function clear(focus) {
      Array.prototype.forEach.call(grid.querySelectorAll('input'), function (x) { x.checked = false; paint(x); });
      setSlot(null);
      if (focus) { var f = grid.querySelector('input') || dayInputs().filter(function (x) { return !x.disabled; })[0]; f && f.focus(); }
    }

    /* ---- prev / next and the swipe strip ---- */
    function reduced() { return !!(mqReduce && mqReduce.matches); }
    function arrows() {
      var max = strip.scrollWidth - strip.clientWidth;
      off(prevB, strip.scrollLeft <= 1);
      off(nextB, max <= 1 || strip.scrollLeft >= max - 1);
    }
    function off(b, yes) {
      if (!b) return;
      b.classList.toggle('is-disabled', yes);
      b.setAttribute('aria-disabled', yes ? 'true' : 'false');
    }
    function page(dir) {
      strip.scrollBy({ left: dir * Math.max(strip.clientWidth * 0.8, 1), behavior: reduced() ? 'auto' : 'smooth' });
    }
    if (prevB) prevB.addEventListener('click', function () { if (prevB.getAttribute('aria-disabled') !== 'true') page(-1); });
    if (nextB) nextB.addEventListener('click', function () { if (nextB.getAttribute('aria-disabled') !== 'true') page(1); });
    var raf = 0;
    strip.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; arrows(); }); }, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(function () { arrows(); }).observe(strip);
    else window.addEventListener('resize', arrows, { passive: true });

    /* ---- input ---- */
    root.addEventListener('change', function (e) {
      var t = e.target;
      if (t.name === dayName && root.contains(t)) selectDay(t.value, true);
      else if (t.name === slotName && root.contains(t)) { var l = t.closest('[data-booking-slot]'); setSlot(l && l.__slot); }
    });
    strip.addEventListener('focusin', function (e) {
      var w = e.target.closest && e.target.closest('[data-day]');
      if (w) w.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    strip.addEventListener('keydown', function (e) {
      if (e.target.name !== dayName) return;
      if (e.key === 'Home' || e.key === 'End') {          /* arrows move natively (radios); Home / End jump to the ends */
        var on = dayInputs().filter(function (x) { return !x.disabled; });
        var x = e.key === 'Home' ? on[0] : on[on.length - 1];
        e.preventDefault();
        if (x) { x.focus(); x.checked = true; selectDay(x.value, true); }
      } else if (e.key === 'Enter') {                      /* Enter on a day goes to its times (never submits) */
        e.preventDefault();
        var f = grid.querySelector('input'); f && f.focus();
      }
    });
    if (clearB) clearB.addEventListener('click', function () { clear(true); });

    /* ---- data ---- */
    function refresh(force) {
      if (st.loaded && !force) { build(); return Promise.resolve(); }
      if (typeof CFG.source !== 'function') { st.loaded = true; build(); return Promise.resolve(); }
      var days = dayList(now()), from = at(days[0].key, '00:00'), to = at(shift(days[days.length - 1].key, 1), '00:00');
      say('Checking free times\u2026');
      return Promise.resolve().then(function () {
        return CFG.source({ from: iso(from), to: iso(to), timezone: TZ });
      }).then(function (r) {
        st.remote = r && r.busy ? intervals(r.busy) : null;
        st.free = r && r.slots ? intervals(r.slots) : null;
        st.failed = false; st.loaded = true; build();
      }, function () { st.failed = true; st.loaded = true; build(); });
    }
    function reset() {
      st.slot = null; st.day = null;
      setSlot(null);
      if (st.built || !root.hasAttribute('data-booking-lazy')) build();
    }
    function commit() {
      if (!CFG.demo || !st.slot) return;
      var t = now();
      var list = readStore().filter(function (b) { return Date.parse(b.end) > t; });
      list.push({ start: iso(st.slot.start), end: iso(st.slot.end) });
      writeStore(list);
    }

    root.__booking = {
      root: root, refresh: refresh, reset: reset, clear: clear, commit: commit,
      get: function () { return info(st.slot); },
      days: function () { return st.days; }
    };
    return root.__booking;
  }

  /* ---- the standalone block (Contact): a form[data-booking-form] around a booking root ---- */
  function setupForm(form) {
    var root = form.querySelector('[data-booking]');
    if (!root) return;
    var api = setup(root);
    var block = form.closest('[data-booking-block]') || form.parentNode;
    var hint = form.querySelector('[data-booking-hint]');
    var btn = form.querySelector('[data-booking-submit]'), btnLabel = btn && btn.querySelector('[data-booking-submit-label]');
    var idle = btnLabel ? btnLabel.textContent : '';
    var done = block.querySelector('[data-booking-done]');
    var doneTitle = done && done.querySelector('[data-booking-done-title]');
    var doneConfirm = done && done.querySelector('[data-booking-confirm]');
    var tried = false;
    var ORDER = ['slot', 'name', 'email', 'address', 'privacy'];
    var CHECKS = {
      slot: function () { return api.get() ? '' : 'Pick a day and a time.'; },
      name: function () { return form.elements.name.value.trim() ? '' : 'Add your name.'; },
      email: function () { var f = form.elements.email; return f.value.trim() && f.checkValidity() ? '' : 'Add a valid email.'; },
      address: function () { var f = form.elements.address; return !f || !f.required || f.value.trim() ? '' : 'Add the address we should visit.'; },
      privacy: function () { return form.elements.privacy.checked ? '' : 'Please accept the privacy policy.'; }
    };
    function say(msg) { if (hint) { hint.textContent = ''; requestAnimationFrame(function () { hint.textContent = msg; }); } }
    function mark() {
      ['name', 'email', 'address'].forEach(function (k) {
        var f = form.elements[k]; if (!f) return;
        var bad = tried && !!CHECKS[k]();
        var wrap = f.closest('.c8a8e_root'); if (wrap) wrap.classList.toggle('is-invalid', bad);
        if (bad) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid');
      });
    }
    function first() { for (var i = 0; i < ORDER.length; i++) if (CHECKS[ORDER[i]]()) return ORDER[i]; return ''; }
    function answers() { var o = {}; new FormData(form).forEach(function (v, k) { o[k] = v; }); return o; }
    function waiting(on) {
      if (btn) btn.classList.toggle('is-waiting', on);
      if (btnLabel) btnLabel.textContent = on ? 'Sending\u2026' : idle;
    }
    function place() { var f = form.elements.address; return f ? f.value.trim() : ''; }
    function finish() {
      var s = api.get(), where = place();
      document.dispatchEvent(new CustomEvent('cosmic:booking', { detail: answers() }));
      api.commit();
      confirm(doneConfirm, s, where);
      form.classList.add('is-hidden');
      if (done) done.classList.remove('is-hidden');
      if (doneTitle) doneTitle.focus({ preventScroll: false });
      waiting(false); say('');
    }
    form.addEventListener('input', function () { if (tried) { mark(); if (!first()) say(''); } });
    form.addEventListener('change', function () { if (tried) { mark(); if (!first()) say(''); } });
    root.addEventListener('cosmic:booking-change', function () { if (tried && !first()) say(''); });
    form.addEventListener('submit', function (e) {
      if (!window.Webflow) e.preventDefault();
      tried = true; mark();
      var k = first();
      if (k) {
        if (window.Webflow) e.preventDefault();
        say(CHECKS[k]());
        var target = k === 'slot' ? (root.querySelector('[data-booking-slots] input') ||
          root.querySelector('[data-booking-days] input:not(:disabled)')) : form.elements[k];
        if (target) target.focus();
        return;
      }
      var hold = typeof CFG.book === 'function' ? CFG.book(api.get(), answers()) : null;
      if (window.Webflow) { finish(); return; }          /* Webflow's own handler posts the form */
      var endpoint = form.getAttribute('data-endpoint');
      waiting(true);
      Promise.resolve(hold).then(function () {
        if (!endpoint) return;
        return fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
          .then(function (r) { if (!r.ok) throw new Error(r.status); });
      }).then(finish, function () {
        waiting(false);
        say('That didn\u2019t go through. Try again, or pick another time.');
        api.refresh(true);
      });
    });
    var again = done && done.querySelector('[data-booking-again]');
    if (again) again.addEventListener('click', function () {
      form.reset(); tried = false; mark();
      if (window.cosmicControls) window.cosmicControls.paintAll();
      api.reset();
      done.classList.add('is-hidden');
      form.classList.remove('is-hidden');
      var d = root.querySelector('[data-booking-days] input:checked') || root.querySelector('[data-booking-days] input:not(:disabled)');
      if (d) d.focus();
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-booking]'), function (r) {
      var a = setup(r);
      if (!r.hasAttribute('data-booking-lazy')) a.refresh();
    });
    Array.prototype.forEach.call(document.querySelectorAll('form[data-booking-form]'), setupForm);
  }

  window.cosmicBooking = {
    setup: setup,
    get: function (root) { return setup(root).get(); },
    refresh: function (root, force) { return setup(root).refresh(force); },
    reset: function (root) { setup(root).reset(); },
    clear: function (root) { setup(root).clear(false); },
    commit: function (root) { setup(root).commit(); },
    confirm: confirm, ics: ics, google: google, download: download,
    config: CFG
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
