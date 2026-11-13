import './prism-setup.js';
import Prism from 'prismjs';
import { $, $$, bindCopy, icon } from './dom.js';

const LANGUAGES = {
  js: { label: 'JS', grammar: 'javascript' },
  css: { label: 'CSS', grammar: 'css' },
  html: { label: 'HTML', grammar: 'markup' },
};

const lineCount = (source) => source.split('\n').length;

/**
 * A tabbed, highlighted source viewer.
 * `sources` is { js, css, html }; empty entries are left out.
 */
export function codeBlock(sources) {
  const entries = Object.keys(LANGUAGES).filter((key) => sources[key]?.trim());
  if (!entries.length) return '';

  const tabs = entries
    .map(
      (key, i) => `
      <button class="code__tab" type="button" role="tab" id="code-tab-${key}" aria-controls="code-panel-${key}"
        aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-code-tab="${key}">
        ${LANGUAGES[key].label}<sup>${lineCount(sources[key].trim())}</sup>
      </button>`,
    )
    .join('');

  const panels = entries
    .map((key, i) => {
      const { grammar } = LANGUAGES[key];
      const html = Prism.highlight(sources[key].trim(), Prism.languages[grammar], grammar);
      return `<pre class="code__panel" role="tabpanel" id="code-panel-${key}" aria-labelledby="code-tab-${key}" tabindex="0" data-code-panel="${key}"${i === 0 ? '' : ' hidden'} data-lenis-prevent><code>${html}</code></pre>`;
    })
    .join('');

  return `
    <div class="code" data-code>
      <div class="code__bar">
        <div class="code__tabs" role="tablist" aria-label="Source files">${tabs}</div>
        <button class="code__copy" type="button" data-code-copy>${icon('copy')}<span data-copy-label>Copy</span></button>
      </div>
      ${panels}
    </div>`;
}

/** Wire tab switching (click and arrow keys) and the copy button. */
export function wireCodeBlock(scope, sources) {
  const block = $('[data-code]', scope);
  if (!block) return;

  const tabs = $$('[data-code-tab]', block);
  const panels = $$('[data-code-panel]', block);
  let active = tabs[0]?.dataset.codeTab;

  const select = (key, focus = false) => {
    active = key;
    tabs.forEach((tab) => {
      const on = tab.dataset.codeTab === key;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus();
    });
    panels.forEach((panel) => (panel.hidden = panel.dataset.codePanel !== key));
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab.dataset.codeTab));
    tab.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      select(tabs[(i + step + tabs.length) % tabs.length].dataset.codeTab, true);
    });
  });

  bindCopy($('[data-code-copy]', block), () => sources[active].trim());
}
