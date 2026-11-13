export default {
  id: 'FH-010',
  title: 'Spring tether',
  layer: 'motion',
  dependency: 'none',
  tags: ['physics', 'spring', 'drag'],
  summary: 'Drag the puck and let go. A real spring: stiffness and damping, integrated every frame.',
  notes: [
    'Acceleration is `−stiffness × offset − damping × velocity`, stepped with semi-implicit Euler.',
    'Letting go keeps the velocity of your throw, so a flick behaves like a flick.',
    'The loop goes to sleep once both offset and velocity are close to zero.',
  ],
  keyboard: 'Focus the puck and nudge it with the arrow keys.',
  reduced: 'The puck returns to centre without oscillating.',
  controls: [
    { key: 'stiffness', label: 'Stiffness', min: 40, max: 400, step: 10, value: 180 },
    { key: 'damping', label: 'Damping', min: 2, max: 40, step: 1, value: 10 },
  ],
  links: [
    {
      label: 'MDN: setPointerCapture()',
      href: 'https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture',
    },
  ],
};
