/* diy-finder: the Project Finder, its "Your DIY plan", and "Continue where you left off" on the DIY landing.
   Needs js/diy-content.js and js/diy-search.js (window.cosmicDiy) first; js/controls.js paints the choice_ tiles and
   check_ rows (.is-selected / .is-focus).
   Finder: four <fieldset data-finder-step> with choice_ radios, one shown at a time. Next never disables: it shows the
   reason in the aria-live hint and carries .is-waiting (as the estimate does). A pointer pick moves on by itself
   (never arrow keys). Step 2 shows only the surfaces for the answer to step 1 (data-where). The plan comes from
   COSMIC_DIY.finder: the first rule whose `when` matches picks the guide; conditionNotes / goalNotes add "Before you
   start" notes; an escalate rule that matches shows the quiet estimate offer with its reason (never otherwise).
   Shopping list = the guide's `needs`, as check_ rows: ticked = "I already own this", kept per guide in
   localStorage <prefix><guideId> = { owned: [needId], ... } (other keys in that object, e.g. a guide page's steps,
   are kept as they are). The last plan is kept in <prefix>finder = { answers, guide, at }.
   Resume strip: the last plan + up to 3 recent items (<prefix>recent) with step progress when the guide page stored
   one ({ done: [...] } or { steps: [...] }). Every storage access is guarded (diy-search.js read/write). */
