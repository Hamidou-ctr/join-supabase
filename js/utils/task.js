// Client-side checks are UX only; the DB check constraints are the real validation.
export const TASK_TITLE_MAX = 100;
export const TASK_DESCRIPTION_MAX = 1000;
export const SUBTASK_TITLE_MAX = 100;
export const SUBTASK_MAX_COUNT = 20;

export const PRIORITIES = ['urgent', 'medium', 'low'];
export const CATEGORIES = ['technical_task', 'user_story'];

export function isValidTitle(title) {
  return title.length > 0 && title.length <= TASK_TITLE_MAX;
}

export function isValidDescription(description) {
  return description.length <= TASK_DESCRIPTION_MAX;
}

export function isValidSubtaskTitle(title) {
  return title.length > 0 && title.length <= SUBTASK_TITLE_MAX;
}

// Local date as YYYY-MM-DD (toISOString would be UTC and can be off by one day).
export function todayIso(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// ISO dates compare correctly as strings. Not in the past, and a real calendar date.
export function isValidDueDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  const real = parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
  return real && value >= todayIso();
}

export function isValidPriority(value) {
  return PRIORITIES.includes(value);
}

export function isValidCategory(value) {
  return CATEGORIES.includes(value);
}
