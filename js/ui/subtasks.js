import { el } from './dom.js';
import { isValidSubtaskTitle, SUBTASK_TITLE_MAX } from '../utils/task.js';

function iconButton(label, iconFile, onClick, className = 'icon-button') {
  const button = el('button', { className, attrs: { type: 'button', 'aria-label': label } }, [
    el('img', { attrs: { src: `assets/img/${iconFile}`, alt: '', width: '16', height: '16' } }),
  ]);
  button.addEventListener('click', onClick);
  return button;
}

// Subtask titles are user input: textContent only. `onChange` receives the new array of titles.
export function renderSubtasks(container, titles, onChange) {
  const nodes = titles.map((title, index) => {
    const item = el('li', { className: 'subtask-item' });

    const showView = () => {
      item.replaceChildren(
        el('span', { className: 'subtask-title', text: title }),
        el('span', { className: 'subtask-actions' }, [
          iconButton('Edit subtask', 'edit.svg', showEdit),
          iconButton('Delete subtask', 'delete.svg', () => onChange(titles.filter((_, i) => i !== index))),
        ]),
      );
    };

    const showEdit = () => {
      const input = el('input', {
        className: 'subtask-edit-input',
        attrs: { type: 'text', maxlength: String(SUBTASK_TITLE_MAX), 'aria-label': 'Edit subtask', autocomplete: 'off' },
      });
      input.value = title;
      const save = () => {
        const next = input.value.trim();
        if (!isValidSubtaskTitle(next)) return;
        onChange(titles.map((current, i) => (i === index ? next : current)));
      };
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          save();
        } else if (event.key === 'Escape') {
          showView();
        }
      });
      item.replaceChildren(
        input,
        el('span', { className: 'subtask-actions' }, [
          iconButton('Delete subtask', 'delete.svg', () => onChange(titles.filter((_, i) => i !== index))),
          iconButton('Save subtask', 'check-dark.svg', save),
        ]),
      );
      input.focus();
    };

    showView();
    return item;
  });
  container.replaceChildren(...nodes);
}
