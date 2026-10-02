import { getTasksForSummary } from './api/tasks.js';
import { handleLogout, loadShellUser } from './shell-init.js';
import { mountShell } from './ui/shell.js';
import { getGreeting, formatDeadline } from './utils/format.js';
import { computeSummary } from './utils/summary.js';

function setText(id, value) {
  document.getElementById(id).textContent = String(value);
}

function renderGreeting(displayName) {
  // Guest: "Good morning!" - user: "Good morning," + name (as in the design).
  const greeting = getGreeting();
  setText('greeting-text', displayName ? `${greeting},` : `${greeting}!`);
  setText('greeting-name', displayName ?? '');
}

function renderSummary({ total, counts, urgent, nextDeadline }) {
  setText('count-todo', counts.todo);
  setText('count-done', counts.done);
  setText('count-urgent', urgent);
  setText('count-total', total);
  setText('count-progress', counts.in_progress);
  setText('count-feedback', counts.await_feedback);
  setText('deadline-date', nextDeadline ? formatDeadline(nextDeadline) : 'No deadline');
}

(async () => {
  const user = await loadShellUser();
  if (!user) {
    window.location.replace('index.html');
    return;
  }

  mountShell({ active: 'summary', initials: user.initials, onLogout: handleLogout });
  renderGreeting(user.displayName);

  const tasks = await getTasksForSummary();
  if (tasks === null) {
    document.getElementById('summary-error').hidden = false;
    return;
  }
  renderSummary(computeSummary(tasks));
})();
