/* legal-reader: the document reader on legal.html (presentation set 5). Plan: notes/presentation/plan-set5.md.
   - Three documents (article[data-legal-doc]); one is open, the others get .is-hidden. Without JS all three read in
     order. legal.html#terms / #privacy / #cookies (or #<doc>-<section>) opens that document; the segmented_ switcher
     and every [data-legal-link] switch too, and the hash follows (replaceState, so Back leaves the page).
   - Search: the flwr search component (runtime.js "search": highlight, prev/next, Enter / Shift+Enter, clear). The
     runtime binds to one target, so on a switch this script re-binds it to the open document's body
     (flwr.search.destroy + init) and re-runs the query. It also adds what the runtime does not:
     the "3 of 12" counter text, Escape clears, a per-document hit count on the switcher, a hint when the open
     document has no match, and a polite live status for screen readers.
   - Table of contents: desktop list in a sticky aside; from 991 down a "Jump to a section" select (CSS swaps them).
   - Sticky offset: the search bar's height goes into --legal-bar-h on the reader, so the aside and the section
     anchors clear it. */
(function () {
  'use strict';
  var reader = document.querySelector('[data-legal-reader]');
  if (!reader) return;
  var docs = [].slice.call(reader.querySelectorAll('[data-legal-doc]'));
  var names = docs.map(function (d) { return d.getAttribute('data-legal-doc'); });
  var TITLES = {};
  docs.forEach(function (d) { var h = d.querySelector('h2'); TITLES[d.getAttribute('data-legal-doc')] = h ? h.textContent.trim() : d.id; });
  var find = reader.querySelector('[data-legal-find]');
  var bar = reader.querySelector('[data-legal-bar]');
  var input = find.querySelector('.flwr_search_input');
  var counter = find.querySelector('.flwr_search_match_counter');
  var clearBtn = find.querySelector('.flwr_search_clear_btn');
  var status = find.querySelector('[data-legal-status]');
  var hint = find.querySelector('[data-legal-hint]');
  var radios = [].slice.call(reader.querySelectorAll('input[name="legal-doc"]'));
  var current = null;

  function body(name) { return document.getElementById('legal-body-' + name); }
  function docOf(hash) {
    var h = (hash || '').replace(/^#/, '');
    if (!h) return null;
    for (var i = 0; i < names.length; i++) {
      if (h === names[i] || h.indexOf(names[i] + '-') === 0) return names[i];
    }
    return null;
  }
  function count(name, q) {
    if (!q) return 0;
    var t = body(name).textContent.toLowerCase(), n = 0, i = 0, l = q.toLowerCase();
    while ((i = t.indexOf(l, i)) !== -1) { n++; i += l.length; }
    return n;
  }

  /* ---- after every runtime update: counter text, badges, hint, status ---- */
  function sync() {
    var q = input.value.trim();
    var marks = [].slice.call(body(current).querySelectorAll('.flwr_search_highlight'));
    var cur = -1;
    marks.forEach(function (m, i) { if (m.classList.contains('is-current')) cur = i; });
    counter.textContent = !q ? '' : (marks.length ? (cur + 1) + ' of ' + marks.length : 'No matches');
    var others = [];
    names.forEach(function (n) {
      var badge = reader.querySelector('[data-legal-hits="' + n + '"]');
      var c = count(n, q);
      if (badge) {
        badge.textContent = c ? ' ' + c : '';
        badge.classList.toggle('is-hidden', !c);
        badge.setAttribute('aria-label', c + (c === 1 ? ' match' : ' matches'));
      }
      if (n !== current && c) others.push('<a class="site-link" href="#' + n + '" data-legal-link="' + n + '">' + TITLES[n] + ' (' + c + ')</a>');
    });
    if (q && !marks.length) {
      hint.innerHTML = 'No matches in ' + TITLES[current] + '.' + (others.length ? ' Found in ' + others.join(' and ') + '.' : ' Try a shorter word.');
      hint.classList.remove('is-hidden');
    } else {
      hint.textContent = '';
      hint.classList.add('is-hidden');
    }
    if (status) {
      status.textContent = !q ? '' : (marks.length ? 'Match ' + (cur + 1) + ' of ' + marks.length + ' in ' + TITLES[current] + '.'
        : 'No matches in ' + TITLES[current] + '.' + (others.length ? ' Other documents have matches.' : ''));
    }
  }
  function later() { setTimeout(sync, 0); }

  /* ---- point the runtime's search at a document ---- */
  function rebind(name) {
    find.setAttribute('data-flwr-search-target', '#legal-body-' + name);
    if (!(window.flwr && window.flwr.search)) return;
    var q = input.value;
    window.flwr.search.destroy();
    window.flwr.search.init(find.parentNode);
    if (q.trim()) input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function open(name, opts) {
    opts = opts || {};
    if (names.indexOf(name) < 0) name = names[0];
    var changed = name !== current;
    current = name;
    docs.forEach(function (d) { d.classList.toggle('is-hidden', d.getAttribute('data-legal-doc') !== name); });
    radios.forEach(function (r) {
      r.checked = r.value === name;
      if (window.cosmicControls) window.cosmicControls.paint(r);
    });
    if (changed) rebind(name);
    if (opts.hash !== false) {
      var h = opts.section || name;
      try { history.replaceState(null, '', '#' + h); } catch (e) { /* file:// */ }
    }
    measure();
    if (opts.section) {
      var s = document.getElementById(opts.section);
      if (s) s.scrollIntoView({ block: 'start' });
    } else if (opts.scroll) {
      reader.scrollIntoView({ block: 'start' });
    }
    later();
  }

  function measure() {
    var h = bar.getBoundingClientRect().height;
    reader.style.setProperty('--legal-bar-h', Math.ceil(h) + 'px');
  }

  /* ---- wiring ---- */
  radios.forEach(function (r) {
    r.addEventListener('change', function () { if (r.checked) open(r.value); });
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-legal-link]');
    if (!a) return;
    e.preventDefault();
    open(a.getAttribute('data-legal-link'), { scroll: true });
  });
  /* table of contents: links in the aside, the select from 991 down */
  reader.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-legal-toc]');
    if (!a) return;
    e.preventDefault();
    var id = a.getAttribute('href').slice(1);
    open(current, { section: id });
    var s = document.getElementById(id);
    if (s) { s.setAttribute('tabindex', '-1'); s.focus({ preventScroll: true }); }
  });
  [].forEach.call(reader.querySelectorAll('[data-legal-jump]'), function (sel) {
    sel.addEventListener('change', function () {
      if (!sel.value) return;
      var id = sel.value;
      open(current, { section: id });
      var s = document.getElementById(id);
      if (s) { s.setAttribute('tabindex', '-1'); s.focus({ preventScroll: true }); }
      sel.value = '';
    });
  });
  window.addEventListener('hashchange', function () {
    var n = docOf(location.hash);
    if (n) open(n, { hash: false, section: location.hash.slice(1) !== n ? location.hash.slice(1) : null, scroll: true });
  });

  /* search glue: Escape clears; the rest follows the runtime */
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (input.value) { e.preventDefault(); e.stopPropagation(); clearBtn.click(); }
      later();
    } else if (e.key === 'Enter') later();
  });
  input.addEventListener('input', later);
  find.addEventListener('click', function (e) { if (e.target.closest('button')) later(); });

  if (window.ResizeObserver) new ResizeObserver(measure).observe(bar);
  else window.addEventListener('resize', measure);

  function start() {
    var n = docOf(location.hash);
    var section = n && location.hash.slice(1) !== n ? location.hash.slice(1) : null;
    open(n || names[0], { hash: !!n, section: section, scroll: !!n && !section });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
