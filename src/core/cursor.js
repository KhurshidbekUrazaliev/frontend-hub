import { gsap, hasFinePointer } from './motion.js';
import { $ } from './dom.js';

/**
 * A small label that follows the pointer and only appears where it has
 * something to say: over any element carrying a `data-cursor` hint.
 */
export function initCursorLabel() {
  const el = $('.cursor-label');
  if (!el || !hasFinePointer()) return;

  const follow = { duration: 0.35, ease: 'power3' };
  const xTo = gsap.quickTo(el, 'x', follow);
  const yTo = gsap.quickTo(el, 'y', follow);
  let current = null;
  let placed = false;
  let x = 0;
  let y = 0;

  const show = (text) => {
    if (text === current) return;
    current = text;
    if (text) {
      el.textContent = text;
      gsap.to(el, { autoAlpha: 1, scale: 1, duration: 0.3, overwrite: 'auto' });
    } else {
      gsap.to(el, { autoAlpha: 0, scale: 0.7, duration: 0.2, overwrite: 'auto' });
    }
  };

  const hintAt = (node) => node?.closest?.('[data-cursor]')?.dataset.cursor || null;

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (!placed) {
        gsap.set(el, { x: x + 14, y: y + 16, scale: 0.7 });
        placed = true;
      }
      xTo(x + 14);
      yTo(y + 16);
      show(hintAt(e.target));
    },
    { passive: true },
  );

  // The page can move under a still pointer; re-check what it is over.
  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking || !placed) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        show(hintAt(document.elementFromPoint(x, y)));
      });
    },
    { passive: true },
  );

  document.documentElement.addEventListener('pointerleave', () => show(null));
  window.addEventListener('blur', () => show(null));
}
