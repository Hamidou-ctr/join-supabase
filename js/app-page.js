import { requireUser, signOut } from './auth.js';
import { getOwnProfile } from './api/profiles.js';

const greetingEl = document.getElementById('greeting');
const logoutButton = document.getElementById('logout');

logoutButton.addEventListener('click', async () => {
  await signOut();
  window.location.replace('index.html');
});

(async () => {
  // Real guard: asks the Auth server. Still just UX - RLS is what actually protects the data.
  const user = await requireUser();
  if (!user) {
    window.location.replace('index.html');
    return;
  }

  const profile = await getOwnProfile();
  greetingEl.textContent = profile ? `Welcome, ${profile.display_name}!` : 'Welcome!';
})();
