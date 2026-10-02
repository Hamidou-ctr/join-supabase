const splash = document.getElementById('splash');
const splashLogo = document.getElementById('splash-logo');
const targetLogo = document.querySelector('.auth-topbar .logo');

function finish() {
  splash.classList.add('is-done');
}

function run() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !targetLogo) {
    finish();
    return;
  }

  // Measure where the real header logo sits and move/scale the splash logo onto it.
  const from = splashLogo.getBoundingClientRect();
  const to = targetLogo.getBoundingClientRect();
  splash.style.setProperty('--splash-dx', `${to.left - from.left}px`);
  splash.style.setProperty('--splash-dy', `${to.top - from.top}px`);
  splash.style.setProperty('--splash-scale', String(to.height / from.height));

  // Force a style flush so the transition starts from the centered state.
  void splashLogo.offsetWidth;
  splash.classList.add('is-moving');

  splashLogo.addEventListener('transitionend', (event) => {
    if (event.propertyName === 'transform') finish();
  });
}

run();
