import { escapeHtml, swap } from '../core/dom.js';
import { layerOf } from './index.js';
import { liveSpecimen } from './runtime.js';

export const displayId = (spec) => spec.id;

/**
 * A specimen card: a live stage you can play with, and a caption bar that
 * opens the full sheet. Returns the element and the handle that runs the demo.
 */
export function specimenCard(spec, { href }) {
  const layer = layerOf(spec);
  const title = escapeHtml(spec.title);
  const facts = `${layer.name} · ${spec.lines} lines`;

  const card = document.createElement('article');
  card.className = 'spec';
  card.dataset.slug = spec.slug;
  card.dataset.layer = spec.layer;
  card.innerHTML = `
    <div class="spec__stage" data-cursor="Play"><div class="spec__host"></div></div>
    <a class="spec__meta" href="${href}" data-cursor="Open" aria-label="Open ${title}. ${facts}.">
      <span class="spec__id">${displayId(spec)}</span>
      <h3 class="spec__title">${title}</h3>
      <span class="spec__facts">${facts}</span>
      ${swap('out')}
    </a>`;

  const live = liveSpecimen(spec, card.querySelector('.spec__host'));
  return { card, live };
}
