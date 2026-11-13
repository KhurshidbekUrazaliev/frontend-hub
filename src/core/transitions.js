import { gsap, prefersReduced } from './motion.js';
import { $ } from './dom.js';

const PAGE_NAMES = { library: 'Library', designs: 'Designs', admin: 'Admin' };

const pageKey = (pathname) => pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');

const labelFor = (url) => {
  const name = pageKey(url.pathname).split('/').pop();
  return PAGE_NAMES[name] || 'Frontend Hub';
};

/** Lift the curtain that covers the page while it loads. */
export function revealPage({ delay = 0 } = {}) {
  const curtain = $('.curtain');
  if (!curtain) return gsap.timeline();
  const label = $('.curtain__label span', curtain);

  if (prefersReduced()) {
    gsap.set(curtain, { visibility: 'hidden' });
    return gsap.timeline();
  }

  return gsap
    .timeline({ delay })
    .to(label, { yPercent: -110, duration: 0.5, ease: 'fhInOut' })
    .to(curtain, { yPercent: -100, duration: 0.85, ease: 'fhInOut' }, 0.1)
    .set(curtain, { visibility: 'hidden' });
}

export function hideCurtain() {
  const curtain = $('.curtain');
  if (curtain) gsap.set(curtain, { yPercent: -100, visibility: 'hidden' });
}

function leave(href, text) {
  const curtain = $('.curtain');
  if (!curtain || prefersReduced()) {
    window.location.assign(href);
    return;
  }
  const label = $('.curtain__label span', curtain);
  label.textContent = text;

  gsap
    .timeline({ onComplete: () => window.location.assign(href) })
    .set(curtain, { visibility: 'visible', yPercent: 100 })
    .set(label, { yPercent: 110 })
    .to(curtain, { yPercent: 0, duration: 0.65, ease: 'fhInOut' })
    .to(label, { yPercent: 0, duration: 0.6 }, 0.22);
}

/** Cover the page before following a link to another page of the site. */
export function initTransitions() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest?.('a[href]');
    if (!link || e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (pageKey(url.pathname) === pageKey(window.location.pathname)) return; // in-page anchors

    e.preventDefault();
    leave(url.href, labelFor(url));
  });

  // A page restored from the back/forward cache still has the curtain down.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) hideCurtain();
  });
}
