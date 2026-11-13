// The script only moves the container's edge. All of the layout is in the CSS.
export default function mount(root) {
  const frame = root.querySelector('.cq__frame');
  const handle = root.querySelector('.cq__handle');
  const readout = root.querySelector('.cq__read');
  const MIN = 160;
  let max = MIN;
  let drag = null;
  let raf = 0;

  const layoutAt = (width) => (width >= 320 ? 'side by side' : width >= 240 ? 'stacked' : 'compact');

  const setWidth = (value) => {
    const width = Math.round(Math.min(max, Math.max(MIN, value)));
    frame.style.width = `${width}px`;
    handle.setAttribute('aria-valuenow', width);
    handle.setAttribute('aria-valuetext', `${width} pixels, ${layoutAt(width)}`);
    readout.textContent = `${width}px / ${layoutAt(width)}`;
  };

  const measure = () => {
    max = Math.max(MIN, Math.min(520, root.clientWidth - 56));
    handle.setAttribute('aria-valuemin', MIN);
    handle.setAttribute('aria-valuemax', max);
    setWidth(max);
  };

  const onDown = (e) => {
    cancelAnimationFrame(raf);
    drag = { x: e.clientX, width: frame.offsetWidth };
    handle.setPointerCapture(e.pointerId);
  };
  // The frame is centred, so its width changes twice as fast as its edge moves.
  const onMove = (e) => {
    if (drag) setWidth(drag.width + (e.clientX - drag.x) * 2);
  };
  const onUp = () => {
    drag = null;
  };
  const onKey = (e) => {
    const direction = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!direction) return;
    e.preventDefault();
    cancelAnimationFrame(raf);
    setWidth(frame.offsetWidth + direction * (e.shiftKey ? 40 : 10));
  };

  // One sweep through every layout on arrival, so the edge reads as draggable.
  const sweep = () => {
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 2400);
      const wave = (1 - Math.cos(t * Math.PI * 2)) / 2;
      setWidth(max - (max - MIN) * wave);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };

  const observer = new ResizeObserver(measure);
  observer.observe(root);
  handle.addEventListener('pointerdown', onDown);
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
  handle.addEventListener('pointercancel', onUp);
  handle.addEventListener('keydown', onKey);

  measure();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) sweep();

  return () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
  };
}
