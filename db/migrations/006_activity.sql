-- Track user activities and login/activity timestamps
alter table users add column if not exists last_login_at timestamptz;
alter table users add column if not exists last_active_at timestamptz;
alter table users add column if not exists welcome_sent_at timestamptz;

create table if not exists user_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists user_activities_user_id_idx on user_activities (user_id);
create index if not exists user_activities_created_at_idx on user_activities (created_at desc);
