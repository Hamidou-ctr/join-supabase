import { createAssigneePicker } from './assigneePicker.js';
import { clearMessage, showMessage } from './formFeedback.js';
import { renderSubtasks } from './subtasks.js';
import {
  isValidCategory, isValidDescription, isValidDueDate, isValidPriority, isValidSubtaskTitle,
  isValidTitle, SUBTASK_MAX_COUNT, todayIso,
} from '../utils/task.js';

const $ = (id) => document.getElementById(id);
const DEFAULT_PRIORITY = 'medium';
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

// Drives the shared task form markup (add-task.html and the board dialogs).
// `onSubmit({ fields, subtasks, contactIds })` is async and resolves to true on success.
// `onClear` is wired to the secondary button (reset on the page, close in a dialog).
export function createTaskForm({ onSubmit, onClear }) {
  const form = $('task-form');
  const state = { priority: DEFAULT_PRIORITY, subtasks: [], saving: false, ready: false, keepDue: null };

  const picker = createAssigneePicker({
    root: $('assignee-select'),
    input: $('assignee-input'),
    toggle: $('assignee-toggle'),
    list: $('assignee-list'),
    chips: $('assignee-chips'),
    onChange: updateSubmit,
  });

  function readValues() {
    return {
      title: $('task-title').value.trim(),
      description: $('task-description').value.trim(),
      dueDate: $('task-due').value,
      priority: state.priority,
      category: $('task-category').value,
    };
  }

  // When editing, the task's existing due date stays valid even if it is already in the past.
  function dueOk(value) {
    return isValidDueDate(value) || (state.keepDue !== null && value === state.keepDue);
  }

  function isComplete({ title, description, dueDate, priority, category }) {
    return isValidTitle(title) && isValidDescription(description) && dueOk(dueDate)
      && isValidPriority(priority) && isValidCategory(category);
  }

  function updateSubmit() {
    $('task-submit').disabled = state.saving || !state.ready || !isComplete(readValues());
  }

  function setFieldError(inputId, errorId, invalid) {
    $(errorId).hidden = !invalid;
    $(inputId).toggleAttribute('aria-invalid', invalid);
  }

  const checkTitle = () => setFieldError('task-title', 'title-error', !isValidTitle(readValues().title));
  const checkDue = () => setFieldError('task-due', 'due-error', !dueOk($('task-due').value));

  function setPriority(priority) {
    state.priority = priority;
    for (const button of $('priority-options').querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String(button.dataset.priority === priority));
    }
    updateSubmit();
  }

  function renderSubtaskList() {
    renderSubtasks($('subtask-list'), state.subtasks, (next) => {
      state.subtasks = next;
      renderSubtaskList();
    });
  }

  const syncSubtaskActions = () => {
    $('subtask-input-actions').hidden = $('subtask-input').value.length === 0;
  };

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

  function reset() {
    form.reset();
    state.keepDue = null;
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

  // Edit mode: `task` is a row from listBoardTasks (values are validated again on submit).
  function fill(task) {
    reset();
    state.keepDue = DATE_SHAPE.test(task.due_date) ? task.due_date : null;
    if (state.keepDue && state.keepDue < todayIso()) $('task-due').min = state.keepDue;
    $('task-title').value = task.title;
    $('task-description').value = task.description;
    $('task-due').value = task.due_date;
    $('task-category').value = task.category;
    state.subtasks = [...task.subtasks]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((subtask) => subtask.title);
    renderSubtaskList();
    picker.setSelected(task.task_assignees.map((row) => row.contact_id));
    setPriority(task.priority);
  }

  async function submit(event) {
    event.preventDefault();
    const values = readValues();
    if (!isComplete(values)) {
      checkTitle();
      checkDue();
      showMessage($('task-error'), 'Please check your input.', 'error');
      return;
    }
    state.saving = true;
    updateSubmit();
    const ok = await onSubmit({
      fields: values, subtasks: state.subtasks, contactIds: picker.getSelectedIds(),
    });
    state.saving = false;
    updateSubmit();
    return ok;
  }

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

  $('task-clear').addEventListener('click', onClear);
  form.addEventListener('submit', submit);
  // Enter in a single-line field must not submit a half-filled form.
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.tagName === 'INPUT' && $('task-submit').disabled) {
      event.preventDefault();
    }
  });

  return {
    reset,
    fill,
    setContacts: (contacts) => picker.setContacts(contacts),
    setReady(ready) {
      state.ready = ready;
      updateSubmit();
    },
    showError: (text) => showMessage($('task-error'), text, 'error'),
    clearError: () => clearMessage($('task-error')),
  };
}
