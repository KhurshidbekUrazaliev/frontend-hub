/**
 * The descent: a straight corridor of thin frames, with five chambers along
 * it. Each chamber is a word you fly through and three photographs behind it.
 * Photographs are grey and dim in the distance and take on colour as they
 * come close, then dissolve as the camera passes through them.
 *
 * The page owns scroll; this module only turns a 0..1 progress into a camera
 * position and draws.
 */
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Fog,
  LinearFilter,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  WebGLRenderer,
} from 'three';
import { gsap } from '../core/motion.js';

// The site's colours (--ink-0, --accent, --paper); a caller can pass different ones.
const DEFAULT_PALETTE = { background: 0x05080a, accent: 0x2ad2ee, ink: '#eef3f4' };
const FOG_NEAR = 8;
const FOG_FAR = 62;

const FIRST = 22; // distance from the origin to the first chamber's word
const SPACING = 46; // distance between chambers
const STEP = SPACING / 4; // distance between frames

export const START_Z = 12;
export const chamberZ = (index) => -(FIRST + index * SPACING);

/** Where the three photographs of a chamber hang: [x, y, z offset, width, turn]. Odd chambers are mirrored. */
const PLACES = [
  [3.6, 0.5, -10, 15, -0.07],
  [-8.2, -0.9, -18, 5.8, 0.16],
  [6.6, -1.5, -26, 8.8, -0.12],
];

const PHOTO_VERTEX = `
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = uv;
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  vDepth = -view.z;
  gl_Position = projectionMatrix * view;
}`;

const PHOTO_FRAGMENT = `
uniform sampler2D uMap;
uniform float uReady;
uniform vec3 uFog;
uniform float uFogNear;
uniform float uFogFar;
varying vec2 vUv;
varying float vDepth;
void main() {
  vec3 color = texture2D(uMap, vUv).rgb;
  float grey = dot(color, vec3(0.299, 0.587, 0.114));
  float far = smoothstep(9.0, 36.0, vDepth);
  color = mix(color, vec3(grey), far * 0.92); // colour arrives as you approach
  color *= mix(1.0, 0.7, far);
  color = mix(color, uFog, smoothstep(uFogNear, uFogFar, vDepth));
  float near = smoothstep(0.8, 5.5, vDepth); // dissolve just before the camera passes through
  gl_FragColor = vec4(color, near * uReady);
}`;

/** A rectangle outline with real thickness, so it thins with distance instead of staying one pixel. */
function frameGeometry(width, height, thickness) {
  const w = width / 2;
  const h = height / 2;
  const t = thickness;
  const quads = [
    [-w, h - t, w, h], // top
    [-w, -h, w, -h + t], // bottom
    [-w, -h + t, -w + t, h - t], // left
    [w - t, -h + t, w, h - t], // right
  ];
  const positions = [];
  for (const [x0, y0, x1, y1] of quads) {
    positions.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return geometry;
}

/** A word drawn large onto a canvas, cropped to its own ink. */
function wordTexture(word, font, ink) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const probe = 400;
  context.font = `${font.replace('%s', probe)}`;
  const metrics = context.measureText(word);
  const inkWidth = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
  const scale = Math.min(1984 / inkWidth, 3.2);
  const size = probe * scale;
  const ascent = metrics.actualBoundingBoxAscent * scale;
  const descent = metrics.actualBoundingBoxDescent * scale;
  const pad = 32;

  canvas.width = Math.ceil(inkWidth * scale) + pad * 2;
  canvas.height = Math.ceil(ascent + descent) + pad * 2;
  context.font = `${font.replace('%s', size)}`;
  context.fillStyle = ink;
  context.textBaseline = 'alphabetic';
  context.fillText(word, pad + metrics.actualBoundingBoxLeft * scale, pad + ascent);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  return { texture, aspect: canvas.width / canvas.height };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ name: string, images: string[] }[]} chambers three image URLs each
 * @param {{ font: string, palette?: { background?: number, accent?: number, ink?: string } }} options
 *   `font` is a canvas font with %s where the pixel size goes
 */
