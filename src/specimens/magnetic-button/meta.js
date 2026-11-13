export default {
  id: 'FH-005',
  title: 'Magnetic button',
  layer: 'interaction',
  dependency: 'gsap',
  tags: ['hover', 'quickTo', 'button'],
  summary: 'A button that leans toward the pointer and snaps back on a spring.',
  notes: [
    '`gsap.quickTo()` returns a setter that retargets a running tween, which is cheap enough to call on every pointer event.',
    'The label travels a third as far as the button, for a hint of depth.',
    'The pull is measured from the button’s resting centre, so it never chases its own offset.',
  ],
  keyboard: 'A real button: focusable, with the same styling on focus as on hover.',
  reduced: 'No pull at all. It behaves like an ordinary button.',
  controls: [
    { key: 'strength', label: 'Strength', min: 0.1, max: 0.9, step: 0.05, value: 0.45 },
    { key: 'radius', label: 'Radius', min: 80, max: 280, step: 10, value: 170, unit: 'px' },
  ],
  links: [{ label: 'GSAP: gsap.quickTo()', href: 'https://gsap.com/docs/v3/GSAP/gsap.quickTo()/' }],
};
