-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

-- Anonymous feedback: anyone can send, nobody can read it through the app (only you, in the dashboard)
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  message text not null check (char_length(message) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "anyone can send feedback" on public.feedback;
create policy "anyone can send feedback" on public.feedback for insert to anon with check (true);

grant insert on public.feedback to anon;
