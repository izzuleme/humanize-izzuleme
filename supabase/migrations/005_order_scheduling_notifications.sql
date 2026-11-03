-- 005_order_scheduling_notifications.sql
-- Per-order scheduling + portal notifications

-- =========================================================
-- 1. ORDER SCHEDULING
-- =========================================================

alter table orders
  add column if not exists estimated_minutes int not null default 30;

alter table orders
  add column if not exists slot_start timestamptz;

alter table orders
  add column if not exists slot_end timestamptz;

do $$ begin
  alter table orders
    add constraint orders_estimated_minutes_chk
    check (estimated_minutes between 5 and 1440);
exception when duplicate_object then null;
end $$;

-- Existing assigned orders use their deadline as slot_end.
update orders
set
  slot_end = deadline,
  slot_start = deadline - make_interval(mins => estimated_minutes)
where worker_id is not null
  and status <> 'cancelled'
  and (slot_start is null or slot_end is null);

create index if not exists orders_worker_slot_idx
on orders(worker_id, slot_start, slot_end);


-- =========================================================
-- 2. NOTIFICATIONS
-- One table for customer / worker / admin
-- =========================================================

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),

  recipient_role text not null
    check (recipient_role in ('customer','worker','admin')),

  customer_id uuid references customers(id) on delete cascade,
  worker_id bigint references workers(id) on delete cascade,

  order_id uuid references orders(id) on delete cascade,

  title text not null,
  message text not null,

  is_read boolean not null default false,
  created_at timestamptz not null default now(),

  check (
    (recipient_role = 'customer'
      and customer_id is not null
      and worker_id is null)

    or

    (recipient_role = 'worker'
      and worker_id is not null
      and customer_id is null)

    or

    (recipient_role = 'admin'
      and customer_id is null
      and worker_id is null)
  )
);

create index if not exists notifications_customer_idx
on notifications(customer_id, is_read, created_at desc);

create index if not exists notifications_worker_idx
on notifications(worker_id, is_read, created_at desc);

create index if not exists notifications_admin_idx
on notifications(recipient_role, is_read, created_at desc);


-- =========================================================
-- 3. CHECK WHETHER A WORKER SLOT OVERLAPS
-- =========================================================

create or replace function worker_slot_available(
  p_worker bigint,
  p_deadline timestamptz,
  p_minutes int,
  p_exclude_order uuid default null
)
returns boolean
language plpgsql
as $$
declare
  v_start timestamptz;
begin

  if p_worker is null
     or p_deadline is null
     or p_minutes is null
     or p_minutes <= 0 then
    return false;
  end if;

  v_start := p_deadline - make_interval(mins => p_minutes);

  return not exists (
    select 1
    from orders o
    where o.worker_id = p_worker
      and o.status <> 'cancelled'
      and o.slot_start is not null
      and o.slot_end is not null
      and (p_exclude_order is null or o.id <> p_exclude_order)

      -- overlap:
      -- new start < existing end
      -- AND new end > existing start
      and v_start < o.slot_end
      and p_deadline > o.slot_start
  );
end;
$$;


-- =========================================================
-- 4. WORKER CHANGES ESTIMATED TIME FOR ONE ORDER
-- =========================================================

create or replace function worker_set_order_minutes(
  p_order uuid,
  p_worker bigint,
  p_minutes int
)
returns boolean
language plpgsql
as $$
declare
  v_deadline timestamptz;
begin

  if p_minutes < 5 or p_minutes > 1440 then
    return false;
  end if;

  select deadline
  into v_deadline
  from orders
  where id = p_order
    and worker_id = p_worker
    and status in (
      'assigned',
      'in_progress',
      'revision_requested'
    )
  for update;

  if not found then
    return false;
  end if;

  if not worker_slot_available(
    p_worker,
    v_deadline,
    p_minutes,
    p_order
  ) then
    return false;
  end if;

  update orders
  set
    estimated_minutes = p_minutes,
    slot_start = v_deadline - make_interval(mins => p_minutes),
    slot_end = v_deadline
  where id = p_order
    and worker_id = p_worker;

  insert into order_events(
    order_id,
    actor,
    event,
    detail
  )
  values (
    p_order,
    'worker:' || p_worker,
    'estimated_time_changed',
    p_minutes || ' minutes'
  );

  return true;
end;
$$;


-- =========================================================
-- 5. SECURITY
-- =========================================================

alter table notifications enable row level security;

revoke all on table notifications
from anon, authenticated;

