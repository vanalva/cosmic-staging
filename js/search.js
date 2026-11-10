/* search: Cosmic search field with a suggestion list (ARIA 1.2 combobox). Generic: any [data-search] root.
   Markup contract (components/search-field.html):
     [data-search]            root (.search_root)
       [data-search-input]    the text input (role=combobox, aria-controls -> the list id)
       [data-search-clear]    clear button (.search_clear, .is-hidden while empty)
       [data-search-list]     the <ul role=listbox> (.flwr_command_list.search_list, .is-hidden while closed);
                              items are flwr_command_item, the keyboard-highlighted one gets flwr's .is-active
       [data-search-value]    hidden input that receives the picked item's value
   Data comes from the page script: window.cosmicSearch(root, { items: [{label, meta, value}], match, onPick, onClear,
   onType, freeText }) where freeText(query) may return an extra item (e.g. "Use ZIP 78745") or null.
   Keys: Down/Up move, Enter picks, Escape closes (a second Escape clears), Tab closes. */
(function () {
  'use strict';
  var uid = 0;

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  function defaultMatch(item, q) {
    if (!q) return 0;
    var l = norm(item.label), m = norm(item.meta);
    if (l.indexOf(q) === 0 || m.indexOf(q) === 0) return 2;
    if (l.indexOf(q) > 0 || l.indexOf(' ' + q) >= 0) return 1;
    return 0;
  }

  function setup(root, opts) {
    if (!root || root.__search) return root && root.__search;
    opts = opts || {};
    var input = root.querySelector('[data-search-input]');
    var list = root.querySelector('[data-search-list]');
    var clear = root.querySelector('[data-search-clear]');
    var hidden = root.querySelector('[data-search-value]');
    if (!input || !list) return null;
    var items = opts.items || [];
    var max = opts.max || 6;
    var shown = [], active = -1, picked = null;
    var id = list.id || ('search-list-' + (++uid));
    list.id = id;

    function open(on) {
      list.classList.toggle('is-hidden', !on);
      input.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (!on) { active = -1; input.removeAttribute('aria-activedescendant'); }
    }

    function paintActive() {
      var lis = list.children;
      for (var i = 0; i < lis.length; i++) {
        var on = i === active;
        lis[i].classList.toggle('is-active', on);
        lis[i].setAttribute('aria-selected', on ? 'true' : 'false');
      }
      if (active >= 0 && lis[active]) {
        input.setAttribute('aria-activedescendant', lis[active].id);
        lis[active].scrollIntoView({ block: 'nearest' });
      } else input.removeAttribute('aria-activedescendant');
    }

    function render() {
      var q = norm(input.value);
      clear && clear.classList.toggle('is-hidden', !input.value);
      var match = opts.match || defaultMatch;
      shown = q ? items.map(function (it) { return { it: it, s: match(it, q) }; })
        .filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .slice(0, max).map(function (x) { return x.it; }) : [];
      var extra = opts.freeText ? opts.freeText(input.value.trim()) : null;
      if (extra && !shown.some(function (s) { return s.value === extra.value && s.label === extra.label; })) shown.unshift(extra);
      list.innerHTML = '';
      shown.forEach(function (it, i) {
        var li = document.createElement('li');
        li.className = 'flwr_command_item search_option';
        li.id = id + '-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        var l = document.createElement('span');
        l.className = 'f-text-body search_option_label';
        l.textContent = it.label;
        li.appendChild(l);
        if (it.meta) {
          var m = document.createElement('span');
          m.className = 'flwr_command_item_meta f-text-small search_option_meta';
          m.textContent = it.meta;
          li.appendChild(m);
        }
        li.addEventListener('mousedown', function (e) { e.preventDefault(); });   /* keep focus in the input */
        li.addEventListener('click', function () { pick(it); });
        list.appendChild(li);
      });
      active = shown.length ? 0 : -1;
      open(shown.length > 0 && document.activeElement === input);
      paintActive();
    }

    function pick(it) {
      picked = it;
      input.value = it.display || it.label;
      if (hidden) hidden.value = it.value;
      clear && clear.classList.remove('is-hidden');
      open(false);
      opts.onPick && opts.onPick(it);
    }

    function reset(silent) {
      picked = null;
      input.value = '';
      if (hidden) hidden.value = '';
      clear && clear.classList.add('is-hidden');
      list.innerHTML = '';
      open(false);
      if (!silent && opts.onClear) opts.onClear();
    }

    input.addEventListener('input', function () {
      if (picked) { picked = null; if (hidden) hidden.value = ''; opts.onClear && opts.onClear(); }
      opts.onType && opts.onType(input.value);
      render();
    });
    input.addEventListener('focus', function () { if (!picked && input.value) render(); });
    input.addEventListener('blur', function () { setTimeout(function () { open(false); }, 0); });
    input.addEventListener('keydown', function (e) {
      var isOpen = !list.classList.contains('is-hidden');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) { render(); return; }
        if (!shown.length) return;
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length;
        paintActive();
      } else if (e.key === 'Enter') {
        if (isOpen && active >= 0) { e.preventDefault(); e.stopPropagation(); pick(shown[active]); }
      } else if (e.key === 'Escape') {
        if (isOpen) { e.preventDefault(); e.stopPropagation(); open(false); }
        else if (input.value) { e.preventDefault(); e.stopPropagation(); reset(); }
      } else if (e.key === 'Tab') open(false);
    });
    clear && clear.addEventListener('click', function () { reset(); input.focus(); });

    var api = {
      pick: pick, reset: reset,
      value: function () { return picked; },
      setItems: function (a) { items = a || []; }
    };
    root.__search = api;
    return api;
  }

  window.cosmicSearch = setup;
})();
