import { gsap, SplitText, prefersReduced } from './motion.js';
import { $$ } from './dom.js';

/**
 * Scroll-triggered entrances, declared in markup:
 *   data-reveal="lines"  text rises line by line from behind a mask
 *   data-reveal="fade"   a short rise and fade
 *   data-reveal="rule"   a hairline draws from the left
 * Optional data-delay="0.2" (seconds).
 */
export function initReveals(scope = document) {
  const reduced = prefersReduced();

  $$('[data-reveal]', scope).forEach((el) => {
    const kind = el.dataset.reveal;
    const delay = parseFloat(el.dataset.delay || '0');
    const trigger = { trigger: el, start: 'top 90%', once: true };

    if (reduced) {
      gsap.set(el, { visibility: 'visible' });
      return;
    }

    if (kind === 'lines') {
      SplitText.create(el, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'line',
        autoSplit: true,
        onSplit(self) {
          gsap.set(el, { visibility: 'visible' });
          return gsap.from(self.lines, {
            yPercent: 108,
            duration: 1.1,
            stagger: 0.09,
            delay,
            scrollTrigger: trigger,
          });
        },
      });
    } else if (kind === 'rule') {
      gsap.set(el, { visibility: 'visible' });
      gsap.from(el, {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 1.2,
        ease: 'fhInOut',
        delay,
        scrollTrigger: trigger,
      });
    } else {
      gsap.set(el, { visibility: 'visible' });
      gsap.from(el, { y: 28, opacity: 0, duration: 1, delay, scrollTrigger: trigger });
    }
  });
}
