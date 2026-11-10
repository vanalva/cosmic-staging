/* site-page: behaviour for projects.html and project-detail.html (presentation set 1, 2026-11-10).
   - Filters (projects.html): two segmented_ radio groups (kind, service) inside [data-site-filters]. A
     [data-project] item shows when its data-kind and data-services match; hidden items get the .is-hidden combo
     class (Webflow-safe: a class, no :checked selector). The count line is aria-live; no match shows
     [data-site-empty] with a reset button. js/controls.js mirrors the radios to .is-selected as everywhere else.
   - [data-site-show="residential|commercial"] (the blue band buttons) set the kind filter and move to the archive.
   - [data-compare-show="before|after"] buttons move the nearest compare to 100 / 0 (same as the DIY guide).
   - .record_swatch[data-swatch] paints its chip from the paint's hex (project data, not a brand colour; as
     club-member.js does for the member record).
   No observers, one listener per control, idempotent. */
(function () {
  'use strict';

  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---- filters ---- */
  var form = document.querySelector('[data-site-filters]');
  if (form) {
    var items = $$('[data-project]');
    var count = form.querySelector('[data-site-count]');
    var empty = document.querySelector('[data-site-empty]');

    var value = function (name) {
      var el = form.querySelector('input[name="' + name + '"]:checked');
      return el ? el.value : 'all';
    };

    var apply = function () {
      var kind = value('project-kind'), service = value('project-service'), shown = 0;
      items.forEach(function (li) {
        var ok = (kind === 'all' || li.getAttribute('data-kind') === kind) &&
          (service === 'all' || (' ' + li.getAttribute('data-services') + ' ').indexOf(' ' + service + ' ') > -1);
        li.classList.toggle('is-hidden', !ok);
        if (ok) shown++;
      });
      if (count) {
        count.textContent = (kind === 'all' && service === 'all')
          ? 'Showing all ' + items.length + ' projects'
          : 'Showing ' + shown + ' of ' + items.length + ' projects';
      }
      if (empty) empty.classList.toggle('is-hidden', shown > 0);
    };

    var set = function (name, v) {
      var input = form.querySelector('input[name="' + name + '"][value="' + v + '"]');
      if (!input) return;
      input.checked = true;
      if (window.cosmicControls) window.cosmicControls.paint(input);
      apply();
    };

    form.addEventListener('change', apply);
    form.addEventListener('submit', function (e) { e.preventDefault(); });

    // deep links (lead, 2026-11-10): projects.html#kind=residential or #service=landscaping (both may combine,
    // "#kind=commercial&service=painting") preset the filters; used by the Services cards' Read More
    var fromHash = function () {
      var h = (location.hash || '').replace(/^#/, '');
      if (h.indexOf('=') < 0) return;
      h.split('&').forEach(function (pair) {
        var kv = pair.split('=');
        if (kv[0] === 'kind') set('project-kind', kv[1]);
        if (kv[0] === 'service') set('project-service', kv[1]);
      });
      var archive = document.getElementById('archive');
      if (archive) archive.scrollIntoView({ block: 'start' });
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);

    if (empty) {
      var reset = empty.querySelector('[data-site-reset]');
      if (reset) reset.addEventListener('click', function () {
        set('project-kind', 'all');
        set('project-service', 'all');
        var first = form.querySelector('input[name="project-kind"]');
        if (first) first.focus();
      });
    }

    $$('[data-site-show]').forEach(function (b) {
      b.addEventListener('click', function () {
        set('project-kind', b.getAttribute('data-site-show'));
        set('project-service', 'all');
        var archive = document.getElementById('archive');
        if (archive) {
          var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          archive.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
          archive.focus({ preventScroll: true });
        }
      });
    });

    apply();
  }

  /* ---- before/after fallback buttons ---- */
  $$('[data-compare-show]').forEach(function (b) {
    b.addEventListener('click', function () {
      var fig = b.closest('figure') || document;
      var c = fig.querySelector('[data-flwr="compare"]');
      var api = c && c.__flwrCompare;
      if (api) api.set(b.getAttribute('data-compare-show') === 'before' ? 100 : 0);
    });
  });

  /* ---- paint swatches on the finish record ---- */
  $$('.record_swatch[data-swatch]').forEach(function (li) {
    var chip = li.querySelector('.record_chip');
    if (chip) chip.style.setProperty('--record-swatch', li.getAttribute('data-swatch'));
  });
})();
