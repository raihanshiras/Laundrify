-- Laundrify order workflow: atomic order creation, status history, and safe payment recording.
-- Apply after 0001_initial_schema.sql in Supabase SQL Editor.

create table if not exists public.shop_order_counters (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  next_number bigint not null default 0 check (next_number >= 0)
);

alter table public.shop_order_counters enable row level security;
revoke all on public.shop_order_counters from anon, authenticated;

-- Order header + all line items + initial payment + initial history are committed together.
create or replace function public.create_shop_order(
  p_shop_id uuid,
  p_customer_id uuid,
  p_due_at timestamptz default null,
  p_notes text default null,
  p_discount_amount numeric default 0,
  p_items jsonb default '[]'::jsonb,
  p_initial_payment numeric default 0,
  p_payment_method public.payment_method default 'cash'
)
returns table(created_order_id uuid, created_order_code text, created_total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_item jsonb;
  v_item_name text;
  v_pricing public.pricing_type;
  v_quantity numeric;
  v_unit_price numeric;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := coalesce(p_discount_amount, 0);
  v_total numeric(12,2);
  v_sequence bigint;
  v_order_id uuid;
  v_order_code text;
  v_initial_payment numeric(12,2) := coalesce(p_initial_payment, 0);
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not public.is_shop_member(p_shop_id) then raise exception 'You do not have access to this shop'; end if;
  if not exists (
    select 1 from public.customers c where c.id = p_customer_id and c.shop_id = p_shop_id
  ) then raise exception 'Choose a customer from this shop'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'An order must contain between 1 and 30 items';
  end if;
  if v_discount < 0 then raise exception 'Discount cannot be negative'; end if;
  if v_initial_payment < 0 then raise exception 'Initial payment cannot be negative'; end if;

  for v_item in select value from jsonb_array_elements(p_items) as entries(value)
  loop
    v_item_name := trim(coalesce(v_item->>'item_name', ''));
    if char_length(v_item_name) < 1 or char_length(v_item_name) > 120 then
      raise exception 'Each item needs a name of 1 to 120 characters';
    end if;
    if coalesce(v_item->>'pricing', '') not in ('per_piece', 'per_kg', 'fixed') then
      raise exception 'Choose a valid pricing type for every item';
    end if;
    v_pricing := (v_item->>'pricing')::public.pricing_type;
    v_quantity := nullif(v_item->>'quantity', '')::numeric;
    v_unit_price := nullif(v_item->>'unit_price', '')::numeric;
    if v_quantity is null or v_quantity <= 0 or v_quantity > 1000000 then
      raise exception 'Item quantity must be greater than zero';
    end if;
    if v_pricing = 'per_piece' and v_quantity <> trunc(v_quantity) then
      raise exception 'Per-piece item quantities must be whole numbers';
    end if;
    if v_unit_price is null or v_unit_price < 0 or v_unit_price > 1000000 then
      raise exception 'Item price must be between zero and 1,000,000';
    end if;
    v_subtotal := v_subtotal + round(v_quantity * v_unit_price, 2);
  end loop;

  if v_discount > v_subtotal then raise exception 'Discount cannot exceed the order subtotal'; end if;
  v_total := v_subtotal - v_discount;
  if v_initial_payment > v_total then raise exception 'Initial payment cannot exceed the order total'; end if;

  insert into public.shop_order_counters(shop_id, next_number)
  values (p_shop_id, 1)
  on conflict (shop_id) do update
    set next_number = public.shop_order_counters.next_number + 1
  returning next_number into v_sequence;

  v_order_code := 'LD-' || lpad(v_sequence::text, 5, '0');

  insert into public.orders(
    shop_id, customer_id, shop_order_number, status, due_at, notes,
    subtotal, discount_amount, total_amount, created_by
  ) values (
    p_shop_id, p_customer_id, v_order_code, 'received', p_due_at,
    nullif(trim(coalesce(p_notes, '')), ''), v_subtotal, v_discount, v_total, v_user_id
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items) as entries(value)
  loop
    insert into public.order_items(
      shop_id, order_id, item_name, pricing, quantity, unit_price, line_total,
      garment_tag, notes
    ) values (
      p_shop_id, v_order_id, trim(v_item->>'item_name'),
      (v_item->>'pricing')::public.pricing_type,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      round((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric, 2),
      nullif(trim(coalesce(v_item->>'garment_tag', '')), ''),
      nullif(trim(coalesce(v_item->>'notes', '')), '')
    );
  end loop;

  insert into public.order_status_history(shop_id, order_id, old_status, new_status, note, changed_by)
  values (p_shop_id, v_order_id, null, 'received', 'Order created', v_user_id);

  if v_initial_payment > 0 then
    insert into public.payments(shop_id, order_id, kind, method, amount, notes, recorded_by)
    values (p_shop_id, v_order_id, 'payment', p_payment_method, v_initial_payment,
      'Initial payment at order creation', v_user_id);
  end if;

  return query select v_order_id, v_order_code, v_total;
end;
$$;

-- Status transitions are explicit and each change is logged in the same transaction.
create or replace function public.update_shop_order_status(
  p_shop_id uuid,
  p_order_id uuid,
  p_new_status public.order_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_old_status public.order_status;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not public.is_shop_member(p_shop_id) then raise exception 'You do not have access to this shop'; end if;

  select o.status into v_old_status
  from public.orders o
  where o.id = p_order_id and o.shop_id = p_shop_id
  for update;

  if not found then raise exception 'Order not found'; end if;
  if v_old_status = p_new_status then raise exception 'Order already has this status'; end if;

  if not (
    (v_old_status = 'received' and p_new_status in ('processing','cancelled')) or
    (v_old_status = 'processing' and p_new_status in ('ready','cancelled')) or
    (v_old_status = 'ready' and p_new_status in ('delivered','processing'))
  ) then
    raise exception 'This status change is not allowed';
  end if;

  update public.orders o
  set status = p_new_status,
      ready_at = case when p_new_status = 'ready' then now() else o.ready_at end,
      delivered_at = case when p_new_status = 'delivered' then now() else o.delivered_at end,
      updated_at = now()
  where o.id = p_order_id and o.shop_id = p_shop_id;

  insert into public.order_status_history(shop_id, order_id, old_status, new_status, note, changed_by)
  values (p_shop_id, p_order_id, v_old_status, p_new_status,
    nullif(trim(coalesce(p_note, '')), ''), v_user_id);
end;
$$;

-- Payments are append-only and may not exceed the outstanding balance.
create or replace function public.record_shop_order_payment(
  p_shop_id uuid,
  p_order_id uuid,
  p_amount numeric,
  p_method public.payment_method,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_total numeric(12,2);
  v_paid numeric(12,2);
  v_payment_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not public.is_shop_member(p_shop_id) then raise exception 'You do not have access to this shop'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment must be greater than zero'; end if;

  select o.total_amount into v_total
  from public.orders o
  where o.id = p_order_id and o.shop_id = p_shop_id
  for update;
  if not found then raise exception 'Order not found'; end if;

  select coalesce(sum(case when p.kind = 'refund' then -p.amount else p.amount end), 0)
  into v_paid from public.payments p where p.shop_id = p_shop_id and p.order_id = p_order_id;

  if p_amount > v_total - v_paid then
    raise exception 'Payment cannot exceed the outstanding balance of %', greatest(v_total - v_paid, 0);
  end if;

  insert into public.payments(shop_id, order_id, kind, method, amount, notes, recorded_by)
  values (p_shop_id, p_order_id, 'payment', p_method, round(p_amount, 2),
    nullif(trim(coalesce(p_notes, '')), ''), v_user_id)
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

revoke all on function public.create_shop_order(uuid, uuid, timestamptz, text, numeric, jsonb, numeric, public.payment_method) from public;
revoke all on function public.update_shop_order_status(uuid, uuid, public.order_status, text) from public;
revoke all on function public.record_shop_order_payment(uuid, uuid, numeric, public.payment_method, text) from public;
grant execute on function public.create_shop_order(uuid, uuid, timestamptz, text, numeric, jsonb, numeric, public.payment_method) to authenticated;
grant execute on function public.update_shop_order_status(uuid, uuid, public.order_status, text) to authenticated;
grant execute on function public.record_shop_order_payment(uuid, uuid, numeric, public.payment_method, text) to authenticated;

-- Direct authenticated writes are disabled for data that must be changed transactionally.
drop policy if exists "Members can create orders" on public.orders;
drop policy if exists "Members can update orders" on public.orders;
drop policy if exists "Members can create order items" on public.order_items;
drop policy if exists "Members can update order items" on public.order_items;
drop policy if exists "Members can add order history" on public.order_status_history;
revoke insert, update on public.orders from authenticated;
revoke insert, update on public.order_items from authenticated;
revoke insert on public.order_status_history from authenticated;
revoke insert on public.payments from authenticated;

-- Avoid duplicate customer records being created with arbitrary client-side writes;
-- customer creation remains available, but order-specific payment records use the RPC above.
