import { supabase } from '../supabase-client.js';

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
function pickTaskFields({ title, description, dueDate, priority, category }) {
  return {
    title,
    description,
    due_date: dueDate,
    priority,
    category,
    status: 'todo',
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
