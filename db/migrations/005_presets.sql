-- Up to two saved journal looks per account, checked and capped by the API.
alter table profiles add column presets jsonb not null default '[]'::jsonb;
