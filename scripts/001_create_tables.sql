-- Create profiles table (for user management)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamp default now()
);

alter table public.profiles enable row level security;

create policy "Allow users to view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Allow users to insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Create PDFs table (stores metadata about uploaded PDFs)
create table if not exists public.pdfs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  file_path text not null,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.pdfs enable row level security;

create policy "Allow users to view their own PDFs" on public.pdfs
  for select using (auth.uid() = user_id);

create policy "Allow users to insert their own PDFs" on public.pdfs
  for insert with check (auth.uid() = user_id);

create policy "Allow users to update their own PDFs" on public.pdfs
  for update using (auth.uid() = user_id);

create policy "Allow users to delete their own PDFs" on public.pdfs
  for delete using (auth.uid() = user_id);

-- Create annotations table (stores highlights and notes on PDFs)
create table if not exists public.annotations (
  id uuid primary key default gen_random_uuid(),
  pdf_id uuid not null references public.pdfs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  page_number integer not null,
  annotation_type text not null, -- 'highlight' or 'note'
  content text, -- for notes
  position jsonb, -- stores x, y coordinates for highlights
  created_at timestamp default now(),
  updated_at timestamp default now()
);

alter table public.annotations enable row level security;

create policy "Allow users to view their own annotations" on public.annotations
  for select using (auth.uid() = user_id);

create policy "Allow users to insert their own annotations" on public.annotations
  for insert with check (auth.uid() = user_id);

create policy "Allow users to update their own annotations" on public.annotations
  for update using (auth.uid() = user_id);

create policy "Allow users to delete their own annotations" on public.annotations
  for delete using (auth.uid() = user_id);

-- Create trigger to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
