/* Bring the newly opened format explanation into view, including keyboard toggles. */
(() => {
  'use strict';
  const details = document.querySelector('.import-footer .scope-note');
  if (!details) return;
  details.addEventListener('toggle', () => {
    if (!details.open) return;
    requestAnimationFrame(() => {
      if (!details.open || document.body.classList.contains('loaded')) return;
      const summary = details.querySelector('summary');
      const header = document.querySelector('header');
      const fixedHeader = header && ['fixed', 'sticky'].includes(getComputedStyle(header).position);
      const offset = 16 + (fixedHeader ? Math.max(0, header.getBoundingClientRect().bottom) : 0);
      const top = window.scrollY + summary.getBoundingClientRect().top - offset;
      // Opening only moves down; closing never changes the user's scroll position.
      if (top > window.scrollY + 1) {
        window.scrollTo({top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
      }
    });
  });
})();
