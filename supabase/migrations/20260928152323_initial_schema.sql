-- Join: initial schema
-- Shared team boards + isolated guest sandbox boards. RLS is enabled on every table
-- in this same migration; access is granted explicitly per operation.

-- ---------------------------------------------------------------------------
-- Private schema for helper functions. Not exposed through the Data API,
-- so these functions can not be called via rpc().
-- ---------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (char_length(display_name) between 1 and 60 and display_name = btrim(display_name)),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (char_length(name) between 1 and 80 and name = btrim(name)),
  owner_id uuid not null references auth.users (id) on delete cascade,
  is_guest_board boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.boards enable row level security;

create table public.board_members (
  board_id uuid not null references public.boards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);
alter table public.board_members enable row level security;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  name text not null
    check (char_length(name) between 1 and 100 and name = btrim(name)),
  email text not null
    check (char_length(email) between 3 and 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text not null default ''
    check (char_length(phone) <= 30 and phone ~ '^[0-9+()/. -]*$'),
  color text not null default '#FF7A00' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Target for composite foreign keys: guarantees child rows stay in the same board.
  unique (id, board_id)
);
alter table public.contacts enable row level security;
create unique index contacts_board_email_key on public.contacts (board_id, lower(email));

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  title text not null
    check (char_length(title) between 1 and 100 and title = btrim(title)),
  description text not null default '' check (char_length(description) <= 1000),
  due_date date not null,
  priority text not null default 'medium' check (priority in ('urgent', 'medium', 'low')),
  category text not null check (category in ('user_story', 'technical_task')),
  status text not null default 'todo'
    check (status in ('todo', 'in_progress', 'await_feedback', 'done')),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, board_id)
);
alter table public.tasks enable row level security;

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  board_id uuid not null,
  title text not null
    check (char_length(title) between 1 and 100 and title = btrim(title)),
  done boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (task_id, board_id) references public.tasks (id, board_id) on delete cascade
);
alter table public.subtasks enable row level security;

create table public.task_assignees (
  task_id uuid not null,
  contact_id uuid not null,
  board_id uuid not null,
  primary key (task_id, contact_id),
  foreign key (task_id, board_id) references public.tasks (id, board_id) on delete cascade,
  foreign key (contact_id, board_id) references public.contacts (id, board_id) on delete cascade
);
alter table public.task_assignees enable row level security;

-- Indexes for foreign keys / common filters
create index board_members_user_id_idx on public.board_members (user_id);
create index boards_owner_id_idx on public.boards (owner_id);
create index contacts_created_by_idx on public.contacts (created_by);
create index tasks_board_status_order_idx on public.tasks (board_id, status, sort_order);
create index tasks_created_by_idx on public.tasks (created_by);
create index subtasks_task_board_idx on public.subtasks (task_id, board_id);
create index task_assignees_task_board_idx on public.task_assignees (task_id, board_id);
create index task_assignees_contact_board_idx on public.task_assignees (contact_id, board_id);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies on board_members do not recurse)
-- ---------------------------------------------------------------------------
create function private.is_board_member(_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.board_members bm
    where bm.board_id = _board_id and bm.user_id = (select auth.uid())
  );
$$;

create function private.is_board_owner(_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.boards b
    where b.id = _board_id and b.owner_id = (select auth.uid())
  );
$$;

create function private.shares_board_with(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.board_members mine
    join public.board_members theirs on theirs.board_id = mine.board_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = _user_id
  );
$$;

