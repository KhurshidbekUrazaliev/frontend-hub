import { $, $$ } from './dom.js';
import { lockScroll } from './scroll.js';

/**
 * The site navigation. It slides away while you scroll down and comes back
 * when you scroll up, and it gains a backdrop once it is over page content.
 *
 * @param {{ solidAfter?: () => number }} [options] the scroll position past
 *   which the bar gets its backdrop (the landing page waits for the hero to end)
 */
export function initNav({ solidAfter = () => 24 } = {}) {
  const nav = $('[data-nav]');
  if (!nav) return;

  // The admin panel only exists on the local dev server.
  if (import.meta.env.DEV) $$('[data-dev-only]').forEach((el) => (el.hidden = false));

  const toggle = $('[data-menu-toggle]');
  const menu = $('[data-menu]');
  let lastY = window.scrollY;
  let ticking = false;
  let menuOpen = false;

  const update = () => {
    ticking = false;
    const y = window.scrollY;
    nav.classList.toggle('is-solid', y > solidAfter());
    if (Math.abs(y - lastY) < 6) return;
    nav.classList.toggle('is-hidden', y > lastY && y > window.innerHeight * 0.6 && !menuOpen);
    lastY = y;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );
  update();

  // Keyboard users must never tab into a bar that has slid away.
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));

  if (!toggle || !menu) return;

  const setMenu = (open) => {
    menuOpen = open;
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) nav.classList.remove('is-hidden');
    lockScroll(open);
  };

  toggle.addEventListener('click', () => setMenu(!menuOpen));
  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !menuOpen) return;
    setMenu(false);
    toggle.focus();
  });
  window.matchMedia('(min-width: 761px)').addEventListener('change', (event) => {
    if (event.matches && menuOpen) setMenu(false);
  });
}
