/* diy-search: the DIY helpers (window.cosmicDiy) and the hero search "What are you trying to fix?".
   Needs js/diy-content.js (window.COSMIC_DIY) loaded first; controls.js and estimate.js are optional (used when the
   estimate dialog is on the page).
   Search: mixed-type results grouped by type (Guides, Quick answers, Tools, Downloads, Packs, What we'd use, Services,
   Categories), ranked by match quality times an intent boost read from COSMIC_DIY.search.intents (a question ranks
   answers first, "paint/fix/repair..." ranks guides and packs first, "how much/gallons" the calculator, "checklist"
   the downloads, "hire/pro" the services). Markup is the search_ component (components/search-field.html) with
   grouped options: <li role="group" class="search_group"> > title + <ul> of role="option" items.
   Keys as search.js: Down/Up move (across groups), Enter opens, Escape closes then clears, Tab closes.
   Opening a result: guides, tools, downloads, packs and categories navigate (and are remembered in "recent");
   a quick answer opens inline in the Popular problems list; a product scrolls to its card; a service opens #estimate
   with that service ticked. Every pick fires `cosmic:diy` on document ({action:'search', q, id, type}) so intent can
   be measured later. localStorage keys: <prefix>recent = [{id, at}] (newest first, max 8); every access guarded. */
