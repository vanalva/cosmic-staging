/*
 * Test panel for the living-ink cursor (js/ink-cursor-panel.js). A tuning tool, not part of the site.
 * ink-cursor.js loads it by itself on a local preview (localhost / 127.0.0.1), with ?ink-panel in the URL, or when
 * localStorage "cosmic-ink-panel" is "on" ("off" hides it everywhere). It never loads on the live site.
 * It changes window.CosmicInk.options live and remembers the values in localStorage, so every page of the preview
 * uses them. Presets: name one and Save; pick one in the list to load it. "Copy" puts the current values on the
 * clipboard (JSON + the script-tag attributes) so they can be made the defaults.
 */
(function () {
  'use strict';
  var ink = window.CosmicInk;
  if (!ink || document.querySelector('.ink-panel')) return;
  var KEY = 'cosmic-ink-panel-v4', PKEY = 'cosmic-ink-presets';
  var DEF = { size: 0.8, trail: 0.71, stretch: 1.24, goo: 2.15, magnet: 1.95, follow: 1, bounce: 0.8, wobble: 1.5, art: 0.7, traces: 1.85, texture: 0.45, hold: 1, dot: 1 };
  var ROWS = [
    ['size', 'Cursor size', 0.4, 2.6, 0.05, 'how big the drop is'],
    ['trail', 'Trail length', 0, 1, 0.01, 'how far the body lags behind'],
    ['stretch', 'Stretch', 0, 1.6, 0.01, 'squash and stretch with speed'],
    ['goo', 'Stickiness', 0.3, 2.6, 0.05, 'how far the ink reaches to join buttons, and how long a strand holds'],
    ['magnet', 'Magnetism', 0, 2.5, 0.05, 'pull toward nearby buttons, and their lean toward the ink'],
    ['follow', 'Snappiness', 0, 2, 0.05, 'how fast the body catches the nose (the nose is always on the pointer)'],
    ['bounce', 'Elasticity (shake)', 0, 1.7, 0.05, 'overshoot and jiggle when it starts, stops or lets go'],
    ['texture', 'Texture', 0, 1.5, 0.05, 'how lumpy the outline gets while moving (0 = smooth drop)'],
    ['traces', 'Traces', 0, 2.5, 0.05, 'small drops left behind at speed (0 = none)'],
    ['wobble', 'Wobble', 0, 3, 0.05, 'the slow living outline at rest'],
    ['art', 'Shape join', 0, 1.25, 0.05, 'how strongly it rounds into icons, drawings and letters (0 = off)'],
    ['dot', 'Click dot', 0, 2.5, 0.05, 'size of the dot that shows over anything clickable (0 = none)'],
    ['hold', 'Keep dark colour', 0, 1, 1, 'on = after leaving something dark the ink stays dark until it touches something of its own colour']
  ];
  var saved = {}, presets = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { saved = {}; }
  try { presets = JSON.parse(localStorage.getItem(PKEY) || '{}'); } catch (e) { presets = {}; }
  var state = { hide: saved.hide !== false, open: saved.open !== false };

  var css = [
    '.ink-panel{position:fixed;right:16px;bottom:16px;z-index:2147483600;width:440px;max-width:calc(100vw - 32px);box-sizing:border-box;padding:12px 14px;border-radius:14px;background:#17171f;color:#f2f1ec;font:12px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.35);cursor:default}',
    '.ink-panel *{box-sizing:border-box;cursor:default}',
    '.ink-panel.is-closed{width:auto}',
    '.ink-panel_head{display:flex;justify-content:space-between;align-items:center;gap:14px;font-weight:700;font-size:12px}',
    '.ink-panel button{border:1px solid #3a3a48;background:#24242f;color:#f2f1ec;border-radius:8px;padding:5px 9px;font:inherit;font-weight:600}',
    '.ink-panel button:hover{background:#30303d}',
    '.ink-panel_body{margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:9px 18px}',
    '.ink-panel.is-closed .ink-panel_body,.ink-panel.is-closed .ink-panel_foot,.ink-panel.is-closed .ink-panel_presets{display:none}',
    '.ink-panel_row label{display:flex;justify-content:space-between;color:#a9a9b6;margin-bottom:3px}',
    '.ink-panel_row output{color:#fff;font-weight:700;font-variant-numeric:tabular-nums}',
    '.ink-panel_row input[type=range]{width:100%;margin:0;accent-color:#f2f1ec}',
    '.ink-panel_check{display:flex;align-items:center;gap:8px;color:#a9a9b6}',
    '.ink-panel_presets{display:flex;gap:6px;margin-top:12px}',
    '.ink-panel_presets select,.ink-panel_presets input{flex:1;min-width:0;border:1px solid #3a3a48;background:#101016;color:#f2f1ec;border-radius:8px;padding:5px 8px;font:inherit}',
    '.ink-panel_foot{display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:10px}',
    '.ink-panel_note{color:#7d7d8c;font-size:11px}'
  ].join('');
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  var panel = document.createElement('div');
  panel.className = 'ink-panel' + (state.open ? '' : ' is-closed');
  panel.setAttribute('data-ink', 'off');
  var html = '<div class="ink-panel_head"><span>Living ink · test controls</span><button type="button" data-act="toggle">' + (state.open ? 'Hide' : 'Show') + '</button></div><div class="ink-panel_body">';
  ROWS.forEach(function (r) {
    html += '<div class="ink-panel_row" title="' + r[5] + '"><label for="inkp-' + r[0] + '">' + r[1] + '<output id="inkp-' + r[0] + '-o"></output></label>' +
      '<input id="inkp-' + r[0] + '" type="range" min="' + r[2] + '" max="' + r[3] + '" step="' + r[4] + '" data-key="' + r[0] + '"></div>';
  });
  html += '<label class="ink-panel_check"><input type="checkbox" data-check="hide"> Hide the system arrow</label></div>' +
    '<div class="ink-panel_presets"><select data-preset aria-label="Presets"></select><input type="text" data-preset-name placeholder="name a preset" aria-label="Preset name"><button type="button" data-act="save">Save</button><button type="button" data-act="del">Delete</button></div>' +
    '<div class="ink-panel_foot"><span class="ink-panel_note" data-note>Saved in this browser, used on every page.</span><span><button type="button" data-act="copy">Copy</button> <button type="button" data-act="reset">Reset</button></span></div>';
  panel.innerHTML = html;
  document.body.appendChild(panel);
  var note = panel.querySelector('[data-note]');

  function values() { var o = {}; ROWS.forEach(function (r) { o[r[0]] = +(+ink.options[r[0]]).toFixed(2); }); o.hide = state.hide; return o; }
  function show(key) {
    var v = ink.options[key];
    panel.querySelector('#inkp-' + key).value = v;
    panel.querySelector('#inkp-' + key + '-o').textContent = key === 'size' ? Math.round(v * 100) + '%' : key === 'hold' ? (v ? 'on' : 'off') : (+v).toFixed(2);
  }
  function save() {
    var o = values(); o.open = state.open;
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* private mode */ }
  }
  function apply(key, v) {
    ink.options[key] = v;
    if (key === 'size' || key === 'goo') ink.resize();
    show(key);
  }
  function applyChecks() {
    ink.native(state.hide);
    if (ink.options.textTint !== 1) { ink.options.textTint = 1; ink.refresh(); }
    panel.querySelector('[data-check=hide]').checked = state.hide;
  }
  function listPresets(sel) {
    var s = panel.querySelector('[data-preset]');
    s.innerHTML = '<option value="">Presets…</option>' + Object.keys(presets).map(function (n) { return '<option>' + n.replace(/[<>&"]/g, '') + '</option>'; }).join('');
    s.value = sel && presets[sel] ? sel : '';
  }
  function load(o) {
    ROWS.forEach(function (r) { apply(r[0], typeof o[r[0]] === 'number' ? o[r[0]] : DEF[r[0]]); });
    if (typeof o.hide === 'boolean') state.hide = o.hide;
    applyChecks();
  }
  load(saved);
  listPresets('');

  panel.addEventListener('input', function (e) {
    var t = e.target;
    if (t.dataset.key) { apply(t.dataset.key, +t.value); save(); }
    else if (t.dataset.check) { state[t.dataset.check] = t.checked; applyChecks(); save(); }
  });
  panel.addEventListener('change', function (e) {
    if (e.target.hasAttribute('data-preset') && presets[e.target.value]) { load(presets[e.target.value]); save(); note.textContent = 'Loaded "' + e.target.value + '".'; }
  });
  panel.addEventListener('click', function (e) {
    var act = e.target.dataset && e.target.dataset.act;
    if (act === 'toggle') { state.open = !state.open; panel.classList.toggle('is-closed', !state.open); e.target.textContent = state.open ? 'Hide' : 'Show'; save(); ink.refresh(); }
    else if (act === 'reset') { state.hide = true; load(DEF); save(); note.textContent = 'Back to the defaults.'; }
    else if (act === 'save') {
      var name = panel.querySelector('[data-preset-name]').value.trim() || panel.querySelector('[data-preset]').value;
      if (!name) { note.textContent = 'Type a name first.'; return; }
      presets[name] = values();
      try { localStorage.setItem(PKEY, JSON.stringify(presets)); } catch (err) { /* private mode */ }
      listPresets(name); panel.querySelector('[data-preset-name]').value = ''; note.textContent = 'Saved "' + name + '".';
    } else if (act === 'del') {
      var cur = panel.querySelector('[data-preset]').value;
      if (!cur) { note.textContent = 'Pick a preset to delete.'; return; }
      delete presets[cur];
      try { localStorage.setItem(PKEY, JSON.stringify(presets)); } catch (err) { /* private mode */ }
      listPresets(''); note.textContent = 'Deleted "' + cur + '".';
    } else if (act === 'copy') {
      var v = values();
      var attrs = ROWS.map(function (r) { return 'data-ink-' + r[0] + '="' + v[r[0]] + '"'; }).join(' ') + (state.hide ? '' : ' data-ink-native="show"');
      var text = JSON.stringify(v) + '\n' + attrs;
      var done = function () { note.textContent = 'Copied the current values.'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { note.textContent = text; });
      else note.textContent = text;
    }
  });
})();
