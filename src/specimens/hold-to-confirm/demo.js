export default function mount(root, params = {}) {
  const button = root.querySelector('.hold');
  const labels = root.querySelectorAll('.hold__label');
  const status = root.querySelector('.hold__status');
  let commit = 0;
  let reset = 0;

  const say = (text) => labels.forEach((label) => (label.textContent = text));

  const start = () => {
    if (button.classList.contains('is-holding') || button.classList.contains('is-done')) return;
    const ms = (params.seconds ?? 1.2) * 1000;
    button.style.setProperty('--hold', `${ms}ms`); // the CSS fill takes exactly this long
    button.classList.add('is-holding');

    commit = setTimeout(() => {
      button.classList.replace('is-holding', 'is-done');
      say('Deleted');
      status.textContent = 'Deleted';
      reset = setTimeout(() => {
        button.classList.remove('is-done');
        say('Hold to delete');
        status.textContent = '';
      }, 1800);
    }, ms);
  };

  // Letting go early clears the timer; the CSS drains the fill back.
  const cancel = () => {
    clearTimeout(commit);
    button.classList.remove('is-holding');
  };

  const isHoldKey = (e) => e.key === ' ' || e.key === 'Enter';
  const onKeyDown = (e) => {
    if (!isHoldKey(e)) return;
    e.preventDefault();
    if (!e.repeat) start();
  };
  const onKeyUp = (e) => {
    if (isHoldKey(e)) cancel();
  };

  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', cancel);
  button.addEventListener('pointerleave', cancel);
  button.addEventListener('pointercancel', cancel);
  button.addEventListener('blur', cancel);
  button.addEventListener('keydown', onKeyDown);
  button.addEventListener('keyup', onKeyUp);

  return () => {
    clearTimeout(commit);
    clearTimeout(reset);
  };
}
