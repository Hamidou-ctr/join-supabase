import { createClient } from './vendor/supabase-js.esm.js';

// The ONLY place that creates the Supabase client.
// Only the publishable key may live here. Never add a service_role / sb_secret_... key:
// everything in the browser is readable, real security is enforced by RLS in Postgres.
const SUPABASE_URL = 'https://stmakiuddrhaufpqwffv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5-L-Mrs7LWj3iaJjwEeaHQ_SpM_Zd7L';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
