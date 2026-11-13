/**
 * "Play the reel": a full-screen run through live specimens, one after
 * another. Nothing here is video. Each one is the real demo, and it waits for
 * you while your pointer is on it.
 */
import { gsap } from '../core/motion.js';
import { $, $$, escapeHtml, icon } from '../core/dom.js';
import { createOverlay } from '../core/overlay.js';
import { mountSpecimen } from '../specimens/runtime.js';
import { bySlug, layerOf, specimenHref } from '../core/regions.js';

const REEL = [
  'variable-proximity',
  'magnetic-button',
  'stagger-ripple',
  'dither-flow',
  'tilt-card',
  'spring-tether',
  'point-field',
]
  .map(bySlug)
  .filter(Boolean);

const SECONDS = 9;

export const reelLength = REEL.length;

export function createReel({ onOpen, onClose } = {}) {
  let el = null;
  let overlay = null;
  let host = null;
  let bars = [];
  let index = 0;
  let unmount = null;
  let timer = null;

  function build() {
    el = document.createElement('div');
    el.className = 'reel';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'The reel: live examples');
    el.innerHTML = `
      <div class="reel__bars" aria-hidden="true">${REEL.map(() => '<span class="reel__bar"><i></i></span>').join('')}</div>
      <header class="reel__head">
        <span class="label" data-reel-id></span>
        <strong data-reel-title></strong>
        <span class="label" data-reel-layer></span>
        <button class="reel__close label" type="button" data-reel-close>Close ${icon('close')}</button>
      </header>
      <div class="reel__stage"><div class="specimen-host" data-reel-host></div></div>
      <footer class="reel__foot">
        <p class="reel__summary" data-reel-summary></p>
        <div class="reel__nav">
          <button type="button" data-reel-step="-1" aria-label="Previous example">${icon('back')}</button>
          <a class="label" data-reel-link href="./library.html">Open with source</a>
          <button type="button" data-reel-step="1" aria-label="Next example">${icon('arrow')}</button>
        </div>
      </footer>`;
    document.body.append(el);

    host = $('[data-reel-host]', el);
    bars = $$('.reel__bar', el);
    overlay = createOverlay(el, {
      onRequestClose: () => overlay.hide(),
      onClosed() {
        timer?.kill();
        timer = null;
        unmount?.();
        unmount = null;
        onClose?.();
      },
    });

    $('[data-reel-close]', el).addEventListener('click', () => overlay.hide());
    el.addEventListener('click', (event) => {
      const step = event.target.closest('[data-reel-step]');
      if (step) play(index + Number(step.dataset.reelStep));
    });
    el.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') play(index + 1);
      else if (event.key === 'ArrowLeft') play(index - 1);
    });

    // The clock stops while you are playing with the example.
    const stage = $('.reel__stage', el);
    stage.addEventListener('pointerenter', () => timer?.pause());
    stage.addEventListener('pointerleave', () => timer?.resume());
  }

  function play(target) {
    index = ((target % REEL.length) + REEL.length) % REEL.length;
    const spec = REEL[index];

    $('[data-reel-id]', el).textContent = spec.id;
    $('[data-reel-title]', el).textContent = spec.title;
    $('[data-reel-layer]', el).textContent = layerOf(spec).name;
    $('[data-reel-summary]', el).textContent = spec.summary;
    $('[data-reel-link]', el).href = specimenHref(spec);
    $('[data-reel-link]', el).setAttribute('aria-label', `Open ${escapeHtml(spec.title)} with its source`);

    unmount?.();
    unmount = mountSpecimen(spec, host);

    bars.forEach((bar, n) => {
      bar.classList.toggle('is-past', n < index);
      gsap.set(bar, { '--p': 0 });
    });
    timer?.kill();
    timer = gsap.fromTo(
      bars[index],
      { '--p': 0 },
      { '--p': 1, duration: SECONDS, ease: 'none', onComplete: () => play(index + 1) },
    );
  }

  return {
    open(originRect) {
      if (!el) build();
      if (overlay.isOpen) return;
      onOpen?.();
      overlay.show(originRect);
      play(0);
      $('[data-reel-close]', el).focus({ preventScroll: true });
    },
  };
}
