/* club-page: the public Good Neighbor Club page (pages/club.html).
   Every number, rule and perk on the page comes from window.COSMIC_CLUB (js/club-config.js, lead-owned draft):
   - [data-club="path.to.value"]        text from the config
   - [data-club-money="path"]           a dollar amount from the config ($1,000)
   - [data-club-list="path"]            a <ul> filled with one <li> per array item
   - [data-club-draft]                  shown (.is-hidden removed) while config.draft is true
   - fee, check-in, credit use, neighborhood rule and the FAQ answers are sentences built here from the config
   Two small demos, both pure maths on the config:
   - referral calculator: three segmented presets (under the minimum, a typical project, past the cap) + a dollar field -> credit earned (floor per full step, cap, minimum)
   - neighborhood perk: how many completed projects nearby -> houses lit (hood_ component) + an Arlo line
   Webflow-safe: state is combo classes (.is-lit, .is-done, .is-hidden, .is-invalid); controls.js paints radios. */
(function () {
  'use strict';
  var C = window.COSMIC_CLUB;
  if (!C) return;

  function get(path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, C);
  }
  function money(n) { return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
  function cap1(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function words(n) {
    var w = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
    return w[n] || String(n);
  }
  function miles(m) {
    if (m === 0.5) return 'half a mile';
    if (m === 0.25) return 'a quarter mile';
    if (m === 1) return 'a mile';
    return m + ' miles';
  }
  function months(n) { return n === 12 ? '12 months' : n + ' months'; }
  function list(arr) {
    if (!arr || !arr.length) return '';
    if (arr.length === 1) return arr[0];
    return arr.slice(0, -1).join(', ') + ' or ' + arr[arr.length - 1];
  }
  function andList(arr) {
    if (!arr || !arr.length) return '';
    if (arr.length === 1) return arr[0];
    return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  }
  function setAll(sel, text) { document.querySelectorAll(sel).forEach(function (el) { el.textContent = text; }); }

  var R = C.referral, CR = C.credit, N = C.neighborhood, M = C.membership, CI = C.checkIn;

  /* ---- plain values ---- */
  document.querySelectorAll('[data-club]').forEach(function (el) {
    var v = get(el.getAttribute('data-club'));
    if (v != null) el.textContent = v;
  });
  document.querySelectorAll('[data-club-money]').forEach(function (el) {
    var v = get(el.getAttribute('data-club-money'));
    if (v != null) el.textContent = money(v);
  });
  document.querySelectorAll('[data-club-list]').forEach(function (ul) {
    (get(ul.getAttribute('data-club-list')) || []).forEach(function (t) {
      var li = document.createElement('li');
      li.className = 'f-text-small club-list_item';
      li.textContent = cap1(t);
      ul.appendChild(li);
    });
  });
  if (C.draft) document.querySelectorAll('[data-club-draft]').forEach(function (el) { el.classList.remove('is-hidden'); });

  /* ---- sentences ---- */
  var free = !M.fee;
  setAll('[data-club-fee-title]', free ? 'No fee' : money(M.fee) + ' a year');
  setAll('[data-club-fee-text]', free ? 'Membership costs nothing. It comes with the work.' : 'The membership fee is ' + money(M.fee) + ' a year.');
  var hoodRule = 'When ' + words(N.unlockAt) + ' Cosmic projects are completed within ' + miles(N.radiusMiles) +
    ' of each other in ' + months(N.windowMonths) + ', every member nearby unlocks a perk.';
  setAll('[data-club-hood-rule]', hoodRule);
  setAll('[data-club-checkin]', CI && CI.complimentary
    ? 'A complimentary check-in every ' + months(CI.everyMonths) + ': ' + CI.what + '.'
    : '');
  var share = Math.round(CR.maxShareOfProject * 100);
  var useText = 'Use it on ' + CR.usableOn + ', for up to ' + share + '% of a project' +
    (CR.expiresMonths ? ', within ' + CR.expiresMonths + ' months' : '') + '.' +
    (CR.cashValue ? '' : ' It has no cash value.');
  setAll('[data-club-use]', useText);

  var answers = {
    member: 'Every Cosmic client with a ' + M.activationTrigger + '. It starts automatically' +
      (free ? ' and costs nothing.' : '; the fee is ' + money(M.fee) + ' a year.'),
    earn: money(R.creditPer) + ' in Cosmic Credit for every ' + (R.creditMode === 'per-full' ? 'full ' : '') + money(R.per) + ' of the referred project, up to ' +
      money(R.capPerProject) + ' per project. Projects under ' + money(R.minProjectValue) + ' don’t earn credit.',
    when: 'When ' + R.paidWhen + '. Nothing is added for a referral that doesn’t go ahead.',
    referred: cap1(R.referredGets) + ', and the same care every Cosmic client gets.',
    use: cap1(CR.usableOn) + '. Credit can cover up to ' + share + '% of a project' +
      (CR.cashValue ? '.' : ' and can’t be exchanged for cash.'),
    expire: CR.expiresMonths ? 'Yes, ' + CR.expiresMonths + ' months after it’s added.' : 'No, it doesn’t expire.',
    hood: hoodRule + ' The perk can be ' + list(N.perks) + '.',
    returning: cap1(andList(C.returning.perks)) + '.'
  };
  document.querySelectorAll('[data-club-answer]').forEach(function (el) {
    el.textContent = answers[el.getAttribute('data-club-answer')] || '';
  });

  /* ---- referral calculator ---- */
  function credit(v) {
    if (!(v >= R.minProjectValue)) return 0;
    var raw = R.creditMode === 'per-full' ? Math.floor(v / R.per) * R.creditPer : Math.round(v * R.creditPer / R.per);
    return Math.min(raw, R.capPerProject);
  }
  var capAt = R.capPerProject / R.creditPer * R.per;          // project value where the cap is reached
  var round = function (v) { return Math.round(v / R.per) * R.per; };
  var presets = [];
  [R.minProjectValue - R.per / 10, round(capAt * 0.8), capAt * 2].forEach(function (v) {
    v = Math.max(R.per / 10, v);
    if (presets.indexOf(v) < 0) presets.push(v);
  });
  presets.sort(function (a, b) { return a - b; });

  var calc = document.querySelector('[data-club-calc]');
  if (calc) {
    var group = calc.querySelector('[data-club-presets]');
    var input = calc.querySelector('[data-club-amount]');
    var help = calc.querySelector('[data-club-amount-help]');
    var out = {
      root: calc.querySelector('[data-club-result]'),
      lead: calc.querySelector('[data-club-result-lead]'),
      value: calc.querySelector('[data-club-result-value]'),
      note: calc.querySelector('[data-club-result-note]')
    };
    var start = round(capAt * 0.8);
    presets.forEach(function (v, i) {
      var l = document.createElement('label');
      l.className = 'segmented_option';
      l.innerHTML = '<input class="f-sr-only segmented_input" type="radio" name="club_preset" value="' + v + '"' +
        (v === start ? ' checked' : '') + '><span class="f-text-small f-text-medium segmented_label">' + money(v) + '</span>';
      group.appendChild(l);
    });
    var helpText = help.textContent;

    function show(v) {
      var c = credit(v);
      out.lead.textContent = 'A ' + money(v) + ' referred project earns you';
      out.value.textContent = money(c);
      if (v < R.minProjectValue) out.note.textContent = 'Projects under ' + money(R.minProjectValue) + ' don’t earn credit.';
      else if (c >= R.capPerProject && v > capAt) out.note.textContent = 'Cosmic Credit. That’s the most one project can earn.';
      else out.note.textContent = 'Cosmic Credit, added once it’s completed and paid.';
      out.root.classList.toggle('is-zero', c === 0);
    }
    function parse(s) {
      var t = String(s).replace(/[$,\s]/g, '');
      if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
      return Math.floor(Number(t));
    }
    function setInvalid(on, msg) {
      input.setAttribute('aria-invalid', on ? 'true' : 'false');
      help.textContent = on ? msg : helpText;
      help.classList.toggle('is-error', on);
      out.root.classList.toggle('is-hidden', on);
    }
    group.addEventListener('change', function (e) {
      if (!e.target.matches('.segmented_input')) return;
      var v = +e.target.value;
      input.value = v.toLocaleString('en-US');
      setInvalid(false);
      show(v);
    });
    input.addEventListener('input', function () {
      var raw = input.value.trim(), v = parse(raw);
      group.querySelectorAll('.segmented_input').forEach(function (r) { r.checked = r.value === String(v); });
      if (window.cosmicControls) window.cosmicControls.paintAll();
      if (raw === '') { setInvalid(false); out.root.classList.add('is-hidden'); return; }
      if (isNaN(v)) { setInvalid(true, 'Use numbers only, for example 4000.'); return; }
      if (v > 1000000) { setInvalid(true, 'That’s more than we can show here. Try a smaller amount.'); return; }
      setInvalid(false);
      show(v);
    });
    calc.addEventListener('submit', function (e) { e.preventDefault(); });
    input.value = start.toLocaleString('en-US');
    show(start);
    if (window.cosmicControls) window.cosmicControls.paintAll();
  }

  /* ---- neighborhood perk demo ---- */
  var hoodTry = document.querySelector('.club-hood_try');
  if (hoodTry) {
    var pick = hoodTry.querySelector('[data-club-hood-pick]');
    var hood = hoodTry.querySelector('[data-hood]');
    var slots = Array.prototype.slice.call(hood.querySelectorAll('[data-hood-slot]'));
    var listEl = hood.querySelector('[data-hood-list]');
    while (slots.length < N.unlockAt) {                      // more houses than the template has: repeat them
      var copy = slots[slots.length % 5].cloneNode(true);
      listEl.appendChild(copy); slots.push(copy);
    }
    slots.forEach(function (s, i) { s.classList.toggle('is-hidden', i >= N.unlockAt); });
    setAll('[data-club-hood-ask]', 'Completed Cosmic projects near you in the last ' + months(N.windowMonths));
    for (var n = 0; n <= N.unlockAt; n++) {
      var l = document.createElement('label');
      l.className = 'segmented_option';
      l.innerHTML = '<input class="f-sr-only segmented_input" type="radio" name="club_hood" value="' + n + '"' +
        (n === 1 ? ' checked' : '') + '><span class="f-text-small f-text-medium segmented_label">' + n +
        (n === N.unlockAt ? '+' : '') + '</span>';
      pick.appendChild(l);
    }
    var line = hoodTry.querySelector('[data-club-hood-line]');
    var count = hood.querySelector('[data-hood-count]');
    var perk = hood.querySelector('[data-hood-perk]');
    function hoodShow(k) {
      slots.forEach(function (s, i) { s.classList.toggle('is-lit', i < k); });
      var done = k >= N.unlockAt, left = N.unlockAt - k;
      hood.classList.toggle('is-done', done);
      perk.classList.toggle('is-lit', done);
      count.textContent = Math.min(k, N.unlockAt) + ' of ' + N.unlockAt + (done ? ': perk unlocked' : '');
      line.textContent = done ? 'Your block has unlocked a neighborhood perk. Nice work, neighbors.'
        : k === 0 ? 'No Cosmic projects near you yet. Refer a neighbor and start the count.'
        : left === 1 ? 'One more completed project nearby unlocks your next neighborhood perk.'
        : cap1(words(left)) + ' more completed projects nearby unlock a perk for your block.';
    }
    pick.addEventListener('change', function (e) {
      if (e.target.matches('.segmented_input')) hoodShow(+e.target.value);
    });
    hoodShow(1);
    if (window.cosmicControls) window.cosmicControls.paintAll();
  }
})();
