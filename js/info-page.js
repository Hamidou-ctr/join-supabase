import { handleLogout, loadShellUser } from './shell-init.js';
import { mountShell } from './ui/shell.js';

// Shared by Privacy Policy, Legal Notice and Help. Privacy/Legal are public (external shell when
// signed out); Help is only reachable from inside the app.
const { page, requiresLogin } = document.body.dataset;

(async () => {
  const user = await loadShellUser();
  if (!user && requiresLogin === 'true') {
    window.location.replace('index.html');
    return;
  }

  mountShell({
    active: page,
    initials: user?.initials,
    onLogout: handleLogout,
    external: user === null,
  });

  document.getElementById('back').addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.location.assign(user ? 'app.html' : 'index.html');
  });
})();
