export default {
  id: 'FH-001',
  title: 'Container-query card',
  layer: 'layout',
  dependency: 'none',
  tags: ['container queries', 'responsive', 'css'],
  summary: 'A card that changes layout by its own width, not the viewport’s. Drag the cyan edge.',
  notes: [
    '`container-type: inline-size` on the wrapper turns it into a query container.',
    'Two `@container` rules do all the layout work: body text appears at 240px, and the card goes side by side at 320px.',
    'The script only moves the edge. Delete it and the CSS still holds.',
  ],
  keyboard: 'Focus the edge, then press ← or →. Hold Shift for bigger steps.',
  reduced: 'Skips the opening sweep.',
  links: [
    {
      label: 'MDN: CSS container queries',
      href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries',
    },
  ],
};
