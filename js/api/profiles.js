import { supabase } from '../supabase-client.js';

// Whitelisted read of the signed-in user's own profile (RLS restricts this to own/co-member rows anyway).
export async function getOwnProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('getOwnProfile failed:', error.code);
    return null;
  }
  return data;
}
