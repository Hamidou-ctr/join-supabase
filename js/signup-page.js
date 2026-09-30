import { signUp, hasLocalSession } from './auth.js';
import {
  normalizeName,
  normalizeEmail,
  isValidName,
  isValidEmail,
  isValidPassword,
  PASSWORD_MIN_LENGTH,
} from './utils/validation.js';
import { showMessage, clearMessage, setFormDisabled } from './ui/formFeedback.js';

const form = document.getElementById('signup-form');
const messageEl = document.querySelector('[data-role="message"]');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage(messageEl);

  const name = normalizeName(form.elements.name.value);
  const email = normalizeEmail(form.elements.email.value);
  const password = form.elements.password.value;
  const confirmPassword = form.elements['confirm-password'].value;

  if (!isValidName(name)) {
    showMessage(messageEl, 'Please enter your name.', 'error');
    return;
  }
  if (!isValidEmail(email)) {
    showMessage(messageEl, 'Please enter a valid email address.', 'error');
    return;
  }
  if (!isValidPassword(password)) {
    showMessage(messageEl, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`, 'error');
    return;
  }
  if (password !== confirmPassword) {
    showMessage(messageEl, 'Passwords do not match.', 'error');
    return;
  }

  setFormDisabled(form, true);
  const result = await signUp(email, password, name);
  setFormDisabled(form, false);

  if (!result.ok) {
    showMessage(messageEl, result.message, 'error');
    return;
  }
  form.reset();
  showMessage(messageEl, 'Almost done - check your email to confirm your account.', 'success');
});

// UX only: if a session already exists, skip straight to the app.
hasLocalSession().then((signedIn) => {
  if (signedIn) window.location.replace('app.html');
});
