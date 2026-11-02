-- Uploaded images. Bytes are counted per user for the storage quota; the file itself lives in Cloudinary.
create table media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  kind text not null check (kind in ('artwork', 'cover', 'journal')),
  bytes int not null,
  url text not null,
  public_id text,                           -- Cloudinary id, for deletion later
  created_at timestamptz not null default now()
);
create index media_by_user on media (user_id);