revoke all on function
  worker_slot_available(bigint, timestamptz, int, uuid),
  worker_set_order_minutes(uuid, bigint, int)
from public, anon, authenticated;
-- =========================================================
-- 6. SLOT CAPACITY CHECK
-- Default new order reservation = 30 minutes
-- =========================================================

create or replace function slot_has_capacity(
  p_deadline timestamptz,
  p_pages int
)
returns boolean
language plpgsql
as $$
declare
  v_time time;
  v_slot_start timestamptz;
  v_slot_start_time time;
  v_day_start timestamptz;
  v_day_end timestamptz;
begin

  if p_deadline is null or p_pages is null or p_pages <= 0 then
    return false;
  end if;

  if p_deadline <= now() then
    return false;
  end if;

  -- New orders reserve 30 minutes by default.
  v_slot_start := p_deadline - interval '30 minutes';

  v_time :=
    (p_deadline at time zone 'Asia/Kuala_Lumpur')::time;

  v_slot_start_time :=
    (v_slot_start at time zone 'Asia/Kuala_Lumpur')::time;

  v_day_start :=
    date_trunc(
      'day',
      p_deadline at time zone 'Asia/Kuala_Lumpur'
    ) at time zone 'Asia/Kuala_Lumpur';

  v_day_end := v_day_start + interval '1 day';

  return exists (
    select 1
    from workers w
    where w.is_available = true

      -- Worker account must be active.
      and exists (
        select 1
        from worker_accounts a
        where a.worker_id = w.id
          and a.role = 'worker'
          and a.status = 'active'
      )

      -- Entire reserved slot must fit inside worker hours.
      and (
        case
          when w.work_start <= w.work_end then
            v_slot_start_time >= w.work_start
            and v_time <= w.work_end

          else
            (
              v_slot_start_time >= w.work_start
              or v_time <= w.work_end
            )
        end
      )

      -- Daily order limit.
      and (
        select count(*)
        from orders o
        where o.worker_id = w.id
          and o.status <> 'cancelled'
          and o.deadline >= v_day_start
          and o.deadline < v_day_end
      ) < w.max_orders_per_day

      -- Daily page limit.
      and (
        coalesce((
          select sum(o.pages)
          from orders o
          where o.worker_id = w.id
            and o.status <> 'cancelled'
            and o.deadline >= v_day_start
            and o.deadline < v_day_end
        ), 0) + p_pages
      ) <= w.max_pages_per_day

      -- Most important:
      -- worker cannot already have an overlapping order.
      and worker_slot_available(
        w.id,
        p_deadline,
        30,
        null
      )
  );
end;
$$;


-- =========================================================
-- 7. SLOT-AWARE AUTOMATIC ASSIGNMENT
-- =========================================================

create or replace function assign_order(
  p_order uuid,
  p_exclude bigint default null
)
returns bigint
language plpgsql
as $$
declare
  v_pages int;
  v_deadline timestamptz;
  v_minutes int;
  v_worker bigint;

  v_time time;
  v_slot_start timestamptz;
  v_slot_start_time time;

  v_day_start timestamptz;
  v_day_end timestamptz;
