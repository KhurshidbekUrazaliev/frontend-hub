/**
 * Runs a specimen inside a shadow root, so its CSS can use plain class names
 * without leaking into the site (or the site leaking into it).
 *
 * A demo module is `export default function mount(root, params)` and may
 * return a cleanup function. `root` is the stage element; `params` holds the
 * current value of each tunable control.
 */

const BASE_CSS = `
  :host { position: absolute; inset: 0; display: block; }
  *, *::before, *::after { box-sizing: border-box; }
  .fh-root {
    position: absolute; inset: 0;
    display: grid; place-items: center;
    overflow: hidden;
    container-type: size;
    font-family: 'Archivo Variable', 'Helvetica Neue', Arial, sans-serif;
    color: #eef3f4;
    -webkit-font-smoothing: antialiased;
  }
  button { font: inherit; color: inherit; }
  :focus-visible { outline: 2px solid #2ad2ee; outline-offset: 3px; }
`;

export const defaultParams = (spec) =>
  Object.fromEntries((spec.controls || []).map((control) => [control.key, control.value]));

export function mountSpecimen(spec, host, params = defaultParams(spec)) {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${BASE_CSS}\n${spec.css}</style><div class="fh-root">${spec.html}</div>`;
  const root = shadow.querySelector('.fh-root');

  let cleanup = null;
  let dead = false;

  spec
    .load()
    .then((module) => {
      if (dead) return;
      cleanup = module.default(root, params) || null;
    })
    .catch((error) => console.error(`[specimen] ${spec.slug} failed to start`, error));

  return () => {
    dead = true;
    try {
      cleanup?.();
    } catch (error) {
      console.error(`[specimen] ${spec.slug} failed to clean up`, error);
    }
    shadow.innerHTML = '';
  };
}

/**
 * Keep a specimen running only while it is on screen. Off-screen demos are
 * unmounted outright, which also frees their WebGL contexts.
 */
export function liveSpecimen(spec, host, { params = defaultParams(spec), threshold = 0.3 } = {}) {
  let unmount = null;
  let visible = false;
  let suspended = false;

  const sync = () => {
    const shouldRun = visible && !suspended;
    if (shouldRun && !unmount) {
      unmount = mountSpecimen(spec, host, params);
    } else if (!shouldRun && unmount) {
      unmount();
      unmount = null;
    }
  };

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.intersectionRatio >= threshold) visible = true;
      else if (!entry.isIntersecting) visible = false;
      sync();
    },
    { threshold: [0, threshold] },
  );
  observer.observe(host);

  return {
    params,
    /** Stop while something covers the page; `resume` picks up where visibility left it. */
    suspend() {
      suspended = true;
      sync();
    },
    resume() {
      suspended = false;
      sync();
    },
    destroy() {
      observer.disconnect();
      visible = false;
      sync();
    },
  };
}
