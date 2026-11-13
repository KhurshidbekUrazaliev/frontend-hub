import { gsap, prefersReduced } from '../core/motion.js';
import { $, $$, escapeHtml, icon, pad, swap } from '../core/dom.js';
import { createOverlay } from '../core/overlay.js';
import { codeBlock, wireCodeBlock } from '../core/code.js';
import { DESIGN_TYPES, codeDocument, hostOf, imagesOf, videoOf } from '../core/designs-data.js';

const formatDate = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const paragraphs = (text) =>
  String(text || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('');

function stageMarkup(design) {
  const title = escapeHtml(design.title);

  if (design.type === 'code') {
    // Sandboxed: the piece can run its own scripts but cannot reach this site.
    return `<div class="viewer"><iframe sandbox="allow-scripts" title="${title}" srcdoc="${escapeHtml(codeDocument(design.code))}"></iframe></div>`;
  }

  const video = design.type === 'video' ? videoOf(design) : null;
  if (video) {
    const poster = design.cover ? ` poster="${escapeHtml(design.cover)}"` : '';
    return `<div class="viewer"><video src="${escapeHtml(video.src)}"${poster} controls playsinline preload="metadata"></video></div>`;
  }

  const first = design.type === 'image' ? imagesOf(design)[0] : null;
  const src = first?.src || design.cover;
  if (!src) {
    return `<div class="viewer"><div class="viewer__blank"><span class="label">${escapeHtml(hostOf(design.url) || 'No preview')}</span></div></div>`;
  }
  return `<div class="viewer"><img data-viewer-image src="${escapeHtml(src)}" alt="${escapeHtml(first?.alt || design.title)}" /></div>`;
}

function thumbsMarkup(design) {
  const frames = imagesOf(design);
  if (design.type !== 'image' || frames.length < 2) return '';
  return `<div class="thumbs" role="group" aria-label="Frames">${frames
    .map(
      (item, i) => `
      <button class="thumb" type="button" data-frame="${i}" aria-current="${i === 0}" aria-label="Frame ${i + 1} of ${frames.length}">
        <img src="${escapeHtml(item.src)}" alt="" loading="lazy" />
      </button>`,
    )
    .join('')}</div>`;
}

function template(design, index, total) {
  const kind = DESIGN_TYPES[design.type] || design.type;
  const tags = (design.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
  const host = hostOf(design.url);

  const facts = [
    ['Kind', kind],
    design.type === 'image' && imagesOf(design).length > 1 ? ['Frames', String(imagesOf(design).length)] : null,
    design.type === 'link' && host
      ? ['Site', `<a href="${escapeHtml(design.url)}" target="_blank" rel="noopener">${escapeHtml(host)}</a>`]
      : null,
    formatDate(design.createdAt) ? ['Placed', formatDate(design.createdAt)] : null,
    tags ? ['Tags', `<span class="tag-list">${tags}</span>`] : null,
  ]
    .filter(Boolean)
    .map(([term, value]) => `<dt>${term}</dt><dd>${value}</dd>`)
    .join('');

  const visit =
    design.type === 'link' && design.url
      ? `<a class="btn btn--solid" href="${escapeHtml(design.url)}" target="_blank" rel="noopener" data-sheet-in>Visit the site ${swap('out')}</a>`
      : '';

  const source =
    design.type === 'code'
      ? `<section class="sheet__block" data-sheet-in><h3 class="label">Source</h3>${codeBlock(design.code || {})}</section>`
      : '';

  return `
    <header class="sheet__bar">
      <p class="label"><b>${escapeHtml(kind)}</b> · ${pad(index + 1)} / ${pad(total)}</p>
      <div class="sheet__nav">
        <button class="sheet__btn" type="button" data-sheet-prev aria-label="Previous design"${total < 2 ? ' disabled' : ''}>${icon('back')}<span>Prev</span></button>
        <button class="sheet__btn" type="button" data-sheet-next aria-label="Next design"${total < 2 ? ' disabled' : ''}><span>Next</span>${icon('arrow')}</button>
        <button class="sheet__btn sheet__close" type="button" data-sheet-close aria-label="Close"><span>Close</span>${icon('close')}</button>
      </div>
    </header>

    <div class="sheet__body">
      <section class="sheet__stage" aria-label="${escapeHtml(design.title)}">
        <div class="sheet__frame">${stageMarkup(design)}</div>
        ${thumbsMarkup(design)}
      </section>

      <aside class="sheet__info" data-lenis-prevent>
        <div class="sheet__intro" data-sheet-in>
          <h2 class="sheet__title" id="sheet-title">${escapeHtml(design.title)}</h2>
          ${design.summary ? `<div class="sheet__summary sheet__summary--long">${paragraphs(design.summary)}</div>` : ''}
        </div>
        ${visit}
        <dl class="facts" data-sheet-in>${facts}</dl>
        ${source}
      </aside>
    </div>`;
}

/** The design sheet: the piece on the left, what it is on the right. */
export function createDesignSheet({ list, onNavigate, onClose }) {
  const el = $('[data-sheet]');
  let current = null;

  const overlay = createOverlay(el, {
    onRequestClose: () => onClose?.(),
    onClosed: () => {
      current = null;
      el.innerHTML = ''; // also stops any video or running frame
    },
  });

  function render(design) {
    current = design;
    const designs = list();
    el.innerHTML = template(design, Math.max(0, designs.indexOf(design)), designs.length || 1);

    // Frame switching for multi-image designs.
    const image = $('[data-viewer-image]', el);
    const thumbs = $$('[data-frame]', el);
    thumbs.forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const item = imagesOf(design)[Number(thumb.dataset.frame)];
        image.src = item.src;
        image.alt = item.alt || design.title;
        thumbs.forEach((other) => other.setAttribute('aria-current', String(other === thumb)));
      });
    });

    if (design.type === 'code') wireCodeBlock(el, design.code || {});

    $('[data-sheet-close]', el).addEventListener('click', () => onClose?.());
    $('[data-sheet-prev]', el).addEventListener('click', () => step(-1));
    $('[data-sheet-next]', el).addEventListener('click', () => step(1));

    if (!prefersReduced()) {
      gsap.from($$('[data-sheet-in]', el), {
        y: 20,
        opacity: 0,
        duration: 0.8,
        stagger: 0.06,
        delay: overlay.isOpen ? 0 : 0.35,
        clearProps: 'transform,opacity',
      });
    }
  }

  function step(direction) {
    const designs = list();
    if (designs.length < 2 || !current) return;
    const next = designs[(designs.indexOf(current) + direction + designs.length) % designs.length];
    render(next);
    $(direction > 0 ? '[data-sheet-next]' : '[data-sheet-prev]', el)?.focus();
    onNavigate?.(next);
  }

  window.addEventListener('keydown', (e) => {
    if (!overlay.isOpen || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.composedPath().some((node) => node.matches?.('input, textarea, select, video, [role="tab"]'))) return;
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });

  return {
    open(design, originRect) {
      const wasOpen = overlay.isOpen;
      render(design);
      if (!wasOpen) overlay.show(originRect);
      $('[data-sheet-close]', el)?.focus({ preventScroll: true });
    },
    close: () => overlay.hide(),
    get isOpen() {
      return overlay.isOpen;
    },
    get current() {
      return current;
    },
  };
}
