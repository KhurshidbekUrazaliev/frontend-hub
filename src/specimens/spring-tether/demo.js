export default function mount(root, params = {}) {
  const stage = root.querySelector('.spring');
  const puck = root.querySelector('.spring__puck');
  const tether = root.querySelector('.spring__tether line');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const offset = { x: 0, y: 0 }; // from the anchor, in pixels
  const velocity = { x: 0, y: 0 }; // pixels per second
  let grab = null;
  let lastTime = 0;
  let raf = 0;

  const render = () => {
    const cx = stage.clientWidth / 2;
    const cy = stage.clientHeight / 2;
    puck.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0)`;
    tether.setAttribute('x1', cx);
    tether.setAttribute('y1', cy);
    tether.setAttribute('x2', cx + offset.x);
    tether.setAttribute('y2', cy + offset.y);
  };

  const step = (now) => {
    const dt = Math.min((now - lastTime) / 1000, 0.032);
    lastTime = now;

    if (!grab) {
      const stiffness = params.stiffness ?? 180;
      const damping = params.damping ?? 10;
      // Semi-implicit Euler: update velocity from the force, then position from velocity.
      velocity.x += (-stiffness * offset.x - damping * velocity.x) * dt;
      velocity.y += (-stiffness * offset.y - damping * velocity.y) * dt;
      offset.x += velocity.x * dt;
      offset.y += velocity.y * dt;
    }

    render();
    const resting = !grab && Math.hypot(offset.x, offset.y) < 0.1 && Math.hypot(velocity.x, velocity.y) < 1;
    raf = resting ? 0 : requestAnimationFrame(step); // sleep when still
  };

  const wake = () => {
    if (raf) return;
    lastTime = performance.now();
    raf = requestAnimationFrame(step);
  };

  const onDown = (e) => {
    grab = { x: e.clientX - offset.x, y: e.clientY - offset.y, time: performance.now() };
    velocity.x = velocity.y = 0;
    puck.setPointerCapture(e.pointerId);
    wake();
  };

  const onMove = (e) => {
    if (!grab) return;
    const now = performance.now();
    const dt = Math.max((now - grab.time) / 1000, 0.001);
    const x = e.clientX - grab.x;
    const y = e.clientY - grab.y;
    velocity.x = (x - offset.x) / dt; // remember the throw
    velocity.y = (y - offset.y) / dt;
    offset.x = x;
    offset.y = y;
    grab.time = now;
  };

  const onUp = () => {
    if (!grab) return;
    grab = null;
    if (reduce) offset.x = offset.y = velocity.x = velocity.y = 0;
    wake();
  };

  const onKey = (e) => {
    const nudge = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!nudge || reduce) return;
    e.preventDefault();
    velocity.x += nudge[0] * 900;
    velocity.y += nudge[1] * 900;
    wake();
  };

  puck.addEventListener('pointerdown', onDown);
  puck.addEventListener('pointermove', onMove);
  puck.addEventListener('pointerup', onUp);
  puck.addEventListener('pointercancel', onUp);
  puck.addEventListener('keydown', onKey);

  // Start pulled to one side so it springs home on arrival.
  if (!reduce) {
    offset.x = Math.min(120, stage.clientWidth * 0.28);
    offset.y = -40;
  }
  render();
  wake();

  return () => cancelAnimationFrame(raf);
}