export function createDescent(canvas, chambers, { font, palette = {} }) {
  const { background, accent, ink } = { ...DEFAULT_PALETTE, ...palette };
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setClearColor(background, 1);

  const scene = new Scene();
  scene.fog = new Fog(background, FOG_NEAR, FOG_FAR);
  const camera = new PerspectiveCamera(50, 1, 0.1, 140);

  const endZ = chamberZ(chambers.length - 1) - 36;
  const fogColor = new Color(background).convertLinearToSRGB(); // the photo shader works in display space
  const inkColor = new Color(ink);
  const loader = new TextureLoader();
  const unit = new PlaneGeometry(1, 1);
  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  let fit = 1; // layout scale for narrow screens
  let aspect = 1;

  /* ---------- frames ---------- */

  const frames = [];
  const frameMaterial = new MeshBasicMaterial({ color: inkColor, transparent: true, opacity: 0.2, depthWrite: false });
  const gateMaterial = new MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.95, depthWrite: false });
  for (let k = 0, z = chamberZ(0) + 8; z > endZ - 30; k += 1, z -= STEP) {
    const gate = k % 4 === 0 && k / 4 < chambers.length;
    const mesh = new Mesh(new BufferGeometry(), gate ? gateMaterial : frameMaterial);
    mesh.position.z = z;
    mesh.userData.gate = gate;
    scene.add(mesh);
    frames.push(mesh);
  }

  /* ---------- dust ---------- */

  const dustCount = 800;
  const dust = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i += 1) {
    dust[i * 3] = MathUtils.randFloatSpread(34);
    dust[i * 3 + 1] = MathUtils.randFloatSpread(19);
    dust[i * 3 + 2] = MathUtils.randFloat(endZ - 20, START_Z);
  }
  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute('position', new Float32BufferAttribute(dust, 3));
  // Round motes that never grow past a few pixels, however close they drift.
  const dustMaterial = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uScale: { value: 1 }, uMax: { value: 4 }, uInk: { value: inkColor.clone().convertLinearToSRGB() } },
    vertexShader: `
      uniform float uScale;
      uniform float uMax;
      varying float vAlpha;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        float depth = -view.z;
        gl_PointSize = min(0.11 * uScale / depth, uMax);
        vAlpha = (1.0 - smoothstep(${FOG_NEAR.toFixed(1)}, ${FOG_FAR.toFixed(1)}, depth)) * smoothstep(0.5, 7.0, depth);
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      uniform vec3 uInk;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(uInk, vAlpha * 0.6 * smoothstep(0.5, 0.15, d));
      }`,
  });
  scene.add(new Points(dustGeometry, dustMaterial));

  /* ---------- chambers ---------- */

  const rooms = chambers.map((chamber, index) => {
    const z = chamberZ(index);
    const mirror = index % 2 ? -1 : 1;

    const word = wordTexture(chamber.name.toUpperCase(), font, ink);
    const title = new Mesh(
      unit,
      new MeshBasicMaterial({ map: word.texture, transparent: true, opacity: 0, depthWrite: false, fog: false }),
    );
    title.position.z = z;
    title.userData.aspect = word.aspect;
    scene.add(title);

    const photos = PLACES.map(([x, y, dz, width, turn], n) => {
      const material = new ShaderMaterial({
        vertexShader: PHOTO_VERTEX,
        fragmentShader: PHOTO_FRAGMENT,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uMap: { value: null },
          uReady: { value: 0 },
          uFog: { value: fogColor },
          uFogNear: { value: FOG_NEAR },
          uFogFar: { value: FOG_FAR },
        },
      });
      const mesh = new Mesh(unit, material);
      mesh.userData = { x: x * mirror, y, width, aspect: 1.5, phase: index * 1.7 + n * 2.1 };
      mesh.position.z = z + dz;
      mesh.rotation.y = turn * mirror;
      mesh.rotation.z = (n - 1) * 0.012 * mirror;
      mesh.visible = false;
      scene.add(mesh);
      return mesh;
    });

    return { z, title, photos, urls: chamber.images, requested: false };
  });

  function request(room) {
    if (room.requested) return;
    room.requested = true;
    room.photos.forEach((mesh, n) => {
      loader.load(room.urls[n], (texture) => {
        texture.anisotropy = maxAnisotropy;
        mesh.material.uniforms.uMap.value = texture;
        mesh.userData.aspect = texture.image.width / texture.image.height;
        mesh.visible = true;
        place();
        gsap.to(mesh.material.uniforms.uReady, { value: 1, duration: 1.2, ease: 'power2.out' });
      });
    });
  }

  /* ---------- layout, redone whenever the shape of the screen changes ---------- */

  function place() {
    rooms.forEach((room) => {
      const titleWidth = 26 * fit;
      room.title.scale.set(titleWidth, titleWidth / room.title.userData.aspect, 1);
      room.photos.forEach((mesh) => {
        const { x, width, aspect: shape } = mesh.userData;
        mesh.position.x = x * fit;
        mesh.scale.set(width * fit, (width * fit) / shape, 1);
      });
    });
  }

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    dustMaterial.uniforms.uScale.value = height * ratio;
    dustMaterial.uniforms.uMax.value = 4 * ratio;

    aspect = width / height;
    camera.aspect = aspect;
    camera.userData.fov = aspect < 0.9 ? 64 : 50;
    camera.fov = camera.userData.fov;
    camera.updateProjectionMatrix();

    // How wide the view is 20 units ahead decides how much the layout must shrink.
    const viewHeight = 2 * 20 * Math.tan(MathUtils.degToRad(camera.fov / 2));
    fit = MathUtils.clamp((viewHeight * aspect) / 33, 0.42, 1);

    const frameHeight = viewHeight * 0.9;
    const frameWidth = frameHeight * aspect;
    frames.forEach((mesh) => {
      mesh.geometry.dispose();
      mesh.geometry = frameGeometry(frameWidth, frameHeight, mesh.userData.gate ? 0.07 : 0.035);
    });
    place();
  }

  /* ---------- per frame ---------- */

  const state = { target: 0, progress: 0, z: START_Z, speed: 0 };
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const listeners = new Set();
  let running = false;
  let raf = 0;
  let last = 0;

  function update(now) {
    const dt = Math.min((now - last) / 1000 || 0.016, 0.1);
    last = now;
    const time = now / 1000;

    // Ease toward the scroll position, independent of frame rate.
    const k = 1 - Math.pow(1 - 0.14, dt * 60);
    state.progress += (state.target - state.progress) * k;
    const z = START_Z + (endZ - START_Z) * state.progress;
    state.speed += ((z - state.z) / dt - state.speed) * k;
    state.z = z;

    pointer.x += (pointer.targetX - pointer.x) * k * 0.5;
    pointer.y += (pointer.targetY - pointer.y) * k * 0.5;

    camera.position.set(pointer.x * 1.1 * fit, -pointer.y * 0.7 + Math.sin(time * 0.4) * 0.07, z);
    camera.rotation.set(pointer.y * 0.03, -pointer.x * 0.05, Math.sin(time * 0.23) * 0.004);
    // Moving fast widens the lens a little.
    camera.fov = camera.userData.fov + Math.min(Math.abs(state.speed) * 0.09, 9);
    camera.updateProjectionMatrix();

    rooms.forEach((room) => {
      const distance = z - room.z;
      if (distance < 110) request(room);

      // The word appears as you close in, and thins out as you fly through it.
      const appear = 1 - MathUtils.smoothstep(distance, 24, 34);
      const pass = MathUtils.smoothstep(distance, 2.5, 15);
      room.title.material.opacity = appear * pass;
      room.title.visible = room.title.material.opacity > 0.003;

      room.photos.forEach((mesh) => {
        const { y, phase } = mesh.userData;
        mesh.position.y = y * Math.max(fit, 0.7) + Math.sin(time * 0.35 + phase) * 0.14;
      });
    });

    renderer.render(scene, camera);
    listeners.forEach((listener) => listener(state));
  }

  const loop = (now) => {
    update(now);
    raf = requestAnimationFrame(loop);
  };

  new ResizeObserver(() => {
    resize();
    if (!running) update(performance.now());
  }).observe(canvas);
  resize();
  request(rooms[0]);

  return {
    endZ,
    /** 0 at the surface, 1 past the last chamber. */
    setProgress(value) {
      state.target = MathUtils.clamp(value, 0, 1);
    },
    setPointer(x, y) {
      pointer.targetX = x;
      pointer.targetY = y;
    },
    setRunning(next) {
      if (next === running) return;
      running = next;
      cancelAnimationFrame(raf);

      // Arriving or leaving, start from where the scroll really is. Without
      // this, a jump past the section (an anchor link, the End key) would
      // leave the camera mid-corridor and it would race to catch up later.
      state.progress = state.target;
      state.z = START_Z + (endZ - START_Z) * state.progress;
      state.speed = 0;

      if (running) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      } else {
        update(performance.now()); // one last frame, so the caption and gauge match
      }
    },
    /** Called after every drawn frame with { progress, z, speed }. */
    onFrame(listener) {
      listeners.add(listener);
    },
  };
}
