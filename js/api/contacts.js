import { supabase } from '../supabase-client.js';

const CONTACT_COLUMNS = 'id, name, email, phone, color';

// Explicit whitelist: only these fields ever leave the browser. board_id is only accepted on insert
// (the DB grants no update on it), created_by is set by the DB default.
function pickFields({ name, email, phone, color }) {
  return { name, email, phone, color };
}

// Maps a Supabase error to a short UI-safe reason. error.message is never shown.
function toResult(error) {
  if (!error) return { ok: true };
  if (error.code === '23505') return { ok: false, reason: 'duplicate' };
  return { ok: false, reason: 'failed' };
}

// RLS decides which boards the user sees; the first membership is the user's working board.
export async function getOwnBoardId() {
  const { data, error } = await supabase
    .from('board_members')
    .select('board_id')
    .order('created_at', { ascending: true })
    .limit(1);

  if (error || !data?.length) {
    console.error('getOwnBoardId failed:', error?.code);
    return null;
  }
  return data[0].board_id;
}

export async function listContacts() {
  const { data, error } = await supabase
    .from('contacts')
    .select(CONTACT_COLUMNS)
    .order('name', { ascending: true })
    .limit(1000);

  if (error) {
    console.error('listContacts failed:', error.code);
    return null;
  }
  return data;
}

export async function createContact(boardId, fields) {
  const { data, error } = await supabase
    .from('contacts')
    .insert({ board_id: boardId, ...pickFields(fields) })
    .select(CONTACT_COLUMNS)
    .single();

  if (error) {
    console.error('createContact failed:', error.code);
    return toResult(error);
  }
  return { ok: true, contact: data };
}

export async function updateContact(id, fields) {
  const { data, error } = await supabase
    .from('contacts')
    .update(pickFields(fields))
    .eq('id', id)
    .select(CONTACT_COLUMNS)
    .single();

  if (error) {
    console.error('updateContact failed:', error.code);
    return toResult(error);
  }
  return { ok: true, contact: data };
}

export async function deleteContact(id) {
  const { error } = await supabase.from('contacts').delete().eq('id', id);
  if (error) console.error('deleteContact failed:', error.code);
  return toResult(error);
}
