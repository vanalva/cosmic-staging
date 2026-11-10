/* diy-calc: the paint calculator (components/calc.html), any number per page: form.calc_root[data-calc].
   Modes (segmented radios, value room | wall | area): a room's walls (2 x (length + width) x height, optional ceiling),
   one wall (width x height), or a known total area. Doors (20 sq ft each) and windows (15 sq ft each) come off the
   walls. Gallons = area x coats / coverage per gallon, rounded UP to the quart; three quarts become a gallon.
   Inputs are text with inputmode="decimal" so the messages are ours, not the browser's. The result updates as you type
   once every visible field is valid; each invalid field shows its own message (aria-invalid + aria-describedby) and
   the result panel says how many fields need fixing. Submit (Calculate / Enter) focuses the first invalid field.
   API: window.cosmicCalc.compute(values) -> {ok, errors, area, gallons, ...} (pure, for tests and other pages),
        window.cosmicCalc.init(root). Needs controls.js (segmented / check_ states). */
(function () {
  'use strict';
  var DOOR = 20, WINDOW = 15;
  var RULES = {
    length:   { min: 1, max: 200, name: 'the room length', unit: 'feet', eg: '12' },
    width:    { min: 1, max: 200, name: 'the room width', unit: 'feet', eg: '10' },
    height:   { min: 4, max: 30, name: 'the wall height', unit: 'feet', eg: '8' },
    wallw:    { min: 1, max: 200, name: 'the wall width', unit: 'feet', eg: '14' },
    wallh:    { min: 2, max: 30, name: 'the wall height', unit: 'feet', eg: '8' },
    area:     { min: 1, max: 20000, name: 'the area', unit: 'square feet', eg: '150' },
    doors:    { min: 0, max: 30, name: 'the number of doors', unit: '', eg: '1', int: true },
    windows:  { min: 0, max: 50, name: 'the number of windows', unit: '', eg: '2', int: true },
    coverage: { min: 100, max: 600, name: 'the coverage per gallon', unit: 'square feet', eg: '350' }
  };
  var NEEDS = { room: ['length', 'width', 'height', 'doors', 'windows'], wall: ['wallw', 'wallh', 'doors', 'windows'], area: ['area'] };

  function num(v) {
    var s = String(v == null ? '' : v).trim().replace(/,/g, '');
    if (s === '') return { empty: true };
    if (!/^\d*\.?\d+$/.test(s)) return { bad: true };
    return { n: parseFloat(s) };
  }
  function check(key, raw) {
    var r = RULES[key], p = num(raw);
    if (p.empty) return key === 'doors' || key === 'windows' ? '' : 'Enter ' + r.name + (r.unit ? ' in ' + r.unit : '') + ', for example ' + r.eg + '.';
    if (p.bad) return 'Use numbers only' + (r.int ? '' : ' (a dot for decimals, like 12.5)') + '.';
    if (r.int && p.n % 1) return 'Use a whole number.';
    if (p.n < r.min || p.n > r.max) return 'Use a number from ' + r.min + ' to ' + r.max.toLocaleString('en-US') + (r.unit ? ' ' + r.unit : '') + '.';
    return '';
  }
  function compute(v) {
    var mode = NEEDS[v.mode] ? v.mode : 'room', errors = {};
    NEEDS[mode].concat(['coverage']).forEach(function (k) { var m = check(k, v[k]); if (m) errors[k] = m; });
    var coats = [1, 2, 3].indexOf(+v.coats) >= 0 ? +v.coats : 2;
    var g = function (k) { var p = num(v[k]); return p.n || 0; };
    var walls = 0, openings = 0, ceiling = 0, area = 0;
    if (mode === 'area') area = g('area');
    else {
      walls = mode === 'room' ? 2 * (g('length') + g('width')) * g('height') : g('wallw') * g('wallh');
      openings = g('doors') * DOOR + g('windows') * WINDOW;
      ceiling = mode === 'room' && v.ceiling ? g('length') * g('width') : 0;
      if (!errors.doors && !errors.windows && walls > 0 && openings >= walls) {
        errors.doors = 'Doors and windows add up to more than the wall area. Check the counts.';
      }
      area = walls - openings + ceiling;
    }
    var ok = !Object.keys(errors).length;
    var out = { ok: ok, errors: errors, mode: mode, coats: coats, walls: walls, openings: openings, ceiling: ceiling, area: Math.max(0, area) };
    if (!ok) return out;
    var cov = g('coverage');
    out.coverage = cov;
    out.exact = out.area * coats / cov;
    var q = Math.max(1, Math.ceil(out.exact * 4 - 1e-9));
    out.quartsTotal = q;
    out.gallons = Math.floor(q / 4);
    out.quarts = q % 4;
    if (out.quarts === 3) { out.gallons += 1; out.quarts = 0; out.roundedUp = true; }
    out.primerQuarts = Math.max(1, Math.ceil(out.area / 300 * 4 - 1e-9));
    return out;
  }

  function fmt(n, d) { return Number(n.toFixed(d == null ? 0 : d)).toLocaleString('en-US'); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function amount(g, q) {
    if (!g) return plural(q, 'quart', 'quarts');
    return plural(g, 'gallon', 'gallons') + (q ? ' and ' + plural(q, 'quart', 'quarts') : '');
  }

  function init(root) {
    if (!root || root.__cosmicCalc) return;
    var $ = function (s) { return root.querySelector(s); };
    var $$ = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };
    var result = $('[data-calc-result]'), valueEl = $('[data-calc-value]'), unitEl = $('[data-calc-unit]');
    var plusEl = $('[data-calc-plus]'), explain = $('[data-calc-explain]'), primer = $('[data-calc-primer]');
    var kicker = $('[data-calc-kicker]');
    var touched = {};

    function values() {
      var v = { mode: (($('input[data-calc-mode]:checked') || {}).value) || 'room', coats: (($('input[data-calc-coats]:checked') || {}).value) || 2 };
      $$('[data-calc-input]').forEach(function (i) { v[i.getAttribute('data-calc-input')] = i.value; });
      var c = $('[data-calc-ceiling]');
      v.ceiling = !!(c && c.checked);
      return v;
    }
    function showMode(mode) {
      $$('[data-calc-show]').forEach(function (el) {
        var on = el.getAttribute('data-calc-show').split(/\s+/).indexOf(mode) >= 0;
        el.classList.toggle('is-hidden', !on);
        Array.prototype.forEach.call(el.querySelectorAll('input'), function (i) { i.disabled = !on; });
      });
    }
    function fieldError(key, msg, show) {
      var input = root.querySelector('[data-calc-input="' + key + '"]');
      if (!input) return;
      var field = input.closest('.calc_field'), wrap = input.closest('.calc_wrap'), err = field && field.querySelector('[data-calc-error]');
      var visible = !!(msg && show);
      if (wrap) wrap.classList.toggle('is-invalid', visible);
      if (visible) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      if (err) {
        err.classList.toggle('is-hidden', !visible);
        var t = err.querySelector('[data-calc-error-text]');
        if (t) t.textContent = visible ? msg : '';
      }
    }
    function render(force) {
      var v = values(), r = compute(v);
      showMode(r.mode);
      Object.keys(RULES).forEach(function (k) { fieldError(k, r.errors[k], force || touched[k]); });
      result.classList.toggle('is-invalid', !r.ok);
      if (!r.ok) {
        var n = Object.keys(r.errors).length;
        if (kicker) kicker.textContent = 'Not yet';
        valueEl.textContent = '–';
        unitEl.textContent = '';
        plusEl.classList.add('is-hidden');
        explain.textContent = 'Fix ' + (n === 1 ? 'the highlighted field' : 'the ' + n + ' highlighted fields') + ' to see how much paint you need.';
        if (primer) primer.classList.add('is-hidden');
        return r;
      }
      if (kicker) kicker.textContent = 'You need about';
      if (r.gallons) {
        valueEl.textContent = String(r.gallons);
        unitEl.textContent = r.gallons === 1 ? 'gallon' : 'gallons';
        plusEl.textContent = r.quarts ? '+ ' + plural(r.quarts, 'quart', 'quarts') : '';
        plusEl.classList.toggle('is-hidden', !r.quarts);
      } else {
        valueEl.textContent = String(r.quarts);
        unitEl.textContent = r.quarts === 1 ? 'quart' : 'quarts';
        plusEl.classList.add('is-hidden');
      }
      var parts = [];
      if (r.mode !== 'area') {
        parts.push(fmt(r.walls) + ' sq ft of wall' + (r.openings ? ' minus ' + fmt(r.openings) + ' for doors and windows' : '') +
          (r.ceiling ? ' plus ' + fmt(r.ceiling) + ' of ceiling' : '') + ' = ' + fmt(r.area) + ' sq ft to paint.');
      } else parts.push(fmt(r.area) + ' sq ft to paint.');
      parts.push(plural(r.coats, 'coat', 'coats') + ' at ' + fmt(r.coverage) + ' sq ft per gallon is ' + fmt(r.exact, 2) + ' gallons, rounded up to ' + amount(r.gallons, r.quarts) + '.');
      if (r.roundedUp) parts.push('Three quarts is nearly a gallon, so we rounded up: the rest is your touch-up paint.');
      explain.textContent = parts.join(' ');
      if (primer) {
        primer.textContent = 'Priming first? One coat over the same area is about ' + amount(Math.floor(r.primerQuarts / 4), r.primerQuarts % 4) + ' at 300 sq ft per gallon. Check the can: primers vary.';
        primer.classList.remove('is-hidden');
      }
      return r;
    }

    root.addEventListener('input', function (e) {
      render(false);
    });
    root.addEventListener('change', function (e) {
      var k = e.target.getAttribute && e.target.getAttribute('data-calc-input');
      if (k) touched[k] = true;
      render(false);
    });
    root.addEventListener('focusout', function (e) {
      var k = e.target.getAttribute && e.target.getAttribute('data-calc-input');
      if (k) { touched[k] = true; render(false); }
    });
    root.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = render(true);
      if (!r.ok) {
        var first = Object.keys(RULES).filter(function (k) { return r.errors[k]; })
          .map(function (k) { return root.querySelector('[data-calc-input="' + k + '"]'); })
          .filter(function (i) { return i && !i.disabled; })[0];
        if (first) first.focus();
      } else if (result) {
        result.setAttribute('tabindex', '-1');
        result.focus({ preventScroll: false });
      }
    });
    root.__cosmicCalc = { render: render };
    render(false);
  }

  function initAll() { Array.prototype.forEach.call(document.querySelectorAll('[data-calc]'), init); }
  window.cosmicCalc = { compute: compute, init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll); else initAll();
})();
