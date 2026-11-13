export default {
  id: 'FH-003',
  title: 'Line mask reveal',
  layer: 'type',
  dependency: 'gsap',
  tags: ['splittext', 'reveal', 'text'],
  summary: 'Lines rise from behind their own baseline. The split re-runs when the width changes, so line breaks stay honest.',
  notes: [
    '`SplitText` splits the paragraph by line and wraps each line in a clipping mask (`mask: "lines"`).',
    '`autoSplit` re-splits when fonts load or the width changes. Returning the tween from `onSplit` keeps it in sync.',
    'Only `yPercent` animates, so the whole reveal is a transform.',
  ],
  keyboard: 'Replay is a real button.',
  reduced: 'Lines fade in where they stand instead of travelling.',
  controls: [
    { key: 'duration', label: 'Duration', min: 0.4, max: 2, step: 0.05, value: 1, unit: 's', restart: true },
    { key: 'stagger', label: 'Stagger', min: 0, max: 0.3, step: 0.01, value: 0.09, unit: 's', restart: true },
  ],
  links: [{ label: 'GSAP: SplitText', href: 'https://gsap.com/docs/v3/Plugins/SplitText/' }],
};