revoke all on function private.is_board_member(uuid) from public, anon;
revoke all on function private.is_board_owner(uuid) from public, anon;
revoke all on function private.shares_board_with(uuid) from public, anon;
grant execute on function private.is_board_member(uuid) to authenticated;
grant execute on function private.is_board_owner(uuid) to authenticated;
grant execute on function private.shares_board_with(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function private.set_updated_at();

-- Every new auth user (registered or anonymous guest) gets a profile and an own board.
-- Guests therefore only ever see their own sandbox board, never a team board.
-- raw_user_meta_data is user-controlled: it is used for the display name only, never for permissions.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _board_id uuid;
  _name text;
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

  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Privileges: no access for anon, column-level grants for authenticated.
-- Columns that must not be written by users (board_id on update, owner_id,
-- is_guest_board, created_by, role) are simply not granted.
-- ---------------------------------------------------------------------------
revoke all on table
  public.profiles, public.boards, public.board_members, public.contacts,
  public.tasks, public.subtasks, public.task_assignees
  from anon, authenticated;

grant select, update (display_name) on public.profiles to authenticated;
grant select, update (name), delete on public.boards to authenticated;
grant select, delete on public.board_members to authenticated;
grant select, insert (board_id, name, email, phone, color),
  update (name, email, phone, color), delete
  on public.contacts to authenticated;
grant select,
  insert (board_id, title, description, due_date, priority, category, status, sort_order),
  update (title, description, due_date, priority, category, status, sort_order), delete
  on public.tasks to authenticated;
grant select, insert (task_id, board_id, title, done), update (title, done), delete
  on public.subtasks to authenticated;
grant select, insert (task_id, contact_id, board_id), delete
  on public.task_assignees to authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies
-- Anonymous (guest) users also have the role "authenticated". They are isolated because
-- every policy below is based on board membership and guests only ever belong to their
-- own guest board. Any future invite function MUST reject anonymous users.
-- ---------------------------------------------------------------------------

-- profiles: own profile and profiles of people sharing a board; insert only via trigger
create policy "Read own and co-member profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_board_with(id));
create policy "Update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- boards: created only by the signup trigger
create policy "Members read boards" on public.boards
  for select to authenticated
  using (private.is_board_member(id));
create policy "Owners rename boards" on public.boards
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Owners delete boards" on public.boards
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- board_members: inserts only via trigger / future secure invite function
create policy "Members read memberships" on public.board_members
  for select to authenticated
  using (private.is_board_member(board_id));
create policy "Owners remove members, members leave" on public.board_members
  for delete to authenticated
  using (role = 'member' and (user_id = (select auth.uid()) or private.is_board_owner(board_id)));

-- contacts
create policy "Members read contacts" on public.contacts
  for select to authenticated using (private.is_board_member(board_id));
create policy "Members create contacts" on public.contacts
  for insert to authenticated with check (private.is_board_member(board_id));
create policy "Members update contacts" on public.contacts
  for update to authenticated
  using (private.is_board_member(board_id))
  with check (private.is_board_member(board_id));
create policy "Members delete contacts" on public.contacts
  for delete to authenticated using (private.is_board_member(board_id));

-- tasks
create policy "Members read tasks" on public.tasks
  for select to authenticated using (private.is_board_member(board_id));
create policy "Members create tasks" on public.tasks
  for insert to authenticated with check (private.is_board_member(board_id));
create policy "Members update tasks" on public.tasks
  for update to authenticated
  using (private.is_board_member(board_id))
  with check (private.is_board_member(board_id));
create policy "Members delete tasks" on public.tasks
  for delete to authenticated using (private.is_board_member(board_id));

-- subtasks
create policy "Members read subtasks" on public.subtasks
  for select to authenticated using (private.is_board_member(board_id));
create policy "Members create subtasks" on public.subtasks
  for insert to authenticated with check (private.is_board_member(board_id));
create policy "Members update subtasks" on public.subtasks
  for update to authenticated
  using (private.is_board_member(board_id))
  with check (private.is_board_member(board_id));
create policy "Members delete subtasks" on public.subtasks
  for delete to authenticated using (private.is_board_member(board_id));

-- task_assignees (no update: re-assign by delete + insert)
create policy "Members read assignees" on public.task_assignees
  for select to authenticated using (private.is_board_member(board_id));
create policy "Members create assignees" on public.task_assignees
  for insert to authenticated with check (private.is_board_member(board_id));
create policy "Members delete assignees" on public.task_assignees
  for delete to authenticated using (private.is_board_member(board_id));
