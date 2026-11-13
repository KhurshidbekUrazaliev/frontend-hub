export default {
  id: 'FH-008',
  title: 'Stagger ripple',
  layer: 'motion',
  dependency: 'gsap',
  tags: ['stagger', 'grid', 'keyframes'],
  summary: 'Click anywhere on the grid. One tween, staggered by each dot’s distance from the click.',
  notes: [
    '`stagger: { grid, from }` lets GSAP work out every dot’s delay from its distance to the origin cell.',
    'Each dot runs two keyframes: swell and take the accent colour, then settle back.',
    'The whole ripple is a single `gsap.to()` call on all the dots at once.',
  ],
  keyboard: 'Focus the grid and press Enter. The ripple starts from the centre.',
  reduced: 'Only the origin dot flashes. Nothing travels.',
  controls: [
    { key: 'spread', label: 'Spread', min: 0.2, max: 1.8, step: 0.05, value: 0.7, unit: 's' },
    { key: 'scale', label: 'Swell', min: 1.5, max: 5, step: 0.1, value: 3.2, unit: '×' },
  ],
  links: [{ label: 'GSAP: Staggers', href: 'https://gsap.com/resources/getting-started/Staggers/' }],
};
