const VERTEX = `
  attribute vec2 position;
  void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAGMENT = `
  precision highp float;
  uniform vec2 resolution;
  uniform vec2 pointer;
  uniform float time;
  uniform float cell;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0, amplitude = 0.5;
    for (int i = 0; i < 4; i++) { value += amplitude * noise(p); p *= 2.0; amplitude *= 0.5; }
    return value;
  }

  // 4x4 ordered-dither threshold, built from the 2x2 pattern.
  float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
  float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

  void main() {
    vec2 block = floor(gl_FragCoord.xy / cell);                 // chunky pixels
    vec2 uv = block * cell / resolution.y;
    vec2 flow = uv * 2.4 + vec2(time * 0.07, -time * 0.05);
    float field = fbm(flow + 1.6 * fbm(flow + time * 0.09));    // domain warp
    field += 0.4 * smoothstep(0.42, 0.0, distance(uv, pointer / resolution.y));
    float lit = step(bayer4(block), field * 1.6 - 0.46);         // ink or cyan, nothing between
    gl_FragColor = vec4(mix(vec3(0.020, 0.031, 0.039), vec3(0.165, 0.824, 0.933), lit), 1.0);
  }
`;

export default function mount(root, params = {}) {
  const canvas = root.querySelector('.dither');
  const gl = canvas.getContext('webgl', { antialias: false });
  if (!gl) return () => {};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  gl.useProgram(program);

  // One triangle, big enough to cover the whole canvas.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = {};
  for (const name of ['resolution', 'pointer', 'time', 'cell']) {
    uniform[name] = gl.getUniformLocation(program, name);
  }

  const pointer = [-9999, -9999];
  const pixelRatio = () => Math.min(window.devicePixelRatio, 2);
  let clock = 12; // start mid-flow so a still frame is already interesting
  let lastTime = performance.now();
  let raf = 0;

  const draw = (now) => {
    if (!reduce) clock += ((now - lastTime) / 1000) * (params.speed ?? 1);
    lastTime = now;
    gl.uniform2f(uniform.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniform.pointer, pointer[0], pointer[1]);
    gl.uniform1f(uniform.time, clock);
    gl.uniform1f(uniform.cell, (params.cell ?? 4) * pixelRatio());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduce) raf = requestAnimationFrame(draw);
  };

  const resize = () => {
    canvas.width = Math.round(canvas.clientWidth * pixelRatio());
    canvas.height = Math.round(canvas.clientHeight * pixelRatio());
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (reduce) draw(performance.now());
  };

  const onMove = (e) => {
    const box = canvas.getBoundingClientRect();
    const scale = canvas.width / box.width;
    pointer[0] = (e.clientX - box.left) * scale;
    pointer[1] = (box.bottom - e.clientY) * scale; // GL counts up from the bottom
    if (reduce) draw(performance.now());
  };
  const onLeave = () => {
    pointer[0] = pointer[1] = -9999;
    if (reduce) draw(performance.now());
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);

  resize();
  if (!reduce) raf = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
}
