/* review: the leave-a-review flow and the full-review view, one <dialog id="review"> per page
   (components/review.html, note notes/components/review.md). No dependencies.
   Rate view: a real radio group (5 radios, name="rating"). This script mirrors the state as combo classes on each
   .review_star label and its .review_fill star (Webflow-safe, no :checked + sibling selector):
     .is-selected  the star is part of the chosen rating
     .is-preview   the star is part of the hovered (mouse) or keyboard-focused rating
     .is-focus     the label's radio has keyboard focus (focus ring)
   Hover / focus preview, click / tap / Space / arrow keys set (native radios), Enter confirms and moves to the comment.
   5 stars: "Share it on Google" opens the Google review link in a new tab (native link) and sends the rating and
   comment; "Send to Cosmic only" sends without Google. 4 or fewer: comment (+ optional email), "Send feedback".
   Sending follows js/estimate.js: inside Webflow the native form handler posts; outside it POSTs FormData to the
   form's data-endpoint when set, else (static prototype) it only shows the thank-you. Either way it fires
   `cosmic:review` on document with { rating, path, comment, email }.
   Review gating: data-review-gate="soft" (default) shows "You can also post a public review on Google" after a
   4-or-fewer thank-you; "strict" leaves it out. Keep soft: Google's policy forbids review gating and the FTC 2024
   reviews rule targets suppressing negative reviews.
   Google link: data-google-review-url on the dialog. Until it holds a real https URL (it says
   "[Cosmic Google review link]", marked data-placeholder), every a[data-google-review] keeps its fallback href, a Google
   search for data-google-review-query. Once real, every such link on the page points at it and loses data-placeholder.
   Read view: any [data-review-read] inside a review card (cb3aa card, Services featured review) opens the card's
   review in full: stars, name, photo, text (the card's data-review-full when set, else its excerpt).
   Share: any [data-review-share] uses navigator.share (page URL + review text), else copies the link and says
   "Link copied" in an aria-live status (inside the dialog when it is open, else the page toast).
   Opens from a[href="#review"] / [data-review-open] (no rating selected), a page star row [data-review-quick]
   (preset to the picked star, see below), [data-review-read], or the URL hash #review on load.
   Closes on Close, Back to the site, Escape and a backdrop click; focus returns to the trigger. */
