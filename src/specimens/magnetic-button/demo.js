import gsap from 'gsap';

export default function mount(root, params = {}) {
  const button = root.querySelector('.magnet');
  const label = root.querySelector('.magnet__label');

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  // quickTo returns a setter that retargets a live tween: made for pointer events.
  const spring = { duration: 0.9, ease: 'elastic.out(1, 0.45)' };
  const buttonX = gsap.quickTo(button, 'x', spring);
  const buttonY = gsap.quickTo(button, 'y', spring);
  const labelX = gsap.quickTo(label, 'x', spring);
  const labelY = gsap.quickTo(label, 'y', spring);

  const pullTo = (x, y) => {
    buttonX(x);
    buttonY(y);
    labelX(x * 0.35); // the label lags behind, for depth
    labelY(y * 0.35);
  };

  const onMove = (e) => {
    const box = button.getBoundingClientRect();
    // Measure from the resting centre, not from wherever the pull has moved it.
    const restX = box.left + box.width / 2 - gsap.getProperty(button, 'x');
    const restY = box.top + box.height / 2 - gsap.getProperty(button, 'y');
    const dx = e.clientX - restX;
    const dy = e.clientY - restY;
    const strength = Math.hypot(dx, dy) < (params.radius ?? 170) ? (params.strength ?? 0.45) : 0;
    pullTo(dx * strength, dy * strength);
  };

  const onLeave = () => pullTo(0, 0);

  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerleave', onLeave);

  return () => {
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerleave', onLeave);
    gsap.killTweensOf([button, label]);
  };
}
