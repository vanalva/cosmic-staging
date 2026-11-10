/* legal-404: the site search on 404.html (presentation set 5). The registered search_ field (js/search.js) with the
   site's pages as items; picking one goes there. Items carry keywords so "primer" or "referral" find the right page.
   When the CMS exists this list comes from the sitemap. */
(function () {
  'use strict';
  var PAGES = [
    { label: 'Home', meta: 'Start here', value: 'index.html', k: 'cosmic austin home' },
    { label: 'Services', meta: 'Everything we do', value: 'services.html', k: 'painting repairs carpentry power washing fences decks handyman' },
    { label: 'Painting', meta: 'Service', value: 'service-detail.html', k: 'paint interior exterior walls cabinets' },
    { label: 'Projects', meta: 'Our work', value: 'projects.html', k: 'before after portfolio homes businesses' },
    { label: 'From the Field', meta: 'Notes from jobs', value: 'field.html', k: 'field crew stories journal news' },
    { label: 'DIY guides', meta: 'Do it yourself', value: 'diy.html', k: 'diy how to guides tips' },
    { label: 'Paint kitchen cabinets', meta: 'DIY guide', value: 'diy-guide-paint-kitchen-cabinets.html', k: 'cabinets kitchen paint guide' },
    { label: 'Do I need primer?', meta: 'Quick answer', value: 'diy-question-do-i-need-primer.html', k: 'primer question answer' },
    { label: 'Paint calculator', meta: 'Tool', value: 'diy-tool-paint-calculator.html', k: 'gallons calculator how much paint' },
    { label: 'About Cosmic', meta: 'Who we are', value: 'about.html', k: 'about team story crew' },
    { label: 'The Cosmic Club', meta: 'Referrals and perks', value: 'club.html', k: 'club referral refer neighbor credit perks member' },
    { label: 'Contact', meta: 'Send a message', value: 'contact.html', k: 'contact message email phone question' },
    { label: 'Legal', meta: 'Terms, privacy, cookies', value: 'legal.html', k: 'terms privacy policy cookies legal data' }
  ];
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
  function match(it, q) {
    if (!q) return 0;
    var l = norm(it.label);
    if (l.indexOf(q) === 0) return 3;
    if (l.indexOf(q) > 0) return 2;
    return (' ' + norm(it.meta + ' ' + it.k)).indexOf(' ' + q) >= 0 ? 1 : 0;
  }
  function start() {
    var root = document.querySelector('[data-lost-search]');
    if (!root || !window.cosmicSearch) return;
    window.cosmicSearch(root, {
      items: PAGES,
      match: match,
      onPick: function (it) { window.location.href = it.value; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
