/**
 * The scroll descent: wires page scroll to the 3D scene, and keeps the
 * caption and the depth gauge in step with the camera.
 *
 * The page supplies the markup hooks (data-descent, data-scene, data-intro,
 * data-chamber, ...), a font for the 3D words and the photographs.
 */
import { gsap, ScrollTrigger, prefersReduced, hasFinePointer } from '../core/motion.js';
import { $, $$, clamp, escapeHtml, icon, plural } from '../core/dom.js';
import { REGIONS } from '../core/regions.js';

const smooth = (value, from, to) => {
  const t = clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Resolves once the element is within a viewport and a half of the screen. */
const whenNear = (el) =>
  new Promise((resolve) => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        resolve();
      },
      { rootMargin: '150% 0px' },
    );
    observer.observe(el);
  });

/** The five regions as plain content: read by assistive tech, and shown where the scene cannot run. */
function buildFlat(poster) {
  $('[data-flat]').innerHTML = REGIONS.map((region) => {
    const picture = poster(region);
    return `
    <li>
      <a class="flat__item" href="${region.href}">
        <img src="${picture.src}" alt="${escapeHtml(picture.alt)}" loading="lazy" decoding="async" />
        <span class="label">${region.index} / 05</span>
        <strong>${escapeHtml(region.name)}</strong>
        <span class="flat__text">${escapeHtml(region.blurb)}</span>
        <span class="label flat__count">${plural(region.count, 'specimen')} ${icon('arrow')}</span>
      </a>
    </li>`;
  }).join('');
}

/**
 * @param {object} options
 * @param {string} options.font canvas font for the 3D words, with %s where the pixel size goes
 * @param {(region: object, small: boolean) => string[]} options.pictures three image URLs per region: the large one, the side one, the far one
 * @param {(region: object) => { src: string, alt: string }} options.poster the picture for the plain list
 * @param {{ background?: number, accent?: number, ink?: string }} [options.palette] scene colours
 * @param {boolean} [options.lazy] wait until the section is near before loading the 3D library
 */
export async function initDescent({ font, pictures, poster, palette, lazy = false }) {
  const section = $('[data-descent]');
  if (!section) return;
  const canvas = $('[data-scene]', section);
  buildFlat(poster);

  const flat = () => {
    section.classList.add('is-flat');
    ScrollTrigger.refresh();
  };
  if (prefersReduced()) return flat(); // no fly-through for people who asked for less motion
  if (lazy) await whenNear(section);

  let scene;
  let START_Z;
  let chamberZ;
  try {
    await document.fonts.load(font.replace('%s', '100'));
    const module = await import('./scene.js');
    ({ START_Z, chamberZ } = module);
    const small = Math.max(window.innerWidth, window.innerHeight) < 900 || (navigator.deviceMemory || 8) <= 4;
    scene = module.createDescent(
      canvas,
      REGIONS.map((region) => ({ name: region.name, images: pictures(region, small) })),
      { font, palette },
    );
  } catch (error) {
    console.error('[descent] the scene could not start', error);
    return flat();
  }

  section.classList.add('is-live');

  const intro = $('[data-intro]', section);
  const chamber = $('[data-chamber]', section);
  const mark = $('[data-gauge-mark]', section);
  const track = $('[data-gauge-track]', section);
  const cue = $('[data-cue]', section);
  const shade = $('.descent__shade', section);
  const total = START_Z - scene.endZ;

  // One tick on the gauge per region, placed where its chamber really is.
  track.insertAdjacentHTML(
    'beforeend',
    REGIONS.map((region, i) => {
      const at = ((START_Z - chamberZ(i)) / total) * 100;
      return `<span class="gauge__tick" style="top:${at.toFixed(2)}%" data-tick="${i}">${region.index}</span>`;
    }).join(''),
  );
  const ticks = $$('.gauge__tick', track);

  let shown = -1;
  let introGone = false;

  scene.onFrame(({ progress, z }) => {
    // The opening words lift away in the first stretch of the descent.
    const here = 1 - smooth(progress, 0.005, 0.055);
    intro.style.opacity = here.toFixed(3);
    intro.style.transform = `translate3d(0, ${((1 - here) * -48).toFixed(1)}px, 0)`;
    if (cue) cue.style.opacity = here.toFixed(3);
    if (here < 0.05 !== introGone) {
      introGone = here < 0.05;
      intro.inert = introGone;
    }

    // Which chamber is around the camera, and how present its caption should be.
    let active = -1;
    let presence = 0;
    for (let i = 0; i < REGIONS.length; i += 1) {
      const distance = z - chamberZ(i);
      if (distance < 27 && distance > -19) {
        active = i;
        presence = Math.min(smooth(27 - distance, 0, 7), smooth(distance + 19, 0, 7));
      }
    }
    if (active !== -1 && active !== shown) {
      shown = active;
      const region = REGIONS[active];
      $('[data-chamber-index]', chamber).textContent = region.index;
      $('[data-chamber-name]', chamber).textContent = region.name;
      $('[data-chamber-text]', chamber).textContent = region.blurb;
      $('[data-chamber-count]', chamber).textContent = plural(region.count, 'specimen');
      $('[data-chamber-link]', chamber).href = region.href;
    }
    chamber.style.opacity = presence.toFixed(3);
    chamber.style.transform = `translate3d(0, ${((1 - presence) * 18).toFixed(1)}px, 0)`;
    chamber.style.pointerEvents = presence > 0.6 ? 'auto' : 'none';

    mark.style.top = `${(clamp((START_Z - z) / total, 0, 1) * 100).toFixed(2)}%`;
    ticks.forEach((tick, i) => tick.classList.toggle('is-on', i === active));

    // The last stretch sinks into the page colour, so the next section arrives clean.
    shade.style.setProperty('--end', smooth(progress, 0.955, 1).toFixed(3));
  });

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => scene.setProgress(self.progress),
    onRefresh: (self) => scene.setProgress(self.progress),
  });
  ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => scene.setRunning(self.isActive),
    onRefresh: (self) => scene.setRunning(self.isActive),
  });

  if (hasFinePointer()) {
    section.addEventListener(
      'pointermove',
      (event) =>
        scene.setPointer((event.clientX / window.innerWidth) * 2 - 1, (event.clientY / window.innerHeight) * 2 - 1),
      { passive: true },
    );
  }

  gsap.to(canvas, { autoAlpha: 1, duration: 1.4, ease: 'power2.out' });
  ScrollTrigger.refresh();
}
