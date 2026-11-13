import { gsap, prefersReduced } from './motion.js';
import { lockScroll } from './scroll.js';

/**
 * Full-screen overlay behaviour shared by the specimen sheet and the design
 * sheet: it grows out of the thing you clicked, freezes the page behind it,
 * keeps focus inside, and hands focus back when it closes.
 */
export function createOverlay(el, { onRequestClose, onClosed } = {}) {
  let open = false;
  let lastFocus = null;

  const behind = () =>
    [...document.body.children].filter(
      (node) => node !== el && !node.matches('.curtain, .cursor-label, .toast, script, .icons'),
    );

  function show(originRect) {
    if (open) return;
    open = true;
    lastFocus = document.activeElement;
    el.hidden = false;
    lockScroll(true);
    behind().forEach((node) => (node.inert = true)); // nothing behind can take focus

    if (prefersReduced()) return;
    const from = originRect
      ? `inset(${originRect.top}px ${window.innerWidth - originRect.right}px ${window.innerHeight - originRect.bottom}px ${originRect.left}px)`
      : 'inset(100% 0% 0% 0%)';
    const to = originRect ? 'inset(0px 0px 0px 0px)' : 'inset(0% 0% 0% 0%)';
    gsap.fromTo(el, { clipPath: from }, { clipPath: to, duration: 0.8, ease: 'fhInOut', clearProps: 'clipPath' });
  }

  function hide() {
    if (!open) return;
    open = false;

    const finish = () => {
      el.hidden = true;
      gsap.set(el, { clearProps: 'clipPath' });
      lockScroll(false);
      behind().forEach((node) => (node.inert = false));
      lastFocus?.focus?.({ preventScroll: true });
      onClosed?.();
    };

    if (prefersReduced()) {
      finish();
      return;
    }
    gsap.killTweensOf(el);
    gsap.fromTo(
      el,
      { clipPath: 'inset(0% 0% 0% 0%)' },
      { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.55, ease: 'fhInOut', onComplete: finish },
    );
  }

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !open) return;
    e.preventDefault();
    (onRequestClose || hide)();
  });

  return {
    show,
    hide,
    get isOpen() {
      return open;
    },
  };
}
