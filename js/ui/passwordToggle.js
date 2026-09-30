// Wires up every .password-toggle button on the page: click toggles the linked input
// between type="password" and type="text" and swaps the eye / eye-off icon via aria-pressed.
// Uses addEventListener only (no inline handlers), so this stays compatible with a strict CSP.
export function initPasswordToggles(root = document) {
  for (const button of root.querySelectorAll('.password-toggle')) {
    const input = document.getElementById(button.getAttribute('aria-controls'));
    if (!input) continue;

    button.addEventListener('click', () => {
      const isRevealed = input.type === 'text';
      input.type = isRevealed ? 'password' : 'text';
      button.setAttribute('aria-pressed', String(!isRevealed));
      button.setAttribute('aria-label', isRevealed ? 'Show password' : 'Hide password');
      input.focus();
    });
  }
}
