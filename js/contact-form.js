/* contact-form: the general contact form on contact.html (presentation set 4, 2026-11-10).
   - Topic = choice_ radios (js/controls.js paints .is-selected / .is-focus). Each topic tunes the message prompt.
     "Start a project" is not a topic: it is a choice_card.is-link to #estimate (js/estimate.js opens the dialog).
   - Validation on submit (the button never disables, as the estimate): each invalid field gets c8a8e .is-invalid,
     aria-invalid and its calc_error row; the live hint under the button says what is missing; focus goes to the
     first problem. A field clears its message as soon as it is fixed.
   - Submit, same pattern as js/estimate.js: inside Webflow the native form handler posts; outside Webflow it POSTs
     FormData to data-endpoint when one is set; empty today, so it only shows the done state (static prototype).
     Either way it dispatches `cosmic:contact` on document with the answers. Open: where messages go. */
(function () {
  'use strict';
  var form = document.querySelector('[data-contact-form]');
  if (!form) return;
  var done = document.querySelector('[data-contact-done]');
  var doneTitle = done && done.querySelector('[data-contact-done-title]');
  var hint = form.querySelector('[data-contact-hint]');
  var prompt = form.querySelector('[data-contact-prompt]');
  var submitBtn = form.querySelector('[data-contact-submit]');
  var submitLabel = submitBtn && submitBtn.querySelector('.c1c31_label');
  var joined = form.querySelector('[data-contact-joined]');
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var PROMPTS = {
    '': prompt ? prompt.textContent : '',
    general: 'Ask away. The more detail, the better the answer.',
    customer: 'Which job was it, and what do you need? A street name or the month we worked helps us find it.',
    partner: 'Who you are, what you offer and what you have in mind.',
    other: 'Tell us what it’s about.'
  };
  var tried = false;

  function topic() { var r = form.querySelector('input[name="topic"]:checked'); return r ? r.value : ''; }
  function topicText() {
    var r = form.querySelector('input[name="topic"]:checked');
    var l = r && r.closest('.choice_card').querySelector('.choice_label');
    return l ? l.textContent.trim() : '';
  }

  /* each check returns '' when fine, else the message shown under the field */
  var CHECKS = {
    topic: function () { return topic() ? '' : 'Pick what your message is about.'; },
    name: function (v) { return v.trim() ? '' : 'Add your name.'; },
    email: function (v) { return !v.trim() ? 'Add your email, so we can reply.' : EMAIL.test(v.trim()) ? '' : 'That email doesn’t look right.'; },
    message: function (v) { return v.trim().length >= 10 ? '' : (v.trim() ? 'A little more detail, please.' : 'Write your message.'); },
    privacy: function (v, el) { return el.checked ? '' : 'Tick the box to agree to the privacy policy.'; }
  };
  var ERR_ID = { topic: 'contact-topic-err', name: 'contact-name-err', email: 'contact-email-err', message: 'contact-text-err', privacy: 'contact-privacy-err' };

  function show(key, msg) {
    var err = document.getElementById(ERR_ID[key]);
    if (err) {
      err.classList.toggle('is-hidden', !msg);
      var t = err.querySelector('[data-contact-error-text]');
      if (t) t.textContent = msg;
    }
    if (key === 'topic') return;
    var el = form.elements[key];
    var wrap = el.closest('.c8a8e_root');
    if (wrap) wrap.classList.toggle('is-invalid', !!msg);
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  }
  function check(key) {
    var el = key === 'topic' ? null : form.elements[key];
    var msg = CHECKS[key](el ? el.value : '', el);
    show(key, msg);
    return msg;
  }
  function validate() {
    var first = null, n = 0;
    Object.keys(CHECKS).forEach(function (k) {
      if (check(k)) { n++; if (!first) first = k; }
    });
    return { first: first, count: n };
  }
  function say(text, isError) {
    if (!hint) return;
    hint.textContent = text;
    hint.classList.toggle('is-error', !!isError);
  }

  form.addEventListener('change', function (e) {
    if (e.target.name === 'topic') {
      if (prompt) prompt.textContent = PROMPTS[topic()] || PROMPTS[''];
      if (tried) check('topic');
    }
    if (e.target.name === 'privacy' && tried) check('privacy');
  });
  form.addEventListener('input', function (e) {
    var k = e.target.name;
    if (tried && CHECKS[k] && k !== 'topic') check(k);
  });

  function answers() {
    var o = {};
    new FormData(form).forEach(function (v, k) { o[k] = v; });
    return o;
  }
  function finish() {
    document.dispatchEvent(new CustomEvent('cosmic:contact', { detail: answers() }));
    form.classList.add('is-hidden');
    if (done) done.classList.remove('is-hidden');
    if (doneTitle) doneTitle.focus({ preventScroll: false });
    say('');
  }
  function waiting(on) {
    if (!submitBtn) return;
    submitBtn.classList.toggle('is-waiting', on);
    if (submitLabel) submitLabel.textContent = on ? 'Sending…' : 'Send message';
  }

  form.addEventListener('submit', function (e) {
    if (!window.Webflow) e.preventDefault();
    tried = true;
    var v = validate();
    if (v.first) {
      if (window.Webflow) e.preventDefault();
      say(v.count === 1 ? 'One thing to fix before it sends.' : v.count + ' things to fix before it sends.', true);
      var target = v.first === 'topic' ? (form.querySelector('input[name="topic"]:checked') || form.querySelector('input[name="topic"]')) : form.elements[v.first];
      target.focus();
      return;
    }
    if (joined) joined.value = topicText();
    if (window.Webflow) { finish(); return; }   /* Webflow's own handler posts the form (it listens for submit) */
    var endpoint = form.getAttribute('data-endpoint');
    if (!endpoint) { finish(); return; }
    waiting(true);
    say('Sending…');
    fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); waiting(false); finish(); })
      .catch(function () { waiting(false); say('That didn’t go through. Please try again.', true); });
  });

  var again = done && done.querySelector('[data-contact-again]');
  if (again) again.addEventListener('click', function () {
    form.reset();
    tried = false;
    Object.keys(CHECKS).forEach(function (k) { show(k, ''); });
    if (prompt) prompt.textContent = PROMPTS[''];
    if (window.cosmicControls) window.cosmicControls.paintAll();
    done.classList.add('is-hidden');
    form.classList.remove('is-hidden');
    var first = form.querySelector('input[name="topic"]');
    if (first) first.focus();
  });

  window.cosmicContact = { validate: validate, answers: answers };
})();
