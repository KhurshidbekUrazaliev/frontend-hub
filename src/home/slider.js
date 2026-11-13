/**
 * The hero's photograph, drawn in WebGL so one image can wipe into the next
 * with a soft, leaning edge that drags both pictures along with it.
 *
 * Raw WebGL on purpose: this is one triangle and two textures, and the hero
 * should not wait for a 3D library to arrive.
 */
import { gsap } from '../core/motion.js';

const VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform vec2 uResolution;
uniform float uAspect;    // image width / height
uniform float uProgress;  // 0 = old image, 1 = new image
uniform float uDirection; // +1 the new image arrives from the right, -1 from the left
uniform float uSmear;     // 0 turns the wipe into a plain cross-fade
uniform vec2 uPointer;    // -1..1
uniform float uZoomFrom;
uniform float uZoomTo;

// object-fit: cover, with a zoom and an offset
vec2 cover(vec2 uv, float zoom, vec2 offset) {
  float screen = uResolution.x / uResolution.y;
  vec2 scale = screen > uAspect ? vec2(1.0, uAspect / screen) : vec2(screen / uAspect, 1.0);
  return (uv - 0.5) * scale / zoom + 0.5 + offset;
}

void main() {
  float p = uProgress;

  // How far the wipe has travelled, measured from the side the new image enters.
  float x = uDirection > 0.0 ? 1.0 - vUv.x : vUv.x;
  float lean = 0.16 * (1.0 - vUv.y);
  float soft = 0.36;
  float front = p * (1.0 + soft + 0.16);
  float wipe = smoothstep(0.0, soft, front - x - lean);
  float mask = mix(p, wipe, uSmear);
  float band = mask * (1.0 - mask) * 4.0; // 1 on the edge itself, 0 either side

  vec2 parallax = uPointer * vec2(0.008, 0.006);
  float push = uDirection * uSmear;

  vec2 fromUv = cover(vUv, uZoomFrom * (1.0 + 0.05 * p), parallax + vec2(push * (0.04 * p + 0.06 * band), 0.0));
  vec2 toUv = cover(
    vUv,
    uZoomTo * (1.0 + 0.08 * (1.0 - p)),
    parallax * 1.4 - vec2(push * (0.05 * (1.0 - p) + 0.06 * band), 0.0)
  );

  vec3 color = mix(texture2D(uFrom, fromUv).rgb, texture2D(uTo, toUv).rgb, mask);
  color += band * 0.04 * uSmear;
  gl_FragColor = vec4(color, 1.0);
}`;

const REST_ZOOM = 1.06;
const ARRIVE_ZOOM = 1.17;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) || 'shader failed to compile');
  }
  return shader;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string[]} sources image URLs, all the same shape
 * @returns the slider, or null where WebGL is not available
 */
export function createSlider(canvas, sources, { reduced = false } = {}) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'high-performance' });
  if (!gl) return null;

  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'link failed');
  } catch (error) {
    console.error('[atlas] slider shader', error);
    return null;
  }
  gl.useProgram(program);

  // One triangle that covers the whole clip space.
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name) => gl.getUniformLocation(program, name);
  const u = {
    from: uniform('uFrom'),
    to: uniform('uTo'),
    resolution: uniform('uResolution'),
    aspect: uniform('uAspect'),
    progress: uniform('uProgress'),
    direction: uniform('uDirection'),
    smear: uniform('uSmear'),
    pointer: uniform('uPointer'),
    zoomFrom: uniform('uZoomFrom'),
    zoomTo: uniform('uZoomTo'),
  };
  gl.uniform1i(u.from, 0);
  gl.uniform1i(u.to, 1);
  gl.uniform1f(u.smear, reduced ? 0 : 1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  const slides = sources.map(() => ({ texture: null, loading: null, zoom: REST_ZOOM }));
  const state = { from: 0, to: 0, progress: 0, direction: 1, aspect: 16 / 9 };
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

  function load(index) {
    const slide = slides[index];
    if (slide.texture) return Promise.resolve(slide.texture);
    if (slide.loading) return slide.loading;

    slide.loading = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        state.aspect = img.naturalWidth / img.naturalHeight;
        slide.texture = texture;
        resolve(texture);
      };
      img.onerror = () => reject(new Error(`could not load ${sources[index]}`));
      img.src = sources[index];
    });
    return slide.loading;
  }

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.uniform2f(u.resolution, width, height);
  }

  function draw() {
    const from = slides[state.from];
    const to = slides[state.to];
    if (!from.texture || !to.texture) return;

    pointer.x += (pointer.targetX - pointer.x) * 0.06;
    pointer.y += (pointer.targetY - pointer.y) * 0.06;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, from.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, to.texture);
    gl.uniform1f(u.aspect, state.aspect);
    gl.uniform1f(u.progress, state.progress);
    gl.uniform1f(u.direction, state.direction);
    gl.uniform2f(u.pointer, pointer.x, pointer.y);
    gl.uniform1f(u.zoomFrom, from.zoom);
    gl.uniform1f(u.zoomTo, to.zoom);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  let running = false;
  let lost = false;
  let frame = 0;
  const loop = () => {
    draw();
    frame = requestAnimationFrame(loop);
  };

  /** A slow push-in on the picture that has just arrived. */
  function settle(index) {
    const slide = slides[index];
    gsap.killTweensOf(slide);
    if (reduced) {
      slide.zoom = REST_ZOOM;
      return;
    }
    gsap.fromTo(slide, { zoom: ARRIVE_ZOOM }, { zoom: REST_ZOOM, duration: 9, ease: 'power2.out' });
  }

  const observer = new ResizeObserver(() => {
    resize();
    if (!running) draw();
  });
  observer.observe(canvas);

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    running = false;
    canvas.classList.remove('is-on'); // the plain <img> underneath takes over
  });

  return {
    /** Put the first picture up without a transition. */
    async show(index) {
      await load(index);
      state.from = state.to = index;
      state.progress = 0;
      resize();
      settle(index);
      draw();
      canvas.classList.add('is-on');
    },

    /** Wipe to another picture. Resolves when it has fully arrived. */
    async go(index, direction = 1) {
      if (lost) return;
      await load(index);
      gsap.killTweensOf(state);
      state.to = index;
      state.direction = direction;
      state.progress = 0;
      settle(index);
      await gsap.to(state, { progress: 1, duration: reduced ? 0.7 : 1.5, ease: reduced ? 'power1.inOut' : 'fhInOut' });
      state.from = index;
      state.progress = 0;
    },

    /** Warm the cache so the next wipe starts at once. */
    preload: (index) => load(index).catch(() => {}),

    setPointer(x, y) {
      if (reduced) return;
      pointer.targetX = x;
      pointer.targetY = y;
    },

    /** Draw only while the hero is on screen. */
    setRunning(next) {
      if (lost || next === running) return;
      running = next;
      cancelAnimationFrame(frame);
      if (running) frame = requestAnimationFrame(loop);
    },

    get lost() {
      return lost;
    },
  };
}
