/* The landing page. */
import { ScrollTrigger } from '../core/motion.js';
import { $, $$ } from '../core/dom.js';
import { initScroll } from '../core/scroll.js';
import { initNav } from '../core/nav.js';
import { initFooter } from '../core/footer.js';
import { initTransitions } from '../core/transitions.js';
import { initReveals } from '../core/reveal.js';
import { initCursorLabel } from '../core/cursor.js';
import { image } from '../core/regions.js';
import { initHero } from './hero.js';
import { createReel, reelLength } from './reel.js';
import { initPremise, initBench, initEnd } from './sections.js';
import { initDescent } from './descent.js';
import { initManifest } from './manifest.js';

const root = document.documentElement;

/* The hero slider already shows each region's main photograph, so the descent
   leads with the other pictures of the same place. Where a region has a second
   wide shot, that one hangs at the back; otherwise the main one returns there. */
const SECOND_SHOT = { type: 'hero-type', motion: 'hero-motion' };

function init() {
  initScroll();
  const hero = initHero();
  root.classList.add('is-ready'); // the hero has set its own starting state; CSS can let go

  // The bar turns solid once the hero's photograph is no longer behind it.
  const heroEl = $('[data-hero]');
  initNav({ solidAfter: () => heroEl.offsetHeight - 120 });
  initTransitions();

  initPremise();
  initDescent({
    font: '800 expanded %spx "Archivo Variable"',
    lazy: true, // the 3D library is fetched as the section approaches, not with the hero
    pictures: (region, small) => [
      image(region.wide, small),
      image(region.detail, true),
      image(SECOND_SHOT[region.key] || region.hero, true),
    ],
    poster: (region) => ({ src: image(region.wide, true), alt: region.wideAlt }),
  });
  initManifest({ first: 'variable-proximity' });
  initEnd();
  initFooter();
  initReveals();
  initCursorLabel();
  initBench();

  /* ---------- the reel ---------- */

  const reel = createReel({
    onOpen: () => hero.pause('reel'),
    onClose: () => hero.resume('reel'),
  });
  $$('[data-reel-count]').forEach((el) => (el.textContent = reelLength));
  $$('[data-reel-open]').forEach((button) => {
    button.addEventListener('click', () => reel.open($('.play__ring', button)?.getBoundingClientRect()));
  });

  document.fonts.ready.then(() => ScrollTrigger.refresh());
}

try {
  init();
} catch (error) {
  console.error('[frontend-hub] the landing page failed to start', error);
  root.classList.add('no-anim', 'is-ready');
}
