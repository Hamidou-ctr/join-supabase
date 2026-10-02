// Renders form feedback via textContent only (never innerHTML), so it is safe even if a
// message ever included user-supplied text.
export function showMessage(el, text, kind) {
  el.textContent = text;
  el.classList.remove('form-message--error', 'form-message--success');
  el.classList.add(kind === 'success' ? 'form-message--success' : 'form-message--error');
  el.hidden = false;
}

export function clearMessage(el) {
  el.textContent = '';
  el.hidden = true;
}

export function setFormDisabled(form, disabled) {
  for (const field of form.elements) field.disabled = disabled;
}

// Shows a dismissible-by-navigation toast (e.g. "You signed up successfully").
// Built with createElement/textContent only, never innerHTML.
export function showToast(text) {
  const toast = document.createElement('p');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = text;
  document.body.appendChild(toast);
  return toast;
}
