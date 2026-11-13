import { gsap, ScrollTrigger, prefersReduced } from '../core/motion.js';
import { Flip } from 'gsap/Flip';
import { $, $$, fillCounts } from '../core/dom.js';
import { initScroll } from '../core/scroll.js';
import { initNav } from '../core/nav.js';
import { initTransitions, hideCurtain } from '../core/transitions.js';
import { initCursorLabel } from '../core/cursor.js';
import { initFooter } from '../core/footer.js';
import { pageIntro } from '../core/page.js';
import { loadDesigns } from '../core/designs-data.js';
import { DEPENDENCIES, LAYERS, specimens, bySlug, countByLayer, layerOf } from '../specimens/index.js';
import { specimenCard } from '../specimens/card.js';
import { REGIONS, image } from '../core/regions.js';
import { createSheet } from './sheet.js';

gsap.registerPlugin(Flip);

const root = document.documentElement;

function init() {
  root.classList.add('is-ready');

  // In-page anchors here open sheets rather than scroll, so Lenis leaves them alone.
  initScroll({ anchors: false });
  initNav();
  initTransitions();
  initCursorLabel();

  fillCounts({ total: specimens.length });
  loadDesigns().then((designs) => fillCounts({ designs: designs.length || '' }));

  const grid = $('[data-grid]');
  const chipRow = $('[data-filters]');
  const search = $('[data-search]');
  const empty = $('[data-empty]');
  const headMedia = $('[data-head-media]');
  const headLede = $('[data-head-lede]');

  /** The page head shows the photograph, and the words, of the region being looked at. */
  function setHead(layer) {
    const region = REGIONS.find((item) => item.key === layer);
    if (headLede) headLede.textContent = region ? region.blurb : headLede.dataset.default;
    if (!headMedia) return;

    const key = region ? region.key : 'all';
    let picture = $(`img[data-layer="${key}"]`, headMedia);
    if (!picture) {
      picture = new Image();
      picture.alt = '';
      picture.decoding = 'async';
      picture.dataset.layer = key;
      picture.src = image(region.hero);
      headMedia.append(picture);
    }
    const show = () => {
      void picture.offsetWidth; // let a just-added picture start from its hidden state
      $$('img', headMedia).forEach((el) => el.classList.toggle('is-on', el === picture));
    };
    if (picture.complete && picture.naturalWidth) show();
    else picture.addEventListener('load', show, { once: true });
  }

  /* ---------- state: which layer, which words ---------- */

  const params = new URLSearchParams(window.location.search);
  const state = {
    layer: LAYERS.some((layer) => layer.key === params.get('layer')) ? params.get('layer') : 'all',
    query: '',
  };

  // What search looks through: everything a person might type to find a specimen.
  const haystack = new Map(
    specimens.map((spec) => [
      spec,
      [spec.title, spec.id, layerOf(spec).name, DEPENDENCIES[spec.dependency], ...spec.tags, spec.summary]
        .join(' ')
        .toLowerCase(),
    ]),
  );
  const matches = (spec) =>
    (state.layer === 'all' || spec.layer === state.layer) &&
    state.query.split(/\s+/).every((word) => haystack.get(spec).includes(word));
  const visibleSpecs = () => specimens.filter(matches);

  /* ---------- cards ---------- */

  const cards = specimens.map((spec) => {
    const { card, live } = specimenCard(spec, { href: `#${spec.slug}` });
    grid.append(card);
    return { spec, card, live };
  });

  /* ---------- filter chips ---------- */

  const chipData = [
    { key: 'all', name: 'All', count: specimens.length },
    ...LAYERS.map((layer) => ({ key: layer.key, name: layer.name, count: countByLayer(layer.key) })),
  ];
  chipRow.innerHTML = chipData
    .map(
      (chip) =>
        `<button class="chip" type="button" data-layer="${chip.key}" aria-pressed="false">${chip.name}<sup>${chip.count}</sup></button>`,
    )
    .join('');
  const chips = $$('.chip', chipRow);

  function applyFilter({ animate = true } = {}) {
    chips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.layer === state.layer)));
    setHead(state.layer);

    const elements = cards.map((item) => item.card);
    const flip = animate && !prefersReduced() ? Flip.getState(elements) : null;

    let shown = 0;
    cards.forEach(({ spec, card }) => {
      const show = matches(spec);
      card.classList.toggle('is-out', !show);
      if (show) shown += 1;
    });
    empty.hidden = shown > 0;

    // Keep the address shareable.
    const url = new URL(window.location.href);
    if (state.layer === 'all') url.searchParams.delete('layer');
    else url.searchParams.set('layer', state.layer);
    window.history.replaceState(window.history.state, '', url);

    if (!flip) {
      ScrollTrigger.refresh();
      return;
    }
    // Cards that stay glide to their new place; the rest fade in or out.
    Flip.from(flip, {
      duration: 0.7,
      ease: 'fhInOut',
      absolute: true,
      onEnter: (entering) =>
        gsap.fromTo(entering, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.6, delay: 0.15 }),
      onLeave: (leaving) => gsap.to(leaving, { opacity: 0, scale: 0.96, duration: 0.3 }),
      onComplete: () => ScrollTrigger.refresh(),
    });
  }

  chipRow.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip || chip.dataset.layer === state.layer) return;
    state.layer = chip.dataset.layer;
    applyFilter();
  });

  let searchTimer = 0;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = search.value.trim().toLowerCase();
      applyFilter();
    }, 140);
  });
  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !search.value) return;
    e.stopPropagation();
    search.value = '';
    state.query = '';
    applyFilter();
  });

  $('[data-clear]')?.addEventListener('click', () => {
    state.layer = 'all';
    state.query = '';
    search.value = '';
    applyFilter();
    search.focus();
  });

  /* ---------- the sheet, and the address bar that follows it ---------- */

  const setHash = (slug, { push }) => {
    const url = new URL(window.location.href);
    url.hash = slug || '';
    const target = slug ? url : url.pathname + url.search;
    if (push) window.history.pushState(null, '', target);
    else window.history.replaceState(null, '', target);
  };

  const sheet = createSheet({
    list: () => {
      const visible = visibleSpecs();
      // A deep link can open a specimen the current filter hides.
      return sheet.current && !visible.includes(sheet.current) ? specimens : visible;
    },
    onNavigate: (spec) => setHash(spec.slug, { push: false }),
    onClose: () => {
      setHash('', { push: true });
      closeSheet();
    },
  });

  function openSheet(spec, originRect) {
    cards.forEach((item) => item.live.suspend()); // nothing runs behind the sheet
    sheet.open(spec, originRect);
  }
  function closeSheet() {
    sheet.close();
    cards.forEach((item) => item.live.resume());
  }

  grid.addEventListener('click', (e) => {
    const link = e.target.closest('.spec__meta');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const item = cards.find((entry) => entry.card.contains(link));
    setHash(item.spec.slug, { push: true });
    openSheet(item.spec, $('.spec__stage', item.card).getBoundingClientRect());
  });

  // Back and forward open, switch or close the sheet.
  const syncToHash = () => {
    const spec = bySlug(window.location.hash.slice(1));
    if (spec) openSheet(spec);
    else if (sheet.isOpen) closeSheet();
  };
  window.addEventListener('popstate', syncToHash);

  // "/" jumps to search, as it does in most developer tools.
  window.addEventListener('keydown', (e) => {
    if (e.key !== '/' || sheet.isOpen || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea')) return;
    e.preventDefault();
    search.focus();
  });

  /* ---------- entrance ---------- */

  applyFilter({ animate: false });
  initFooter();

  pageIntro().then(() => {
    if (!prefersReduced()) {
      gsap.from(
        cards.map((item) => item.card),
        { y: 40, opacity: 0, duration: 1, stagger: 0.05, delay: 0.5, clearProps: 'transform,opacity' },
      );
    }
    syncToHash(); // a link straight to a specimen opens its sheet
    ScrollTrigger.refresh();
  });
}

try {
  init();
} catch (error) {
  console.error('[frontend-hub] library failed to start', error);
  root.classList.add('no-anim', 'is-ready');
  hideCurtain();
}
