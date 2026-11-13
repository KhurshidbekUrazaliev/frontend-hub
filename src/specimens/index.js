/**
 * Specimen registry.
 *
 * Every folder beside this file that contains meta.js and demo.{html,css,js}
 * becomes a specimen. The demo files are imported twice: once as modules to
 * run, once as raw text to display. What you read in the library is, byte for
 * byte, what is running in the page.
 */

const metas = import.meta.glob('./*/meta.js', { eager: true, import: 'default' });
const htmlSources = import.meta.glob('./*/demo.html', { eager: true, query: '?raw', import: 'default' });
const cssSources = import.meta.glob('./*/demo.css', { eager: true, query: '?raw', import: 'default' });
const jsSources = import.meta.glob('./*/demo.js', { eager: true, query: '?raw', import: 'default' });
const loaders = import.meta.glob('./*/demo.js');

/** The five layers of an interface, bottom to top. */
export const LAYERS = [
  { key: 'layout', index: '01', name: 'Layout' },
  { key: 'type', index: '02', name: 'Type' },
  { key: 'interaction', index: '03', name: 'Interaction' },
  { key: 'motion', index: '04', name: 'Motion' },
  { key: 'webgl', index: '05', name: 'WebGL' },
];

export const DEPENDENCIES = {
  none: 'No dependency',
  gsap: 'GSAP',
  three: 'Three.js',
};

const countLines = (source) => source.split('\n').filter((line) => line.trim()).length;

export const specimens = Object.entries(metas)
  .map(([path, meta]) => {
    const dir = path.slice(0, -'/meta.js'.length);
    const js = jsSources[`${dir}/demo.js`].trim();
    return {
      ...meta,
      slug: dir.slice(2),
      html: htmlSources[`${dir}/demo.html`].trim(),
      css: cssSources[`${dir}/demo.css`].trim(),
      js,
      lines: countLines(js),
      load: loaders[`${dir}/demo.js`],
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

export const bySlug = (slug) => specimens.find((spec) => spec.slug === slug);
export const layerOf = (spec) => LAYERS.find((layer) => layer.key === spec.layer);
export const countByLayer = (key) => specimens.filter((spec) => spec.layer === key).length;

export function lineStats() {
  const sorted = specimens.map((spec) => spec.lines).sort((a, b) => a - b);
  const mid = sorted.length / 2;
  const median = sorted.length % 2 ? sorted[Math.floor(mid)] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return { median, longest: sorted.at(-1), shortest: sorted[0] };
}
