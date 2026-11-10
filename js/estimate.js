/* estimate: the multi-step estimate request, <dialog id="estimate"> (components/estimate-dialog.html).
   Opens from any a[href="#estimate"], button[data-estimate-open], or on submit of form[data-estimate-open] (its email
   is carried into the contact step). Also opens on load when the URL hash is #estimate.
   Steps are <section data-step="name">; the numbered ones carry data-count. One step shows at a time (.is-active),
   with a short slide (none under reduced motion). Per-step checks live in CHECKS; Next shows the reason in the footer
   hint instead of being disabled, and carries .is-waiting while the step is incomplete.
   Single-choice steps (property, timing) move on by themselves after a pointer pick (never on arrow keys).
   "Change" in the contact summary jumps to a step and its Next returns straight to the summary.
   Submit: inside Webflow the native form handler posts (multi-selects are also joined into services_list /
   areas_list, because Webflow stores each checkbox as its own column); outside Webflow it POSTs FormData to
   data-endpoint when one is set, else it only shows the done step (static prototype). Either way it dispatches
   `cosmic:estimate` on document with the answers. Needs controls.js (selected states, range) and search.js.
   Walkthrough (2026-11-10): an optional "booking" step after contact holds a booking_ root (js/booking.js, loaded
   before this file with js/booking-config.js). With it the request is sent from that step: Next reads "Skip for now"
   until a time is picked, then "Book and send"; the slot travels as visit_start / visit_end / visit_when /
   visit_timezone, shows in the contact summary ("Visit") and on the done step with add-to-calendar buttons. Without
   the step (older markup) or without booking.js, the contact step sends as before. */
