export default function mount(root, params = {}) {
  const strip = root.querySelector('.marquee');
  const track = root.querySelector('.marquee__track');
  const unit = track.firstElementChild;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  let unitWidth = 1;
  let x = 0; // track offset, always wrapped to one unit
  let energy = 0; // eased scroll or drag speed, in pixels per frame
  let direction = -1; // -1 runs left, 1 runs right
  let lastScroll = window.scrollY;
  let lastTime = performance.now();
  let dragX = null;
  let dragged = 0;
  let raf = 0;

  // Enough copies to cover the stage plus two spare, so the wrap is never on screen.
  const fill = () => {
    unitWidth = unit.offsetWidth || 1;
    const needed = Math.ceil(root.clientWidth / unitWidth) + 2;
    while (track.children.length < needed) track.append(unit.cloneNode(true));
  };

  const frame = (now) => {
    const dt = Math.min(now - lastTime, 64) / 1000;
    lastTime = now;

    const scrolled = window.scrollY - lastScroll;
    lastScroll = window.scrollY;
    if (scrolled) direction = scrolled > 0 ? -1 : 1; // scrolling down runs it left
    else if (dragged) direction = dragged > 0 ? 1 : -1; // dragging pulls it your way

    // Energy chases this frame's push, then eases back to zero on its own.
    const push = Math.abs(scrolled) || Math.abs(dragged);
    const target = push * (params.boost ?? 0.6);
    energy += (target - energy) * (1 - Math.pow(0.88, dt * 60));

    const speed = ((params.speed ?? 70) + energy * 40) * direction; // px per second
    x = (x + speed * dt + dragged) % unitWidth;
    dragged = 0;

    const skew = Math.max(-14, Math.min(14, energy * 0.35 * direction));
    track.style.transform = `translate3d(${x - unitWidth}px, 0, 0) skewX(${skew}deg)`;
    raf = requestAnimationFrame(frame);
  };

  const onDown = (e) => {
    dragX = e.clientX;
    strip.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (dragX === null) return;
    dragged += e.clientX - dragX;
    dragX = e.clientX;
  };
  const onUp = () => {
    dragX = null;
  };

  const observer = new ResizeObserver(fill);
  observer.observe(root);
  strip.addEventListener('pointerdown', onDown);
  strip.addEventListener('pointermove', onMove);
  strip.addEventListener('pointerup', onUp);
  strip.addEventListener('pointercancel', onUp);

  fill();
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
  };
}
