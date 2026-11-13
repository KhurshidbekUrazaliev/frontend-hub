import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

export default function mount(root, params = {}) {
  const text = root.querySelector('.lines__text');
  const replay = root.querySelector('.lines__replay');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tween;

  const split = SplitText.create(text, {
    type: 'lines',
    mask: 'lines', // each line gets its own clipping wrapper
    autoSplit: true, // re-split when fonts load or the width changes
    onSplit(self) {
      tween = reduce
        ? gsap.from(self.lines, { opacity: 0, duration: 0.4, stagger: 0.06 })
        : gsap.from(self.lines, {
            yPercent: 110,
            duration: params.duration ?? 1,
            ease: 'expo.out',
            stagger: params.stagger ?? 0.09,
          });
      return tween; // lets SplitText keep the animation in sync across re-splits
    },
  });

  const onReplay = () => tween?.restart();
  replay.addEventListener('click', onReplay);

  return () => {
    replay.removeEventListener('click', onReplay);
    split.revert();
  };
}
