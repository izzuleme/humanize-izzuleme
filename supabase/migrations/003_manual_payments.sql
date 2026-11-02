-- ============================================================================
-- 003_manual_payments.sql — manual payment (WhatsApp + receipt) verification.
-- Run AFTER 001. Idempotent. No external payment gateway. BACK UP FIRST.
-- The `payments` table has provider / provider_reference columns so a gateway
-- (CHIP, Billplz, ...) can later write to the SAME table and status machine.
-- ============================================================================

-- ---------- 1. admin-configurable payment settings (single row) --------------
create table if not exists payment_settings (
  id int primary key default 1 check (id = 1),
  whatsapp_number text,                       -- digits with country code, e.g. 60123456789
  bank_name text,
  account_holder text,
  account_number text,
  payment_methods text,                       -- free text list shown to customers
  instructions text,
  price_standard numeric(10,2) not null default 1.00 check (price_standard >= 0),
  price_academic numeric(10,2) not null default 1.00 check (price_academic >= 0),
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into payment_settings (id) values (1) on conflict (id) do nothing;

create table if not exists admin_audit (
  id bigint generated always as identity primary key,
  actor text not null,
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);

-- ---------- 2. orders: richer order form + idempotency + new status ----------
alter table orders add column if not exists from_page int;
alter table orders add column if not exists to_page int;
alter table orders add column if not exists total_pages int;
alter table orders add column if not exists style text;
alter table orders add column if not exists customer_phone text;
alter table orders add column if not exists submission_key uuid;
alter table orders add column if not exists reference_code text;
do $$ begin
  alter table orders add constraint orders_style_chk check (style is null or style in ('academic','standard'));
exception when duplicate_object then null; end $$;
create unique index if not exists orders_submission_uq on orders (customer_id, submission_key) where submission_key is not null;
create unique index if not exists orders_reference_uq on orders (reference_code) where reference_code is not null;

alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check (status in
  ('pending_payment_verification','pending_assignment','assigned','in_progress','delivered',
   'revision_requested','approved','cancelled'));

-- ---------- 3. payments (one row per order), receipts, audit trail -----------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  currency text not null default 'MYR',
  provider text not null default 'manual_whatsapp',
  provider_reference text,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','receipt_submitted','under_verification','rejected','paid',
                      'failed','expired','refunded')),   -- last three reserved for a future gateway
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  storage_path text not null unique,
  filename text not null,
  size_bytes bigint not null,
  mime text not null,
  sha256 text not null,
  status text not null default 'submitted' check (status in ('submitted','approved','rejected','superseded')),
  uploaded_by text not null,
  reviewed_by text,
  reviewed_at timestamptz,
  internal_note text,            -- admin only, never sent to customers
  customer_message text,         -- visible to the customer
  created_at timestamptz not null default now()
);
create index if not exists payment_receipts_order_idx on payment_receipts (order_id, created_at);
create index if not exists payment_receipts_sha_idx on payment_receipts (sha256);
-- at most ONE receipt waiting for review per order -> no duplicate pending records
create unique index if not exists payment_receipts_one_submitted_uq on payment_receipts (order_id) where status = 'submitted';

create table if not exists payment_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references orders(id) on delete cascade,
  actor text not null,
  action text not null,           -- receipt_submitted, review_started, approved, rejected, receipt_requested, receipt_replaced
  internal_note text,
  customer_message text,
  created_at timestamptz not null default now()
);
create index if not exists payment_events_order_idx on payment_events (order_id, created_at);

-- existing (pre-manual-payment) orders that already have a worker keep working
insert into payments (order_id, amount, status, verified_by, verified_at)
select o.id, coalesce(o.price, 0), 'paid', 'migration', now()
  from orders o
 where o.worker_id is not null
   and not exists (select 1 from payments p where p.order_id = o.id);

-- ---------- 4. assignment now requires PAID and a future deadline ------------
create or replace function assign_order(p_order uuid, p_exclude bigint default null)
returns bigint language plpgsql as $$
declare
  v_pages int; v_deadline timestamptz; v_worker bigint;
  v_now time := (now() at time zone 'Asia/Kuala_Lumpur')::time;
  v_day timestamptz := (date_trunc('day', now() at time zone 'Asia/Kuala_Lumpur')) at time zone 'Asia/Kuala_Lumpur';
begin
  select pages, deadline into v_pages, v_deadline from orders
   where id = p_order and status = 'pending_assignment' and worker_id is null for update;
  if not found then return null; end if;
  -- never assign an unpaid order, even if called directly
  if not exists (select 1 from payments where order_id = p_order and status = 'paid') then return null; end if;
  -- a deadline that has already passed needs a human decision
  if v_deadline <= now() then return null; end if;

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

