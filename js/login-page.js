import { signIn, guestLogin, hasLocalSession } from './auth.js';
import { normalizeEmail } from './utils/validation.js';
import { showMessage, clearMessage, setFormDisabled } from './ui/formFeedback.js';
import { initPasswordToggles } from './ui/passwordToggle.js';

initPasswordToggles();

const form = document.getElementById('login-form');
const messageEl = document.querySelector('[data-role="message"]');
const guestButton = document.getElementById('guest-login');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage(messageEl);

  const email = normalizeEmail(form.elements.email.value);
  const password = form.elements.password.value;

  setFormDisabled(form, true);
  const result = await signIn(email, password);
  setFormDisabled(form, false);

  if (!result.ok) {
    showMessage(messageEl, result.message, 'error');
    return;
  }
  window.location.assign('app.html');
});

guestButton.addEventListener('click', async () => {
  clearMessage(messageEl);
  guestButton.disabled = true;
  const result = await guestLogin();
  guestButton.disabled = false;

  if (!result.ok) {
    showMessage(messageEl, result.message, 'error');
    return;
  }
  window.location.assign('app.html');
});

// UX only: if a session already exists, skip straight to the app.
hasLocalSession().then((signedIn) => {
  if (signedIn) window.location.replace('app.html');
});
