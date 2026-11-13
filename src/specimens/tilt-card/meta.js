export default {
  id: 'FH-006',
  title: 'Tilt card',
  layer: 'interaction',
  dependency: 'none',
  tags: ['3d transforms', 'pointer', 'custom properties'],
  summary: 'A card that tilts toward the pointer, with a glare that follows it across the face.',
  notes: [
    'Pointer position becomes five custom properties. CSS does the transform and the glare gradient.',
    'Values ease toward their targets in a small rAF loop that stops once they settle.',
    'The title sits on `translateZ(36px)`, so it parallaxes against the face it is printed on.',
  ],
  keyboard: 'Decorative. There is nothing to operate.',
  reduced: 'No tilt. The glare still follows the pointer.',
  controls: [{ key: 'max', label: 'Max tilt', min: 4, max: 24, step: 1, value: 12, unit: '°' }],
  links: [
    { label: 'MDN: perspective', href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/perspective' },
  ],
};