-- completion approval (payroll) also requires a verified payment
create or replace function approve_order(p_order uuid, p_admin text) returns boolean language plpgsql as $$
declare o orders%rowtype; v_rate numeric(10,2);
begin
  select * into o from orders where id = p_order for update;
  if not found or o.status <> 'delivered' or o.worker_id is null then return false; end if;
  if not exists (select 1 from payments where order_id = p_order and status = 'paid') then return false; end if;
  if exists (select 1 from revisions where order_id = p_order and status = 'open') then return false; end if;
  select pay_rate_per_page into v_rate from workers where id = o.worker_id;
  update orders set status = 'approved', approved_at = now(), approved_by = p_admin where id = p_order;
  insert into payroll_entries(order_id, worker_id, pages, rate, amount)
       values (p_order, o.worker_id, o.pages, v_rate, round(o.pages * v_rate, 2))
  on conflict (order_id) do nothing;
  insert into order_events(order_id, actor, event) values (p_order, p_admin, 'approved');
  return true;
end $$;

-- ---------- 5. atomic payment workflow functions ----------------------------
-- Customer submits order + original document + receipt in ONE transaction.
-- Idempotent on (customer, submission_key): double-clicks never create 2 orders.
create or replace function create_manual_order(
  p_customer uuid, p_key uuid, p_title text, p_from int, p_to int, p_total int, p_style text,
  p_deadline timestamptz, p_phone text, p_requirements text, p_original jsonb, p_receipt jsonb)
returns table (order_id uuid, duplicate boolean, amount numeric)
language plpgsql as $$
declare v_id uuid; v_rate numeric(10,2); v_pages int := p_to - p_from + 1; v_amount numeric(10,2);
begin
  select o.id into v_id from orders o where o.customer_id = p_customer and o.submission_key = p_key;
  if found then
    return query select v_id, true, (select pa.amount from payments pa where pa.order_id = v_id);
    return;
  end if;

  if exists (select 1 from payment_receipts r where r.sha256 = p_receipt->>'sha256' and r.status in ('submitted','approved')) then
    raise exception 'duplicate_receipt';
  end if;

  select case when p_style = 'academic' then price_academic else price_standard end into v_rate from payment_settings where id = 1;
  v_amount := round(v_pages * coalesce(v_rate, 0), 2);

  insert into orders (customer_id, title, requirements, pages, from_page, to_page, total_pages, style, deadline,
                      customer_phone, submission_key, reference_code, price, status)
  values (p_customer, p_title, p_requirements, v_pages, p_from, p_to, p_total, p_style, p_deadline,
          p_phone, p_key, upper(substr(replace(p_key::text, '-', ''), 1, 8)), v_amount, 'pending_payment_verification')
  returning id into v_id;

  insert into order_files (order_id, kind, storage_path, filename, size_bytes, mime, uploaded_by)
  values (v_id, 'customer_upload', p_original->>'path', p_original->>'filename', (p_original->>'size')::bigint,
          p_original->>'mime', 'customer:' || p_customer);

  insert into payments (order_id, amount, status) values (v_id, v_amount, 'receipt_submitted');
  insert into payment_receipts (order_id, storage_path, filename, size_bytes, mime, sha256, uploaded_by)
  values (v_id, p_receipt->>'path', p_receipt->>'filename', (p_receipt->>'size')::bigint, p_receipt->>'mime',
          p_receipt->>'sha256', 'customer:' || p_customer);
  insert into payment_events (order_id, actor, action) values (v_id, 'customer:' || p_customer, 'receipt_submitted');
  insert into order_events (order_id, actor, event) values (v_id, 'customer:' || p_customer, 'created');

  return query select v_id, false, v_amount;
exception when unique_violation then
  -- lost a race with an identical concurrent submit: return the winner
  select o.id into v_id from orders o where o.customer_id = p_customer and o.submission_key = p_key;
  if v_id is null then raise; end if;
  return query select v_id, true, (select pa.amount from payments pa where pa.order_id = v_id);
end $$;

