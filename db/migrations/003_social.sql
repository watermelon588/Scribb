-- Entry extras the journal editor stores (grid, focus, scribbles, stickers, align), kept as one JSON value.
alter table journal_entries add column extras jsonb not null default '{}';

create table likes (
  user_id uuid not null references users (id) on delete cascade,
  book_id uuid not null references books (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
create table saves (
  user_id uuid not null references users (id) on delete cascade,
  book_id uuid not null references books (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
create index saves_by_user on saves (user_id, created_at desc, book_id);

create table follows (
  follower_id uuid not null references users (id) on delete cascade,
  followee_id uuid not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee on follows (followee_id);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,   -- who is notified
  actor_id uuid not null references users (id) on delete cascade,  -- who did it
  type text not null check (type in ('like', 'follow')),
  book_id uuid references books (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_inbox on notifications (user_id, created_at desc, id);
