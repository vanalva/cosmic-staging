/* services-deck: keeps the pagination dots of the "How it works" card stack in step with the stack.
   flwr's cardStack runtime cycles the cards but has no pagination hook, so this reads which slide is on top
   (last child of .flwr_card_stack_list) and marks the matching dot with .is-active.
   Root: .services-sec3_row (also .flwr_card_stack_wrap). Dots: .services-sec3_dot. Idempotent, no dependencies. */
(function () {
  'use strict';
  function init(root) {
    var list = root.querySelector('.flwr_card_stack_list');
    var dots = root.querySelectorAll('.services-sec3_dot');
    if (!list || !dots.length || root.__servicesDeck) return;
    root.__servicesDeck = true;
    /* Step order = DOM order reversed at load (the stack paints the last child on top). */
    var order = Array.prototype.slice.call(list.children).reverse();
    function sync() {
      var i = order.indexOf(list.lastElementChild);
      for (var k = 0; k < dots.length; k++) dots[k].classList.toggle('is-active', k === i);
    }
    new MutationObserver(sync).observe(list, { childList: true });
    sync();
  }
  function boot() {
    var roots = document.querySelectorAll('.services-sec3_row');
    for (var i = 0; i < roots.length; i++) init(roots[i]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