-- Customer replaces a rejected / requested receipt.
create or replace function payment_submit_replacement(p_order uuid, p_customer uuid, p_receipt jsonb)
returns void language plpgsql as $$
declare v_status text;
begin
  perform 1 from orders where id = p_order and customer_id = p_customer for update;
  if not found then raise exception 'not_found'; end if;
  select status into v_status from payments where order_id = p_order for update;
  if v_status is null or v_status not in ('rejected','awaiting_payment') then raise exception 'not_allowed'; end if;
  if exists (select 1 from payment_receipts r where r.sha256 = p_receipt->>'sha256'
              and (r.order_id = p_order or r.status in ('submitted','approved'))) then
    raise exception 'duplicate_receipt';
  end if;
  insert into payment_receipts (order_id, storage_path, filename, size_bytes, mime, sha256, uploaded_by)
  values (p_order, p_receipt->>'path', p_receipt->>'filename', (p_receipt->>'size')::bigint, p_receipt->>'mime',
          p_receipt->>'sha256', 'customer:' || p_customer);
  update payments set status = 'receipt_submitted', updated_at = now() where order_id = p_order;
  insert into payment_events (order_id, actor, action) values (p_order, 'customer:' || p_customer, 'receipt_replaced');
end $$;

create or replace function payment_start_review(p_order uuid, p_admin text) returns boolean language plpgsql as $$
begin
  update payments set status = 'under_verification', updated_at = now()
   where order_id = p_order and status = 'receipt_submitted';
  if not found then return false; end if;
  insert into payment_events (order_id, actor, action) values (p_order, p_admin, 'review_started');
  return true;
end $$;

-- Approve: payment -> paid, order -> eligible, then auto-assign. Returns the worker id (or null = queued).
create or replace function payment_approve(p_order uuid, p_admin text, p_note text)
returns table (ok boolean, worker_id bigint) language plpgsql as $$
declare v_worker bigint;
begin
  perform 1 from payments where order_id = p_order and status in ('receipt_submitted','under_verification') for update;
  if not found then return query select false, null::bigint; return; end if;
  update payments set status = 'paid', verified_by = p_admin, verified_at = now(), updated_at = now() where order_id = p_order;
  update payment_receipts set status = 'approved', reviewed_by = p_admin, reviewed_at = now(), internal_note = nullif(p_note,'')
   where order_id = p_order and status = 'submitted';
  update orders set status = 'pending_assignment' where id = p_order and status = 'pending_payment_verification';
  insert into payment_events (order_id, actor, action, internal_note) values (p_order, p_admin, 'approved', nullif(p_note,''));
  v_worker := assign_order(p_order);
  return query select true, v_worker;
end $$;

create or replace function payment_reject(p_order uuid, p_admin text, p_internal text, p_customer_msg text)
returns boolean language plpgsql as $$
begin
  if coalesce(trim(p_internal), '') = '' then raise exception 'note_required'; end if;
  perform 1 from payments where order_id = p_order and status in ('receipt_submitted','under_verification') for update;
  if not found then return false; end if;
  update payments set status = 'rejected', updated_at = now() where order_id = p_order;
  update payment_receipts set status = 'rejected', reviewed_by = p_admin, reviewed_at = now(),
         internal_note = p_internal, customer_message = nullif(p_customer_msg,'')
   where order_id = p_order and status = 'submitted';
  insert into payment_events (order_id, actor, action, internal_note, customer_message)
  values (p_order, p_admin, 'rejected', p_internal, nullif(p_customer_msg,''));
  return true;
end $$;

create or replace function payment_request_receipt(p_order uuid, p_admin text, p_internal text, p_customer_msg text)
returns boolean language plpgsql as $$
begin
  perform 1 from payments where order_id = p_order and status in ('receipt_submitted','under_verification') for update;
  if not found then return false; end if;
  update payments set status = 'awaiting_payment', updated_at = now() where order_id = p_order;
  update payment_receipts set status = 'superseded', reviewed_by = p_admin, reviewed_at = now(),
         internal_note = nullif(p_internal,''), customer_message = nullif(p_customer_msg,'')
   where order_id = p_order and status = 'submitted';
  insert into payment_events (order_id, actor, action, internal_note, customer_message)
  values (p_order, p_admin, 'receipt_requested', nullif(p_internal,''), nullif(p_customer_msg,''));
  return true;
end $$;

-- ---------- 6. lock down (server/service role only) --------------------------
do $$
declare t text;
begin
  foreach t in array array['payment_settings','admin_audit','payments','payment_receipts','payment_events'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from anon, authenticated', t);
  end loop;
end $$;
revoke all on function
  create_manual_order(uuid, uuid, text, int, int, int, text, timestamptz, text, text, jsonb, jsonb),
  payment_submit_replacement(uuid, uuid, jsonb), payment_start_review(uuid, text),
  payment_approve(uuid, text, text), payment_reject(uuid, text, text, text),
  payment_request_receipt(uuid, text, text, text), assign_order(uuid, bigint), approve_order(uuid, text)
  from public, anon, authenticated;
