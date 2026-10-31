/* Gently reveal the explanation before scrolling just enough to read it. */
(() => {
  'use strict';
  const details = document.querySelector('.import-footer .scope-note');
  const summary = details?.querySelector('summary');
  const reveal = details?.querySelector('.support-reveal');
  if (!summary || !reveal) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let targetOpen = details.open;
  let animation = null;
  let revision = 0;

  function bringIntoView() {
    if (!details.open || document.body.classList.contains('loaded')) return;
    const content = reveal.getBoundingClientRect();
    const header = document.querySelector('header');
    const fixedHeader = header && ['fixed', 'sticky'].includes(getComputedStyle(header).position);
    const offset = 16 + (fixedHeader ? Math.max(0, header.getBoundingClientRect().bottom) : 0);
    const available = innerHeight - offset - 24;
    const distance = content.height > available
      ? summary.getBoundingClientRect().top - offset
      : content.bottom - innerHeight + 24;
    if (distance > 1) {
      window.scrollTo({top: scrollY + distance, behavior: reducedMotion.matches ? 'instant' : 'smooth'});
    }
  }

  function expand(open) {
    const currentRevision = ++revision;
    const startHeight = details.open ? reveal.getBoundingClientRect().height : 0;
    const startOpacity = details.open ? getComputedStyle(reveal).opacity : '0';
    animation?.cancel();
    animation = null;
    targetOpen = open;
    if (open) details.open = true;
    if (reducedMotion.matches || typeof reveal.animate !== 'function') {
      details.open = open;
      if (open) requestAnimationFrame(bringIntoView);
      return;
    }
    const height = open ? reveal.getBoundingClientRect().height : 0;
    const next = reveal.animate([
      {height: `${startHeight}px`, opacity: startOpacity, transform: `translateY(${startHeight ? 0 : -4}px)`},
      {height: `${height}px`, opacity: open ? 1 : 0, transform: `translateY(${open ? 0 : -4}px)`}
    ], {duration: open ? 340 : 240, easing: 'cubic-bezier(.22,.68,0,1)', fill: 'both'});
    animation = next;
    next.finished.then(() => {
      if (currentRevision !== revision) return;
      details.open = open;
      next.cancel();
      animation = null;
      if (open) requestAnimationFrame(bringIntoView);
    }).catch(() => {}); // A second click can reverse an unfinished transition.
  }

  summary.addEventListener('click', event => {
    event.preventDefault(); // Native keyboard activation also dispatches this click.
    expand(!targetOpen);
  });
})();
