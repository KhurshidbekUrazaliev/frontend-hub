export default function mount(root, params = {}) {
  const word = root.querySelector('.prox');
  const text = word.textContent;

  // One span per letter. Screen readers get the word once, via the label.
  word.setAttribute('aria-label', text);
  const letters = [...text].map((character) => {
    const span = document.createElement('span');
    span.textContent = character;
    span.setAttribute('aria-hidden', 'true');
    return span;
  });
  word.replaceChildren(...letters);

  const influence = letters.map(() => 0); // eased 0–1 per letter
  let pointer = null;
  let raf = 0;

  const frame = () => {
    const radius = params.radius ?? 200;

    // Read every position first, then write, so layout runs once per frame.
    const centres = letters.map((letter) => {
      const box = letter.getBoundingClientRect();
      return [box.left + box.width / 2, box.top + box.height / 2];
    });

    let moving = false;
    letters.forEach((letter, i) => {
      const distance = pointer ? Math.hypot(pointer.x - centres[i][0], pointer.y - centres[i][1]) : Infinity;
      const target = Math.max(0, 1 - distance / radius);
      influence[i] += (target - influence[i]) * 0.16;
      if (Math.abs(target - influence[i]) > 0.002) moving = true;
      letter.style.setProperty('--wght', Math.round(300 + influence[i] * 600));
      letter.style.setProperty('--wdth', (62 + influence[i] * 50).toFixed(1));
    });

    raf = moving ? requestAnimationFrame(frame) : 0; // sleep when settled
  };

  const wake = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };
  const onMove = (e) => {
    pointer = { x: e.clientX, y: e.clientY };
    wake();
  };
  const onLeave = () => {
    pointer = null;
    wake();
  };

  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerleave', onLeave);

  return () => {
    cancelAnimationFrame(raf);
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerleave', onLeave);
  };
}
