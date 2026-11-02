-- Books (sketchbooks and journals) and journal entries. Visibility is per book.
create table books (
  id uuid primary key,                      -- client-generated, so retries never duplicate
  user_id uuid not null references users (id) on delete cascade,
  kind text not null check (kind in ('sketchbook', 'journal')),
  title text not null default '',
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  category text,
  design jsonb not null default '{}',
  pages jsonb not null default '[]',
  like_count int not null default 0,
  save_count int not null default 0,
  version int not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index books_owner on books (user_id, updated_at desc);
create index books_public on books (published_at desc, id) where visibility = 'public';

create table journal_entries (
  id uuid primary key,
  book_id uuid not null references books (id) on delete cascade,
  user_id uuid not null references users (id) on delete cascade,
  entry_date date not null,                 -- the writer's calendar date
  layout text not null,
  texts jsonb not null default '{}',        -- sanitized HTML per slot
  images jsonb not null default '{}',       -- media ids per slot
  plain_text text not null default '',
  word_count int not null default 0,
  search tsvector generated always as (to_tsvector('english', plain_text)) stored,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journal_entries_by_date on journal_entries (user_id, entry_date desc, id);
create index journal_entries_in_book on journal_entries (book_id, entry_date, id);
create index journal_entries_search on journal_entries using gin (search);

-- The AI service connects as scribb_ai and may read only the entries of the user named in its ticket.
-- Give the role a password once, by hand: alter role scribb_ai login password '...';
do $$ begin
  if not exists (select from pg_roles where rolname = 'scribb_ai') then create role scribb_ai nologin; end if;
end $$;
grant usage on schema public to scribb_ai;
grant select (id, book_id, user_id, entry_date, plain_text, word_count, search) on journal_entries to scribb_ai;
alter table journal_entries enable row level security;
create policy journal_entries_owner_only on journal_entries for select to scribb_ai
  using (user_id = nullif(current_setting('app.user_id', true), '')::uuid);
