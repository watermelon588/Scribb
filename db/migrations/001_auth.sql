-- Accounts. Sign-up needs only a username and password (or Google); email is optional and verified later.
create table users (
  id uuid primary key default gen_random_uuid(),
  password_hash text,                       -- null for Google-only accounts
  google_sub text unique,
  email text check (email = lower(email)),  -- stored lowercase; may be unverified
  email_verified_at timestamptz,
  token_version int not null default 0,     -- bump to sign out every device
  ai_consent_at timestamptz,
  created_at timestamptz not null default now()
);
-- Only a verified email has to be unique, so typing someone else's address claims nothing.
create unique index users_verified_email on users (email) where email_verified_at is not null;

create table profiles (
  user_id uuid primary key references users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9._]{3,30}$'),  -- the username
  display_name text not null default '',
  bio text not null default '',
  city text not null default '',
  avatar text not null default 'a01',       -- preset avatar id, no uploads
  links jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Single-use links for email verification and password reset. Only the SHA-256 hash is stored.
create table email_tokens (
  token_hash text primary key,
  user_id uuid not null references users (id) on delete cascade,
  purpose text not null check (purpose in ('verify', 'reset')),
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Fixed-window counters for rate limits and daily AI quotas (serverless has no shared memory).
create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);