(function () {
  'use strict';
  var dlg = document.getElementById('review');
  var toast = document.querySelector('[data-review-toast]');
  var CARD = 'article.cb3aa_root, article.services-carousel_2_card';

  /* ---- Google review link: one place to set it (the dialog), every marked link follows ---- */
  function googleUrl() {
    var u = dlg ? (dlg.getAttribute('data-google-review-url') || '').trim() : '';
    if (/^https:\/\/\S+$/i.test(u)) return { url: u, real: true };
    var q = (dlg && dlg.getAttribute('data-google-review-query')) || 'Cosmic Austin reviews';
    return { url: 'https://www.google.com/search?q=' + encodeURIComponent(q).replace(/%20/g, '+'), real: false };
  }
  var google = googleUrl();
  document.querySelectorAll('a[data-google-review]').forEach(function (a) {
    a.setAttribute('href', google.url);
    if (!a.getAttribute('target')) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
    if (google.real) a.removeAttribute('data-placeholder');
  });

  /* ---- status: "Link copied" etc. (in the dialog when open, else the page toast) ---- */
  var toastTimer = 0;
  function status(msg) {
    var el = dlg && dlg.open ? dlg.querySelector('[data-review-status]') : toast;
    if (!el) return;
    el.textContent = '';
    requestAnimationFrame(function () { el.textContent = msg; });   /* re-set so a repeat is announced */
    if (el === toast) {
      toast.classList.add('is-shown');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.remove('is-shown'); }, 2600);
    }
  }

  /* ---- reading a card (Home cb3aa, Services featured review) ---- */
  function readCard(card) {
    var q = function (s) { return card ? card.querySelector(s) : null; };
    var name = q('.cb3aa_name, .services-carousel_2_name');
    var body = q('.cb3aa_body, .services-carousel_2_quote');
    var img = q('.cb3aa_avatar, .services-carousel_2_photo');
    var rate = q('[aria-label^="Rated"]');
    var n = rate ? parseInt((rate.getAttribute('aria-label').match(/\d/) || ['5'])[0], 10) : 5;
    return {
      name: name ? name.textContent.trim() : '',
      text: (card && card.getAttribute('data-review-full')) || (body ? body.textContent.trim() : ''),
      img: img ? img.getAttribute('src') : '',
      rating: n
    };
  }

  /* ---- share ---- */
  var current = null;   /* the review shown in the read view */
  function pageUrl() { return location.href.split('#')[0]; }
  function copy(url) {
    function fallback() {
      var t = document.createElement('textarea');
      t.value = url; t.setAttribute('readonly', ''); t.className = 'f-sr-only';
      (dlg && dlg.open ? dlg : document.body).appendChild(t);
      t.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      t.remove();
      status(ok ? 'Link copied' : 'Copy this link: ' + url);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { status('Link copied'); }, fallback);
    } else fallback();
  }
  function share(btn) {
    var inDialog = dlg && dlg.contains(btn);
    var r = inDialog ? current : readCard(btn.closest(CARD));
    var url = pageUrl();
    var text = r && r.text ? '“' + r.text + '”' + (r.name ? ' (' + r.name + ')' : '') : 'A Cosmic review';
    var data = { title: 'A Cosmic review', text: text, url: url };
    if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      navigator.share(data).catch(function (e) { if (!e || e.name !== 'AbortError') copy(url); });
    } else copy(url);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-review-share]');
    if (!b) return;
    e.preventDefault();
    share(b);
  });

  if (!dlg || typeof dlg.showModal !== 'function') return;

  /* ---- the dialog ---- */
  var $ = function (s, r) { return (r || dlg).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || dlg).querySelectorAll(s)); };
  var panel = $('[data-review-panel]'), form = $('[data-review-form]');
  var views = {}; $$('[data-review-view]').forEach(function (v) { views[v.getAttribute('data-review-view')] = v; });
  var stars = $$('[data-review-star]');
  var inputs = stars.map(function (s) { return $('.review_input', s); });
  var fills = stars.map(function (s) { return $('.review_fill', s); });
  var word = $('[data-review-word]'), more = $('[data-review-more]'), hint = $('[data-review-hint]');
  var comment = $('[data-review-comment]'), commentLabel = $('[data-review-comment-label]'), email = $('[data-review-email]');
  var closeTop = $('[data-review-close-top]'), logo = $('[data-review-logo]');
  var WORDS = ['Pick a star', 'Not good', 'Could be better', 'Okay', 'Good', 'Great'];
  var strict = dlg.getAttribute('data-review-gate') === 'strict';
  var rating = 0, preview = 0, sent = false, opener = null, view = 'rate';

  function paint() {
    stars.forEach(function (s, i) {
      var n = i + 1;
      var sel = n <= rating && (!preview || n <= preview);
      var pre = !!preview && n <= preview;
      s.classList.toggle('is-selected', sel); fills[i].classList.toggle('is-selected', sel);
      s.classList.toggle('is-preview', pre); fills[i].classList.toggle('is-preview', pre);
    });
    word.textContent = WORDS[preview || rating];
  }

  function tier() { return rating === 5 ? 'high' : 'low'; }
  function branch() {
    more.classList.toggle('is-hidden', !rating);
    if (!rating) return;
    var t = tier();
    $$('[data-review-for]', more).forEach(function (el) {
      var on = el.getAttribute('data-review-for') === t;
      el.classList.toggle('is-hidden', !on);
      $$('input, textarea, select', el).forEach(function (i) { i.disabled = !on; });
    });
    commentLabel.firstChild.nodeValue = commentLabel.getAttribute(t === 'high' ? 'data-high' : 'data-low') + ' ';
  }

  function say(msg) {
    hint.textContent = '';
    requestAnimationFrame(function () { hint.textContent = msg; });
  }

  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].classList.toggle('is-active', k === name); });
    view = name;
    var done = name === 'done';
    panel.classList.toggle('is-done', done);
    if (closeTop) closeTop.classList.toggle('is-invert', done);   /* registered cd421 variant: cream on blue */
    if (logo) logo.classList.toggle('is-invert', done);
    dlg.setAttribute('aria-labelledby', 'review-t-' + name);
    var t = $('.review_title', views[name]);
    if (t) t.focus({ preventScroll: true });
  }

  function reset() {
    form.reset();
    rating = 0; preview = 0; sent = false;
    hint.textContent = '';
    paint(); branch();
  }

  /* ---- sending (as js/estimate.js) ---- */
  function problem() {
    if (!rating) return 'Pick a star first.';
    if (email && !email.disabled && email.value.trim() && !email.checkValidity()) return 'Check the email, or leave it empty.';
    return '';
  }
  function finish(path) {
    sent = true;
    document.dispatchEvent(new CustomEvent('cosmic:review', { detail: {
      rating: rating, path: path, comment: comment.value.trim(), email: email && !email.disabled ? email.value.trim() : ''
    } }));
    $$('[data-review-done]', views.done).forEach(function (p) {
      p.classList.toggle('is-hidden', p.getAttribute('data-review-done') !== path);
    });
    var pub = $('[data-review-public]', views.done);
    if (pub) pub.classList.toggle('is-hidden', strict || path !== 'feedback');
    show('done');
  }
  function submit(path) {
    var p = problem();
    if (p) { say(p); return false; }
    hint.textContent = '';
    $('[data-review-path]', form).value = path;
    $('[data-review-page]', form).value = location.pathname;
    if (window.Webflow) {             /* Webflow's own handler posts the form (it listens for submit) */
      if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      finish(path);
      return true;
    }
    var endpoint = form.getAttribute('data-endpoint');
    if (!endpoint) { finish(path); return true; }
    say('Sending…');
    fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); finish(path); })
      .catch(function () { say('That didn’t go through. Try again, or email us.'); });
    return true;
  }
  form.addEventListener('submit', function (e) { if (!window.Webflow) e.preventDefault(); });

  /* ---- stars ---- */
  function starOf(el) { return el && el.closest ? el.closest('[data-review-star]') : null; }
  function numOf(star) { return star ? +star.getAttribute('data-review-star') : 0; }
  var starBox = $('[data-review-stars]');
  starBox.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse') return;   /* touch has no hover: a tap sets */
    var n = numOf(starOf(e.target));
    if (n && n !== preview) { preview = n; paint(); }
  });
  starBox.addEventListener('pointerleave', function () { if (preview) { preview = 0; paint(); } });
  inputs.forEach(function (input, i) {
    input.addEventListener('change', function () {
      if (!input.checked) return;
      rating = i + 1;
      if (preview && !stars[i].classList.contains('is-focus')) preview = 0;
      else if (preview) preview = rating;
      hint.textContent = '';
      paint(); branch();
    });
    input.addEventListener('focus', function () {
      var fv = false;
      try { fv = input.matches(':focus-visible'); } catch (x) { fv = true; }
      stars[i].classList.toggle('is-focus', fv);
      if (fv) { preview = i + 1; paint(); }
    });
    input.addEventListener('blur', function () {
      stars[i].classList.remove('is-focus');
      if (preview) { preview = 0; paint(); }
    });
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (!input.checked) { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); }
      comment.focus();
    });
  });

  /* ---- actions ---- */
  $$('[data-review-send]').forEach(function (b) {
    b.addEventListener('click', function () { submit(rating === 5 ? 'private' : 'feedback'); });
  });
  var googleBtn = $('[data-review-google]');
  if (googleBtn) googleBtn.addEventListener('click', function () { submit('google'); });   /* the link itself opens Google */
  $$('[data-review-close]').forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
  form.addEventListener('keydown', function (e) {   /* Enter in the email field sends; never in the textarea */
    if (e.key === 'Enter' && e.target === email) { e.preventDefault(); submit('feedback'); }
  });

  /* backdrop click: the dialog box is the panel, so a click whose target is the dialog itself landed outside it */
  dlg.addEventListener('click', function (e) {
    if (e.target !== dlg) return;
    var r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
  });

  /* ---- read view ---- */
  function fillRead(r) {
    current = r;
    $('[data-review-read-name]').textContent = r.name || 'A Cosmic client';
    $('[data-review-read-text]').textContent = r.text;
    var av = $('[data-review-read-avatar]');
    av.classList.toggle('is-hidden', !r.img);
    if (r.img) av.setAttribute('src', r.img);
    $$('[data-review-read-star]').forEach(function (s, i) { s.classList.toggle('is-hidden', i >= r.rating); });
    $('[data-review-read-rating]').setAttribute('aria-label', 'Rated ' + r.rating + ' out of 5');
    $('[data-review-status]').textContent = '';
  }

  /* ---- open / close ---- */
  /* preset: 0 = open with nothing selected ("Leave a review"), 1-5 = a page star row picked that rating */
  function setRating(n) {
    inputs.forEach(function (i, k) { i.checked = k + 1 === n; });
    rating = n; preview = 0; hint.textContent = '';
    paint(); branch();
  }
  function open(trigger, mode, card, preset) {
    opener = trigger || null;
    if (mode === 'read') fillRead(readCard(card));
    else {
      if (sent) reset();
      setRating(preset || 0);   /* the typed comment survives; the rating always comes from this trigger */
    }
    if (!dlg.open) dlg.showModal();
    document.body.style.overflow = 'hidden';
    show(mode === 'read' ? 'read' : 'rate');
  }
  dlg.addEventListener('close', function () {
    document.body.style.overflow = '';
    if (sent) reset();
    paintQuick(rating);
    if (location.hash === '#review' && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var t = e.target.closest('[data-review-read]');
    if (t && !dlg.contains(t)) { e.preventDefault(); open(t, 'read', t.closest(CARD)); return; }
    t = e.target.closest('a[href="#review"], [data-review-open]');
    if (t && !dlg.contains(t)) { e.preventDefault(); open(t, 'rate'); }
  });

  /* ---- quick rating on the page ([data-review-quick]: Home's star row) ----
     5 radios, outlined until chosen; same .is-selected / .is-preview / .is-focus mirroring as the dialog.
     Mouse hover and keyboard focus preview. A click or tap on star N opens the dialog with N selected (so it goes
     straight to the 5-star or the 4-and-below path). Keyboard: arrows / Home / End move and select without opening,
     Enter or Space opens with the focused star. After the dialog closes the row shows the dialog's rating (none once
     a review was sent). */
  var quick = Array.prototype.slice.call(document.querySelectorAll('[data-review-quick]'));
  function quickParts(row) {
    var labels = Array.prototype.slice.call(row.querySelectorAll('[data-review-quick-star]'));
    return { labels: labels, inputs: labels.map(function (l) { return l.querySelector('input'); }),
      fills: labels.map(function (l) { return l.querySelector('.review_quick_fill'); }) };
  }
  function paintRow(row, sel, pre) {
    var q = quickParts(row);
    q.labels.forEach(function (l, i) {
      var n = i + 1, on = n <= sel && (!pre || n <= pre), p = !!pre && n <= pre;
      l.classList.toggle('is-selected', on); if (q.fills[i]) q.fills[i].classList.toggle('is-selected', on);
      l.classList.toggle('is-preview', p); if (q.fills[i]) q.fills[i].classList.toggle('is-preview', p);
      q.inputs[i].checked = n === sel;
    });
    row.__sel = sel;
  }
  function paintQuick(n) { quick.forEach(function (row) { paintRow(row, n, 0); }); }
  quick.forEach(function (row) {
    var q = quickParts(row);
    row.__sel = 0;
    row.addEventListener('pointerover', function (e) {
      if (e.pointerType !== 'mouse') return;
      var l = e.target.closest('[data-review-quick-star]');
      if (l) paintRow(row, row.__sel, +l.getAttribute('data-review-quick-star'));
    });
    row.addEventListener('pointerleave', function () { paintRow(row, row.__sel, 0); });
    q.labels.forEach(function (l, i) {
      var input = q.inputs[i], n = i + 1;
      l.addEventListener('click', function (e) {
        if (e.target === input) return;   /* the label's own click; the input's synthetic click follows and is ignored */
        e.preventDefault();
        paintRow(row, n, 0);
        open(input, 'rate', null, n);
      });
      input.addEventListener('focus', function () {
        var fv = false;
        try { fv = input.matches(':focus-visible'); } catch (x) { fv = true; }
        l.classList.toggle('is-focus', fv);
        if (fv) paintRow(row, row.__sel, n);
      });
      input.addEventListener('blur', function () { l.classList.remove('is-focus'); paintRow(row, row.__sel, 0); });
      input.addEventListener('keydown', function (e) {
        var k = e.key, to = 0;
        if (k === 'ArrowRight' || k === 'ArrowDown') to = Math.min(5, n + 1);
        else if (k === 'ArrowLeft' || k === 'ArrowUp') to = Math.max(1, n - 1);
        else if (k === 'Home') to = 1;
        else if (k === 'End') to = 5;
        else if (k === 'Enter' || k === ' ') { e.preventDefault(); paintRow(row, n, 0); open(input, 'rate', null, n); return; }
        else return;
        e.preventDefault();   /* own roving: native arrows would select and fire change; here they only move */
        paintRow(row, to, 0);
        q.inputs[to - 1].focus();
      });
    });
  });

  paint(); branch();
  if (location.hash === '#review') open(null, 'rate');
  window.cosmicReview = { open: function (t, n) { open(t, 'rate', null, n); }, close: function () { dlg.close(); }, reset: reset };
})();
