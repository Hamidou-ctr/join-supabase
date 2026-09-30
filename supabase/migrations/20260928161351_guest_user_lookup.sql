-- Lookup of the shared guest account for the guest-login Edge Function.
-- The guest user is marked via auth.users.raw_app_meta_data (app_metadata.is_guest = true),
-- which end users can not modify. Only service_role may execute this function.
create function public.get_guest_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from auth.users
  where raw_app_meta_data ->> 'is_guest' = 'true'
  order by created_at
  limit 1;
$$;

revoke all on function public.get_guest_user_id() from public, anon, authenticated;
grant execute on function public.get_guest_user_id() to service_role;
