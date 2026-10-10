import { getOwnBoardId, listContacts } from './api/contacts.js';
import { createTask } from './api/tasks.js';
import { handleLogout, loadShellUser } from './shell-init.js';
import { showToast } from './ui/formFeedback.js';
import { mountShell } from './ui/shell.js';
import { createTaskForm } from './ui/taskForm.js';

const MESSAGES = {
  load: 'Could not load the board data. Please try again later.',
  save: 'Could not create the task. Please try again.',
};

let boardId = null;

function flash(text) {
  const toast = showToast(text);
  window.setTimeout(() => toast.remove(), 3000);
}

const taskForm = createTaskForm({
  onClear: () => taskForm.reset(),
  async onSubmit({ fields, subtasks, contactIds }) {
    const result = await createTask(boardId, fields, subtasks, contactIds);
    if (!result.ok) {
      taskForm.showError(MESSAGES.save);
      return false;
    }
    taskForm.reset();
    flash('Task added to board');
    return true;
  },
});

(async () => {
  const user = await loadShellUser();
  if (!user) {
    window.location.replace('index.html');
    return;
  }
  mountShell({ active: 'add-task', initials: user.initials, onLogout: handleLogout });

  const [ownBoardId, contacts] = await Promise.all([getOwnBoardId(), listContacts()]);
  if (ownBoardId === null || contacts === null) {
    taskForm.showError(MESSAGES.load);
    return;
  }
  boardId = ownBoardId;
  taskForm.setContacts(contacts);
  taskForm.setReady(true);
})();
