export default function mount(root, params = {}) {
  const card = root.querySelector('.tilt');
  const face = root.querySelector('.tilt__face');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const target = { rx: 0, ry: 0, gx: 50, gy: 50, glare: 0 };
  const current = { ...target };
  let raf = 0;

  // Ease every value toward its target; stop the loop once they have all arrived.
  const frame = () => {
    let settled = true;
    for (const key in target) {
      current[key] += (target[key] - current[key]) * 0.14;
      if (Math.abs(target[key] - current[key]) > 0.01) settled = false;
      face.style.setProperty(`--${key}`, current[key].toFixed(2));
    }
    raf = settled ? 0 : requestAnimationFrame(frame);
  };

  const wake = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const onMove = (e) => {
    const box = card.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width - 0.5; // -0.5 … 0.5
    const y = (e.clientY - box.top) / box.height - 0.5;
    const max = reduce ? 0 : (params.max ?? 12);
    target.ry = x * 2 * max;
    target.rx = -y * 2 * max;
    target.gx = (x + 0.5) * 100;
    target.gy = (y + 0.5) * 100;
    target.glare = 1;
    wake();
  };

  const onLeave = () => {
    target.rx = 0;
    target.ry = 0;
    target.glare = 0;
    wake();
  };

  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerleave', onLeave);

  return () => {
    cancelAnimationFrame(raf);
    card.removeEventListener('pointermove', onMove);
    card.removeEventListener('pointerleave', onLeave);
  };
}
