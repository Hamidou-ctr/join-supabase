import { getOwnBoardId, listContacts } from './api/contacts.js';
import {
  createTask, deleteTask, listBoardTasks, moveTask, setSubtaskDone, updateTask,
} from './api/tasks.js';
import { handleLogout, loadShellUser } from './shell-init.js';
import { renderBoard, renderTaskDetail } from './ui/board.js';
import { showMessage, clearMessage, showToast } from './ui/formFeedback.js';
import { mountShell } from './ui/shell.js';
import { createTaskForm } from './ui/taskForm.js';
import { groupByStatus, isStatus, matchesQuery, nextSortOrder } from './utils/board.js';

const $ = (id) => document.getElementById(id);

const state = {
  tasks: [], contactsById: new Map(), query: '', openId: null, busy: false,
  boardId: null, editingId: null, newStatus: 'todo',
};

const MESSAGES = {
  load: 'Could not load the board. Please try again later.',
  move: 'Could not move the task. Please try again.',
  remove: 'Could not delete the task. Please try again.',
  subtask: 'Could not update the subtask. Please try again.',
  create: 'Could not create the task. Please try again.',
  save: 'Could not save the task. Please try again.',
};

const dialog = $('task-dialog');
const formDialog = $('task-form-dialog');

function flash(text) {
  const toast = showToast(text);
  window.setTimeout(() => toast.remove(), 3000);
}

function fail(text) {
  showMessage($('board-error'), text, 'error');
}

function openTask() {
  return state.tasks.find((task) => task.id === state.openId) ?? null;
}

function renderDetail() {
  const task = openTask();
  if (!task) return;
  renderTaskDetail($('task-detail'), task, state.contactsById, {
    onClose: () => dialog.close(),
    onDelete: removeOpenTask,
    onEdit: openEdit,
    onToggleSubtask: toggleSubtask,
    onMove: (status) => relocate(task.id, status),
  });
}

function render() {
  const visible = state.tasks.filter((task) => matchesQuery(task, state.query));
  $('board-no-results').hidden = !(state.query.trim() !== '' && visible.length === 0);
  renderBoard($('board-columns'), groupByStatus(visible), state.contactsById, {
    onOpen: (id) => {
      state.openId = id;
      renderDetail();
      dialog.showModal();
    },
    onAdd: openAdd,
    onDragStart: () => {},
    onDragEnd: () => {},
    // The id comes from dataTransfer, i.e. from outside: only accept ids we actually know.
    onDrop: (id, status) => relocate(id, status),
  });
}

// Optimistic update; rolled back when the DB (RLS/constraints) rejects the change.
async function relocate(id, status) {
  const task = state.tasks.find((candidate) => candidate.id === id);
  if (!task || !isStatus(status) || task.status === status || state.busy) return;

  const previous = { status: task.status, sort_order: task.sort_order };
  const sortOrder = nextSortOrder(state.tasks, status);
  task.status = status;
  task.sort_order = sortOrder;
  state.busy = true;
  render();
  if (state.openId === id) renderDetail();

  const ok = await moveTask(id, status, sortOrder);
  state.busy = false;
  if (!ok) {
    Object.assign(task, previous);
    fail(MESSAGES.move);
    render();
    if (state.openId === id) renderDetail();
    return;
  }
  clearMessage($('board-error'));
}

async function toggleSubtask(subtaskId, done) {
  const task = openTask();
  const subtask = task?.subtasks.find((candidate) => candidate.id === subtaskId);
  if (!subtask) return;

  subtask.done = done;
  render();
  const ok = await setSubtaskDone(subtaskId, done);
  if (!ok) {
    subtask.done = !done;
    fail(MESSAGES.subtask);
    render();
    renderDetail();
  }
}

// --- Add / edit dialog (shares the form with add-task.html) ---
async function reloadTasks() {
  const tasks = await listBoardTasks();
  if (tasks === null) {
    fail(MESSAGES.load);
    return;
  }
  state.tasks = tasks;
  render();
  if (state.openId) renderDetail();
}

const taskForm = createTaskForm({
  onClear: () => formDialog.close(),
  async onSubmit({ fields, subtasks, contactIds }) {
    const editing = state.editingId !== null;
    const existing = editing ? state.tasks.find((task) => task.id === state.editingId) : null;
    if (editing && !existing) return false;

    const result = editing
      ? await updateTask(existing, state.boardId, fields, subtasks, contactIds)
      : await createTask(state.boardId, { ...fields, status: state.newStatus }, subtasks, contactIds);
    // Reload either way: a failed multi-step edit may have been applied partially.
    await reloadTasks();
    if (!result.ok) {
      taskForm.showError(editing ? MESSAGES.save : MESSAGES.create);
      return false;
    }
    formDialog.close();
    flash(editing ? 'Task updated' : 'Task added to board');
    return true;
  },
});

function openFormDialog(title, submitLabel) {
  $('task-form-title').textContent = title;
  $('task-submit-label').textContent = submitLabel;
  formDialog.showModal();
  $('task-title').focus();
}

function openAdd(status) {
  state.editingId = null;
  state.newStatus = isStatus(status) ? status : 'todo';
  taskForm.reset();
  openFormDialog('Add Task', 'Create Task');
}

function openEdit() {
  const task = openTask();
  if (!task) return;
  state.editingId = task.id;
  taskForm.fill(task);
  dialog.close();
  openFormDialog('Edit Task', 'Ok');
}

async function removeOpenTask() {
  const task = openTask();
  if (!task || !window.confirm('Delete this task?')) return;

  const ok = await deleteTask(task.id);
  if (!ok) {
    fail(MESSAGES.remove);
    return;
  }
  state.tasks = state.tasks.filter((candidate) => candidate.id !== task.id);
  dialog.close();
  render();
  flash('Task deleted');
}

(async () => {
  const user = await loadShellUser();
  if (!user) {
    window.location.replace('index.html');
    return;
  }
  mountShell({ active: 'board', initials: user.initials, onLogout: handleLogout });

  $('search-input').addEventListener('input', (event) => {
    state.query = event.target.value;
    render();
  });
  $('board-add').addEventListener('click', () => openAdd('todo'));
  $('task-form-close').addEventListener('click', () => formDialog.close());
  formDialog.addEventListener('click', (event) => {
    if (event.target === formDialog) formDialog.close();
  });
  // The search is live; submitting must not reload the page.
  $('board-search').addEventListener('submit', (event) => event.preventDefault());

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    state.openId = null;
  });

  // getOwnBoardId only confirms membership; tasks themselves are scoped by RLS.
  const [boardId, contacts, tasks] = await Promise.all([getOwnBoardId(), listContacts(), listBoardTasks()]);
  if (boardId === null || contacts === null || tasks === null) {
    fail(MESSAGES.load);
    render();
    return;
  }
  state.boardId = boardId;
  state.contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
  taskForm.setContacts(contacts);
  taskForm.setReady(true);
  state.tasks = tasks;
  render();
})();
