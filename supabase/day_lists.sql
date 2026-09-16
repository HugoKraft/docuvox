create extension if not exists pgcrypto;

create table if not exists public.day_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('active', 'backup')),
  date date not null,
  patient_count integer not null check (patient_count > 0),
  schema_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.day_lists enable row level security;

drop policy if exists "day_lists_select_own" on public.day_lists;
create policy "day_lists_select_own"
on public.day_lists
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "day_lists_insert_own" on public.day_lists;
create policy "day_lists_insert_own"
on public.day_lists
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "day_lists_update_own" on public.day_lists;
create policy "day_lists_update_own"
on public.day_lists
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "day_lists_delete_own" on public.day_lists;
create policy "day_lists_delete_own"
on public.day_lists
for delete
to authenticated
using (auth.uid() = user_id);

create unique index if not exists day_lists_one_active_per_user_idx
on public.day_lists (user_id)
where status = 'active';

create unique index if not exists day_lists_one_backup_per_user_idx
on public.day_lists (user_id)
where status = 'backup';

create index if not exists day_lists_user_status_idx
on public.day_lists (user_id, status);

create index if not exists day_lists_user_updated_idx
on public.day_lists (user_id, updated_at desc);

create or replace function public.set_day_lists_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_day_lists_updated_at on public.day_lists;
create trigger set_day_lists_updated_at
before update on public.day_lists
for each row
execute function public.set_day_lists_updated_at();

alter table public.documents
add column if not exists day_list_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_day_list_id_fkey'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
    add constraint documents_day_list_id_fkey
    foreign key (day_list_id)
    references public.day_lists(id)
    on delete cascade;
  end if;
end;
$$;

create index if not exists documents_day_list_patient_idx
on public.documents (day_list_id, patient_number)
where day_list_id is not null;

create index if not exists documents_day_list_idx
on public.documents (day_list_id)
where day_list_id is not null;
