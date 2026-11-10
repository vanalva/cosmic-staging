/* Home hero motion (truck idle, night cloud). The imgs carry the animated SVG (Realizer flipbook)
   as their src, so the art moves with no script. Under prefers-reduced-motion this swaps each
   img[data-still-src] to its still frame (frame 0 of the same animation, same viewBox, so nothing
   jumps), and back when the setting changes. If the still file is missing, the animation stays. */
(function () {
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function apply() {
    var imgs = document.querySelectorAll('img[data-still-src]');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (!img.hasAttribute('data-anim-src')) img.setAttribute('data-anim-src', img.getAttribute('src'));
      var want = mq && mq.matches ? img.getAttribute('data-still-src') : img.getAttribute('data-anim-src');
      if (img.getAttribute('src') !== want) img.setAttribute('src', want);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);
  }
})();