(function () {
  'use strict';
  var X = window.cosmicDiy, D = window.COSMIC_DIY;
  if (!X || !D) return;
  var F = D.finder;
  var KIND = { guide: 'Guide', answer: 'Quick answer', tool: 'Tool', download: 'Download', pack: 'Project pack', product: 'What we\'d use' };
  var MARK = '<svg class="check_mark" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M4.5 12.5l5 5 10-11" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function matches(when, a) { return Object.keys(when).every(function (k) { return when[k].indexOf(a[k]) >= 0; }); }
  function link(it, cls, text) {
    return '<a class="' + cls + '" href="' + esc(it.url) + '"' + (it.pending ? ' data-diy-pending' : '') +
      ' data-diy-open="' + esc(it.id) + '">' + esc(text || it.title) + '</a>';
  }

  /* ---------- deep link to an inline answer ---------- */
  if (/^#answer-/.test(location.hash)) {
    var aid = location.hash.slice(8);
    if (X.item(aid)) setTimeout(function () { X.openAnswer(aid); }, 60);
  }
  /* answer links in the plan open the inline answer instead of jumping */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-diy-answer-link]');
    if (!a) return;
    if (X.openAnswer(a.getAttribute('data-diy-answer-link'))) e.preventDefault();
  });

  /* ---------- Project Finder ---------- */
  var root = document.querySelector('[data-finder]');
  if (root) (function () {
    var $ = function (s) { return root.querySelector(s); };
    var form = $('[data-finder-form]');
    var steps = Array.prototype.slice.call(root.querySelectorAll('[data-finder-step]'));
    var names = steps.map(function (s) { return s.getAttribute('data-finder-step'); });
    var plan = $('[data-finder-plan]'), back = $('[data-finder-back]'), next = $('[data-finder-next]');
    var backLabel = $('[data-finder-back-label]'), nextLabel = $('[data-finder-next-label]'), hint = $('[data-finder-hint]');
    var progress = $('[data-finder-progress]'), bar = $('[data-finder-bar]'), count = $('[data-finder-count]');
    var art = $('[data-finder-art]');
    var ART = { q: 'assets/diy-cosmo-03.svg', plan: 'assets/diy-cosmo-what-50.svg' };
    var cur = 0, pointer = false, advanceTimer = 0, guideId = null;
    var total = names.length;

    function val(name) { var i = form.querySelector('input[name="' + name + '"]:checked'); return i ? i.value : ''; }
    function labelOf(name) {
      var i = form.querySelector('input[name="' + name + '"]:checked');
      var l = i && i.closest('label').querySelector('.choice_label');
      return l ? l.textContent.trim() : '';
    }
    function answers() { var a = {}; names.forEach(function (n) { a[n] = val(n); }); return a; }

    function filterSurfaces() {
      var w = val('where');
      root.querySelectorAll('[data-finder-step="surface"] .choice_card[data-where]').forEach(function (t) {
        var where = t.getAttribute('data-where');
        var hide = !!w && where !== 'both' && where !== w;
        t.classList.toggle('is-hidden', hide);
        var input = t.querySelector('input');
        input.disabled = hide;
        if (hide && input.checked) { input.checked = false; if (window.cosmicControls) window.cosmicControls.paint(input); }
      });
    }
    function problem() { return cur < total && !val(names[cur]) ? 'Pick one to continue.' : ''; }
    function refresh() {
      var p = problem();
      next.classList.toggle('is-waiting', !!p);
      if (!p) hint.textContent = '';
    }
    function say(msg) {
      hint.textContent = '';
      requestAnimationFrame(function () { hint.textContent = msg; });
    }
    function show(i, focus) {
      clearTimeout(advanceTimer);
      cur = i;
      var onPlan = i >= total;
      steps.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
      plan.classList.toggle('is-hidden', !onPlan);
      progress.classList.toggle('is-hidden', onPlan);
      if (!onPlan) {
        count.textContent = pad(i + 1);
        bar.style.setProperty('--flwr-progress', (((i + 1) / total) * 100).toFixed(2) + '%');
        bar.setAttribute('aria-valuenow', String(i + 1));
        bar.setAttribute('aria-valuetext', 'Question ' + (i + 1) + ' of ' + total);
      }
      back.classList.toggle('is-hidden', i === 0);
      backLabel.textContent = onPlan ? 'Change answers' : 'Back';
      next.classList.toggle('is-hidden', onPlan);
      nextLabel.textContent = i === total - 1 ? 'See my plan' : 'Next';
      if (art) art.src = onPlan ? ART.plan : ART.q;
      if (names[i] === 'surface') filterSurfaces();
      refresh();
      if (focus) {
        var t = onPlan ? plan.querySelector('#finder-plan-title') : steps[i].querySelector('legend');
        if (t) t.focus({ preventScroll: true });
        var top = root.getBoundingClientRect().top;
        if (top < 0 || top > window.innerHeight * 0.6) root.scrollIntoView({ behavior: mq && mq.matches ? 'auto' : 'smooth', block: 'start' });
      }
    }
    function goNext() {
      var p = problem();
      if (p) { say(p); return; }
      if (cur === total - 1) { buildPlan(); show(total, true); }
      else show(cur + 1, true);
    }
    function goBack() { if (cur > 0) show(cur - 1, true); }

    next.addEventListener('click', goNext);
    back.addEventListener('click', goBack);
    form.addEventListener('submit', function (e) { e.preventDefault(); goNext(); });
    form.addEventListener('pointerdown', function (e) { if (e.target.closest('.choice_card')) pointer = true; });
    form.addEventListener('keydown', function (e) {
      pointer = false;
      /* Enter on a tile moves on (radios do not submit a form natively); the plan's checkboxes keep Enter */
      if (e.key === 'Enter' && e.target.matches('.choice_input') && cur < total) { e.preventDefault(); goNext(); }
    });
    form.addEventListener('change', function (e) {
      if (!e.target.matches('.choice_input')) return;
      if (e.target.name === 'where') filterSurfaces();
      refresh();
    });
    /* pointer pick moves on; click (not change) so re-picking the answer that is already chosen after Back moves on too */
    form.addEventListener('click', function (e) {
      if (!e.target.matches || !e.target.matches('.choice_input') || !pointer || cur >= total) return;
      pointer = false;
      clearTimeout(advanceTimer);
      advanceTimer = setTimeout(goNext, mq && mq.matches ? 0 : 280);
    });

    /* ---- the plan ---- */
    var el = {
      answers: $('[data-plan-answers]'), kicker: $('[data-plan-kicker]'), guide: $('[data-plan-guide]'),
      summary: $('[data-plan-summary]'), facts: $('[data-plan-facts]'), notesWrap: $('[data-plan-notes-wrap]'),
      notes: $('[data-plan-notes]'), start: $('[data-plan-start]'), relWrap: $('[data-plan-related-wrap]'),
      rel: $('[data-plan-related]'), needs: $('[data-plan-needs]'), count: $('[data-plan-count]'),
      copy: $('[data-plan-copy]'), copied: $('[data-plan-copied]'), offer: $('[data-plan-offer]'),
      reason: $('[data-plan-offer-reason]'), offerLink: $('[data-plan-offer-link]')
    };
    function fact(label, value, dots) {
      return '<div class="guide_fact"><dt class="f-text-micro guide_fact_label">' + esc(label) + '</dt>' +
        '<dd class="f-text-small f-text-medium guide_fact_value">' + (dots ? '<span class="guide_level is-' + dots + '" aria-hidden="true"><span class="guide_dot is-1"></span><span class="guide_dot is-2"></span><span class="guide_dot is-3"></span></span>' : '') + esc(value) + '</dd></div>';
    }
    function store(id) { var o = X.read(id, {}); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; }
    function ownedCount() {
      var boxes = el.needs.querySelectorAll('.check_input');
      var left = 0;
      boxes.forEach(function (b) { if (!b.checked) left++; });
      el.count.textContent = 'Tick what you already own. ' + left + ' of ' + boxes.length + ' to buy.';
    }
    function buildPlan() {
      var a = answers();
      var rule = F.rules.filter(function (r) { return matches(r.when, a); })[0] || F.rules[F.rules.length - 1];
      var g = X.item(rule.guide);
      guideId = g.id;
      var m = g.meta || {};
      el.answers.textContent = names.map(labelOf).filter(Boolean).join(' · ');
      el.kicker.textContent = rule.closest ? 'Closest guide' : 'Recommended guide';
      el.guide.textContent = g.title;
      el.guide.href = g.url;
      el.guide.setAttribute('data-diy-open', g.id);
      el.guide.toggleAttribute('data-diy-pending', !!g.pending);
      el.summary.textContent = g.summary;
      var facts = fact('Skill', X.level[m.difficulty] || '', m.difficulty) + fact('DIY time', m.time) +
        fact('Materials', m.cost) + fact('Steps', m.steps + ' steps') + fact('Tools & materials', (g.needs || []).length + ' items');
      if (m.proTime) facts += fact('Pro crew', m.proTime.charAt(0).toUpperCase() + m.proTime.slice(1));
      el.facts.innerHTML = facts;

      /* before you start */
      var notes = [], extraAnswers = [], extraGuides = [], safety = false;
      [[F.conditionNotes, a.condition], [F.goalNotes, a.goal]].forEach(function (p) {
        var n = p[0] && p[0][p[1]];
        if (!n || (n.whereOnly && n.whereOnly !== a.where)) return;
        notes.push(n.note);
        extraAnswers = extraAnswers.concat(n.answers || []);
        extraGuides = extraGuides.concat(n.guides || []);
        if (n.safety) safety = true;
      });
      if (a.where === 'exterior' && (a.condition === 'peeling' || a.goal === 'strip' || a.goal === 'repair')) safety = true;
      var html = notes.map(function (t) { return '<li class="f-text-small diy-plan_note">' + esc(t) + '</li>'; }).join('');
      extraGuides.filter(function (id) { return id !== g.id; }).forEach(function (id) {
        var eg = X.item(id);
        html += '<li class="f-text-small diy-plan_note">First: ' + link(eg, 'diy-link') + ' (' + esc(eg.meta.time) + ', ' + esc(eg.meta.cost) + ').</li>';
      });
      if (safety) html += '<li class="f-text-small diy-plan_note is-safety"><strong>Safety:</strong> ' + esc(F.safety) + '</li>';
      el.notes.innerHTML = html;
      el.notesWrap.classList.toggle('is-hidden', !html);

      /* start */
      el.start.href = g.url;
      el.start.setAttribute('data-diy-open', g.id);
      el.start.toggleAttribute('data-diy-pending', !!g.pending);

      /* also useful: answers (inline), the pack, a checklist, the calculator */
      var rel = g.related || {}, seen = {}, rows = [];
      extraAnswers.concat(rel.answers || []).forEach(function (id) {
        if (seen[id] || rows.length >= 3) return;
        seen[id] = 1;
        var it = X.item(id);
        rows.push('<li class="f-text-small"><span class="diy-plan_kind">Quick answer: </span><a class="diy-link" href="#answer-' + esc(id) + '" data-diy-answer-link="' + esc(id) + '">' + esc(it.title) + '</a></li>');
      });
      [['packs', 'Project pack'], ['tools', 'Tool'], ['downloads', 'Checklist']].forEach(function (p) {
        var id = (rel[p[0]] || [])[0];
        if (id) rows.push('<li class="f-text-small"><span class="diy-plan_kind">' + p[1] + ': </span>' + link(X.item(id), 'diy-link') + '</li>');
      });
      el.rel.innerHTML = rows.join('');
      el.relWrap.classList.toggle('is-hidden', !rows.length);

      /* shopping list */
      var mine = store(g.id).owned || [];
      el.needs.innerHTML = (g.needs || []).map(function (n) {
        return '<label class="f-text-small check_item is-list"><input class="f-sr-only check_input" type="checkbox" name="owned" value="' + esc(n.id) + '"' + (mine.indexOf(n.id) >= 0 ? ' checked' : '') + '>' +
          '<span class="check_box">' + MARK + '</span><span class="check_label">' + esc(n.label) + '</span></label>';
      }).join('');
      if (window.cosmicControls) window.cosmicControls.paintAll();
      ownedCount();
      el.copied.textContent = '';

      /* the quiet offer: only when a rule says the project usually outgrows a weekend */
      var esc8 = (F.escalate || []).filter(function (r) { return matches(r.when, a); })[0];
      var reason = esc8 ? esc8.reason : (m.difficulty === 'advanced' ? 'This one is rated advanced.' : '');
      el.offer.classList.toggle('is-hidden', !reason);
      el.reason.textContent = reason;
      var svc = X.item((rel.services || [])[0]);
      el.offerLink.setAttribute('data-diy-estimate', svc && svc.estimateService ? svc.estimateService : '');

      X.write('finder', { answers: a, guide: g.id, at: Date.now() });
      X.emit({ action: 'finder-plan', answers: a, guide: g.id, offer: !!reason });
    }
    el.needs.addEventListener('change', function (e) {
      if (!guideId || !e.target.matches('.check_input')) return;
      var o = store(guideId);
      o.owned = Array.prototype.slice.call(el.needs.querySelectorAll('.check_input:checked')).map(function (i) { return i.value; });
      X.write(guideId, o);
      ownedCount();
    });
    el.copy.addEventListener('click', function () {
      var g = X.item(guideId);
      if (!g) return;
      var left = Array.prototype.slice.call(el.needs.querySelectorAll('.check_input')).filter(function (i) { return !i.checked; })
        .map(function (i) { return '- ' + i.closest('label').querySelector('.check_label').textContent; });
      var text = 'Shopping list: ' + g.title + '\n' + left.join('\n') + '\n' + location.href.split('#')[0] + '#finder';
      function done(ok) { el.copied.textContent = ok ? 'Copied ' + left.length + (left.length === 1 ? ' item.' : ' items.') : 'Copy did not work here; select the list and copy it.'; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallback(text)); });
      else done(fallback(text));
    });
    function fallback(text) {
      var t = document.createElement('textarea');
      t.value = text;
      t.setAttribute('readonly', '');
      t.className = 'f-sr-only';
      document.body.appendChild(t);
      t.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(t);
      return ok;
    }

    /* restore a saved plan (from the resume strip) */
    window.cosmicDiy.restorePlan = function () {
      var last = X.read('finder', null);
      if (!last || !last.answers) return false;
      names.forEach(function (n) {
        var i = form.querySelector('input[name="' + n + '"][value="' + last.answers[n] + '"]');
        if (i) { i.checked = true; if (window.cosmicControls) window.cosmicControls.paint(i); }
        if (n === 'where') filterSurfaces();
      });
      if (names.some(function (n) { return !val(n); })) { show(0, true); return true; }
      buildPlan();
      show(total, true);
      return true;
    };

    show(0, false);
  })();

  /* ---------- continue where you left off ---------- */
  var resume = document.querySelector('[data-diy-resume]');
  if (resume) (function () {
    var list = resume.querySelector('[data-diy-resume-list]');
    function progressOf(it) {
      if (it.type !== 'guide') return '';
      var o = X.read(it.id, null), done = o && (o.done || o.steps);
      var n = Array.isArray(done) ? done.length : 0;
      return n && it.meta && it.meta.steps ? ' · ' + n + ' of ' + it.meta.steps + ' steps done' : '';
    }
    function row(kind, title, href, attrs) {
      return '<li><a class="diy-resume_item" href="' + esc(href) + '"' + (attrs || '') + '><span class="f-text-micro f-text-bold f-text-uppercase diy-resume_kind">' + esc(kind) + '</span><span class="f-text-small f-text-medium">' + esc(title) + '</span></a></li>';
    }
    function render() {
      var html = '', last = X.read('finder', null), lg = last && X.item(last.guide);
      if (lg && document.querySelector('[data-finder]')) html += row('Your last plan', lg.title, '#finder', ' data-diy-resume-plan');
      X.recent().slice(0, 3).forEach(function (r) {
        var it = X.item(r.id);
        html += row((KIND[it.type] || 'Recent') + progressOf(it), it.title, it.url, (it.pending ? ' data-diy-pending' : '') + ' data-diy-open="' + esc(it.id) + '"');
      });
      list.innerHTML = html;
      resume.classList.toggle('is-hidden', !html);
    }
    list.addEventListener('click', function (e) {
      var a = e.target.closest('[data-diy-resume-plan]');
      if (!a || !window.cosmicDiy.restorePlan) return;
      e.preventDefault();
      window.cosmicDiy.restorePlan();
    });
    resume.querySelector('[data-diy-resume-clear]').addEventListener('click', function () {
      X.write('recent', null);
      X.write('finder', null);
      render();
      var h = document.getElementById('diy-q');
      if (h) h.focus({ preventScroll: true });
    });
    document.addEventListener('cosmic:diy-recent', render);
    render();
  })();
})();
