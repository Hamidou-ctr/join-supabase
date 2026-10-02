import { requireUser, signOut } from './auth.js';
import { getOwnProfile } from './api/profiles.js';
import { getInitials } from './utils/format.js';

// Resolves who is signed in for the page shell. Returns null when nobody is.
// The real guard is still RLS - this only decides what the UI shows.
export async function loadShellUser() {
  const user = await requireUser();
  if (!user) return null;

  // is_guest lives in app_metadata (server-controlled) and is only used for display here.
  const isGuest = user.app_metadata?.is_guest === true;
  const profile = await getOwnProfile();
  const displayName = isGuest ? null : (profile?.display_name ?? null);
  return { displayName, initials: isGuest ? 'G' : getInitials(displayName) };
}

export async function handleLogout() {
  await signOut();
  window.location.replace('index.html');
}
