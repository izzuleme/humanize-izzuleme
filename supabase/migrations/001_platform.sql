-- ============================================================================
-- 001_platform.sql  — Customer / Worker / Admin platform on ONE database.
-- Idempotent: safe to run more than once. BACK UP YOUR DATABASE FIRST.
-- Assumes existing tables: workers(id, phone, orders), rotation(id, current_worker),
-- worker_accounts(id, username, password, worker_id, role, created_at).
-- ============================================================================
create extension if not exists pgcrypto;

-- ---------- 1. worker_accounts: keep rows, add hashing + status + lockout ----
alter table worker_accounts add column if not exists password_hash text;
alter table worker_accounts add column if not exists display_name text;
alter table worker_accounts add column if not exists status text not null default 'active';
alter table worker_accounts add column if not exists must_change_password boolean not null default false;
alter table worker_accounts add column if not exists failed_attempts int not null default 0;
alter table worker_accounts add column if not exists locked_until timestamptz;
alter table worker_accounts add column if not exists last_login_at timestamptz;
alter table worker_accounts add column if not exists password_changed_at timestamptz;
do $$ begin
  alter table worker_accounts add constraint worker_accounts_status_chk
    check (status in ('active','inactive','suspended'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table worker_accounts add constraint worker_accounts_role_chk
    check (role in ('admin','worker'));
exception when duplicate_object then null; end $$;
-- legacy plaintext column must become nullable so it can be wiped (see 002)
do $$ begin
  alter table worker_accounts alter column password drop not null;
exception when undefined_column then null; end $$;
create unique index if not exists worker_accounts_username_lower_uq on worker_accounts (lower(username));

-- Hash existing plaintext passwords in place (bcrypt via pgcrypto; compatible with bcryptjs).
update worker_accounts
   set password_hash = crypt(password, gen_salt('bf', 10)),
       password_changed_at = now()
 where password_hash is null and password is not null;

-- ---------- 2. workers: availability, limits, hours, rate -------------------
alter table workers add column if not exists is_available boolean not null default true;
alter table workers add column if not exists max_orders_per_day int not null default 5 check (max_orders_per_day >= 0);
alter table workers add column if not exists max_pages_per_day int not null default 50 check (max_pages_per_day >= 0);
alter table workers add column if not exists work_start time not null default '09:00';
alter table workers add column if not exists work_end time not null default '23:00';
alter table workers add column if not exists pay_rate_per_page numeric(10,2) not null default 0 check (pay_rate_per_page >= 0);
alter table workers add column if not exists last_assigned_at timestamptz;

-- ---------- 3. customers ----------------------------------------------------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  phone text,
  password_hash text not null,
  status text not null default 'active' check (status in ('active','suspended')),
  failed_attempts int not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists customers_email_lower_uq on customers (lower(email));

-- ---------- 4. server-side sessions (revocable) ------------------------------
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  account_kind text not null check (account_kind in ('staff','customer')),
  account_id text not null,
  role text not null check (role in ('admin','worker','customer')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists sessions_account_idx on sessions (account_kind, account_id);

-- ---------- 5. orders, files, revisions, payroll, audit ----------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated always as identity,
  customer_id uuid not null references customers(id),
  worker_id bigint references workers(id),
  title text not null,
  requirements text not null default '',
  pages int not null check (pages > 0),
  deadline timestamptz not null,
  price numeric(10,2),
  status text not null default 'pending_assignment'
    check (status in ('pending_assignment','assigned','in_progress','delivered','revision_requested','approved','cancelled')),
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  delivered_at timestamptz,
  approved_at timestamptz,
  approved_by text
);
create index if not exists orders_worker_idx on orders (worker_id, status);
create index if not exists orders_customer_idx on orders (customer_id);

create table if not exists order_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  kind text not null check (kind in ('customer_upload','deliverable')),
  storage_path text not null unique,
  filename text not null,
  size_bytes bigint not null,
  mime text not null,
  revision_no int not null default 0,
  uploaded_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists order_files_order_idx on order_files (order_id);

create table if not exists revisions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  revision_no int not null,
  note text not null,
  status text not null default 'open' check (status in ('open','resolved')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (order_id, revision_no)
);

-- ONE payroll row per order, enforced by the database. Revisions can never duplicate it.
create table if not exists payroll_entries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id),
  worker_id bigint not null references workers(id),
  pages int not null,
  rate numeric(10,2) not null,
  amount numeric(10,2) not null,
  earned_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','paid')),
  paid_at timestamptz
);
create index if not exists payroll_worker_idx on payroll_entries (worker_id, earned_at);

create table if not exists order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  actor text not null,
  event text not null,
  detail text,
  created_at timestamptz not null default now()
);