(function () {
  'use strict';
  var D = window.COSMIC_DIY;
  if (!D) return;
  var P = D.storagePrefix || 'cosmic-diy:v1:';
  var items = {}, cats = {};
  D.items.forEach(function (i) { items[i.id] = i; });
  D.categories.forEach(function (c) { cats[c.id] = c; });
  var LEVEL = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
  var reduced = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;

  /* ---------- storage (every access guarded: private windows and blocked storage must not break the page) ---------- */
  function read(key, fallback) {
    try { var v = localStorage.getItem(P + key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function write(key, val) {
    try {
      if (val === null || val === undefined) localStorage.removeItem(P + key);
      else localStorage.setItem(P + key, JSON.stringify(val));
    } catch (e) { /* storage unavailable: the page works without it */ }
  }
  function recentList() {
    var r = read('recent', []);
    if (!Array.isArray(r)) return [];
    return r.map(function (x) { return typeof x === 'string' ? { id: x, at: 0 } : x; })
      .filter(function (x) { return x && items[x.id]; });
  }
  function remember(id) {
    if (!items[id]) return;
    var r = recentList().filter(function (x) { return x.id !== id; });
    r.unshift({ id: id, at: Date.now() });
    write('recent', r.slice(0, 8));
    document.dispatchEvent(new CustomEvent('cosmic:diy-recent'));
  }
  function emit(detail) {
    try { document.dispatchEvent(new CustomEvent('cosmic:diy', { detail: detail })); } catch (e) {}
  }

  /* ---------- actions ---------- */
  function scrollTo(el) {
    el.scrollIntoView({ behavior: reduced && reduced.matches ? 'auto' : 'smooth', block: 'start' });
  }
  function flash(el) {
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
    setTimeout(function () { el.classList.remove('is-flash'); }, 2200);
  }
  function openAnswer(id) {
    var root = document.getElementById('answer-' + id);
    var det = root && root.querySelector('details');
    if (!det) return false;
    det.open = true;
    scrollTo(root);
    flash(root);
    var sum = det.querySelector('summary');
    if (sum) sum.focus({ preventScroll: true });
    if (history.replaceState) history.replaceState(null, '', '#answer-' + id);
    return true;
  }
  function preselect(service) {
    if (!service) return;
    var input = document.querySelector('#estimate input[name="services"][value="' + service + '"]');
    if (input && !input.checked) {
      input.checked = true;
      if (window.cosmicControls) window.cosmicControls.paint(input);
    }
  }
  function openEstimate(service, opener) {
    preselect(service);
    if (window.cosmicEstimate) window.cosmicEstimate.open(opener || null);
    else location.hash = 'estimate';
  }
  function go(item, opener) {
    if (item.type === 'answer' && openAnswer(item.id)) return;
    if (item.type === 'product') {
      var card = document.getElementById('product-' + item.id);
      if (card) { scrollTo(card); flash(card); return; }
    }
    if (item.type === 'service') { openEstimate(item.estimateService, opener); return; }
    if (item.type !== 'category') remember(item.id);
    location.href = item.url;
  }
  function itemMeta(it) {
    var m = it.meta || {};
    switch (it.type) {
      case 'guide': return [LEVEL[m.difficulty], m.time, m.cost].filter(Boolean).join(' · ');
      case 'pack': return [m.time, m.cost].filter(Boolean).join(' · ');
      case 'answer': return cats[it.category] ? cats[it.category].title : '';
      case 'tool': return 'Interactive';
      case 'download': return (it.format || 'Printable') + ' · free';
      case 'product': return 'What we\'d use';
      case 'service': return 'Get an estimate';
      case 'category': return 'Category';
    }
    return '';
  }

  /* links anywhere on the page: remember opened content; ticking the right service before #estimate opens */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-diy-open], [data-diy-estimate]');
    if (!a) return;
    if (a.hasAttribute('data-diy-estimate')) preselect(a.getAttribute('data-diy-estimate'));
    var id = a.getAttribute('data-diy-open');
    if (id && items[id]) emit({ action: 'open', id: id, type: items[id].type }), remember(id);
  }, true);

  window.cosmicDiy = {
    data: D, item: function (id) { return items[id]; }, category: function (id) { return cats[id]; },
    read: read, write: write, recent: recentList, remember: remember, emit: emit,
    openAnswer: openAnswer, openEstimate: openEstimate, preselect: preselect, go: go, meta: itemMeta,
    flash: flash, scrollTo: scrollTo, level: LEVEL
  };

  /* ---------- search engine ---------- */
  var S = D.search || {};
  var STOP = {};
  (S.stopwords || []).forEach(function (w) { STOP[w] = true; });
  var SYN = S.synonyms || {};

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function words(s) { var n = norm(s); return n ? n.split(' ') : []; }
  function uniq(a) { var o = {}, r = []; a.forEach(function (x) { if (!o[x]) { o[x] = 1; r.push(x); } }); return r; }

  var INDEX = D.items.map(function (it) {
    var kw = (it.keywords || []).map(norm);
    return {
      it: it, title: norm(it.title), kw: kw,
      tW: words(it.title), kW: uniq([].concat.apply([], kw.map(function (k) { return k.split(' '); }))),
      sW: words((it.summary || '') + ' ' + (it.answer || '')),
      cW: cats[it.category] ? words(cats[it.category].title) : []
    };
  }).concat(D.categories.map(function (c) {
    var it = { id: 'category:' + c.id, type: 'category', title: c.title, summary: c.summary, url: c.url, pending: c.pending };
    return { it: it, title: norm(c.title), kw: [norm(c.title)], tW: words(c.title), kW: [], sW: words(c.summary), cW: [] };
  }));

  function tokens(q) {
    var out = [];
    words(q).forEach(function (w) {
      if (STOP[w]) return;
      out = out.concat(SYN[w] ? words(SYN[w]) : [w]);
    });
    return uniq(out);
  }
  function hit(tok, list) {
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      if (w === tok) return true;
      if (tok.length >= 3 && w.indexOf(tok) === 0) return true;                           /* typing a prefix */
      if (w.length >= 4 && tok.indexOf(w) === 0 && tok.length - w.length <= 3) return true; /* plurals, -ing */
    }
    return false;
  }
  function score(e, toks, qn) {
    var s = 0, n = 0;
    toks.forEach(function (t) {
      var b = hit(t, e.tW) ? 3 : hit(t, e.kW) ? 2 : (hit(t, e.sW) || hit(t, e.cW)) ? 1 : 0;
      if (b) n++;
      s += b;
    });
    if (!n) return 0;
    var cov = n / toks.length;
    if (cov < (toks.length > 2 ? 0.6 : toks.length === 2 ? 0.5 : 1)) return 0;
    if (qn.length >= 4 && (e.title.indexOf(qn) >= 0 || e.kw.some(function (k) { return k === qn || k.indexOf(qn) === 0 || (k.length >= 6 && qn.indexOf(k) >= 0); }))) s += 4;
    return s * (0.4 + 0.6 * cov);
  }
  function intentBoost(q) {
    var qn = norm(q), w = words(q), first = w[0] || '', boost = {}, found = [];
    var I = S.intents || {};
    Object.keys(I).forEach(function (name) {
      var on = I[name].words.some(function (x) {
        x = norm(x);
        if (x.indexOf(' ') > 0) return (' ' + qn + ' ').indexOf(' ' + x + ' ') >= 0;
        if (name === 'question') return first === x && !/^how to\b/.test(qn);
        return w.indexOf(x) >= 0;
      });
      if (name === 'question' && /\?\s*$/.test(q)) on = true;
      if (!on) return;
      found.push(name);
      Object.keys(I[name].boost).forEach(function (t) { boost[t] = (boost[t] || 1) * I[name].boost[t]; });
    });
    return { boost: boost, found: found };
  }
  var ORDER = ['guide', 'answer', 'tool', 'download', 'pack', 'product', 'service', 'category'];
  var CAP = { guide: 3, answer: 3, tool: 1, download: 2, pack: 2, product: 2, service: 1, category: 2 };

  function search(q) {
    var toks = tokens(q), qn = norm(q);
    if (!toks.length) return [];
    var ib = intentBoost(q);
    var res = [];
    INDEX.forEach(function (e) {
      var s = score(e, toks, qn);
      if (s > 0) res.push({ it: e.it, s: s * (ib.boost[e.it.type] || 1) });
    });
    var groups = {};
    res.sort(function (a, b) { return b.s - a.s; }).forEach(function (r) {
      var g = groups[r.it.type] || (groups[r.it.type] = { type: r.it.type, top: r.s, list: [] });
      if (g.list.length < (CAP[r.it.type] || 2)) g.list.push(r.it);
    });
    var out = Object.keys(groups).map(function (k) { return groups[k]; })
      .sort(function (a, b) { return (b.top - a.top) || (ORDER.indexOf(a.type) - ORDER.indexOf(b.type)); });
    var total = 0;
    out.forEach(function (g) { g.list = g.list.slice(0, Math.max(0, 10 - total)); total += g.list.length; });
    return out.filter(function (g) { return g.list.length; });
  }
  window.cosmicDiy.search = search;

  /* ---------- the combobox ---------- */
  var form = document.querySelector('[data-diy-search-form]');
  var root = form && form.querySelector('[data-diy-search]');
  if (!root) return;
  var input = root.querySelector('[data-search-input]');
  var list = root.querySelector('[data-search-list]');
  var clear = root.querySelector('[data-search-clear]');
  var status = form.querySelector('[data-diy-search-status]');
  var flat = [], active = -1, statusTimer = 0;
  var labels = D.typeLabels || {};

  function open(on) {
    list.classList.toggle('is-hidden', !on);
    input.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (!on) { active = -1; input.removeAttribute('aria-activedescendant'); }
  }
  function paint() {
    flat.forEach(function (o, i) {
      var on = i === active;
      o.el.classList.toggle('is-active', on);
      o.el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (active >= 0 && flat[active]) {
      input.setAttribute('aria-activedescendant', flat[active].el.id);
      flat[active].el.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }
  function option(label, meta, i, act) {
    var li = document.createElement('li');
    li.className = 'flwr_command_item search_option is-stacked';
    li.id = 'diy-q-opt-' + i;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', 'false');
    var l = document.createElement('span');
    l.className = 'f-text-body search_option_label';
    l.textContent = label;
    li.appendChild(l);
    if (meta) {
      var m = document.createElement('span');
      m.className = 'flwr_command_item_meta f-text-small search_option_meta';
      m.textContent = meta;
      li.appendChild(m);
    }
    li.addEventListener('mousedown', function (e) { e.preventDefault(); });
    li.addEventListener('click', function () { act(); });
    flat.push({ el: li, act: act });
    return li;
  }
  function group(title, gid) {
    var g = document.createElement('li');
    g.className = 'search_group';
    g.setAttribute('role', 'group');
    g.setAttribute('aria-labelledby', gid);
    var t = document.createElement('p');
    t.className = 'flwr_command_group_title search_group_title f-text-micro';
    t.id = gid;
    t.textContent = title;
    var ul = document.createElement('ul');
    ul.className = 'search_group_list';
    ul.setAttribute('role', 'none');
    g.appendChild(t);
    g.appendChild(ul);
    list.appendChild(g);
    return ul;
  }
  function say(msg) {
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { if (status) status.textContent = msg; }, 400);
  }
  function pickItem(it) {
    var q = input.value.trim();
    emit({ action: 'search', q: q, id: it.id, type: it.type });
    open(false);
    go(it, input);
  }
  function render() {
    var q = input.value;
    clear.classList.toggle('is-hidden', !q);
    list.innerHTML = '';
    flat = [];
    if (norm(q).length < 2) { open(false); say(''); return; }
    var groups = search(q), n = 0;
    groups.forEach(function (g, gi) {
      var ul = group(labels[g.type] || g.type, 'diy-q-g-' + gi);
      g.list.forEach(function (it) {
        ul.appendChild(option(it.title, itemMeta(it), n++, function () { pickItem(it); }));
      });
    });
    if (!n) {
      var ul = group('Nothing yet', 'diy-q-g-none');
      ul.appendChild(option('Answer 4 questions in the Project Finder', 'Finder', n++, function () {
        emit({ action: 'search-empty', q: input.value.trim(), next: 'finder' });
        open(false);
        var f = document.getElementById('finder');
        if (f) { scrollTo(f); var first = f.querySelector('.diy-finder_step.is-active .choice_input'); if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 400); }
      }));
      ul.appendChild(option('Ask the Cosmic crew about it', 'Get an estimate', n++, function () {
        emit({ action: 'search-empty', q: input.value.trim(), next: 'estimate' });
        open(false);
        openEstimate('', input);
      }));
      say('No match for ' + q.trim() + '. Two options: the Project Finder, or ask the Cosmic crew.');
    } else {
      say(n + (n === 1 ? ' result' : ' results') + ' in ' + groups.length + (groups.length === 1 ? ' group' : ' groups') + '. First: ' + groups[0].list[0].title + '.');
    }
    active = flat.length ? 0 : -1;
    open(flat.length > 0 && document.activeElement === input);
    paint();
  }

  input.addEventListener('input', render);
  input.addEventListener('focus', function () { if (input.value) render(); });
  input.addEventListener('blur', function () { setTimeout(function () { open(false); }, 0); });
  input.addEventListener('keydown', function (e) {
    var isOpen = !list.classList.contains('is-hidden');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) { render(); return; }
      if (!flat.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length;
      paint();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (!isOpen) render();
      if (active >= 0 && flat[active]) flat[active].act();
    } else if (e.key === 'Escape') {
      if (isOpen) { e.preventDefault(); e.stopPropagation(); open(false); }
      else if (input.value) { e.preventDefault(); e.stopPropagation(); input.value = ''; render(); }
    } else if (e.key === 'Tab') open(false);
  });
  /* the Search button: opens the highlighted (else the first) result; empty field = focus it and say why */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (norm(input.value).length < 2) {
      input.focus();
      if (status) { status.textContent = ''; setTimeout(function () { status.textContent = 'Type what you are working on, for example peeling paint.'; }, 50); }
      return;
    }
    render();
    var o = flat[active >= 0 ? active : 0];
    if (o) o.act();
  });
  clear.addEventListener('click', function () { input.value = ''; render(); input.focus(); });
  form.querySelectorAll('[data-diy-try]').forEach(function (b) {
    b.addEventListener('click', function () {
      input.value = b.getAttribute('data-diy-try');
      input.focus();
      render();
    });
  });
})();
