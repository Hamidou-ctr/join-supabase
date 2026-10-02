// Pure aggregation of the whitelisted task columns (status, priority, due_date).
export function computeSummary(tasks) {
  const counts = { todo: 0, in_progress: 0, await_feedback: 0, done: 0 };
  let urgent = 0;
  let nextDeadline = null;

  for (const task of tasks) {
    if (task.status in counts) counts[task.status] += 1;
    if (task.priority === 'urgent' && task.status !== 'done') {
      urgent += 1;
      // ISO dates sort correctly as strings.
      if (nextDeadline === null || task.due_date < nextDeadline) nextDeadline = task.due_date;
    }
  }

  return { total: tasks.length, counts, urgent, nextDeadline };
}
