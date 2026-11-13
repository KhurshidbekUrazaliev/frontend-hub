export default {
  id: 'FH-007',
  title: 'Hold to confirm',
  layer: 'interaction',
  dependency: 'none',
  tags: ['button', 'press', 'destructive action'],
  summary: 'A destructive action that needs a deliberate hold. Let go early and it drains back.',
  notes: [
    'The fill is a `clip-path` transition whose duration is the hold time.',
    'A timeout of the same length commits the action. Releasing clears it, and the fill reverses on a short ease.',
    'A second copy of the label, clipped along with the fill, keeps the text readable on both colours.',
  ],
  keyboard: 'Focus the button and hold Space or Enter.',
  reduced: 'Unchanged. The fill is progress feedback, not decoration.',
  controls: [{ key: 'seconds', label: 'Hold time', min: 0.5, max: 3, step: 0.1, value: 1.2, unit: 's' }],
  links: [{ label: 'MDN: Pointer events', href: 'https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events' }],
};
