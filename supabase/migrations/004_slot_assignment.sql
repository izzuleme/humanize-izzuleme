-- 004_slot_assignment.sql
-- Slot-aware worker availability + automatic assignment
-- Uses Asia/Kuala_Lumpur as business timezone.

-- =========================================================
-- 1. Check whether an order slot has an eligible worker
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
  v_day_start timestamptz;
  v_day_end timestamptz;
begin
  if p_deadline is null or p_pages is null or p_pages <= 0 then
    return false;
  end if;

  -- Don't allow deadlines that have already passed.
  if p_deadline <= now() then
    return false;
  end if;

  -- Customer's selected deadline in Malaysia time.
  v_time := (p_deadline at time zone 'Asia/Kuala_Lumpur')::time;

  v_day_start :=
    date_trunc('day', p_deadline at time zone 'Asia/Kuala_Lumpur')
    at time zone 'Asia/Kuala_Lumpur';

  v_day_end := v_day_start + interval '1 day';

  return exists (
    select 1
    from workers w
    where w.is_available = true

      -- Worker account must still be active.
      and exists (
        select 1
        from worker_accounts a
        where a.worker_id = w.id
          and a.role = 'worker'
          and a.status = 'active'
      )

      -- Deadline must fall inside worker working hours.
      and (
        case
          when w.work_start <= w.work_end
            then v_time between w.work_start and w.work_end
          else
            v_time >= w.work_start or v_time <= w.work_end
        end
      )

      -- Worker must still have order capacity on that deadline day.
      and (
        select count(*)
        from orders o
        where o.worker_id = w.id
          and o.status <> 'cancelled'
          and o.deadline >= v_day_start
          and o.deadline < v_day_end
      ) < w.max_orders_per_day

      -- Worker must still have page capacity on that deadline day.
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
  );
end;
$$;


-- =========================================================
-- 2. Replace automatic assignment
--    Assignment now follows the ORDER DEADLINE slot.
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
  v_worker bigint;
  v_time time;
  v_day_start timestamptz;
  v_day_end timestamptz;
begin

  select pages, deadline
  into v_pages, v_deadline
  from orders
  where id = p_order
    and status = 'pending_assignment'
    and worker_id is null
  for update;

  if not found then
    return null;
  end if;

  -- Never assign an unpaid order.
  if not exists (
    select 1
    from payments
    where order_id = p_order
      and status = 'paid'
  ) then
    return null;
  end if;

  -- Expired deadline cannot be assigned.
  if v_deadline <= now() then
    return null;
  end if;

  v_time :=
    (v_deadline at time zone 'Asia/Kuala_Lumpur')::time;

  v_day_start :=
    date_trunc('day', v_deadline at time zone 'Asia/Kuala_Lumpur')
    at time zone 'Asia/Kuala_Lumpur';

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

    -- Check working hours against CUSTOMER DEADLINE.
    and (
      case
        when w.work_start <= w.work_end
          then v_time between w.work_start and w.work_end
        else
          v_time >= w.work_start or v_time <= w.work_end
      end
    )

    -- Max orders for deadline day.
    and (
      select count(*)
      from orders o
      where o.worker_id = w.id
        and o.status <> 'cancelled'
        and o.deadline >= v_day_start
        and o.deadline < v_day_end
    ) < w.max_orders_per_day

    -- Max pages for deadline day.
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

  -- Rotation:
  -- worker who hasn't received an order recently gets priority.
  order by
    w.last_assigned_at nulls first,
    w.id

  limit 1
  for update of w skip locked;

  -- This should normally NOT happen once customer-side
  -- availability checking is added.
  if v_worker is null then
    return null;
  end if;

  update orders
  set
    worker_id = v_worker,
    status = 'assigned',
    assigned_at = now()
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
    'worker ' || v_worker || ' for deadline slot ' ||
      (v_deadline at time zone 'Asia/Kuala_Lumpur')::text
  );

  return v_worker;
end;
$$;


-- =========================================================
-- 3. Security
-- =========================================================

revoke all on function slot_has_capacity(timestamptz, int)
from public, anon, authenticated;

revoke all on function assign_order(uuid, bigint)
from public, anon, authenticated;