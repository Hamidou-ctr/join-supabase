-- A newly registered user also shows up as a contact on their own board (name + email),
-- so their own details are visible in the contacts list and can be assigned to tasks.
-- Same trigger as before (private.handle_new_user), only extended; still security definer
-- with an empty search_path. raw_user_meta_data is used for display text only, never for permissions.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _board_id uuid;
  _name text;
  _colors text[] := array[
    '#FF7A00', '#FF5EB3', '#6E52FF', '#9327FF', '#00BEE8', '#1FD7C1',
    '#FF745E', '#FFA35E', '#FC71FF', '#FFC701', '#0038FF', '#C3FF2B',
    '#FFE62B', '#FF4646', '#FFBB2B'
  ];
begin
  _name := btrim(left(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), 60));
  if _name = '' then
    if new.is_anonymous then
      _name := 'Guest';
    else
      _name := btrim(left(split_part(coalesce(new.email, ''), '@', 1), 60));
      if _name = '' then
        _name := 'User';
      end if;
    end if;
  end if;

  insert into public.profiles (id, display_name) values (new.id, _name);

  insert into public.boards (name, owner_id, is_guest_board)
  values (case when new.is_anonymous then 'Guest board' else 'Team board' end,
          new.id, new.is_anonymous)
  returning id into _board_id;

  insert into public.board_members (board_id, user_id, role)
  values (_board_id, new.id, 'owner');

  -- Own contact: skipped for anonymous users and for emails the contacts check would reject,
  -- so a signup can never fail because of this step.
  if not new.is_anonymous
     and new.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     and char_length(new.email) between 3 and 254 then
    insert into public.contacts (board_id, name, email, color, created_by)
    values (
      _board_id, _name, new.email,
      _colors[1 + (abs(hashtext(lower(new.email))) % array_length(_colors, 1))],
      new.id
    );
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

-- Backfill for users registered before this migration (idempotent: skips existing emails,
-- skips the shared guest account and guest boards).
insert into public.contacts (board_id, name, email, color, created_by)
select b.id, p.display_name, u.email,
       (array['#FF7A00', '#FF5EB3', '#6E52FF', '#9327FF', '#00BEE8', '#1FD7C1',
              '#FF745E', '#FFA35E', '#FC71FF', '#FFC701', '#0038FF', '#C3FF2B',
              '#FFE62B', '#FF4646', '#FFBB2B'])[1 + (abs(hashtext(lower(u.email))) % 15)],
       u.id
from auth.users u
join public.profiles p on p.id = u.id
join public.boards b on b.owner_id = u.id and not b.is_guest_board
where u.email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  and char_length(u.email) between 3 and 254
  and coalesce(u.raw_app_meta_data ->> 'is_guest', '') <> 'true'
  and not u.is_anonymous
on conflict do nothing;