begin

  select
    pages,
    deadline,
    estimated_minutes
  into
    v_pages,
    v_deadline,
    v_minutes
  from orders
  where id = p_order
    and status = 'pending_assignment'
    and worker_id is null
  for update;

  if not found then
    return null;
  end if;

  -- Never assign unpaid orders.
  if not exists (
    select 1
    from payments
    where order_id = p_order
      and status = 'paid'
  ) then
    return null;
  end if;

  if v_deadline <= now() then
    return null;
  end if;

  v_minutes := coalesce(v_minutes, 30);

  v_slot_start :=
    v_deadline - make_interval(mins => v_minutes);

  v_time :=
    (v_deadline at time zone 'Asia/Kuala_Lumpur')::time;

  v_slot_start_time :=
    (v_slot_start at time zone 'Asia/Kuala_Lumpur')::time;

  v_day_start :=
    date_trunc(
      'day',
      v_deadline at time zone 'Asia/Kuala_Lumpur'
    ) at time zone 'Asia/Kuala_Lumpur';

  v_day_end := v_day_start + interval '1 day';


  select w.id
  into v_worker
  from workers w

  where w.is_available = true

    and exists (
      select 1
      from worker_accounts a
      where a.worker_id = w.id
        and a.role = 'worker'
        and a.status = 'active'
    )

    and (
      p_exclude is null
      or w.id <> p_exclude
    )

    -- Entire job slot must fit worker hours.
    and (
      case
        when w.work_start <= w.work_end then
          v_slot_start_time >= w.work_start
          and v_time <= w.work_end

        else
          (
            v_slot_start_time >= w.work_start
            or v_time <= w.work_end
          )
      end
    )

    -- Daily order limit.
    and (
      select count(*)
      from orders o
      where o.worker_id = w.id
        and o.status <> 'cancelled'
        and o.deadline >= v_day_start
        and o.deadline < v_day_end
    ) < w.max_orders_per_day

    -- Daily page limit.
    and (
      coalesce((
        select sum(o.pages)
        from orders o
        where o.worker_id = w.id
          and o.status <> 'cancelled'
          and o.deadline >= v_day_start
          and o.deadline < v_day_end
      ), 0) + v_pages
    ) <= w.max_pages_per_day

    -- Prevent overlapping jobs.
    and worker_slot_available(
      w.id,
      v_deadline,
      v_minutes,
      p_order
    )

  -- Existing rotation behaviour stays.
  order by
    w.last_assigned_at nulls first,
    w.id

  limit 1

  -- Prevent two simultaneous assignments from grabbing
  -- the same worker at the same time.
  for update of w skip locked;


  if v_worker is null then
    return null;
  end if;


  update orders
  set
    worker_id = v_worker,
    status = 'assigned',
    assigned_at = now(),
    slot_start = v_slot_start,
    slot_end = v_deadline
  where id = p_order;


  update workers
  set
    last_assigned_at = now(),
    orders = coalesce(orders, 0) + 1
  where id = v_worker;


  insert into order_events(
    order_id,
    actor,
    event,
    detail
  )
  values (
    p_order,
    'system',
    'auto_assigned',
    'worker ' || v_worker ||
    ' | estimated ' || v_minutes || ' minutes' ||
    ' | slot ' ||
    (v_slot_start at time zone 'Asia/Kuala_Lumpur')::text ||
    ' - ' ||
    (v_deadline at time zone 'Asia/Kuala_Lumpur')::text
  );


  -- Worker portal notification
  insert into notifications(
    recipient_role,
    worker_id,
    order_id,
    title,
    message
  )
  values (
    'worker',
    v_worker,
    p_order,
    'New order assigned',
    'A new order has been assigned to you. Deadline: ' ||
      to_char(
        v_deadline at time zone 'Asia/Kuala_Lumpur',
        'DD Mon YYYY, HH12:MI AM'
      )
  );


  -- Customer portal notification
  insert into notifications(
    recipient_role,
    customer_id,
    order_id,
    title,
    message
  )
  select
    'customer',
    o.customer_id,
    o.id,
    'Order assigned',
    'Your payment has been approved and your order has been assigned to a worker.'
  from orders o
  where o.id = p_order;


  return v_worker;
end;
$$;


-- =========================================================
-- 8. SECURITY FOR REPLACED FUNCTIONS
-- =========================================================

revoke all on function
  slot_has_capacity(timestamptz, int),
  assign_order(uuid, bigint)
from public, anon, authenticated;
-- =========================================================
-- 9. DATABASE-LEVEL OVERLAP PROTECTION
-- Final safety net against overlapping worker slots
-- =========================================================

create extension if not exists btree_gist;

do $$ begin
  alter table orders
    add constraint orders_no_worker_slot_overlap
    exclude using gist (
      worker_id with =,
      tstzrange(slot_start, slot_end, '[)') with &&
    )
    where (
      worker_id is not null
      and slot_start is not null
      and slot_end is not null
      and status <> 'cancelled'
    );
exception
  when duplicate_object then null;
end $$;


-- =========================================================
-- 10. ADMIN NOTIFICATION WHEN CUSTOMER SUBMITS ORDER
-- =========================================================

create or replace function notify_admin_new_order()
returns trigger
language plpgsql
as $$
begin

  insert into notifications(
    recipient_role,
    order_id,
    title,
    message
  )
  values (
    'admin',
    new.id,
    'New order received',
    'A customer submitted a new order. Payment receipt is waiting for verification.'
  );

  return new;
end;
$$;


drop trigger if exists trg_notify_admin_new_order
on orders;

create trigger trg_notify_admin_new_order
after insert on orders
for each row
execute function notify_admin_new_order();


revoke all on function notify_admin_new_order()
from public, anon, authenticated;