/**
 * The manifest: every specimen in a list, and one stage that runs whichever
 * row you point at.
 */
import { gsap, prefersReduced, hasFinePointer } from '../core/motion.js';
import { $, $$, escapeHtml, icon } from '../core/dom.js';
import { liveSpecimen } from '../specimens/runtime.js';
import { specimens, layerOf, specimenFacts, specimenHref } from '../core/regions.js';

/** @param {{ first?: string }} [options] slug of the specimen that is on the stage to begin with */
export function initManifest({ first = 'stagger-ripple' } = {}) {
  const list = $('[data-manifest-list]');
  const host = $('[data-stage-host]');
  const screen = $('.stage__screen');
  if (!list || !host) return;
  const reduced = prefersReduced();
  $$('[data-total]').forEach((el) => (el.textContent = specimens.length));

  list.innerHTML = specimens
    .map(
      (spec) => `
      <a class="entry" role="listitem" href="${specimenHref(spec)}" data-slug="${spec.slug}">
        <span class="entry__id label">${spec.id}</span>
        <span class="entry__title">${escapeHtml(spec.title)}</span>
        <span class="entry__layer label">${escapeHtml(layerOf(spec).name)}</span>
        <span class="entry__lines label">${spec.lines} lines</span>
        ${icon('arrow')}
      </a>`,
    )
    .join('');
  const entries = $$('.entry', list);
  const find = (slug) => specimens.find((spec) => spec.slug === slug);

  let current = null;
  let live = null;
  let timer = 0;

  function activate(spec) {
    if (!spec || spec === current) return;
    current = spec;
    entries.forEach((entry) => entry.classList.toggle('is-on', entry.dataset.slug === spec.slug));
    live?.destroy();
    live = liveSpecimen(spec, host);
    $('[data-stage-id]').textContent = `${spec.id} / ${spec.title}`;
    $('[data-stage-facts]').textContent = specimenFacts(spec);
    const link = $('[data-stage-link]');
    if (link) {
      link.href = specimenHref(spec);
      link.setAttribute('aria-label', `Open ${spec.title} with its source`);
    }
    if (!reduced) {
      gsap.fromTo(
        screen,
        { clipPath: 'inset(0% 0% 0% 100%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: 'fhInOut', clearProps: 'clipPath' },
      );
    }
  }

  const queue = (slug) => {
    clearTimeout(timer);
    timer = setTimeout(() => activate(find(slug)), 130); // skimming the list should not start twelve demos
  };

  entries.forEach((entry) => {
    entry.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') queue(entry.dataset.slug);
    });
    entry.addEventListener('focus', () => queue(entry.dataset.slug));
    // Touch has no hover: the first tap puts a specimen on the stage, the second opens it.
    entry.addEventListener('click', (event) => {
      if (hasFinePointer() || current?.slug === entry.dataset.slug) return;
      event.preventDefault();
      activate(find(entry.dataset.slug));
    });
  });

  activate(find(first) || specimens[0]);

  if (!reduced) {
    gsap.from(entries, {
      autoAlpha: 0,
      y: 18,
      duration: 0.7,
      stagger: 0.035,
      scrollTrigger: { trigger: list, start: 'top 85%', once: true },
    });
  }
}
