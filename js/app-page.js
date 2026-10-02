import { requireUser, signOut } from './auth.js';
import { getOwnProfile } from './api/profiles.js';
import { getTasksForSummary } from './api/tasks.js';
import { mountShell } from './ui/shell.js';
import { getGreeting, getInitials, formatDeadline } from './utils/format.js';
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

async function handleLogout() {
  await signOut();
  window.location.replace('index.html');
}

(async () => {
  // Real guard: asks the Auth server. Still just UX - RLS is what actually protects the data.
  const user = await requireUser();
  if (!user) {
    window.location.replace('index.html');
    return;
  }

  // is_guest lives in app_metadata (server-controlled) and is only used for display here.
  const isGuest = user.app_metadata?.is_guest === true;
  const profile = await getOwnProfile();
  const displayName = isGuest ? null : (profile?.display_name ?? null);

  mountShell({
    active: 'summary',
    initials: isGuest ? 'G' : getInitials(displayName),
    onLogout: handleLogout,
  });
  renderGreeting(displayName);

  const tasks = await getTasksForSummary();
  if (tasks === null) {
    document.getElementById('summary-error').hidden = false;
    return;
  }
  renderSummary(computeSummary(tasks));
})();
