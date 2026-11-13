export default {
  id: 'FH-004',
  title: 'Variable proximity',
  layer: 'type',
  dependency: 'none',
  tags: ['variable fonts', 'pointer', 'font-variation-settings'],
  summary: 'Letters gain weight and width as the pointer gets close. One variable font, two axes, no library.',
  notes: [
    'Each letter gets an eased 0–1 influence from its distance to the pointer.',
    'That value drives the `wght` and `wdth` axes through two custom properties.',
    'This one touches layout on purpose: glyphs really do change width. All reads happen before any write, and the loop sleeps when nothing is moving.',
  ],
  keyboard: 'Decorative. There is nothing to operate.',
  reduced: 'Still answers the pointer; nothing moves on its own.',
  controls: [{ key: 'radius', label: 'Radius', min: 80, max: 400, step: 10, value: 200, unit: 'px' }],
  links: [
    {
      label: 'MDN: Variable fonts guide',
      href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Fonts/Variable_fonts',
    },
  ],
};
