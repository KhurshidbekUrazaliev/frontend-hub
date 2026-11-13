import { gsap, prefersReduced } from './motion.js';
import { $, $$ } from './dom.js';
import { splitChars } from './text.js';
import { revealPage } from './transitions.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Entrance for the inner pages (Library, Designs): the curtain lifts, the
 * page title rises letter by letter, and the supporting pieces follow.
 */
export async function pageIntro() {
  const title = $('[data-page-title]');
  const items = $$('[data-page-in]');

  await Promise.race([document.fonts.ready, wait(1500)]);

  const chars = title ? splitChars(title) : [];
  gsap.set([title, ...items].filter(Boolean), { visibility: 'visible' });
  revealPage();

  if (prefersReduced()) return;
  gsap.from(chars, { yPercent: 120, duration: 1.2, stagger: 0.03, delay: 0.35 });
  gsap.from(items, { y: 22, opacity: 0, duration: 1, stagger: 0.08, delay: 0.6, clearProps: 'transform,opacity' });
}
