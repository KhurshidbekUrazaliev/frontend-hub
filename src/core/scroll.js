import Lenis from 'lenis';
import { gsap, ScrollTrigger, prefersReduced } from './motion.js';

let lenis = null;

/** Smooth scrolling, driven by the GSAP ticker so ScrollTrigger and Lenis share one clock. */
export function initScroll({ anchors = true } = {}) {
  if (prefersReduced()) return null; // native scrolling when the system asks for less motion

  lenis = new Lenis({ lerp: 0.11, anchors, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  return lenis;
}

export function scrollTo(target, options = {}) {
  if (lenis) {
    lenis.scrollTo(target, options);
    return;
  }
  if (typeof target === 'number') {
    window.scrollTo({ top: target });
  } else {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    el?.scrollIntoView();
  }
}

/** Freeze page scrolling while an overlay is open. */
export function lockScroll(locked) {
  if (lenis) {
    if (locked) lenis.stop();
    else lenis.start();
  }
  document.documentElement.classList.toggle('is-locked', locked);
}
