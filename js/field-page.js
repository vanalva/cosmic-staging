/* field-page: behaviour for field.html (presentation set 3, 2026-11-10).
   - Filters: one segmented_ radio group in [data-field-filters] (js/controls.js mirrors it to .is-selected). A
     [data-field-item] cell shows when its data-filters has the value; "all" shows every post except the archive
     ([data-archive]) until "Show older posts" is pressed. The estimate post (data-filters="cta") shows in "all" only.
     Hidden = .is-hidden combo class. Dividers hide when their group is empty. Count line is aria-live.
   - Packing: each cell carries its desktop span (is-d4..is-d12, data-d) and tablet span (is-t3/is-t6, data-t),
     authored so the "all" view fills every row without JS. In a filtered view this widens the last cell of each row
     to close the gap (desktop 12 columns, tablet 6); a photo post widened to 9+ columns turns side by side (is-row).
     Phones are one column (CSS), nothing to pack. Runs on filter, load more and breakpoint change (matchMedia).
   - Load more: reveals the archive group, focuses its first post, then shows the end line.
   - Rail: Back / More scroll the story track by one tile; the counter names the fully visible tiles. A tile jumps
     to its post; if a filter or the archive hides it, the view resets to All first. Reduced motion: no smooth scroll.
   No observers; one listener per control plus one passive scroll and one resize listener. Idempotent. */
