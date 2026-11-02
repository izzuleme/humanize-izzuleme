-- Run ONLY after you have confirmed that existing workers/admin can log in with the
-- new login pages (their old passwords still work: they were hashed in 001).
update worker_accounts set password = null where password_hash is not null;
