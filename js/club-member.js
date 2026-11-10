/* club-member: the Good Neighbor Club member area (pages/club-dashboard.html, pages/club-refer.html).
   Reads the rules from js/club-config.js (window.COSMIC_CLUB) and the member from js/club-demo.js
   (window.COSMIC_CLUB_DEMO); never holds a rate, cap, threshold or perk of its own.
   Dashboard: fills every [data-club="key"] text, and builds the lists by cloning the first [data-club-item] of each
   list (Webflow-safe: the item is real markup). Arlo lines are agent A's arlo_ (in [data-club-arlo] wrappers), the neighborhood houses its hood_. Referral rows are native <details>; the toggle event
   mirrors [open] as .is-open on the row and its plus. Credit-earned celebration: <dialog id="club-celebrate">, opened
   by ?demo=credit or the "Preview: credit added" button: it applies demo.demoCredit (a referral gets completed and
   paid), re-renders, and celebrates the difference.
   Refer page: validates on blur and on submit (messages under each field, a live hint by the button, which carries
   .is-waiting and is never disabled), then submits like the estimate: inside Webflow the native form handler posts,
   outside it POSTs FormData to data-endpoint when one is set, else only shows the confirmation (prototype). Either
   way it dispatches `cosmic:referral` on document with the answers and keeps the referral for this browser session
   (sessionStorage), so the dashboard shows it as Sent. */
