import { getOwnBoardId, listContacts } from './api/contacts.js';
import { createTask } from './api/tasks.js';
import { handleLogout, loadShellUser } from './shell-init.js';
import { createAssigneePicker } from './ui/assigneePicker.js';
import { clearMessage, showMessage, showToast } from './ui/formFeedback.js';
import { mountShell } from './ui/shell.js';
import { renderSubtasks } from './ui/subtasks.js';
import {
  isValidCategory, isValidDescription, isValidDueDate, isValidPriority, isValidSubtaskTitle,
  isValidTitle, SUBTASK_MAX_COUNT, todayIso,
} from './utils/task.js';

const $ = (id) => document.getElementById(id);

const DEFAULT_PRIORITY = 'medium';
const state = { boardId: null, priority: DEFAULT_PRIORITY, subtasks: [], saving: false };

const MESSAGES = {
  load: 'Could not load the board data. Please try again later.',
  save: 'Could not create the task. Please try again.',
  invalid: 'Please check your input.',
};

const form = $('task-form');
let picker = null;

function readValues() {
  return {
    title: $('task-title').value.trim(),
    description: $('task-description').value.trim(),
    dueDate: $('task-due').value,
    priority: state.priority,
    category: $('task-category').value,
  };
}

function isComplete({ title, description, dueDate, priority, category }) {
  return isValidTitle(title) && isValidDescription(description) && isValidDueDate(dueDate)
    && isValidPriority(priority) && isValidCategory(category);
}

// "Create Task" stays disabled until the required fields are valid (see Figma note).
function updateSubmit() {
  $('task-submit').disabled = state.saving || state.boardId === null || !isComplete(readValues());
}

function setFieldError(inputId, errorId, invalid) {
  $(errorId).hidden = !invalid;
  $(inputId).toggleAttribute('aria-invalid', invalid);
}

function checkTitle() {
  setFieldError('task-title', 'title-error', !isValidTitle(readValues().title));
}

function checkDue() {
  setFieldError('task-due', 'due-error', !isValidDueDate($('task-due').value));
}

function setPriority(priority) {
  state.priority = priority;
  for (const button of $('priority-options').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.priority === priority));
  }
  updateSubmit();
}

// --- Subtasks ---
function renderSubtaskList() {
  renderSubtasks($('subtask-list'), state.subtasks, (next) => {
    state.subtasks = next;
    renderSubtaskList();
  });
}

function syncSubtaskActions() {
  $('subtask-input-actions').hidden = $('subtask-input').value.length === 0;
}

function addSubtask() {
  const title = $('subtask-input').value.trim();
  if (!isValidSubtaskTitle(title) || state.subtasks.length >= SUBTASK_MAX_COUNT) return;
  state.subtasks = [...state.subtasks, title];
  $('subtask-input').value = '';
  syncSubtaskActions();
  renderSubtaskList();
}

function discardSubtaskInput() {
  $('subtask-input').value = '';
  syncSubtaskActions();
  $('subtask-input').focus();
}

// --- Reset + submit ---
function resetForm() {
  form.reset();
  $('task-due').min = todayIso();
  state.subtasks = [];
  renderSubtaskList();
  syncSubtaskActions();
  picker.reset();
  setPriority(DEFAULT_PRIORITY);
  setFieldError('task-title', 'title-error', false);
  setFieldError('task-due', 'due-error', false);
  clearMessage($('task-error'));
}

function flash(text) {
  const toast = showToast(text);
  window.setTimeout(() => toast.remove(), 3000);
}

async function submitForm(event) {
  event.preventDefault();
  const values = readValues();
  if (!isComplete(values)) {
    checkTitle();
    checkDue();
    showMessage($('task-error'), MESSAGES.invalid, 'error');
    return;
  }

  state.saving = true;
  updateSubmit();
  const result = await createTask(state.boardId, values, state.subtasks, picker.getSelectedIds());
  state.saving = false;

  if (!result.ok) {
    showMessage($('task-error'), MESSAGES.save, 'error');
    updateSubmit();
    return;
  }
  resetForm();
  flash('Task added to board');
}

(async () => {
  const user = await loadShellUser();
  if (!user) {
    window.location.replace('index.html');
    return;
  }
  mountShell({ active: 'add-task', initials: user.initials, onLogout: handleLogout });

  picker = createAssigneePicker({
    root: $('assignee-select'),
    input: $('assignee-input'),
    toggle: $('assignee-toggle'),
    list: $('assignee-list'),
    chips: $('assignee-chips'),
    onChange: updateSubmit,
  });

  $('task-due').min = todayIso();
  renderSubtaskList();

  $('priority-options').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-priority]');
    if (button) setPriority(button.dataset.priority);
  });
  $('task-title').addEventListener('input', () => {
    updateSubmit();
    if (!$('title-error').hidden) checkTitle();
  });
  $('task-title').addEventListener('blur', checkTitle);
  $('task-description').addEventListener('input', updateSubmit);
  $('task-due').addEventListener('input', () => {
    updateSubmit();
    if (!$('due-error').hidden) checkDue();
  });
  $('task-due').addEventListener('blur', () => {
    if ($('task-due').value) checkDue();
  });
  $('task-category').addEventListener('change', updateSubmit);

  $('subtask-input').addEventListener('input', syncSubtaskActions);
  $('subtask-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addSubtask();
    } else if (event.key === 'Escape') {
      discardSubtaskInput();
    }
  });
  $('subtask-add').addEventListener('click', addSubtask);
  $('subtask-cancel').addEventListener('click', discardSubtaskInput);

  $('task-clear').addEventListener('click', resetForm);
  form.addEventListener('submit', submitForm);
  // Enter in a single-line field must not submit a half-filled form.
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.tagName === 'INPUT' && $('task-submit').disabled) {
      event.preventDefault();
    }
  });

  const [boardId, contacts] = await Promise.all([getOwnBoardId(), listContacts()]);
  if (boardId === null || contacts === null) {
    showMessage($('task-error'), MESSAGES.load, 'error');
    return;
  }
  state.boardId = boardId;
  picker.setContacts(contacts);
  updateSubmit();
})();
