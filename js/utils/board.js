export const COLUMNS = [
  { status: 'todo', title: 'To do' },
  { status: 'in_progress', title: 'In progress' },
  { status: 'await_feedback', title: 'Await feedback' },
  { status: 'done', title: 'Done' },
];

export const CATEGORY_LABELS = { technical_task: 'Technical Task', user_story: 'User Story' };
export const PRIORITY_LABELS = { urgent: 'Urgent', medium: 'Medium', low: 'Low' };

export function isStatus(value) {
  return COLUMNS.some((column) => column.status === value);
}

// Search matches title or description, case-insensitive. Empty query shows everything.
export function matchesQuery(task, query) {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return task.title.toLowerCase().includes(needle) || task.description.toLowerCase().includes(needle);
}

export function groupByStatus(tasks) {
  const groups = Object.fromEntries(COLUMNS.map((column) => [column.status, []]));
  for (const task of tasks) {
    if (task.status in groups) groups[task.status].push(task);
  }
  return groups;
}

export function subtaskProgress(task) {
  const total = task.subtasks.length;
  const done = task.subtasks.filter((subtask) => subtask.done).length;
  return { total, done };
}

// Next sort_order for the end of a column (sort_order is a non-negative integer in the DB).
export function nextSortOrder(tasks, status) {
  const orders = tasks.filter((task) => task.status === status).map((task) => task.sort_order);
  return orders.length ? Math.max(...orders) + 1 : 0;
}
