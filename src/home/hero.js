/**
 * The hero: five regions shown one at a time. The photograph wipes in WebGL;
 * the headline, the card and the pager follow it.
 */
import { gsap, ScrollTrigger, prefersReduced, hasFinePointer } from '../core/motion.js';
import { $, $$, escapeHtml, plural } from '../core/dom.js';
import { REGIONS, STATS, image } from '../core/regions.js';
import { createSlider } from './slider.js';

const HOLD = 7; // seconds a region stays up before the next one arrives

const linesMarkup = (lines) =>
  lines.map((line) => `<span class="line"><span>${escapeHtml(line)}</span></span>`).join('');

const wait = (seconds) => new Promise((resolve) => gsap.delayedCall(seconds, resolve));

export function initHero() {
  const hero = $('[data-hero]');
  const frame = $('[data-frame]', hero);
  const poster = $('[data-poster]', hero);
  const canvas = $('[data-canvas]', hero);
  const backdrop = $('[data-backdrop]', hero);
  const title = $('[data-title]', hero);
  const cardInner = $('[data-card-inner]', hero);
  const track = $('[data-pager-track]', hero);
  const reduced = prefersReduced();
  const total = REGIONS.length;

  // Only genuinely small canvases get the lighter photographs.
  const density = Math.min(window.devicePixelRatio || 1, 1.75);
  const small = Math.max(window.innerWidth, window.innerHeight) * density <= 1000;
  const sources = REGIONS.map((region) => image(region.hero, small));
  const slider = createSlider(canvas, sources, { reduced });

  track.innerHTML = REGIONS.map(
    (region, i) =>
      `<button class="pager__seg" type="button" data-go="${i}" aria-label="${region.index} ${escapeHtml(region.name)}"><i></i></button>`,
  ).join('');
  const segs = $$('.pager__seg', track);

  let index = 0;
  let busy = false;
  let hold = null;
  const pauses = new Set();

  /* ---------- text and chrome that follow the photograph ---------- */

  function paint(i) {
    const region = REGIONS[i];
    $('[data-card-index]', hero).textContent = region.index;
    $('[data-card-name]', hero).textContent = region.name;
    $('[data-card-text]', hero).textContent = region.blurb;
    $('[data-card-count]', hero).textContent = plural(region.count, 'specimen');
    $('[data-card-link]', hero).href = region.href;
    $('[data-pager-now]', hero).textContent = region.index;
    $('[data-pager-name]', hero).textContent = region.name;
    segs.forEach((seg, n) => {
      seg.classList.toggle('is-past', n < i);
      seg.toggleAttribute('aria-current', n === i);
      gsap.set(seg, { '--p': reduced && n === i ? 1 : 0 });
    });
    backdrop.style.backgroundImage = `url("${image(region.hero, true)}")`;
  }

  /* ---------- the hold: a segment fills, then the next region arrives ---------- */

  function startHold() {
    hold?.kill();
    hold = null;
    if (reduced) return;
    hold = gsap.fromTo(
      segs[index],
      { '--p': 0 },
      { '--p': 1, duration: HOLD, ease: 'none', paused: pauses.size > 0, onComplete: () => go(index + 1, 1) },
    );
  }

  function pause(reason) {
    pauses.add(reason);
    hold?.pause();
  }

  function resume(reason) {
    pauses.delete(reason);
    if (!pauses.size) hold?.resume();
  }

  /* ---------- changing region ---------- */

  async function go(target, direction) {
    const next = ((target % total) + total) % total;
    if (busy || next === index) return;
    busy = true;
    hold?.kill();
    hold = null;

    const region = REGIONS[next];
    if (!reduced) {
      gsap.to($$('.line > span', title), { yPercent: -112, duration: 0.55, ease: 'power3.in', stagger: 0.05 });
      gsap.to(cardInner, { y: -10, autoAlpha: 0, duration: 0.35, ease: 'power2.in' });
    }

    const usable = slider && !slider.lost;
    const arrived = usable ? slider.go(next, direction).catch(() => {}) : Promise.resolve();
    if (usable) slider.preload((next + 1) % total);
    if (!usable) poster.src = image(region.hero, small);

    await wait(reduced ? 0 : 0.6);
    index = next;
    title.innerHTML = linesMarkup(region.title);
    paint(next);

    if (reduced) {
      gsap.set(cardInner, { y: 0, autoAlpha: 1 });
    } else {
      gsap.fromTo($$('.line > span', title), { yPercent: 112 }, { yPercent: 0, duration: 1.1, stagger: 0.09 });
      // The letters arrive a little narrow and open out to full width.
      gsap.fromTo(title, { '--squeeze': -12 }, { '--squeeze': 0, duration: 1.5 });
      gsap.fromTo(cardInner, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, delay: 0.1 });
    }

    await arrived;
    poster.src = image(region.hero, small);
    poster.alt = region.heroAlt;
    busy = false;
    startHold();
  }

  track.addEventListener('click', (event) => {
    const seg = event.target.closest('[data-go]');
    if (!seg) return;
    const target = Number(seg.dataset.go);
    go(target, target > index ? 1 : -1);
  });

  // The hold waits while the pointer is on something you might click.
  $$('[data-hold-pause]', hero).forEach((el) => {
    el.addEventListener('pointerenter', () => pause('hover'));
    el.addEventListener('pointerleave', () => resume('hover'));
    el.addEventListener('focusin', () => pause('focus'));
    el.addEventListener('focusout', () => resume('focus'));
  });

  document.addEventListener('visibilitychange', () => (document.hidden ? pause('tab') : resume('tab')));

  let inView = true;
  window.addEventListener('keydown', (event) => {
    if (!inView || pauses.has('reel') || event.target.closest?.('input, textarea, [contenteditable]')) return;
    if (event.key === 'ArrowRight') go(index + 1, 1);
    else if (event.key === 'ArrowLeft') go(index - 1, -1);
  });

  // Swipe sideways on the photograph. Vertical movement still scrolls the page.
  let swipe = null;
  frame.addEventListener('pointerdown', (event) => {
    if (event.target.closest('a, button')) return;
    swipe = { x: event.clientX, y: event.clientY };
  });
  window.addEventListener('pointerup', (event) => {
    if (!swipe) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) go(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  });
  window.addEventListener('pointercancel', () => (swipe = null));

  if (slider && hasFinePointer()) {
    hero.addEventListener(
      'pointermove',
      (event) => {
        slider.setPointer((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1);
      },
      { passive: true },
    );
  }

  /* ---------- the play button leans toward the pointer ---------- */

  const play = $('.play', hero);
  const ring = $('.play__ring', hero);
  if (hasFinePointer() && !reduced) {
    const xTo = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
    const yTo = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
    play.addEventListener('pointermove', (event) => {
      const box = ring.getBoundingClientRect();
      xTo((event.clientX - (box.left + box.width / 2)) * 0.3);
      yTo((event.clientY - (box.top + box.height / 2)) * 0.3);
    });
    play.addEventListener('pointerleave', () => {
      gsap.to(ring, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.45)', overwrite: true });
    });
  }

  /* ---------- numbers ---------- */

  const stats = $$('[data-stat]', hero);
  stats.forEach((el) => {
    el.textContent = STATS[el.dataset.stat].toLocaleString('en-US');
    el.style.minWidth = `${Math.ceil(el.getBoundingClientRect().width)}px`; // counting up must not shift the row
  });

  function countUp() {
    stats.forEach((el) => {
      const counter = { value: 0 };
      gsap.to(counter, {
        value: STATS[el.dataset.stat],
        duration: 1.8,
        ease: 'power3.out',
        onUpdate: () => (el.textContent = Math.round(counter.value).toLocaleString('en-US')),
      });
    });
  }

  /* ---------- opening: the framed photograph opens to fill the screen ---------- */

  paint(0);
  poster.alt = REGIONS[0].heroAlt;
  // On a slow connection the light version of the photograph stands in until the full one arrives.
  frame.style.backgroundImage = `url("${image(REGIONS[0].hero, true)}")`;

  let intro = null;
  if (!reduced) {
    gsap.set(frame, { scale: 0.84, borderRadius: 28 });
    intro = gsap
      .timeline({ paused: true, defaults: { ease: 'fhOut' } })
      .to(frame, { scale: 1, borderRadius: 0, duration: 1.7, ease: 'fhInOut' }, 0.2)
      .from([poster, canvas], { scale: 1.22, duration: 2.4 }, 0.2)
      .from('.nav > *', { y: -18, autoAlpha: 0, duration: 0.9, stagger: 0.07 }, 1.0)
      .from($$('.line > span', title), { yPercent: 112, duration: 1.25, stagger: 0.1 }, 1.0)
      .fromTo(title, { '--squeeze': -14 }, { '--squeeze': 0, duration: 1.7 }, 1.0)
      .from($('.hero__lede', hero), { y: 22, autoAlpha: 0, duration: 0.9 }, 1.3)
      .from($$('.hero__actions > *', hero), { y: 22, autoAlpha: 0, duration: 0.9, stagger: 0.09 }, 1.4)
      .from($('.card', hero), { x: 36, autoAlpha: 0, duration: 1.1 }, 1.45)
      .from($('.pager', hero), { autoAlpha: 0, duration: 0.8 }, 1.6)
      .from($$('.stats > div', hero), { y: 26, autoAlpha: 0, duration: 0.9, stagger: 0.09 }, 1.55)
      .add(countUp, 1.55)
      .from($('.hero__hint', hero), { autoAlpha: 0, duration: 0.8 }, 1.9)
      .add(startHold, 2.4);
  }

  const firstImage = slider
    ? slider.show(0).catch(() => {})
    : (poster.decode?.() ?? Promise.resolve()).catch(() => {});

  Promise.race([Promise.all([firstImage, document.fonts.ready]), new Promise((resolve) => setTimeout(resolve, 2800))]).then(
    () => {
      slider?.setRunning(true);
      slider?.preload(1);
      intro?.play();
    },
  );

  /* ---------- leaving: the frame pulls back as the page scrolls on ---------- */

  if (!reduced) {
    gsap
      .timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          onUpdate(self) {
            if (self.progress > 0.12) pause('scroll');
            else resume('scroll');
          },
        },
      })
      .to($('[data-pull]', hero), { scale: 0.86, borderRadius: 26, duration: 1 }, 0)
      .to($('[data-hero-body]', hero), { yPercent: -10, autoAlpha: 0, duration: 0.55 }, 0)
      .to($('[data-hero-chrome]', hero), { autoAlpha: 0, duration: 0.4 }, 0);
  }

  // Nothing is drawn, and no key is taken, once the hero has left the screen.
  ScrollTrigger.create({
    trigger: hero,
    start: 'top bottom',
    end: 'bottom top',
    onToggle(self) {
      inView = self.isActive;
      slider?.setRunning(self.isActive);
      if (self.isActive) resume('offscreen');
      else pause('offscreen');
    },
  });

  return { pause, resume };
}
