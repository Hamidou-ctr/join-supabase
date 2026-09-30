import { supabase } from './supabase-client.js';

// Generic, non-enumerating messages only: never show error.message from Supabase in the UI
// (no "user not found" / "email already registered" / stack traces).
const LOGIN_ERROR = 'Email or password is incorrect.';
const SIGNUP_ERROR = 'Registration failed. Please check your details and try again.';
const RATE_LIMIT_ERROR = 'Too many attempts. Please try again later.';
const NETWORK_ERROR = 'Connection failed. Please try again.';
const GUEST_LOGIN_ERROR = 'Guest login failed. Please try again.';

function mapAuthError(error, genericMessage) {
  if (error.status === 429 || error.code === 'over_request_rate_limit') return RATE_LIMIT_ERROR;
  if (error.name === 'AuthRetryableFetchError') return NETWORK_ERROR;
  return genericMessage;
}

// name is stored in raw_user_meta_data.name and only ever used as a display name by the
// signup trigger (private.handle_new_user) - never for permissions (see CLAUDE.md RLS rules).
export async function signUp(email, password, name) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) return { ok: false, message: mapAuthError(error, SIGNUP_ERROR) };
  return { ok: true };
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, message: mapAuthError(error, LOGIN_ERROR) };
  return { ok: true };
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Guest login goes through the guest-login Edge Function, so no guest credentials exist in the browser.
export async function guestLogin() {
  const { data, error } = await supabase.functions.invoke('guest-login', { method: 'POST' });
  if (error || typeof data?.access_token !== 'string' || typeof data?.refresh_token !== 'string') {
    return { ok: false, message: GUEST_LOGIN_ERROR };
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  return sessionError ? { ok: false, message: GUEST_LOGIN_ERROR } : { ok: true };
}

// UX-only redirect guard (local/cached session). Never use this for an actual authorization decision.
export async function hasLocalSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session !== null;
}

// Real check: asks the Auth server. Still only a page guard - actual protection is RLS in Postgres.
export async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}
