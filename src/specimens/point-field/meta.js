export default {
  id: 'FH-012',
  title: 'Point field',
  layer: 'webgl',
  dependency: 'three',
  tags: ['three.js', 'points', 'vertex shader'],
  summary: 'Five thousand points on a plane. The pointer drops a ripple; the vertex shader does the rest.',
  notes: [
    'All of the motion happens in the vertex shader. The geometry is uploaded once and never touched again.',
    'A raycast onto the ground plane turns the pointer into field coordinates.',
    'Points near the pointer grow and take the accent colour.',
  ],
  keyboard: 'Decorative. There is nothing to operate.',
  reduced: 'Time stops. The pointer still shapes the field.',
  controls: [{ key: 'amplitude', label: 'Amplitude', min: 0.1, max: 0.9, step: 0.05, value: 0.35 }],
  links: [{ label: 'three.js: Points', href: 'https://threejs.org/docs/#api/en/objects/Points' }],
};