(function () {
  'use strict';
  var C = window.COSMIC_CLUB, D = window.COSMIC_CLUB_DEMO;
  if (!C || !D) return;

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var KEY = 'cosmic-club-sent';
  function parse(s) { var p = String(s).split('-'); return new Date(+p[0], (+p[1] || 1) - 1, +(p[2] || 1)); }
  var TODAY = D.today ? parse(D.today) : new Date();
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function monthYear(s) { var d = typeof s === 'string' ? parse(s) : s; return MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function shortDate(s) {
    var d = parse(s);
    return MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getDate() + (d.getFullYear() !== TODAY.getFullYear() ? ', ' + d.getFullYear() : '');
  }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, d.getDate()); }
  function monthsBetween(a, b) { return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function lower(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  function short(name) { var p = name.split(' '); return p[0] + (p[1] ? ' ' + p[1].charAt(0) + '.' : ''); }
  function first(name) { return name.split(' ')[0]; }
  function miles(n) { return (n < 1 ? n.toFixed(1) : String(n)) + ' mi'; }
  function cssVar(n, f) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || f; }
  function ms(v) { var n = parseFloat(v); return /ms$/.test(v) ? n : /s$/.test(v) ? n * 1000 : NaN; }
  var reduced = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;

  function set(key, text) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-club="' + key + '"]'), function (e) { e.textContent = text; });
  }
  function field(el, name) { return el.querySelector('[data-club-field="' + name + '"]'); }
  function fill(list, items, paint) {
    if (!list) return;
    if (!list._proto) { var p = list.querySelector('[data-club-item]'); if (!p) return; list._proto = p.cloneNode(true); }
    list.innerHTML = '';
    items.forEach(function (it, i) { var el = list._proto.cloneNode(true); paint(el, it, i); list.appendChild(el); });
  }
  function readSent() { try { return JSON.parse(sessionStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; } }
  function keepSent(r) { try { var a = readSent(); a.push(r); sessionStorage.setItem(KEY, JSON.stringify(a)); } catch (e) { /* private mode: fine */ } }

  /* ---- the club rules, from config ---- */
  var R = C.referral, K = C.credit, N = C.neighborhood;
  function creditFor(value) {
    if (!value || value < R.minProjectValue) return 0;
    return Math.min(R.capPerProject, rawCredit(value));
  }
  function rawCredit(value) {   /* one rule for both club pages: club-config.js referral.creditMode */
    return R.creditMode === 'per-full' ? Math.floor(value / R.per) * R.creditPer : Math.round(value * R.creditPer / R.per);
  }
  function rateLine() { return money(R.creditPer) + ' per ' + money(R.per); }
  function share() { return K.maxShareOfProject >= 1 ? 'all' : Math.round(K.maxShareOfProject * 100) === 50 ? 'half' : Math.round(K.maxShareOfProject * 100) + '%'; }
  function mathLine(r) {
    if (r.stage === 'sent') return 'We’re getting in touch with ' + first(r.name) + '. Nothing to do on your side.';
    if (!r.paid) {
      return r.estimate
        ? 'Quoted at ' + money(r.estimate) + '. If the final bill matches, you get ' + money(creditFor(r.estimate)) + ' of credit when ' + R.paidWhen + '.'
        : 'Credit is added when ' + R.paidWhen + '.';
    }
    if (r.value < R.minProjectValue) return money(r.value) + ' of completed work. Projects under ' + money(R.minProjectValue) + ' don’t earn credit.';
    var raw = rawCredit(r.value);
    return money(r.value) + ' of completed work at ' + rateLine() + ' = ' + money(raw) + (raw > R.capPerProject ? ', capped at ' + money(R.capPerProject) + ' per project.' : '.');
  }

  /* ---- the member, computed ---- */
  function model(demo) {
    var refs = D.referrals.map(function (r) { var o = {}; for (var k in r) o[k] = r[k]; return o; });
    readSent().forEach(function (s) { refs.push(s); });
    var celebrated = null;
    if (demo && D.demoCredit) {
      refs.forEach(function (r) {
        if (r.id !== D.demoCredit.referral) return;
        r.paid = D.demoCredit.paid; r.value = D.demoCredit.value; r.credited = D.demoCredit.credited; celebrated = r;
      });
    }
    refs.forEach(function (r) {
      r.stage = r.credited ? 'credited' : r.paid ? 'paid' : r.booked ? 'booked' : 'sent';
      r.credit = r.credited ? creditFor(r.value) : 0;
    });
    var earned = refs.reduce(function (s, r) { return s + r.credit; }, 0);
    var used = D.member.creditUsed || 0;
    var since = TODAY.getTime() - N.windowMonths * 30.44 * 864e5;
    var near = [];
    refs.forEach(function (r) {
      if (r.paid && r.miles <= N.radiusMiles && parse(r.paid).getTime() >= since) near.push({ label: short(r.name) + '’s ' + lower(r.need), miles: r.miles, date: r.paid });
    });
    (D.nearby || []).forEach(function (n) { if (n.miles <= N.radiusMiles && parse(n.completed).getTime() >= since) near.push({ label: n.label, miles: n.miles, date: n.completed }); });
    near.sort(function (a, b) { return parse(a.date) - parse(b.date); });
    var pendingNear = refs.filter(function (r) { return !r.paid && r.booked && r.miles <= N.radiusMiles; });
    var projects = D.projects.slice();
    var base = D.member.lastCheckIn || projects[0].completed;
    var due = addMonths(parse(base), C.checkIn.everyMonths);
    return {
      refs: refs, earned: earned, available: earned - used, near: near, pendingNear: pendingNear,
      projects: projects, due: due, dueIn: monthsBetween(TODAY, due), celebrated: celebrated
    };
  }

  /* ============================================================ dashboard */
  var dash = document.querySelector('[data-club-referrals]');
  var current = null;

  /* Arlo's lines (arlo_ component), one next to the thing it is about; '' hides the line */
  function lines(m) {
    var left = N.unlockAt - m.near.length, p = m.pendingNear[0];
    var open = m.refs.filter(function (r) { return r.stage === 'booked' && r.starts; })[0];
    return {
      credit: m.available > 0 ? 'You’ve got ' + money(m.available) + ' to put back into your place.' : '',
      checkin: m.dueIn <= 1 ? 'Looks like your annual check-in is due. It’s on us.'
        : 'Your next check-in is in ' + plural(m.dueIn, 'month', 'months') + '. I’ll remind you.',
      referrals: m.celebrated ? 'Your neighbor’s project is complete. Credit added.'
        : open ? first(open.name) + '’s ' + lower(open.need) + ' starts ' + shortDate(open.starts) + '. I’ll tell you when it’s done.'
        : R.shortLine,
      hood: left <= 0 ? 'Your block unlocked a neighborhood perk. Cosmic will be in touch about which one.'
        : left === 1 ? 'One more completed referral unlocks your next neighborhood perk.' + (p ? ' ' + first(p.name) + '’s could be the one.' : '')
        : left + ' more completed projects nearby unlock a perk for your block.'
    };
  }
  function paintHood(m) {
    var hood = document.querySelector('[data-hood]');
    if (!hood) return;
    var list = hood.querySelector('[data-hood-list]');
    var slots = Array.prototype.slice.call(hood.querySelectorAll('[data-hood-slot]'));
    while (slots.length < N.unlockAt) { var c = slots[slots.length % 5].cloneNode(true); list.appendChild(c); slots.push(c); }
    var k = Math.min(m.near.length, N.unlockAt), done = m.near.length >= N.unlockAt;
    slots.forEach(function (s, i) { s.classList.toggle('is-hidden', i >= N.unlockAt); s.classList.toggle('is-lit', i < k); });
    hood.classList.toggle('is-done', done);
    hood.querySelector('[data-hood-perk]').classList.toggle('is-lit', done);
    hood.querySelector('[data-hood-count]').textContent = k + ' of ' + N.unlockAt + (done ? ': perk unlocked' : '');
  }

  var STEPS = ['sent', 'booked', 'paid', 'credited'];
  var STATUS = { sent: 'Sent', booked: 'Project booked', paid: 'Completed and paid', credited: 'Credit added' };

  function paintReferral(el, r) {
    field(el, 'initials').textContent = r.name.split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
    field(el, 'name').textContent = r.name;
    field(el, 'need').textContent = r.need + (r.area ? ' · ' + r.area : '');
    var tag = field(el, 'status');
    tag.textContent = STATUS[r.stage];
    tag.classList.toggle('is-done', r.stage === 'credited');
    field(el, 'credit').textContent = r.credit ? '+' + money(r.credit) : '';
    var reached = STEPS.indexOf(r.stage);
    Array.prototype.forEach.call(el.querySelectorAll('[data-club-step]'), function (s) {
      var k = s.getAttribute('data-club-step'), i = STEPS.indexOf(k), done = i <= reached;
      ['.referral_dot', '.referral_label', '.referral_connector'].forEach(function (q) {
        var x = s.querySelector(q); x.classList.toggle('is-done', done); x.classList.toggle('is-current', i === reached);
      });
      var date = k === 'sent' ? r.sent : k === 'booked' ? r.booked : k === 'paid' ? r.paid : r.credited;
      var extra = k === 'booked' && r.starts && !r.paid ? 'starts ' + shortDate(r.starts) : k === 'credited' && r.credit ? '+' + money(r.credit) : '';
      field(s, 'date').textContent = date ? shortDate(date) + (extra ? ' · ' + extra : '') : (extra || 'not yet');
      if (i === reached) s.setAttribute('aria-current', 'step'); else s.removeAttribute('aria-current');
    });
    field(el, 'math').textContent = mathLine(r);
    var d = el.querySelector('details');
    d.addEventListener('toggle', function () {
      d.classList.toggle('is-open', d.open);
      field(el, 'indicator').classList.toggle('is-open', d.open);
    });
  }

  function paintRecord(el, p) {
    var icon = document.querySelector('[data-club-icon="' + p.icon + '"] svg') || document.querySelector('[data-club-icon="house"] svg');
    var slot = field(el, 'icon'); slot.innerHTML = ''; if (icon) slot.appendChild(icon.cloneNode(true));
    field(el, 'name').textContent = p.name;
    field(el, 'when').textContent = p.where + ' · completed ' + monthYear(p.completed);
    fill(field(el, 'colors'), p.colors || [], function (li, c) {
      li.querySelector('.record_chip').style.setProperty('--record-swatch', c.hex);
      li.querySelector('[data-club-swatch-text]').textContent = c.where + ' · ' + c.name + (c.code ? ' ' + c.code : '');
    });
    var end = addMonths(parse(p.completed), p.warrantyMonths || 0);
    field(el, 'warranty').textContent = p.warrantyMonths
      ? 'Workmanship, ' + (end > TODAY ? 'until ' : 'ended ') + monthYear(end) : 'None on file';
    field(el, 'finish').textContent = p.finish || '';
    field(el, 'notes').textContent = p.notes || '';
    photo(field(el, 'photo'), p.photo, field(el, 'empty'));
  }

  /* a photo from the data; without one the image goes and the "no photos" line (if any) stays */
  function photo(img, ph, empty) {
    if (!img) return;
    if (!ph) { img.remove(); return; }
    if (empty) empty.remove();
    img.src = 'assets/' + ph.src; img.alt = ph.alt || '';
    if (ph.w) { img.width = ph.w; img.height = ph.h; }
  }

  function render(m) {
    current = m;
    var mem = D.member, prop = D.property, last = m.projects[m.projects.length - 1];
    set('clubName', C.name);
    set('first', mem.first);
    set('memberSince', 'member since ' + monthYear(m.projects[0].completed));
    set('creditAvailable', money(m.available));
    set('creditEarned', money(m.earned));
    set('creditNote', 'Ready to use on ' + K.usableOn + ', for up to ' + share() + ' of a project.');
    set('creditRules', 'Credit expires ' + K.expiresMonths + ' months after it’s added' + (K.cashValue ? '.' : ' and has no cash value.') + ' Draft rules.');
    set('shortLine', R.shortLine);
    set('propertyName', prop.name);
    Array.prototype.forEach.call(document.querySelectorAll('[data-club-photo="property"]'), function (img) { photo(img, prop.photo); });
    set('propertyMeta', prop.area + ', ' + prop.zip + ' · ' + prop.type + ' · built ' + prop.built);
    set('lastProject', last.name);
    set('lastCompleted', monthYear(last.completed));
    set('projectCount', plural(m.projects.length, 'project', 'projects'));
    set('checkinWhen', m.dueIn < 0 || (m.dueIn === 0 && m.due <= TODAY) ? 'Due now' : m.dueIn <= 1 ? 'Due ' + shortDate(iso(m.due)) : 'In ' + plural(m.dueIn, 'month', 'months'));
    set('checkinWhat', (C.checkIn.complimentary ? 'Complimentary' : 'Your') + ' every ' + C.checkIn.everyMonths + ' months: ' + C.checkIn.what + '.');
    var sent = m.refs.length, done = m.refs.filter(function (r) { return r.paid; }).length;
    set('refSent', sent); set('refDone', done); set('refOpen', sent - done);
    set('hoodRule', 'Completed Cosmic projects within ' + N.radiusMiles + ' miles of your place in the last ' + N.windowMonths + ' months.');
    paintHood(m);
    var said = lines(m);
    Array.prototype.forEach.call(document.querySelectorAll('[data-club-arlo]'), function (w) {
      var t = said[w.getAttribute('data-club-arlo')] || '';
      field(w, 'arlo-text').textContent = t;
      w.classList.toggle('is-hidden', !t);
    });
    var ledger = m.refs.filter(function (r) { return r.credit; });
    fill(document.querySelector('[data-club-ledger]'), ledger.length ? ledger : [null], function (li, r) {
      field(li, 'label').textContent = r ? short(r.name) + '’s ' + lower(r.need) : 'No credit yet. It starts with a referral.';
      field(li, 'meta').textContent = r ? '+' + money(r.credit) + ' · ' + MONTHS[parse(r.credited).getMonth()].slice(0, 3) + ' ' + parse(r.credited).getFullYear() : '';
    });
    fill(document.querySelector('[data-club-checkin-list]'), m.projects.slice().reverse(), function (li, p) {
      var age = monthsBetween(parse(p.completed), TODAY);
      field(li, 'label').textContent = p.name;
      field(li, 'meta').textContent = age < 12 ? plural(Math.max(age, 0), 'month', 'months') + ' old' : plural(Math.floor(age / 12), 'year', 'years') + ' old';
    });
    fill(dash, m.refs.slice().reverse(), paintReferral);
    var hood = m.near.map(function (x) { return { label: x.label, meta: miles(x.miles) + ' · ' + MONTHS[parse(x.date).getMonth()].slice(0, 3) }; })
      .concat(m.pendingNear.map(function (r) { return { label: short(r.name) + '’s ' + lower(r.need), meta: miles(r.miles) + ' · booked', pending: true }; }));
    fill(document.querySelector('[data-club-hood-list]'), hood, function (li, x) {
      field(li, 'label').textContent = x.label; field(li, 'meta').textContent = x.meta;
      li.classList.toggle('is-pending', !!x.pending);
    });
    fill(document.querySelector('[data-club-perks]'), N.perks, function (li, p) { li.textContent = p; });
    fill(document.querySelector('[data-club-projects]'), m.projects.slice().reverse(), paintRecord);
    fill(document.querySelector('[data-club-rules-credit]'), [
      R.shortLine,
      'You earn ' + money(R.creditPer) + ' of Cosmic Credit for every ' + money(R.per) + ' of completed referred work, up to ' + money(R.capPerProject) + ' per project.',
      'Credit is added when ' + R.paidWhen + '. Referred projects under ' + money(R.minProjectValue) + ' don’t earn credit.',
      'Use it on ' + K.usableOn + ', for up to ' + share() + ' of a project. It expires after ' + K.expiresMonths + ' months' + (K.cashValue ? '.' : ' and has no cash value.'),
      'The neighbor you refer gets ' + R.referredGets + '.'
    ], function (li, t) { li.textContent = t; });
    fill(document.querySelector('[data-club-rules-perks]'), [
      'Membership is ' + C.membership.activation + ': it starts with your ' + C.membership.activationTrigger + (C.membership.fee ? '.' : ', and it’s free.')
    ].concat(C.returning.perks.map(function (p) { return cap(p) + '.'; })).concat([
      'Neighborhood perk: when ' + N.unlockAt + ' Cosmic projects are completed within ' + N.radiusMiles + ' miles of each other in ' + N.windowMonths + ' months, the block unlocks one.'
    ]), function (li, t) { li.textContent = t; });
  }

  /* ---- credit-earned celebration ---- */
  var cele = document.getElementById('club-celebrate'), opener = null;
  function celebrate(trigger) {
    var before = model(false), after = model(true);
    render(after);
    var r = after.celebrated;
    if (!cele || !r || typeof cele.showModal !== 'function') return;
    opener = trigger || null;
    field(cele, 'amount').textContent = '+' + money(r.credit);
    field(cele, 'text').textContent = first(r.name) + '’s ' + lower(r.need) + ' is complete and paid. ' + money(r.credit) + ' of Cosmic Credit is yours, ready for your next project.';
    var unlocked = before.near.length < N.unlockAt && after.near.length >= N.unlockAt;
    field(cele, 'extra').classList.toggle('is-hidden', !unlocked);
    field(cele, 'extra-text').textContent = 'That makes ' + after.near.length + ' completed projects near you: your block unlocked a neighborhood perk.';
    if (!cele.open) cele.showModal();
    document.body.style.overflow = 'hidden';
    var t = cele.querySelector('.celebrate_title'); t && t.focus({ preventScroll: true });
    var panel = cele.querySelector('[data-club-celebrate-panel]');
    var d = reduced && reduced.matches ? 0 : (ms(cssVar('--_motion---duration-slow', '400ms')) || 400);
    if (d && panel.animate) {
      panel.animate([{ opacity: 0, transform: 'translateY(1.5rem) scale(0.97)' }, { opacity: 1, transform: 'none' }],
        { duration: d, easing: cssVar('--_motion---ease-emphasized', 'ease-out') });
    }
  }
  if (cele) {
    cele.addEventListener('close', function () {
      document.body.style.overflow = '';
      if (opener && opener.focus) opener.focus({ preventScroll: true });
    });
    cele.querySelector('[data-club-celebrate-close]').addEventListener('click', function () { cele.close(); });
    cele.querySelector('[data-club-celebrate-see]').addEventListener('click', function () {
      opener = null;
      cele.close();
      var c = document.getElementById('credit');
      if (c) { c.scrollIntoView({ behavior: reduced && reduced.matches ? 'auto' : 'smooth', block: 'start' }); var h = c.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
    });
    cele.addEventListener('click', function (e) { if (e.target === cele) cele.close(); });   /* backdrop click */
  }

  if (dash) {
    render(model(false));
    var demoBtn = document.querySelector('[data-club-demo-credit]');
    if (demoBtn) demoBtn.addEventListener('click', function () { celebrate(demoBtn); });
    if (/[?&]demo=credit\b/.test(location.search)) celebrate(null);
  }

  /* ============================================================ refer page */
  var form = document.querySelector('[data-club-refer]');
  if (!form) return;
  var done = document.querySelector('[data-club-refer-done]');
  var hint = form.querySelector('[data-club-hint]'), submitBtn = form.querySelector('[data-club-submit]');
  var label = form.querySelector('[data-club-submit-label]');
  var touched = {}, tried = false;

  set('shortLine', R.shortLine);
  set('sendingAs', 'Sending as ' + D.member.first + ' ' + D.member.last + (D.sample ? ' (sample account).' : '.'));
  form.querySelector('[data-club-member-id]').value = D.member.id;
  fill(document.querySelector('[data-club-refer-steps]'), [
    'Tell us who they are and what they need.',
    'We get in touch, only because they said it’s OK.',
    'They get ' + R.referredGets + '.',
    'When ' + R.paidWhen + ', you get ' + rateLine() + ' of their work in Cosmic Credit, up to ' + money(R.capPerProject) + '.'
  ], function (li, t, i) { field(li, 'n').textContent = String(i + 1); field(li, 'text').textContent = t; });

  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function needs() { return Array.prototype.slice.call(form.querySelectorAll('input[name="needs"]:checked')); }
  var CHECKS = {
    name: function () { return form.elements.neighbor_name.value.trim() ? '' : 'Add their name.'; },
    contact: function () {
      var v = form.elements.neighbor_contact.value.trim(), digits = v.replace(/\D/g, '');
      if (!v) return 'Add an email or a phone number we can use.';
      if (EMAIL.test(v) || (/^[\d\s()+.-]+$/.test(v) && digits.length >= 10 && digits.length <= 11)) return '';
      return v.indexOf('@') >= 0 ? 'That email doesn’t look complete.' : 'Use a full email, or a 10-digit phone number.';
    },
    needs: function () { return needs().length ? '' : 'Pick at least one. “Not sure yet” is fine.'; },
    consent: function () { return form.elements.consent.checked ? '' : 'Please confirm they’re happy for us to contact them.'; }
  };
  var ORDER = ['name', 'contact', 'needs', 'consent'];
  var ERR = { name: 'refer-name', contact: 'refer-contact', needs: 'refer-needs', consent: 'refer-consent' };
  function target(k) { return form.querySelector('[data-club-check="' + k + '"]'); }
  function show(k, msg) {
    var box = form.querySelector('[data-club-error="' + ERR[k] + '"]');
    box.querySelector('[data-club-error-text]').textContent = msg;
    box.classList.toggle('is-hidden', !msg);
    var t = target(k);
    (t.tagName === 'FIELDSET' ? form.querySelectorAll('input[name="needs"]') : [t]).forEach(function (i) {
      if (msg) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid');
    });
  }
  function problems() { return ORDER.filter(function (k) { return CHECKS[k](); }); }
  function refresh() {
    ORDER.forEach(function (k) { if (touched[k] || tried) show(k, CHECKS[k]()); });
    var p = problems();
    submitBtn.classList.toggle('is-waiting', p.length > 0);
    if (!p.length) hint.textContent = '';
    else if (tried) hint.textContent = p.length === 1 ? '1 thing to fix before sending.' : p.length + ' things to fix before sending.';
  }
  form.addEventListener('focusout', function (e) {
    var k = e.target.getAttribute('data-club-check') || (e.target.name === 'needs' ? 'needs' : null);
    if (!k) return;
    if (k === 'needs' && form.querySelector('fieldset').contains(e.relatedTarget)) return;   /* still inside the group */
    touched[k] = true; refresh();
  });
  form.addEventListener('input', refresh);
  form.addEventListener('change', function (e) { if (e.target.name === 'needs' || e.target.name === 'consent') touched[e.target.name] = true; refresh(); });

  function answers() {
    var o = {};
    new FormData(form).forEach(function (v, k) { if (o[k] === undefined) o[k] = v; else o[k] = [].concat(o[k], v); });
    return o;
  }
  function needText() { return needs().map(function (i) { return i.closest('label').querySelector('.check_label').textContent.trim(); }); }
  function finish() {
    var a = answers(), name = form.elements.neighbor_name.value.trim(), contact = form.elements.neighbor_contact.value.trim();
    document.dispatchEvent(new CustomEvent('cosmic:referral', { detail: a }));
    keepSent({ id: 's' + Date.now(), name: name, need: needText().join(', '), sent: iso(TODAY) });
    field(done, 'done-text').textContent = 'We’ll get in touch with ' + name + ' by ' + (EMAIL.test(contact) ? 'email' : 'phone') + '.';
    field(done, 'done-status').textContent = first(name) + ' is in your referrals as Sent. Your credit lands when ' + R.paidWhen.replace(/^the referred project/, 'their project') + '.';
    form.classList.add('is-hidden');
    done.classList.remove('is-hidden');
    var t = done.querySelector('.club-refer_done_title'); t && t.focus({ preventScroll: true });
    var top = done.getBoundingClientRect().top;
    if (top < 0) done.scrollIntoView({ block: 'start', behavior: reduced && reduced.matches ? 'auto' : 'smooth' });
  }
  form.addEventListener('submit', function (e) {
    tried = true;
    form.querySelector('[data-club-needs-joined]').value = needText().join(', ');
    var p = problems();
    refresh();
    if (p.length) {
      e.preventDefault();
      hint.textContent = '';
      requestAnimationFrame(function () { hint.textContent = p.length === 1 ? '1 thing to fix before sending.' : p.length + ' things to fix before sending.'; });
      var t = target(p[0]);
      (t.tagName === 'FIELDSET' ? t.querySelector('input') : t).focus();
      return;
    }
    if (window.Webflow) { finish(); return; }          /* Webflow's own handler posts the form */
    e.preventDefault();
    var endpoint = form.getAttribute('data-endpoint');
    if (!endpoint) { finish(); return; }
    submitBtn.classList.add('is-waiting');
    label.textContent = 'Sending…';
    fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); label.textContent = 'Send referral'; finish(); })
      .catch(function () { label.textContent = 'Send referral'; submitBtn.classList.remove('is-waiting'); hint.textContent = 'That didn’t go through. Try again, or email us.'; });
  });
  done.querySelector('[data-club-refer-again]').addEventListener('click', function () {
    form.reset(); touched = {}; tried = false;
    ORDER.forEach(function (k) { show(k, ''); });
    window.cosmicControls && window.cosmicControls.paintAll();
    done.classList.add('is-hidden'); form.classList.remove('is-hidden');
    refresh();
    form.elements.neighbor_name.focus();
  });
  refresh();
})();
