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
