export default {
  id: 'FH-002',
  title: 'Flip reflow',
  layer: 'layout',
  dependency: 'gsap',
  tags: ['flip', 'css grid', 'layout animation'],
  summary: 'Click any tile to feature it. CSS grid does the reflow; Flip animates every tile from where it was to where it lands.',
  notes: [
    'Record positions with `Flip.getState()`, change the layout with a class, then let `Flip.from()` play the difference.',
    'The layout itself is plain CSS grid with `grid-auto-flow: dense`, so the tiles repack themselves.',
    '`absolute: true` lifts tiles out of flow while they travel, so grid tracks never fight the animation.',
  ],
  keyboard: 'Every tile is a button: Tab to one, press Enter to feature it.',
  reduced: 'The layout snaps into place with no travel.',
  controls: [{ key: 'duration', label: 'Duration', min: 0.2, max: 1.6, step: 0.05, value: 0.7, unit: 's' }],
  links: [{ label: 'GSAP: Flip plugin', href: 'https://gsap.com/docs/v3/Plugins/Flip/' }],
};
