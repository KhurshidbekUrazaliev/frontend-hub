/** The landing page's simpler sections: the premise, the placed designs, the closing photograph. */
import { gsap, ScrollTrigger, SplitText, prefersReduced } from '../core/motion.js';
import { $, $$, escapeHtml } from '../core/dom.js';
import { featuredDesigns, designHref, designMedia, designType } from '../core/designs-data.js';

/* ---------- Premise: the statement lights up word by word ---------- */

export function initPremise() {
  const el = $('[data-words]');
  if (!el || prefersReduced()) return;

  SplitText.create(el, {
    type: 'words',
    wordsClass: 'word',
    autoSplit: true,
    onSplit(self) {
      return gsap.fromTo(
        self.words,
        { opacity: 0.16 },
        {
          opacity: 1,
          ease: 'none',
          stagger: 0.5,
          scrollTrigger: { trigger: el, start: 'top 84%', end: 'bottom 58%', scrub: true },
        },
      );
    },
  });
}

/* ---------- Bench: the designs placed through the admin panel ---------- */

export async function initBench() {
  const section = $('[data-bench]');
  const grid = $('[data-bench-grid]');
  if (!section) return;

  const designs = await featuredDesigns(3);
  if (!designs.length) return;

  grid.innerHTML = designs
    .map(
      (design) => `
      <a class="piece" href="${designHref(design)}" data-cursor="Open">
        <div class="piece__media">${designMedia(design)}</div>
        <div class="piece__cap">
          <h3>${escapeHtml(design.title)}</h3>
          <span class="label">${escapeHtml(designType(design))}</span>
        </div>
      </a>`,
    )
    .join('');
  section.hidden = false;

  $$('.piece', grid).forEach((piece) => {
    const video = $('video', piece);
    if (!video) return;
    piece.addEventListener('pointerenter', () => video.play().catch(() => {}));
    piece.addEventListener('pointerleave', () => {
      video.pause();
      video.currentTime = 0;
    });
  });

  if (!prefersReduced()) {
    gsap.from($$('.piece', grid), {
      y: 44,
      autoAlpha: 0,
      duration: 1.1,
      stagger: 0.1,
      scrollTrigger: { trigger: grid, start: 'top 86%', once: true },
    });
  }
  ScrollTrigger.refresh();
}

/* ---------- Close: the photograph drifts behind the last line ---------- */

export function initEnd() {
  const picture = $('[data-end-image]');
  if (!picture || prefersReduced()) return;
  gsap.fromTo(
    picture,
    { yPercent: -6 },
    {
      yPercent: 6,
      ease: 'none',
      scrollTrigger: { trigger: '[data-end]', start: 'top bottom', end: 'bottom top', scrub: true },
    },
  );
}
