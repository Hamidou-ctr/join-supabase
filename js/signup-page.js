import { signUp, hasLocalSession } from './auth.js';
import {
  normalizeName,
  normalizeEmail,
  isValidName,
  isValidEmail,
  isValidPassword,
  PASSWORD_MIN_LENGTH,
} from './utils/validation.js';
import { showMessage, clearMessage, setFormDisabled, showToast } from './ui/formFeedback.js';

const form = document.getElementById('signup-form');
const messageEl = document.querySelector('[data-role="message"]');
const acceptPrivacy = document.getElementById('signup-accept-privacy');
const submitButton = document.getElementById('signup-submit');

// Figma: the Sign up button is only enabled once the privacy policy checkbox is checked.
acceptPrivacy.addEventListener('change', () => {
  submitButton.disabled = !acceptPrivacy.checked;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage(messageEl);

  const name = normalizeName(form.elements.name.value);
  const email = normalizeEmail(form.elements.email.value);
  const password = form.elements.password.value;
  const confirmPassword = form.elements['confirm-password'].value;

  if (!acceptPrivacy.checked) {
    showMessage(messageEl, 'Please accept the Privacy policy.', 'error');
    return;
  }
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
  submitButton.disabled = !acceptPrivacy.checked;

  if (!result.ok) {
    showMessage(messageEl, result.message, 'error');
    return;
  }

  // Signup does not log the user in - email confirmation is required first (see CLAUDE.md /
  // auth settings), so send them back to the login page instead of app.html.
  showToast('You signed up successfully - check your email to confirm your account.');
  setTimeout(() => window.location.assign('index.html'), 2000);
});

// UX only: if a session already exists, skip straight to the app.
hasLocalSession().then((signedIn) => {
  if (signedIn) window.location.replace('app.html');
});
