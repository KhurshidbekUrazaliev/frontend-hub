import * as THREE from 'three';

const COLS = 90;
const ROWS = 56;

export default function mount(root, params = {}) {
  const canvas = root.querySelector('.field');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  camera.position.set(0, 3.4, 5.6);
  camera.lookAt(0, -0.2, 0);

  // A flat grid of points, uploaded once. The vertex shader does all the moving.
  const positions = new Float32Array(COLS * ROWS * 3);
  for (let i = 0; i < COLS * ROWS; i++) {
    positions[i * 3] = ((i % COLS) / (COLS - 1) - 0.5) * 10;
    positions[i * 3 + 2] = (Math.floor(i / COLS) / (ROWS - 1) - 0.5) * 6;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      time: { value: 0 },
      amplitude: { value: 0.35 },
      pointer: { value: new THREE.Vector2(99, 99) },
      pixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: `
      uniform float time, amplitude, pixelRatio;
      uniform vec2 pointer;
      varying float glow;

      void main() {
        vec3 p = position;
        float d = distance(p.xz, pointer);
        float swell = sin(p.x * 1.3 + time) * cos(p.z * 1.6 + time * 0.8);
        float ring = sin(d * 5.0 - time * 3.0) * exp(-d * 0.9);   // ripple around the pointer
        p.y = (swell * 0.5 + ring) * amplitude;
        glow = smoothstep(1.8, 0.0, d);

        vec4 view = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = pixelRatio * (1.4 + glow * 2.6) * (7.0 / -view.z);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      varying float glow;

      void main() {
        if (length(gl_PointCoord - 0.5) > 0.5) discard;            // round points
        vec3 colour = mix(vec3(0.933, 0.953, 0.957), vec3(0.165, 0.824, 0.933), glow);
        gl_FragColor = vec4(colour, 0.4 + glow * 0.6);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  // Pointer → a position on the ground plane, in the field's own coordinates.
  const raycaster = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();

  const onMove = (e) => {
    const box = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    if (raycaster.ray.intersectPlane(ground, hit)) material.uniforms.pointer.value.set(hit.x, hit.z);
  };
  const onLeave = () => material.uniforms.pointer.value.set(99, 99);

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  let time = 0;
  let lastTime = performance.now();
  let raf = 0;

  const frame = (now) => {
    if (!reduce) time += (now - lastTime) / 1000;
    lastTime = now;
    material.uniforms.time.value = time;
    material.uniforms.amplitude.value = params.amplitude ?? 0.35;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);

  resize();
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
