/**
 * The five regions of the library, with their words and photographs. Counts
 * come from the real specimen registry, so no page ever states a number that
 * is not true.
 */
import { LAYERS, specimens, countByLayer, bySlug, layerOf, DEPENDENCIES } from '../specimens/index.js';

const urls = import.meta.glob('../media/*.jpg', { eager: true, query: '?url', import: 'default' });

/** URL of a photograph by name. `small` picks the lighter file. */
export const image = (name, small = false) => urls[`../media/${name}${small ? '-sm' : ''}.jpg`];

/**
 * Each layer of the library is pictured as a place (dark set) and as an
 * object (light set). `title` is the two-line statement for that layer.
 */
const COPY = {
  layout: {
    title: ['Space,', 'divided well.'],
    blurb: 'Grids, containers and reflow. The structure everything else stands on.',
    place: 'The plaza',
    object: 'Try square',
    hero: 'hero-layout',
    heroAlt: 'A lone figure crosses a wet plaza toward a concrete building with a strict grid of windows. One window is lit.',
    detail: 'layout-stair',
    detailAlt: 'Looking up a concrete stairwell to a skylight.',
    wide: 'layout-desk',
    wideAlt: 'A drafting table with gridded paper, a steel ruler and a compass.',
    plate: 'plate-layout',
    plateAlt: 'A steel try square standing upright.',
  },
  type: {
    title: ['Letters', 'that respond.'],
    blurb: 'Variable fonts, split lines and masks. Type that reacts instead of sitting still.',
    place: 'The print room',
    object: 'Wood type',
    hero: 'hero-type2',
    heroAlt: 'A printer works at an iron hand press in a dim workshop. Cases of metal type sit in the foreground.',
    detail: 'type-sorts',
    detailAlt: 'Rows of metal type, seen close up.',
    wide: 'type-sheets',
    wideAlt: 'Printed sheets of large letterforms drying on wooden racks.',
    plate: 'plate-type',
    plateAlt: 'A worn wooden type block of an ampersand.',
  },
  interaction: {
    title: ['Made to', 'be touched.'],
    blurb: 'Hover, press, hold and drag. Small responses that make an interface feel physical.',
    place: 'The control room',
    object: 'Toggle switch',
    hero: 'hero-interaction',
    heroAlt: 'An operator reaches for a single lit switch on a long control console.',
    detail: 'interaction-key',
    detailAlt: 'A fingertip about to press a glowing button.',
    wide: 'interaction-patch',
    wideAlt: 'A switchboard with looping patch cables and one lit lamp.',
    plate: 'plate-interaction',
    plateAlt: 'A chrome toggle switch on an oak block.',
  },
  motion: {
    title: ['Time,', 'well spent.'],
    blurb: 'Springs, staggers and scroll velocity. Movement with a reason behind it.',
    place: 'The platform',
    object: 'Metronome',
    hero: 'hero-motion2',
    heroAlt: 'A figure stands still on a platform while a train streaks past.',
    detail: 'motion-pendulum',
    detailAlt: 'Rings of light traced by a swinging lamp in a dark hall.',
    wide: 'motion-road',
    wideAlt: 'Light trails along a winding mountain road in fog.',
    plate: 'plate-motion',
    plateAlt: 'A wooden metronome with its arm caught mid-swing.',
  },
  webgl: {
    title: ['Light,', 'calculated.'],
    blurb: 'Shaders and point fields, drawn by the graphics card one pixel at a time.',
    place: 'The light hall',
    object: 'Prism',
    hero: 'hero-webgl',
    heroAlt: 'A figure stands in light scattered across a concrete hall by a wall of glass blocks.',
    detail: 'webgl-caustics',
    detailAlt: 'Light refracted through rippled glass onto dark slate.',
    wide: 'webgl-dunes',
    wideAlt: 'A figure on the ridge of rippled dunes at dusk.',
    plate: 'plate-webgl',
    plateAlt: 'A glass prism casting a small spectrum onto paper.',
  },
};

export const REGIONS = LAYERS.map((layer) => ({
  ...layer,
  ...COPY[layer.key],
  count: countByLayer(layer.key),
  href: `./library.html?layer=${layer.key}`,
}));

const nonEmpty = (source) => source.split('\n').filter((line) => line.trim()).length;

export const STATS = {
  specimens: specimens.length,
  layers: LAYERS.length,
  lines: specimens.reduce((sum, spec) => sum + nonEmpty(spec.html) + nonEmpty(spec.css) + nonEmpty(spec.js), 0),
};

/** One specimen per layer: the set every take shows running. */
export const specimenHref = (spec) => `./library.html#${spec.slug}`;
export const specimenFacts = (spec) =>
  `${layerOf(spec).name} · ${spec.lines} lines · ${DEPENDENCIES[spec.dependency] || spec.dependency}`;

export { specimens, bySlug, layerOf };
