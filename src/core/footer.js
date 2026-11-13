import { gsap, prefersReduced, hasFinePointer } from './motion.js';
import { $, $$, clamp } from './dom.js';
import { scrollTo } from './scroll.js';

/**
 * Footer: back-to-top, and the wordmark. The word is sized to span the footer
 * exactly, rises into place when it scrolls into view, and its letters narrow
 * and lighten as the pointer passes over them.
 */
export function initFooter() {
  $('[data-top]')?.addEventListener('click', () => scrollTo(0, { duration: 1.6 }));

  const mark = $('[data-word]');
  if (!mark) return;

  mark.innerHTML = `<span>${[...mark.textContent.trim()]
    .map((letter) => (letter === ' ' ? ' ' : `<span class="char">${letter}</span>`))
    .join('')}</span>`;
  const inner = mark.firstElementChild;
  const chars = $$('.char', mark);

  // Set the size so the word spans the footer exactly, whatever the width.
  const fit = () => {
    const parent = mark.parentElement;
    const style = getComputedStyle(parent);
    const room = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    mark.style.fontSize = '100px';
    const natural = inner.getBoundingClientRect().width;
    if (natural > 0) mark.style.fontSize = `${((100 * room) / natural).toFixed(2)}px`;
  };
  document.fonts.ready.then(fit);
  new ResizeObserver(fit).observe(document.documentElement);

  if (prefersReduced()) return;

  gsap.from(chars, {
    yPercent: 105,
    duration: 1.3,
    stagger: 0.035,
    scrollTrigger: { trigger: mark, start: 'top 96%', once: true },
  });

  if (!hasFinePointer()) return;

  let frame = 0;
  let pointerX = null;
  const update = () => {
    frame = 0;
    // Read every position first, then write.
    const centres = chars.map((char) => {
      const box = char.getBoundingClientRect();
      return box.left + box.width / 2;
    });
    chars.forEach((char, i) => {
      const near = pointerX === null ? 0 : clamp(1 - Math.abs(pointerX - centres[i]) / 260, 0, 1);
      const eased = near * near * (3 - 2 * near);
      char.style.setProperty('--w', (100 - eased * 26).toFixed(1));
      char.style.setProperty('--g', Math.round(800 - eased * 520));
    });
  };
  const request = () => (frame ||= requestAnimationFrame(update));

  mark.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    request();
  });
  mark.addEventListener('pointerleave', () => {
    pointerX = null;
    request();
  });
}
