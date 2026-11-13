import { gsap, ScrollTrigger, prefersReduced } from '../core/motion.js';
import { Flip } from 'gsap/Flip';
import { $, $$, fillCounts } from '../core/dom.js';
import { initScroll } from '../core/scroll.js';
import { initNav } from '../core/nav.js';
import { initTransitions, hideCurtain } from '../core/transitions.js';
import { initCursorLabel } from '../core/cursor.js';
import { initFooter } from '../core/footer.js';
import { pageIntro } from '../core/page.js';
import { DESIGN_TYPES, loadDesigns, hostOf } from '../core/designs-data.js';
import { specimens } from '../specimens/index.js';
import { designCard } from './card.js';
import { createDesignSheet } from './sheet.js';

gsap.registerPlugin(Flip);

const root = document.documentElement;

async function init() {
  root.classList.add('is-ready');

  initScroll({ anchors: false });
  initNav();
  initTransitions();
  initCursorLabel();
  fillCounts({ total: specimens.length });

  const designs = await loadDesigns();
  fillCounts({ designs: designs.length || '' });

  const gallery = $('[data-gallery]');
  const filterBar = $('[data-filter-bar]');
  const chipRow = $('[data-filters]');
  const search = $('[data-search]');
  const noMatch = $('[data-no-match]');

  if (!designs.length) {
    $('[data-empty]').hidden = false;
    initFooter();
    await pageIntro();
    ScrollTrigger.refresh();
    return;
  }

  /* ---------- state ---------- */

  const state = { type: 'all', query: '' };
  const haystack = new Map(
    designs.map((design) => [
      design,
      [design.title, design.summary, DESIGN_TYPES[design.type], hostOf(design.url), ...(design.tags || [])]
        .join(' ')
        .toLowerCase(),
    ]),
  );
  const matches = (design) =>
    (state.type === 'all' || design.type === state.type) &&
    state.query.split(/\s+/).every((word) => haystack.get(design).includes(word));
  const visibleDesigns = () => designs.filter(matches);

  const cards = new Map(designs.map((design) => [design, designCard(design, { href: `#${design.slug}` })]));

  /* ---------- masonry ---------- */

  const columnCount = () => (window.innerWidth >= 1100 ? 3 : window.innerWidth >= 640 ? 2 : 1);
  let columnsNow = 0;

  // Each card goes to whichever column is currently shortest, so reading order survives.
  function layout() {
    columnsNow = columnCount();
    const columns = Array.from({ length: columnsNow }, () => {
      const column = document.createElement('div');
      column.className = 'gallery__col';
      return column;
    });
    const heights = new Array(columnsNow).fill(0);

    visibleDesigns().forEach((design) => {
      const card = cards.get(design);
      const shortest = heights.indexOf(Math.min(...heights));
      columns[shortest].append(card);
      heights[shortest] += 1 / Number(card.dataset.ratio) + 0.2; // image height + caption, in column widths
    });
    gallery.replaceChildren(...columns);
  }

  /* ---------- filters ---------- */

  const kinds = Object.keys(DESIGN_TYPES).filter((type) => designs.some((design) => design.type === type));
  if (kinds.length > 1 || designs.length > 6) {
    filterBar.hidden = false;
    chipRow.innerHTML = [
      `<button class="chip" type="button" data-type="all" aria-pressed="true">All<sup>${designs.length}</sup></button>`,
      ...kinds.map(
        (type) =>
          `<button class="chip" type="button" data-type="${type}" aria-pressed="false">${DESIGN_TYPES[type]}<sup>${designs.filter((d) => d.type === type).length}</sup></button>`,
      ),
    ].join('');
  }
  const chips = $$('.chip', chipRow);

  function applyFilter({ animate = true } = {}) {
    chips.forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.type === state.type)));

    const staying = [...cards.values()].filter((card) => card.isConnected);
    const flip = animate && !prefersReduced() ? Flip.getState(staying) : null;

    layout();
    noMatch.hidden = visibleDesigns().length > 0;

    if (!flip) {
      ScrollTrigger.refresh();
      return;
    }
    Flip.from(flip, {
      targets: [...cards.values()].filter((card) => card.isConnected),
      duration: 0.7,
      ease: 'fhInOut',
      absolute: true,
      onEnter: (entering) => gsap.fromTo(entering, { opacity: 0 }, { opacity: 1, duration: 0.6, delay: 0.15 }),
      onComplete: () => ScrollTrigger.refresh(),
    });
  }

  chipRow.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip || chip.dataset.type === state.type) return;
    state.type = chip.dataset.type;
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

  $('[data-clear]')?.addEventListener('click', () => {
    state.type = 'all';
    state.query = '';
    search.value = '';
    applyFilter();
  });

  window.addEventListener('resize', () => {
    if (columnCount() !== columnsNow) applyFilter({ animate: false });
  });

  /* ---------- the sheet, and the address bar that follows it ---------- */

  const bySlug = (slug) => designs.find((design) => design.slug === slug || design.id === slug);

  const setHash = (slug, { push }) => {
    const url = new URL(window.location.href);
    url.hash = slug || '';
    const target = slug ? url : url.pathname + url.search;
    if (push) window.history.pushState(null, '', target);
    else window.history.replaceState(null, '', target);
  };

  const sheet = createDesignSheet({
    list: () => {
      const visible = visibleDesigns();
      return sheet.current && !visible.includes(sheet.current) ? designs : visible;
    },
    onNavigate: (design) => setHash(design.slug, { push: false }),
    onClose: () => {
      setHash('', { push: true });
      sheet.close();
    },
  });

  gallery.addEventListener('click', (e) => {
    const card = e.target.closest('.dcard');
    if (!card || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const design = bySlug(card.dataset.slug);
    setHash(design.slug, { push: true });
    sheet.open(design, $('.dcard__media', card).getBoundingClientRect());
  });

  const syncToHash = () => {
    const design = bySlug(decodeURIComponent(window.location.hash.slice(1)));
    if (design) sheet.open(design);
    else if (sheet.isOpen) sheet.close();
  };
  window.addEventListener('popstate', syncToHash);

  window.addEventListener('keydown', (e) => {
    if (e.key !== '/' || sheet.isOpen || filterBar.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest?.('input, textarea')) return;
    e.preventDefault();
    search.focus();
  });

  /* ---------- entrance ---------- */

  applyFilter({ animate: false });
  initFooter();

  await pageIntro();
  if (!prefersReduced()) {
    gsap.from([...cards.values()], {
      y: 40,
      opacity: 0,
      duration: 1,
      stagger: 0.06,
      delay: 0.5,
      clearProps: 'transform,opacity',
    });
  }
  syncToHash();
  ScrollTrigger.refresh();
}

init().catch((error) => {
  console.error('[frontend-hub] designs page failed to start', error);
  root.classList.add('no-anim', 'is-ready');
  hideCurtain();
});
