import gsap from 'gsap';

const COLS = 15;
const ROWS = 9;
const REST = '#7b8a91';
const HOT = '#2ad2ee';

export default function mount(root, params = {}) {
  const grid = root.querySelector('.ripple');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  grid.style.setProperty('--cols', COLS);
  grid.style.setProperty('--rows', ROWS);
  grid.innerHTML = '<i></i>'.repeat(COLS * ROWS);
  const dots = [...grid.children];

  const ripple = (origin) => {
    if (reduce) {
      gsap.fromTo(dots[origin], { color: HOT }, { color: REST, duration: 0.8 });
      return;
    }
    gsap.to(dots, {
      keyframes: [
        { scale: params.scale ?? 3.2, color: HOT, duration: 0.2, ease: 'power2.out' },
        { scale: 1, color: REST, duration: 0.7, ease: 'power3.out' },
      ],
      // GSAP works out each dot's delay from its distance to the origin cell.
      stagger: { grid: [ROWS, COLS], from: origin, amount: params.spread ?? 0.7 },
      overwrite: true,
    });
  };

  const onPointer = (e) => {
    const box = grid.getBoundingClientRect();
    const col = Math.min(COLS - 1, Math.floor(((e.clientX - box.left) / box.width) * COLS));
    const row = Math.min(ROWS - 1, Math.floor(((e.clientY - box.top) / box.height) * ROWS));
    ripple(row * COLS + col);
  };

  const centre = Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2);
  const onKey = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    ripple(centre);
  };

  grid.addEventListener('pointerdown', onPointer);
  grid.addEventListener('keydown', onKey);
  ripple(centre); // one ripple on arrival

  return () => {
    grid.removeEventListener('pointerdown', onPointer);
    grid.removeEventListener('keydown', onKey);
    gsap.killTweensOf(dots);
  };
}
