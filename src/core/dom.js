export const $ = (selector, scope = document) => scope.querySelector(selector);
export const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c]);

export const pad = (n, length = 2) => String(n).padStart(length, '0');
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

/** Two stacked copies of an icon; CSS slides one out and the other in on hover. */
export const swap = (name) =>
  `<span class="swap${name === 'out' ? ' swap--out' : ''}" aria-hidden="true">${icon(name)}${icon(name)}</span>`;

/** Fill every [data-count="key"] with a value counted from real data. */
export function fillCounts(values, scope = document) {
  $$('[data-count]', scope).forEach((el) => {
    const value = values[el.dataset.count];
    if (value !== undefined && value !== null) el.textContent = value;
  });
}

let toastTimer = 0;
export function toast(message) {
  let el = $('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = message;
  // Next frame so the transition runs even on first use.
  requestAnimationFrame(() => el.classList.add('is-on'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2200);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

/** Wire a copy button: copies `getText()` and flashes a confirmation label. */
export function bindCopy(button, getText) {
  const label = button.querySelector('[data-copy-label]');
  const original = label?.textContent;
  let timer = 0;
  button.addEventListener('click', async () => {
    const ok = await copyText(getText());
    if (!label) return;
    label.textContent = ok ? 'Copied' : 'Press ⌘C';
    clearTimeout(timer);
    timer = setTimeout(() => (label.textContent = original), 1600);
  });
}
