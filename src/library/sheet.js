import { gsap, prefersReduced } from '../core/motion.js';
import { $, $$, escapeHtml, icon, pad } from '../core/dom.js';
import { createOverlay } from '../core/overlay.js';
import { codeBlock, wireCodeBlock } from '../core/code.js';
import { DEPENDENCIES, layerOf } from '../specimens/index.js';
import { mountSpecimen, defaultParams } from '../specimens/runtime.js';
import { displayId } from '../specimens/card.js';

/** Notes are plain strings; `backticks` mark inline code. */
const rich = (text) => escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>');

const decimals = (step) => (String(step).split('.')[1] || '').length;
const formatValue = (value, control) => `${Number(value).toFixed(decimals(control.step))}${control.unit || ''}`;

function template(spec, index, total) {
  const layer = layerOf(spec);

  const controls = spec.controls?.length
    ? `<div class="sheet__controls">${spec.controls
        .map(
          (control) => `
        <label class="control">
          <span class="label control__label">${escapeHtml(control.label)}<output>${formatValue(control.value, control)}</output></span>
          <input class="range" type="range" min="${control.min}" max="${control.max}" step="${control.step}"
            value="${control.value}" data-control="${control.key}" />
        </label>`,
        )
        .join('')}</div>`
    : '';

  const links = (spec.links || [])
    .map(
      (link) =>
        `<li><a class="link" href="${escapeHtml(link.href)}" target="_blank" rel="noopener">${escapeHtml(link.label)}${icon('out')}</a></li>`,
    )
    .join('');

  return `
    <header class="sheet__bar">
      <p class="label"><b>${displayId(spec)}</b> · ${layer.name} · ${pad(index + 1)} / ${pad(total)}</p>
      <div class="sheet__nav">
        <button class="sheet__btn" type="button" data-sheet-prev aria-label="Previous specimen"${total < 2 ? ' disabled' : ''}>${icon('back')}<span>Prev</span></button>
        <button class="sheet__btn" type="button" data-sheet-next aria-label="Next specimen"${total < 2 ? ' disabled' : ''}><span>Next</span>${icon('arrow')}</button>
        <button class="sheet__btn sheet__close" type="button" data-sheet-close aria-label="Close sheet"><span>Close</span>${icon('close')}</button>
      </div>
    </header>

    <div class="sheet__body">
      <section class="sheet__stage" aria-label="Live stage">
        <div class="sheet__frame" data-cursor="Play"><div class="sheet__host"></div></div>
        ${controls}
      </section>

      <aside class="sheet__info" data-lenis-prevent>
        <div class="sheet__intro" data-sheet-in>
          <h2 class="sheet__title" id="sheet-title">${escapeHtml(spec.title)}</h2>
          <p class="sheet__summary">${escapeHtml(spec.summary)}</p>
        </div>

        <dl class="facts" data-sheet-in>
          <dt>Region</dt><dd>${layer.index} ${layer.name}</dd>
          <dt>Dependency</dt><dd>${DEPENDENCIES[spec.dependency]}</dd>
          <dt>Source</dt><dd>${spec.lines} lines of JavaScript</dd>
          <dt>Keyboard</dt><dd>${escapeHtml(spec.keyboard)}</dd>
          <dt>Reduced motion</dt><dd>${escapeHtml(spec.reduced)}</dd>
          <dt>Tags</dt><dd><span class="tag-list">${spec.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</span></dd>
        </dl>

        <section class="sheet__block" data-sheet-in>
          <h3 class="label">How it works</h3>
          <ol class="notes">${spec.notes.map((note) => `<li><span>${rich(note)}</span></li>`).join('')}</ol>
        </section>

        <section class="sheet__block" data-sheet-in>
          <h3 class="label">Source — exactly what is running on the left</h3>
          ${codeBlock(spec)}
        </section>

        ${links ? `<section class="sheet__block" data-sheet-in><h3 class="label">Further reading</h3><ul class="sheet__links">${links}</ul></section>` : ''}
      </aside>
    </div>`;
}

/**
 * The specimen sheet. `list()` returns the specimens currently in view, so
 * Prev and Next walk the filtered set; `onNavigate` and `onClose` let the
 * page keep the address bar in step.
 */
export function createSheet({ list, onNavigate, onClose }) {
  const el = $('[data-sheet]');
  let current = null;
  let unmount = null;
  let restartTimer = 0;

  const stopDemo = () => {
    clearTimeout(restartTimer);
    unmount?.();
    unmount = null;
  };

  const overlay = createOverlay(el, {
    onRequestClose: () => onClose?.(),
    onClosed: () => {
      stopDemo();
      current = null;
      el.innerHTML = '';
    },
  });

  function render(spec) {
    stopDemo();
    current = spec;

    const specs = list();
    const index = Math.max(0, specs.indexOf(spec));
    el.innerHTML = template(spec, index, specs.length || 1);

    const host = $('.sheet__host', el);
    const params = defaultParams(spec);
    const start = () => {
      unmount?.();
      unmount = mountSpecimen(spec, host, params);
    };
    start();

    // Controls write straight into `params`. Demos read it live; the ones that
    // only read it once ask for a restart.
    $$('[data-control]', el).forEach((input) => {
      const control = spec.controls.find((item) => item.key === input.dataset.control);
      const output = input.closest('.control').querySelector('output');
      input.addEventListener('input', () => {
        params[control.key] = Number(input.value);
        output.textContent = formatValue(input.value, control);
        if (!control.restart) return;
        clearTimeout(restartTimer);
        restartTimer = setTimeout(start, 160);
      });
    });

    wireCodeBlock(el, spec);

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
    const specs = list();
    if (specs.length < 2 || !current) return;
    const next = specs[(specs.indexOf(current) + direction + specs.length) % specs.length];
    render(next);
    $(direction > 0 ? '[data-sheet-next]' : '[data-sheet-prev]', el)?.focus();
    onNavigate?.(next);
  }

  window.addEventListener('keydown', (e) => {
    if (!overlay.isOpen || e.metaKey || e.ctrlKey || e.altKey) return;
    // Arrow keys belong to whatever is focused inside a demo, a slider or the tabs.
    const path = e.composedPath();
    if (path.some((node) => node.matches?.('input, textarea, select, .sheet__host, [role="tab"]'))) return;
    if (e.key === 'ArrowRight') step(1);
    if (e.key === 'ArrowLeft') step(-1);
  });

  return {
    open(spec, originRect) {
      const wasOpen = overlay.isOpen;
      render(spec);
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
