-- Create folders table
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_folder_id uuid references public.folders(id) on delete cascade,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Add indexes for better query performance
create index if not exists idx_folders_user_id on public.folders(user_id);
create index if not exists idx_folders_parent_folder_id on public.folders(parent_folder_id);

-- Enable RLS
alter table public.folders enable row level security;

-- RLS policies for folders
create policy "Allow users to view their own folders" on public.folders
  for select using (auth.uid() = user_id);

create policy "Allow users to insert their own folders" on public.folders
  for insert with check (auth.uid() = user_id);

create policy "Allow users to update their own folders" on public.folders
  for update using (auth.uid() = user_id);

create policy "Allow users to delete their own folders" on public.folders
  for delete using (auth.uid() = user_id);

-- Add folder_id column to pdfs table
alter table public.pdfs add column if not exists folder_id uuid references public.folders(id) on delete set null;

-- Add index for folder_id in pdfs table
create index if not exists idx_pdfs_folder_id on public.pdfs(folder_id);

-- Create trigger to update updated_at timestamp
create or replace function public.update_folder_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_folder_updated on public.folders;

create trigger on_folder_updated
  before update on public.folders
  for each row
  execute function public.update_folder_updated_at();
