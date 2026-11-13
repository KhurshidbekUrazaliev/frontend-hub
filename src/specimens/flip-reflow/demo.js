import gsap from 'gsap';
import { Flip } from 'gsap/Flip';

gsap.registerPlugin(Flip);

export default function mount(root, params = {}) {
  const tiles = [...root.querySelectorAll('.tile')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const feature = (tile) => {
    if (tile.classList.contains('is-featured')) return;

    // First: remember where everything is (and what colour).
    const state = Flip.getState(tiles, { props: 'backgroundColor,borderColor,color' });

    // Last: change the layout. CSS grid repacks the tiles instantly.
    tiles.forEach((t) => t.classList.toggle('is-featured', t === tile));

    // Invert + Play: animate each tile from its old box to its new one.
    Flip.from(state, {
      duration: reduce ? 0 : (params.duration ?? 0.7),
      ease: 'power3.inOut',
      stagger: reduce ? 0 : 0.015,
      absolute: true,
    });
  };

  const onClick = (e) => {
    const tile = e.target.closest('.tile');
    if (tile) feature(tile);
  };

  root.addEventListener('click', onClick);

  return () => {
    root.removeEventListener('click', onClick);
    gsap.killTweensOf(tiles);
  };
}
