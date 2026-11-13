import { escapeHtml } from '../core/dom.js';
import { DESIGN_TYPES, codeDocument, hostOf, imagesOf, videoOf } from '../core/designs-data.js';

/** Width over height for the card's picture, kept inside a sensible window. */
const ratioOf = (design) => {
  const source = design.type === 'image' ? imagesOf(design)[0] : design.type === 'video' ? videoOf(design) : null;
  if (!source?.width || !source?.height) return 4 / 3;
  return Math.min(1.9, Math.max(0.7, source.width / source.height));
};

function mediaMarkup(design) {
  const title = escapeHtml(design.title);

  if (design.type === 'code') {
    // Sandboxed: scripts may run, but the frame cannot reach this site.
    return `<iframe sandbox="allow-scripts" loading="lazy" tabindex="-1" title="${title} preview" srcdoc="${escapeHtml(codeDocument(design.code))}"></iframe>`;
  }

  const video = design.type === 'video' ? videoOf(design) : null;
  if (video) {
    const poster = design.cover ? ` poster="${escapeHtml(design.cover)}"` : '';
    return `<video src="${escapeHtml(video.src)}"${poster} muted loop playsinline preload="metadata" aria-label="${title}"></video>`;
  }

  if (design.cover) {
    const alt = escapeHtml(imagesOf(design)[0]?.alt || design.title);
    return `<img src="${escapeHtml(design.cover)}" alt="${alt}" loading="lazy" decoding="async" />`;
  }

  return `<div class="dcard__blank"><span class="label">${escapeHtml(hostOf(design.url) || 'No cover yet')}</span></div>`;
}

export function designMeta(design) {
  if (design.type === 'image') {
    const count = imagesOf(design).length;
    return count > 1 ? `${count} frames` : '';
  }
  if (design.type === 'link') return hostOf(design.url);
  return '';
}

/** A design card. `fixedRatio` gives every card one shape (the landing strip uses it). */
export function designCard(design, { href, fixedRatio = false } = {}) {
  const ratio = ratioOf(design).toFixed(3);
  const meta = designMeta(design);

  const card = document.createElement('a');
  card.className = 'dcard';
  card.href = href;
  card.dataset.slug = design.slug;
  card.dataset.type = design.type;
  card.dataset.cursor = 'Open';
  card.dataset.ratio = ratio;
  card.innerHTML = `
    <div class="dcard__media"${fixedRatio ? '' : ` style="aspect-ratio: ${ratio}"`}>
      ${mediaMarkup(design)}
      <span class="dcard__type label">${DESIGN_TYPES[design.type] || design.type}</span>
    </div>
    <div class="dcard__cap">
      <h3 class="dcard__title">${escapeHtml(design.title)}</h3>
      ${meta ? `<span class="dcard__meta label">${escapeHtml(meta)}</span>` : ''}
    </div>`;

  // Videos preview while hovered or focused, and rest otherwise.
  const video = card.querySelector('video');
  if (video) {
    const play = () => video.play().catch(() => {});
    const rest = () => {
      video.pause();
      video.currentTime = 0;
    };
    card.addEventListener('pointerenter', play);
    card.addEventListener('pointerleave', rest);
    card.addEventListener('focus', play);
    card.addEventListener('blur', rest);
  }

  return card;
}
