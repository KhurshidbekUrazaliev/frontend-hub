import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

// One easing signature for the whole site. These mirror --ease-out and
// --ease-in-out in tokens.css so CSS and JS motion feel identical.
CustomEase.create('fhOut', '0.16, 1, 0.3, 1');
CustomEase.create('fhInOut', '0.76, 0, 0.24, 1');

gsap.defaults({ ease: 'fhOut', duration: 0.9 });
ScrollTrigger.config({ ignoreMobileResize: true });

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const fineQuery = window.matchMedia('(hover: hover) and (pointer: fine)');

export const prefersReduced = () => reduceQuery.matches;
export const onReducedChange = (fn) => reduceQuery.addEventListener('change', fn);
export const hasFinePointer = () => fineQuery.matches;

export { gsap, ScrollTrigger, SplitText, CustomEase };