(function () {
  'use strict';
  if (window.__fieldPage) return;
  window.__fieldPage = true;

  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var behavior = reduce ? 'auto' : 'smooth';
  var mqTablet = window.matchMedia('(max-width: 991px)');
  var mqPhone = window.matchMedia('(max-width: 767px)');

  /* ---------------- feed ---------------- */
  var form = document.querySelector('[data-field-filters]');
  var cells = $$('[data-field-item]');
  var dividers = $$('[data-field-divider]');
  var count = document.querySelector('[data-field-count]');
  var empty = document.querySelector('[data-field-empty]');
  var more = document.querySelector('[data-field-more]');
  var end = document.querySelector('[data-field-end]');
  var revealed = false;
  var posts = cells.filter(function (c) { return !has(c, 'cta'); });

  function has(cell, v) { return (' ' + cell.getAttribute('data-filters') + ' ').indexOf(' ' + v + ' ') > -1; }
  function value() {
    var el = form && form.querySelector('input[name="field-filter"]:checked');
    return el ? el.value : 'all';
  }
  function label(v) {
    var el = form && form.querySelector('input[name="field-filter"][value="' + v + '"]');
    var l = el && el.closest('label');
    return l ? l.textContent.trim() : v;
  }
  function setSpan(cell, key, n) {
    cell.className = cell.className.replace(new RegExp('\\bis-' + key + '\\d+\\b', 'g'), '').replace(/\s+/g, ' ').trim();
    cell.classList.add('is-' + key + n);
  }

  function pack(f) {
    /* back to the authored spans and layouts */
    cells.forEach(function (c) {
      setSpan(c, 'd', c.getAttribute('data-d'));
      setSpan(c, 't', c.getAttribute('data-t'));
      var a = c.querySelector('.field_entry[data-auto-row]');
      if (a) {
        a.classList.remove('is-row');
        a.removeAttribute('data-auto-row');
        var b = a.querySelector('.field_body');
        if (b) b.classList.remove('is-center');
      }
    });
    if (f === 'all' || mqPhone.matches) return;
    var key = mqTablet.matches ? 't' : 'd', cap = key === 'd' ? 12 : 6;
    var row = [], used = 0;
    function close() {
      if (!row.length) return;
      /* widen the last post that is not a social board (a 4:5 board grows tall fast); a board alone turns sideways */
      var last = row[row.length - 1];
      for (var i = row.length - 1; i >= 0; i--) {
        if (!row[i].querySelector('.field_entry.is-board')) { last = row[i]; break; }
      }
      var n = +last.getAttribute('data-' + key) + (cap - used);
      if (cap - used > 0) {
        setSpan(last, key, n);
        var a = last.querySelector('.field_entry');
        var wide = a && a.classList.contains('is-board') ? n >= 6 : n >= 9;
        if (key === 'd' && wide && a && !a.classList.contains('is-row') && a.querySelector('.field_media') &&
            !a.querySelector('.field_media.is-compare')) {
          a.classList.add('is-row');
          a.setAttribute('data-auto-row', '');
          var b = a.querySelector('.field_body');
          if (b) b.classList.add('is-center');
        }
      }
      row = []; used = 0;
    }
    var list = document.querySelector('[data-field-grid]');
    $$('[data-field-item], [data-field-divider]', list).forEach(function (el) {
      if (el.classList.contains('is-hidden')) return;
      if (el.hasAttribute('data-field-divider')) { close(); return; }
      var s = +el.getAttribute('data-' + key);
      if (used + s > cap) close();
      row.push(el); used += s;
      if (used === cap) { row = []; used = 0; }
    });
    close();
  }

  function apply() {
    var f = value(), shown = 0;
    cells.forEach(function (c) {
      var ok = f === 'all' ? (!c.hasAttribute('data-archive') || revealed) : (!has(c, 'cta') && has(c, f));
      c.classList.toggle('is-hidden', !ok);
      if (ok && !has(c, 'cta')) shown++;
    });
    dividers.forEach(function (d) {
      var g = d.getAttribute('data-group');
      var any = cells.some(function (c) { return c.getAttribute('data-group') === g && !c.classList.contains('is-hidden'); });
      d.classList.toggle('is-hidden', !any);
    });
    if (count) {
      count.textContent = f === 'all'
        ? 'Showing ' + shown + ' of ' + posts.length + ' posts'
        : shown + (shown === 1 ? ' post' : ' posts') + ': ' + label(f);
    }
    if (empty) empty.classList.toggle('is-hidden', shown > 0);
    if (more) more.classList.toggle('is-hidden', !(f === 'all' && !revealed));
    if (end) end.classList.toggle('is-hidden', !(f === 'all' && revealed));
    pack(f);
  }

  function setFilter(v) {
    var input = form && form.querySelector('input[name="field-filter"][value="' + v + '"]');
    if (!input) return;
    input.checked = true;
    if (window.cosmicControls) window.cosmicControls.paint(input);
  }

  function reveal() {
    revealed = true;
    apply();
  }

  if (form) {
    form.addEventListener('change', function (e) {
      apply();
      var l = e.target && e.target.closest && e.target.closest('label');
      /* 991 and down: keep the chosen option in view inside the scrolling filter row */
      if (l && mqTablet.matches) l.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: behavior });
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); });
  }
  if (more) more.addEventListener('click', function () {
    reveal();
    var first = cells.filter(function (c) { return c.hasAttribute('data-archive') && !c.classList.contains('is-hidden'); })[0];
    var a = first && first.querySelector('.field_entry');
    if (a) a.focus({ preventScroll: false });
  });
  if (empty) {
    var reset = empty.querySelector('[data-field-reset]');
    if (reset) reset.addEventListener('click', function () {
      setFilter('all'); apply();
      var first = form && form.querySelector('input[name="field-filter"]');
      if (first) first.focus();
    });
  }
  function onBreakpoint() { pack(value()); update(); }
  if (mqTablet.addEventListener) { mqTablet.addEventListener('change', onBreakpoint); mqPhone.addEventListener('change', onBreakpoint); }

  /* jump to a post (rail tiles, or a #entry- hash on load): make sure it is shown first */
  function show(id, smooth) {
    var target = document.getElementById(id);
    if (!target) return false;
    var cell = target.closest('[data-field-item]');
    if (cell && cell.classList.contains('is-hidden')) {
      if (cell.hasAttribute('data-archive')) revealed = true;
      setFilter('all');
      apply();
    }
    target.scrollIntoView({ behavior: smooth ? behavior : 'auto', block: 'start' });
    target.focus({ preventScroll: true });
    return true;
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.field_entry.is-story');
    if (!a) return;
    var id = (a.getAttribute('href') || '').replace(/^#/, '');
    if (show(id, true)) {
      e.preventDefault();
      if (history.replaceState) history.replaceState(null, '', '#' + id);
    }
  });

  /* ---------------- rail ---------------- */
  var track = document.querySelector('[data-field-rail]');
  var prev = document.querySelector('[data-rail-prev]');
  var next = document.querySelector('[data-rail-next]');
  var railCount = document.querySelector('[data-rail-count]');
  var tiles = track ? Array.prototype.slice.call(track.children) : [];
  var ticking = false;

  function stepWidth() {
    if (!tiles.length) return 0;
    var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return tiles[0].getBoundingClientRect().width + gap;
  }
  function update() {
    ticking = false;
    if (!track || !railCount || !tiles.length) return;
    var r = track.getBoundingClientRect(), first = -1, last = -1;
    tiles.forEach(function (t, i) {
      var b = t.getBoundingClientRect();
      if (b.left >= r.left - 1 && b.right <= r.right + 1) { if (first < 0) first = i; last = i; }
    });
    if (first < 0) { first = last = 0; }
    railCount.textContent = (first === last ? (first + 1) : (first + 1) + '–' + (last + 1)) + ' of ' + tiles.length;
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  if (track) {
    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -stepWidth(), behavior: behavior }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: stepWidth(), behavior: behavior }); });
    track.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
  }

  apply();
  update();
  if (/^#entry-/.test(location.hash)) show(location.hash.slice(1), false);
})();
