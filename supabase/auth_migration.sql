-- Run this ONCE in Supabase > SQL Editor. It is safe to re-run.
-- Deploy the new code first or after: login keeps working either way, because
-- the code falls back to the old plaintext column until password_hash exists.

-- 1) Hashed passwords --------------------------------------------------------
alter table public.worker_accounts
  add column if not exists password_hash text;

-- The old plaintext column must be allowed to become NULL once migrated.
alter table public.worker_accounts
  alter column password drop not null;

-- 2) One account per username (login looks accounts up by username) ---------
-- If this fails with "could not create unique index", you have duplicate
-- usernames: fix them first with
--   select username, count(*) from public.worker_accounts group by 1 having count(*) > 1;
create unique index if not exists worker_accounts_username_key
  on public.worker_accounts (username);

-- 3) Lock the public Data API --------------------------------------------------
-- All data access in this app goes through the Next.js server using the
-- service role key, which bypasses RLS. Enabling RLS with NO policies means the
-- public anon key can no longer read or write these tables from a browser.
alter table public.worker_accounts enable row level security;
alter table public.workers         enable row level security;
alter table public.orders          enable row level security;
alter table public.rotation        enable row level security;
alter table public.schedules       enable row level security;
alter table public.settings        enable row level security;

revoke all on public.worker_accounts from anon, authenticated;

-- 4) After running scripts/hash-passwords.mjs (or after every account has
--    logged in once) verify no plaintext is left. Expect 0 rows:
--    select id, username from public.worker_accounts where password is not null;
