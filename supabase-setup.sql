-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

-- One row per user with the whole app state as JSON
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Everyone can only see and change their own row
alter table public.user_data enable row level security;

drop policy if exists "own data select" on public.user_data;
drop policy if exists "own data insert" on public.user_data;
drop policy if exists "own data update" on public.user_data;
drop policy if exists "own data delete" on public.user_data;

create policy "own data select" on public.user_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "own data insert" on public.user_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own data update" on public.user_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own data delete" on public.user_data for delete to authenticated using ((select auth.uid()) = user_id);

-- Anonymous feedback: anyone can send, nobody can read it through the app (only you, in the dashboard)
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback" on public.feedback for insert to anon, authenticated with check (true);

grant insert on public.feedback to anon, authenticated;

-- Lets a signed-in user delete their own account (and through the cascade all their data)
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