-- ---------- 6. assignment, approval, rotation (atomic, row-locked) -----------
-- Auto-assign: active account + available + inside working hours (Asia/Kuala_Lumpur)
-- + under today's max orders and max pages. Least-recently-assigned first.
create or replace function assign_order(p_order uuid, p_exclude bigint default null)
returns bigint language plpgsql as $$
declare
  v_pages int; v_worker bigint;
  v_tz constant text := 'Asia/Kuala_Lumpur';
  v_now time := (now() at time zone 'Asia/Kuala_Lumpur')::time;
  v_day timestamptz := (date_trunc('day', now() at time zone 'Asia/Kuala_Lumpur')) at time zone 'Asia/Kuala_Lumpur';
begin
  select pages into v_pages from orders
   where id = p_order and status = 'pending_assignment' and worker_id is null for update;
  if not found then return null; end if;

  select w.id into v_worker
    from workers w
   where w.is_available
     and exists (select 1 from worker_accounts a where a.worker_id = w.id and a.role = 'worker' and a.status = 'active')
     and (p_exclude is null or w.id <> p_exclude)
     and (case when w.work_start <= w.work_end then v_now between w.work_start and w.work_end
               else v_now >= w.work_start or v_now <= w.work_end end)
     and (select count(*) from orders o where o.worker_id = w.id and o.status <> 'cancelled' and o.assigned_at >= v_day) < w.max_orders_per_day
     and coalesce((select sum(o.pages) from orders o where o.worker_id = w.id and o.status <> 'cancelled' and o.assigned_at >= v_day), 0) + v_pages <= w.max_pages_per_day
   order by w.last_assigned_at nulls first, w.id
   limit 1
   for update of w skip locked;

  if v_worker is null then return null; end if;

  update orders set worker_id = v_worker, status = 'assigned', assigned_at = now() where id = p_order;
  update workers set last_assigned_at = now(), orders = coalesce(orders, 0) + 1 where id = v_worker;
  insert into order_events(order_id, actor, event, detail) values (p_order, 'system', 'auto_assigned', 'worker ' || v_worker);
  return v_worker;
end $$;

-- Retry every waiting order (oldest deadline first). Call when capacity changes.
create or replace function assign_pending_orders() returns int language plpgsql as $$
declare r record; n int := 0;
begin
  for r in select id from orders where status = 'pending_assignment' and worker_id is null order by deadline, created_at loop
    if assign_order(r.id) is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- Admin approval -> payroll. Only from 'delivered'. Payroll insert is idempotent.
create or replace function approve_order(p_order uuid, p_admin text) returns boolean language plpgsql as $$
declare o orders%rowtype; v_rate numeric(10,2);
begin
  select * into o from orders where id = p_order for update;
  if not found or o.status <> 'delivered' or o.worker_id is null then return false; end if;
  if exists (select 1 from revisions where order_id = p_order and status = 'open') then return false; end if;
  select pay_rate_per_page into v_rate from workers where id = o.worker_id;
  update orders set status = 'approved', approved_at = now(), approved_by = p_admin where id = p_order;
  insert into payroll_entries(order_id, worker_id, pages, rate, amount)
       values (p_order, o.worker_id, o.pages, v_rate, round(o.pages * v_rate, 2))
  on conflict (order_id) do nothing;
  insert into order_events(order_id, actor, event) values (p_order, p_admin, 'approved');
  return true;
end $$;

-- WhatsApp rotation: same semantics as before (current_worker = next to serve),
-- but skips unavailable / non-active workers and is atomic.
create or replace function next_rotation_worker()
returns table (worker_id bigint, phone text) language plpgsql as $$
declare cur bigint; pick bigint; nxt bigint;
begin
  select current_worker into cur from rotation where id = 1 for update;
  cur := coalesce(cur, 0);
  create temp table if not exists _elig (id bigint) on commit drop;
  truncate _elig;
  insert into _elig
    select w.id::bigint from workers w
     where w.is_available
       and not exists (select 1 from worker_accounts a where a.worker_id = w.id and a.status <> 'active');
  select id into pick from _elig where id >= cur order by id limit 1;
  if pick is null then select id into pick from _elig order by id limit 1; end if;
  if pick is null then return; end if;
  select id into nxt from _elig where id > pick order by id limit 1;
  if nxt is null then select id into nxt from _elig order by id limit 1; end if;
  update rotation set current_worker = nxt where id = 1;
  update workers set orders = coalesce(orders, 0) + 1 where id = pick;
  return query select w.id::bigint, w.phone::text from workers w where w.id = pick;
end $$;

-- ---------- 7. lock everything: server (service role) only -------------------
do $$
declare t text;
begin
  foreach t in array array['worker_accounts','workers','rotation','customers','sessions','orders',
                           'order_files','revisions','payroll_entries','order_events'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from anon, authenticated', t);
  end loop;
end $$;
revoke all on function assign_order(uuid, bigint), assign_pending_orders(), approve_order(uuid, text), next_rotation_worker()
  from public, anon, authenticated;

-- ---------- 8. private storage bucket for all order documents ----------------
insert into storage.buckets (id, name, public) values ('order-files', 'order-files', false)
on conflict (id) do update set public = false;
