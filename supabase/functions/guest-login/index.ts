// Guest login without any guest credentials in the browser.
//
// Public endpoint on purpose (deployed with verify_jwt = false): the caller is not signed in yet.
// Instead of a shared password, the function asks the Auth admin API for a one-time login token
// of the guest account and redeems it itself. The guest account is identified by
// app_metadata.is_guest = true (not writable by end users); anything else is refused.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

// Extra allowed browser origins (e.g. the production URL) go into the ALLOWED_ORIGINS secret.
const DEFAULT_ORIGINS = ['http://localhost:5500', 'http://127.0.0.1:5500'];

const authOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

function allowedOrigins(): string[] {
  const extra = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...DEFAULT_ORIGINS, ...extra];
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' };
  if (origin && allowedOrigins().includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type';
    headers['Access-Control-Max-Age'] = '600';
  }
  return headers;
}

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// New key format first (JSON dictionary), legacy key as fallback.
function readKey(jsonVar: string, legacyVar: string): string {
  const raw = Deno.env.get(jsonVar);
  if (raw) {
    try {
      const key = JSON.parse(raw).default;
      if (typeof key === 'string' && key) return key;
    } catch (_) {
      // fall through to the legacy variable
    }
  }
  const legacy = Deno.env.get(legacyVar);
  if (legacy) return legacy;
  throw new Error(`Missing ${jsonVar}`);
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    if (!url) throw new Error('Missing SUPABASE_URL');

    const admin = createClient(
      url,
      readKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'),
      authOptions,
    );

    const { data: guestId, error: idError } = await admin.rpc('get_guest_user_id');
    if (idError || typeof guestId !== 'string') throw new Error('Guest user not found');

    // Re-read the email at runtime so a changed guest email can not break the login.
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(guestId);
    const user = userData?.user;
    if (userError || !user?.email || user.app_metadata?.is_guest !== true) {
      throw new Error('Guest user invalid');
    }

    // generateLink does not send an email; it only returns a one-time token hash.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: user.email,
    });
    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) throw new Error('Could not create login token');

    const publicClient = createClient(
      url,
      readKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'),
      authOptions,
    );
    const { data: otpData, error: otpError } = await publicClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email',
    });
    const session = otpData?.session;
    if (otpError || !session) throw new Error('Could not create session');

    return json(
      { access_token: session.access_token, refresh_token: session.refresh_token },
      200,
      cors,
    );
  } catch (err) {
    // Details stay in the server logs; the caller only gets a generic message.
    console.error('guest-login failed:', err instanceof Error ? err.message : 'unknown error');
    return json({ error: 'Guest login failed' }, 500, cors);
  }
});
