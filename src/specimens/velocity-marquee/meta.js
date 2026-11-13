export default {
  id: 'FH-009',
  title: 'Velocity marquee',
  layer: 'motion',
  dependency: 'none',
  tags: ['marquee', 'scroll velocity', 'loop'],
  summary: 'A marquee that speeds up, leans and changes direction with your scroll. You can drag it too.',
  notes: [
    'How far the page scrolled this frame becomes an energy value that eases back to zero.',
    'Energy adds to the base speed and sets the skew. Scroll direction sets which way it runs.',
    'The track is translated modulo one unit’s width, so the loop has no seam.',
  ],
  keyboard: 'Decorative. The phrase is exposed once to assistive tech, not once per copy.',
  reduced: 'Stands still.',
  controls: [
    { key: 'speed', label: 'Base speed', min: 0, max: 240, step: 10, value: 70, unit: 'px/s' },
    { key: 'boost', label: 'Scroll boost', min: 0, max: 2, step: 0.1, value: 0.6, unit: '×' },
  ],
  links: [
    {
      label: 'MDN: requestAnimationFrame',
      href: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame',
    },
  ],
};
