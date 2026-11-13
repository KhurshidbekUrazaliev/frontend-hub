export default {
  id: 'FH-011',
  title: 'Dither flow',
  layer: 'webgl',
  dependency: 'none',
  tags: ['shader', 'dithering', 'noise', 'glsl'],
  summary: 'Warped noise, cut down to two colours with a 4×4 Bayer matrix. Raw WebGL, one triangle.',
  notes: [
    'Domain-warped fractal noise gives the flow. The pointer adds light around itself.',
    'An ordered-dither threshold then decides, for each chunky pixel, whether it is ink or cyan.',
    'No library: one full-canvas triangle and a fragment shader.',
  ],
  keyboard: 'Decorative. There is nothing to operate.',
  reduced: 'Renders a single still frame; the pointer still lights it.',
  controls: [
    { key: 'cell', label: 'Pixel size', min: 2, max: 12, step: 1, value: 4, unit: 'px' },
    { key: 'speed', label: 'Speed', min: 0, max: 3, step: 0.1, value: 1, unit: '×' },
  ],
  links: [
    { label: 'The Book of Shaders', href: 'https://thebookofshaders.com/' },
    { label: 'MDN: WebGL tutorial', href: 'https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial' },
  ],
};