(function () {
  'use strict';
  var dlg = document.getElementById('estimate');
  if (!dlg || typeof dlg.showModal !== 'function') return;

  var $ = function (s, r) { return (r || dlg).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || dlg).querySelectorAll(s)); };
  var panel = $('[data-estimate-panel]'), form = $('[data-estimate-form]'), stage = $('[data-estimate-stage]');
  /* the optional walkthrough step needs booking.js; without it the step is dropped and contact sends */
  var visitStep = $('[data-step="booking"]');
  var visitRoot = visitStep && $('[data-booking]', visitStep);
  var booking = visitRoot && window.cosmicBooking ? window.cosmicBooking : null;
  if (visitStep && !booking) { visitStep.parentNode.removeChild(visitStep); visitStep = null; }
  var visitConfirm = $('[data-estimate-visit]');
  var steps = $$('[data-step]');
  var names = steps.map(function (s) { return s.getAttribute('data-step'); });
  var counted = steps.filter(function (s) { return s.hasAttribute('data-count'); });
  var sendStep = names.indexOf('booking') >= 0 ? 'booking' : 'contact';   /* the step whose Next sends the request */
  var foot = $('[data-estimate-foot]'), back = $('[data-estimate-back]'), hint = $('[data-estimate-hint]');
  var nexts = $$('[data-estimate-next]');
  var footNext = $('[data-estimate-next]', foot), footLabel = $('[data-estimate-next-label]', foot);
  var progress = $('[data-estimate-progress]'), bar = $('[data-estimate-bar]');
  var countEl = $('[data-estimate-count]'), totalEl = $('[data-estimate-total]');
  var summary = $('[data-estimate-summary]');
  var closeTop = $('[data-estimate-close-top]');
  var whereBox = $('[data-estimate-where]'), whereText = $('[data-estimate-where-text]');
  var rangeRoot = $('[data-range]'), rangeInput = $('[data-range-input]');
  var mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;

  var cur = 0, busy = false, pointer = false, opener = null, sent = false, returnTo = null, where = null;
  var unitMemory = { sqft: 1500, rooms: 3 };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function cssVar(n, f) { var v = getComputedStyle(dlg).getPropertyValue(n).trim(); return v || f; }
  function ms(v) { var n = parseFloat(v); return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : NaN; }
  function checked(name) { return $$('input[name="' + name + '"]:checked', form).filter(function (i) { return !i.disabled; }); }
  function textOf(input) {
    var l = input.closest('label');
    var t = l && l.querySelector('.choice_label, .check_label, .segmented_label');
    return t ? t.textContent.trim() : input.value;
  }
  function stepEl(name) { return steps[names.indexOf(name)]; }
  function visit() { return booking ? booking.get(visitRoot) : null; }
  function visitPlace() {          /* calendar location: the typed address, else the place picked in the location step */
    var a = form.elements.address ? form.elements.address.value.trim() : '';
    var zip = where && /^\d{5}$/.test(where.value) ? where.value : '';
    if (a) return zip && a.indexOf(zip) < 0 ? a + ', ' + zip : a;
    return where ? (where.display || where.value) + ', TX' : '';
  }

  /* ---- Austin areas for the location search (ZIPs to confirm with Cosmic) ---- */
  var AREAS = [
    ['Downtown', '78701'], ['East Austin', '78702'], ['Holly', '78702'], ['Clarksville', '78703'], ['Tarrytown', '78703'],
    ['Zilker', '78704'], ['Bouldin Creek', '78704'], ['Travis Heights', '78704'], ['Barton Hills', '78704'],
    ['South Congress', '78704'], ['South Lamar', '78704'], ['Hyde Park', '78751'], ['North Loop', '78751'],
    ['Cherrywood', '78722'], ['Mueller', '78723'], ['Windsor Park', '78723'], ['Rosedale', '78756'], ['Crestview', '78757'],
    ['Allandale', '78757'], ['Brentwood', '78757'], ['North Burnet / Domain', '78758'], ['Riverside', '78741'],
    ['Montopolis', '78741'], ['Circle C', '78739'], ['Shady Hollow', '78748'], ['Onion Creek', '78747'],
    ['Westlake', '78746'], ['Rollingwood', '78746'], ['Lakeway', '78734'], ['Bee Cave', '78738'],
    ['Round Rock', '78664'], ['Cedar Park', '78613'], ['Leander', '78641'], ['Pflugerville', '78660'],
    ['Georgetown', '78626'], ['Manor', '78653'], ['Del Valle', '78617'], ['Buda', '78610'], ['Kyle', '78640'],
    ['Dripping Springs', '78620']
  ];
  function isLocal(zip) { return /^78[67]\d\d$/.test(zip); }

  /* ---- per-step checks: '' = complete ---- */
  var CHECKS = {
    property: function () { return checked('property').length ? '' : 'Pick one to continue.'; },
    services: function () { return checked('services').length ? '' : 'Pick at least one.'; },
    location: function () {
      if (where) return '';
      var q = ($('[data-search-input]').value || '').trim();
      return /^\d{5}$/.test(q) ? '' : 'Pick a place from the list, or type a 5-digit ZIP.';
    },
    areas: function () { return checked('areas').length ? '' : 'Pick at least one area.'; },
    timing: function () { return checked('timing').length ? '' : 'Pick one to continue.'; },
    contact: function () {
      var n = form.elements.name, em = form.elements.email, pv = form.elements.privacy;
      if (!n.value.trim()) return 'Add your name.';
      if (!em.value.trim() || !em.checkValidity()) return 'Add a valid email.';
      if (!pv.checked) return 'Please accept the privacy policy.';
      return '';
    }
  };
  function problem(name) { return CHECKS[name] ? CHECKS[name]() : ''; }

  /* ---- chrome: progress, footer, labels ---- */
  function chrome() {
    var s = steps[cur], name = names[cur];
    var n = counted.indexOf(s) + 1, total = counted.length;
    var inFlow = n > 0;
    progress.classList.toggle('is-hidden', !inFlow);
    foot.classList.toggle('is-hidden', !inFlow);
    panel.classList.toggle('is-done', name === 'done');
    if (closeTop) closeTop.classList.toggle('is-invert', name === 'done');   /* cream button on the blue done panel */
    if (inFlow) {
      countEl.textContent = pad(n);
      totalEl.textContent = pad(total);
      bar.style.setProperty('--flwr-progress', ((n / total) * 100).toFixed(2) + '%');
      bar.setAttribute('aria-valuenow', String(n));
      bar.setAttribute('aria-valuemax', String(total));
      bar.setAttribute('aria-valuetext', 'Step ' + n + ' of ' + total);
    }
    var label = 'Next';
    if (name === 'contact') label = sendStep === 'contact' ? 'Send request' : 'Next';
    else if (returnTo) label = 'Back to summary';
    else if (name === 'booking') label = visit() ? 'Book and send' : 'Skip for now';
    else if (name === 'details' && !form.elements.details.value.trim()) label = 'Skip';
    footLabel.textContent = label;
    dlg.setAttribute('aria-labelledby', 'estimate-t-' + name);
    refresh();
  }

  function refresh() {
    var p = problem(names[cur]);
    nexts.forEach(function (b) { b.classList.toggle('is-waiting', !!p); });
    if (!p) clearHint();
  }
  function clearHint() {
    hint.textContent = '';
    hint.classList.remove('is-nudge');
  }

  function say(msg) {
    hint.textContent = '';
    /* re-set on the next frame so the live region announces a repeated message too */
    requestAnimationFrame(function () { hint.textContent = msg; });
    hint.classList.remove('is-nudge');
    void hint.offsetWidth;
    hint.classList.add('is-nudge');
  }

  /* ---- moving between steps ---- */
  function show(i, dir, focusTitle) {
    if (i === cur || i < 0 || i >= steps.length) return;
    if (names[i] === 'areas') syncAreas();
    if (names[i] === 'contact') buildSummary();
    if (names[i] === 'booking' && booking) booking.refresh(visitRoot);
    var from = steps[cur], to = steps[i];
    var reduced = mq && mq.matches;
    var d = reduced ? 0 : (ms(cssVar('--_motion---duration-base', '240ms')) || 240);
    var ease = cssVar('--_motion---ease-standard', 'ease');
    busy = true;
    function swap() {
      from.classList.remove('is-active');
      to.classList.add('is-active');
      cur = i;
      stage.scrollTop = 0;
      clearHint();
      chrome();
      if (focusTitle !== false) { var t = $('.estimate_title', to); t && t.focus({ preventScroll: true }); }
      if (d && to.animate) {
        to.animate([{ opacity: 0, transform: 'translateX(' + (dir * 2) + 'rem)' }, { opacity: 1, transform: 'none' }],
          { duration: d, easing: ease }).finished.then(done, done);
      } else done();
    }
    function done() { busy = false; }
    if (d && from.animate) {
      var a = from.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(' + (-dir * 2) + 'rem)' }],
        { duration: d * 0.6, easing: ease, fill: 'forwards' });
      a.finished.then(function () { swap(); a.cancel(); }, swap);
    } else swap();
  }

  function next() {
    if (busy) return;
    var name = names[cur];
    var p = problem(name);
    if (p) { say(p); focusFirstGap(); return; }
    if (name === 'location' && !where) acceptTypedZip();
    if (returnTo && name !== returnTo) { var r = returnTo; returnTo = null; show(names.indexOf(r), 1); return; }
    if (name === sendStep) { submit(); return; }
    show(cur + 1, 1);
  }
  function prev() {
    if (busy) return;
    returnTo = null;
    show(cur - 1, -1);
  }
  function focusFirstGap() {
    var s = steps[cur];
    var el = $('input:not([type="hidden"]):not(:disabled), textarea', s);
    if (names[cur] === 'contact') {
      ['name', 'email', 'privacy'].some(function (k) {
        var f = form.elements[k];
        var bad = k === 'privacy' ? !f.checked : (!f.value.trim() || !f.checkValidity());
        if (bad) { el = f; return true; }
      });
    }
    el && el.focus({ preventScroll: false });
  }

  /* ---- step 3: location ---- */
  var search = window.cosmicSearch ? window.cosmicSearch($('[data-search]'), {
    items: AREAS.map(function (a) { return { label: a[0], meta: a[1], value: a[1], display: a[0] + ', ' + a[1] }; }),
    freeText: function (q) {
      return /^\d{5}$/.test(q) ? { label: 'Use ZIP ' + q, meta: isLocal(q) ? 'Austin area' : '', value: q, display: q } : null;
    },
    onPick: function (it) { setWhere(it); },
    onClear: function () { setWhere(null); },
    onType: function () { refresh(); }
  }) : null;

  function setWhere(it) {
    where = it;
    if (!it) { whereBox.classList.add('is-hidden'); refresh(); return; }
    var place = it.label.indexOf('Use ZIP') === 0 ? 'ZIP ' + it.value : it.label + ', ' + it.value;
    whereText.textContent = place + ' · ' + (isLocal(it.value)
      ? 'Inside our usual area.' : 'A bit outside our usual area. We’ll still take a look.');
    whereBox.classList.remove('is-hidden');
    refresh();
  }
  function acceptTypedZip() {
    var q = ($('[data-search-input]').value || '').trim();
    if (/^\d{5}$/.test(q) && search) search.pick({ label: 'Use ZIP ' + q, value: q, display: q });
  }

  /* ---- step 4: only the areas of the chosen services (the rest are disabled, so they are not sent) ---- */
  function syncAreas() {
    var chosen = checked('services').map(function (i) { return i.value; });
    $$('[data-for]', form).forEach(function (g) {
      var on = chosen.indexOf(g.getAttribute('data-for')) >= 0 || g.getAttribute('data-for') === 'other';
      g.classList.toggle('is-hidden', !on);
      $$('input', g).forEach(function (i) { i.disabled = !on; });
    });
  }

  /* ---- step 5: size ---- */
  var UNITS = {
    sqft: { min: 250, max: 5000, step: 50, unit: 'sq ft', lo: '250', hi: '5,000+' },
    rooms: { min: 1, max: 12, step: 1, unit: 'rooms', lo: '1', hi: '12+' }
  };
  function setUnit(u) {
    var c = UNITS[u];
    rangeInput.min = c.min; rangeInput.max = c.max; rangeInput.step = c.step;
    rangeInput.value = unitMemory[u];
    rangeRoot.setAttribute('data-range-plus', '');
    $('[data-range-min]', rangeRoot).textContent = c.lo;
    $('[data-range-max]', rangeRoot).textContent = c.hi;
    rangeInput.setAttribute('aria-valuetext', '');
    sizeChanged();
  }
  function unit() { var u = checked('size_unit')[0]; return u ? u.value : 'sqft'; }
  function sizeChanged() {
    var u = unit(), v = +rangeInput.value, c = UNITS[u];
    unitMemory[u] = v;
    window.cosmicControls && window.cosmicControls.range(rangeRoot);
    var unitText = u === 'rooms' ? (v === 1 ? 'room' : 'rooms') : c.unit;
    $('[data-range-unit]', rangeRoot).textContent = unitText;
    var note;
    if (u === 'sqft') {
      note = v < 600 ? 'About a studio or a single room.' : v < 1200 ? 'About an apartment or a small house.'
        : v < 2200 ? 'About a family home.' : v < 3500 ? 'A big home.' : 'A lot of space. We like that.';
    } else {
      note = v === 1 ? 'One room. Quick and tidy.' : v < 5 ? 'A few rooms.' : v < 9 ? 'Most of a home.' : 'The whole place, or close to it.';
    }
    $('[data-range-note]', rangeRoot).textContent = note;
    rangeInput.setAttribute('aria-valuetext', Number(v).toLocaleString('en-US') + (v >= c.max ? '+' : '') + ' ' + unitText);
  }

  /* ---- step 8: summary ---- */
  function buildSummary() {
    var rows = [];
    function add(term, value, goto) { if (value) rows.push([term, value, goto]); }
    add('Property', checked('property').map(textOf).join(''), 'property');
    add('Services', checked('services').map(textOf).join(', '), 'services');
    add('Where', where ? (where.display || where.value) : '', 'location');
    var areas = checked('areas').map(textOf);
    add('Areas', areas.length > 3 ? areas.slice(0, 3).join(', ') + ' +' + (areas.length - 3) : areas.join(', '), 'areas');
    var u = unit(), v = +rangeInput.value;
    add('Size', Number(v).toLocaleString('en-US') + (v >= UNITS[u].max ? '+' : '') + ' ' + $('[data-range-unit]', rangeRoot).textContent, 'size');
    add('Start', checked('timing').map(textOf).join(''), 'timing');
    var det = form.elements.details.value.trim();
    add('Notes', det.length > 70 ? det.slice(0, 70) + '…' : det, 'details');
    var v = visit();
    add('Visit', v ? v.day + ', ' + v.time : '', 'booking');
    summary.innerHTML = '';
    rows.forEach(function (r) {
      var row = document.createElement('div'); row.className = 'estimate_summary_row';
      var dt = document.createElement('dt'); dt.className = 'f-text-micro f-text-bold f-text-uppercase estimate_summary_term'; dt.textContent = r[0];
      var dd = document.createElement('dd'); dd.className = 'f-text-small estimate_summary_value';
      var val = document.createElement('span'); val.textContent = r[1];
      var b = document.createElement('button'); b.type = 'button'; b.className = 'f-text-micro estimate_summary_edit';
      b.textContent = 'Change'; b.setAttribute('aria-label', 'Change ' + r[0].toLowerCase()); b.setAttribute('data-goto', r[2]);
      dd.appendChild(val); dd.appendChild(b); row.appendChild(dt); row.appendChild(dd); summary.appendChild(row);
    });
  }

  /* ---- submit ---- */
  function answers() {
    var o = {};
    new FormData(form).forEach(function (v, k) { if (o[k] === undefined) o[k] = v; else o[k] = [].concat(o[k], v); });
    return o;
  }
  function joinLists() {
    $('[data-estimate-joined="services"]').value = checked('services').map(textOf).join(', ');
    $('[data-estimate-joined="areas"]').value = checked('areas').map(function (i) {
      var g = i.closest('[data-for]'); var t = g && $('.estimate_group_title', g);
      return (t ? t.textContent.trim() + ': ' : '') + textOf(i);
    }).join(', ');
  }
  function finish() {
    sent = true;
    var v = visit();
    if (booking && visitConfirm) booking.confirm(visitConfirm, v, visitPlace());
    if (v) booking.commit(visitRoot);
    document.dispatchEvent(new CustomEvent('cosmic:estimate', { detail: answers() }));
    show(names.indexOf('done'), 1);
  }
  function submit() {
    joinLists();
    if (window.Webflow) {             /* Webflow's own handler posts the form (it listens for submit) */
      if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      finish();
      return;
    }
    var endpoint = form.getAttribute('data-endpoint');
    if (!endpoint) { finish(); return; }
    footNext.classList.add('is-waiting');
    footLabel.textContent = 'Sending…';
    fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); finish(); })
      .catch(function () { chrome(); say('That didn’t go through. Try again, or email us.'); });
  }
  form.addEventListener('submit', function (e) { if (!window.Webflow) e.preventDefault(); });

  /* ---- events inside the dialog ---- */
  nexts.forEach(function (b) { b.addEventListener('click', next); });
  back.addEventListener('click', prev);
  $$('[data-estimate-close]').forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
  summary.addEventListener('click', function (e) {
    var b = e.target.closest('[data-goto]');
    if (!b) return;
    returnTo = 'contact';
    show(names.indexOf(b.getAttribute('data-goto')), -1);
  });
  form.addEventListener('pointerdown', function () { pointer = true; }, true);
  form.addEventListener('keydown', function (e) {
    pointer = false;
    if (e.key !== 'Enter' || e.defaultPrevented) return;
    var t = e.target;
    if (t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.tagName === 'A') return;
    e.preventDefault();
    next();
  });
  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'size_unit') setUnit(t.value);
    if (t.name === 'services') syncAreas();
    refresh();
    if ((t.name === 'property' || t.name === 'timing') && pointer && !returnTo) {
      var here = cur;
      setTimeout(function () { if (cur === here && !busy) next(); }, 320);
    }
  });
  form.addEventListener('cosmic:booking-change', function () { if (names[cur] === 'booking') chrome(); });
  form.addEventListener('input', function (e) {
    if (e.target === rangeInput) sizeChanged();
    if (e.target.name === 'details') chrome(); else refresh();
  });

  /* ---- open / close ---- */
  function reset() {
    form.reset();
    search && search.reset(true);
    where = null; returnTo = null; sent = false;
    whereBox.classList.add('is-hidden');
    if (booking) booking.reset(visitRoot);
    if (visitConfirm) visitConfirm.classList.add('is-hidden');
    unitMemory = { sqft: 1500, rooms: 3 };
    window.cosmicControls && window.cosmicControls.paintAll();
    setUnit('sqft');
    syncAreas();
    steps.forEach(function (s, i) { s.classList.toggle('is-active', i === 0); });
    cur = 0;
    chrome();
  }
  function open(trigger, email) {
    if (sent) reset();
    opener = trigger || null;
    if (email) form.elements.email.value = email;
    // a trigger on a service page (data-cms-service="painting") preselects that service, only while none is chosen
    var svc = trigger && trigger.getAttribute && trigger.getAttribute('data-cms-service');
    if (svc && !checked('services').length) {
      var box = form.querySelector('input[name="services"][value="' + svc + '"]');
      if (box) {
        box.checked = true;
        if (window.cosmicControls) window.cosmicControls.paint(box);
        syncAreas();
      }
    }
    if (!dlg.open) dlg.showModal();
    document.body.style.overflow = 'hidden';
    chrome();
    var t = $('.estimate_title', steps[cur]);
    t && t.focus({ preventScroll: true });
  }
  dlg.addEventListener('close', function () {
    document.body.style.overflow = '';
    if (sent) reset();
    if (location.hash === '#estimate' && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('a[href="#estimate"], a[data-estimate-open], button[data-estimate-open]');
    if (!t || dlg.contains(t)) return;
    e.preventDefault();
    open(t);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f.matches || !f.matches('form[data-estimate-open]')) return;
    e.preventDefault();
    var em = f.querySelector('input[type="email"]');
    open(f.querySelector('[type="submit"]'), em && em.value.trim());
  });

  setUnit('sqft');
  syncAreas();
  chrome();
  if (location.hash === '#estimate') open(null);
  window.cosmicEstimate = { open: open, close: function () { dlg.close(); }, reset: reset };
})();
