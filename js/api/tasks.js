import { supabase } from '../supabase-client.js';
import { isStatus } from '../utils/board.js';

// Only the columns the summary needs. RLS limits the rows to boards the user is a member of.
export async function getTasksForSummary() {
  const { data, error } = await supabase
    .from('tasks')
    .select('status, priority, due_date')
    .limit(1000);

  if (error) {
    console.error('getTasksForSummary failed:', error.code);
    return null;
  }
  return data;
}

// Whitelist of what leaves the browser. board_id/created_by/id are never taken from the form:
// the DB sets created_by itself and RLS checks that the user is a member of board_id.
function pickTaskFields({ title, description, dueDate, priority, category, status }) {
  return {
    title,
    description,
    due_date: dueDate,
    priority,
    category,
    status: isStatus(status) ? status : 'todo',
  };
}

// Creates the task, then its subtasks and assignees. These are separate requests (no transaction
// through the Data API), so if a later step fails the task is deleted again instead of staying half-built.
export async function createTask(boardId, fields, subtaskTitles, contactIds) {
  const { data: task, error } = await supabase
    .from('tasks')
    .insert({ board_id: boardId, ...pickTaskFields(fields) })
    .select('id')
    .single();

  if (error) {
    console.error('createTask failed:', error.code);
    return { ok: false };
  }

  const subtaskRows = subtaskTitles.map((title) => ({ task_id: task.id, board_id: boardId, title }));
  const assigneeRows = contactIds.map((contactId) => ({
    task_id: task.id, board_id: boardId, contact_id: contactId,
  }));

  const steps = [];
  if (subtaskRows.length) steps.push(supabase.from('subtasks').insert(subtaskRows));
  if (assigneeRows.length) steps.push(supabase.from('task_assignees').insert(assigneeRows));
  const results = await Promise.all(steps);
  const failed = results.find((result) => result.error);

  if (failed) {
    console.error('createTask children failed:', failed.error.code);
    const { error: cleanupError } = await supabase.from('tasks').delete().eq('id', task.id);
    if (cleanupError) console.error('createTask cleanup failed:', cleanupError.code);
    return { ok: false };
  }
  return { ok: true };
}

const BOARD_TASK_COLUMNS =
  'id, title, description, due_date, priority, category, status, sort_order, created_at, '
  + 'subtasks(id, title, done, created_at), task_assignees(contact_id)';

// RLS limits the rows to boards the user is a member of. Child rows come embedded in one request.
export async function listBoardTasks() {
  const { data, error } = await supabase
    .from('tasks')
    .select(BOARD_TASK_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1000);

  if (error) {
    console.error('listBoardTasks failed:', error.code);
    return null;
  }
  return data;
}

// Only status and sort_order are sent: nothing else may change by dragging a card.
export async function moveTask(id, status, sortOrder) {
  const { error } = await supabase
    .from('tasks')
    .update({ status, sort_order: sortOrder })
    .eq('id', id);

  if (error) console.error('moveTask failed:', error.code);
  return !error;
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) console.error('deleteTask failed:', error.code);
  return !error;
}

export async function setSubtaskDone(id, done) {
  const { error } = await supabase.from('subtasks').update({ done }).eq('id', id);
  if (error) console.error('setSubtaskDone failed:', error.code);
  return !error;
}

// Editing keeps status/sort_order: only the form's own fields are sent.
function pickEditFields({ title, description, dueDate, priority, category }) {
  return { title, description, due_date: dueDate, priority, category };
}

// Subtasks are matched by title so existing ones keep their done state. Not transactional: the
// caller reloads the board afterwards, so a half-applied edit never stays visible as stale data.
function diffSubtasks(current, nextTitles) {
  const pool = [...current];
  const toInsert = [];
  for (const title of nextTitles) {
    const index = pool.findIndex((subtask) => subtask.title === title);
    if (index >= 0) pool.splice(index, 1);
    else toInsert.push(title);
  }
  return { toDeleteIds: pool.map((subtask) => subtask.id), toInsert };
}

export async function updateTask(task, boardId, fields, subtaskTitles, contactIds) {
  const { error } = await supabase
    .from('tasks')
    .update(pickEditFields(fields))
    .eq('id', task.id)
    .select('id')
    .single();
  if (error) {
    console.error('updateTask failed:', error.code);
    return { ok: false };
  }

  const { toDeleteIds, toInsert } = diffSubtasks(task.subtasks, subtaskTitles);
  const currentContactIds = task.task_assignees.map((row) => row.contact_id);
  const removedContacts = currentContactIds.filter((id) => !contactIds.includes(id));
  const addedContacts = contactIds.filter((id) => !currentContactIds.includes(id));

  const steps = [];
  if (toDeleteIds.length) steps.push(supabase.from('subtasks').delete().in('id', toDeleteIds));
  if (toInsert.length) {
    steps.push(supabase.from('subtasks').insert(
      toInsert.map((title) => ({ task_id: task.id, board_id: boardId, title })),
    ));
  }
  if (removedContacts.length) {
    steps.push(supabase.from('task_assignees').delete()
      .eq('task_id', task.id).in('contact_id', removedContacts));
  }
  if (addedContacts.length) {
    steps.push(supabase.from('task_assignees').insert(
      addedContacts.map((contactId) => ({ task_id: task.id, board_id: boardId, contact_id: contactId })),
    ));
  }
  const failed = (await Promise.all(steps)).find((result) => result.error);
  if (failed) {
    console.error('updateTask children failed:', failed.error.code);
    return { ok: false };
  }
  return { ok: true };
}
