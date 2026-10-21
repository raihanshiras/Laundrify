-- Laundrify initial schema. Apply in a new Supabase project via SQL Editor.
create extension if not exists pgcrypto;

create type public.shop_member_role as enum ('owner', 'manager', 'staff');
create type public.order_status as enum ('received', 'processing', 'ready', 'delivered', 'cancelled');
create type public.pricing_type as enum ('per_piece', 'per_kg', 'fixed');
create type public.payment_method as enum ('cash', 'upi', 'card', 'bank_transfer', 'other');
create type public.payment_kind as enum ('payment', 'refund');

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text unique,
  phone text,
  address text,
  timezone text not null default 'Asia/Kolkata',
  currency_code text not null default 'INR' check (currency_code = 'INR'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.shop_member_role not null default 'staff',
  created_at timestamptz not null default now(),
  unique (shop_id, user_id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 160),
  phone text not null,
  phone_normalized text not null,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (shop_id, phone_normalized),
  unique (shop_id, id)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  pricing public.pricing_type not null default 'per_piece',
  unit_price numeric(12,2) not null check (unit_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (shop_id, name),
  unique (shop_id, id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null,
  order_number bigint generated always as identity,
  shop_order_number text not null,
  status public.order_status not null default 'received',
  received_at timestamptz not null default now(),
  due_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  notes text,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, shop_order_number),
  unique (shop_id, id),
  constraint orders_customer_same_shop foreign key (shop_id, customer_id)
    references public.customers(shop_id, id) on delete restrict
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_id uuid not null,
  service_id uuid,
  item_name text not null check (char_length(trim(item_name)) between 1 and 120),
  pricing public.pricing_type not null,
  quantity numeric(10,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  garment_tag text,
  notes text,
  created_at timestamptz not null default now(),
  constraint order_items_order_same_shop foreign key (shop_id, order_id)
    references public.orders(shop_id, id) on delete cascade,
  constraint order_items_service_same_shop foreign key (shop_id, service_id)
    references public.services(shop_id, id) on delete restrict
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_id uuid not null,
  kind public.payment_kind not null default 'payment',
  method public.payment_method not null,
  amount numeric(12,2) not null check (amount > 0),
  reference text,
  notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_at timestamptz not null default now(),
  constraint payments_order_same_shop foreign key (shop_id, order_id)
    references public.orders(shop_id, id) on delete restrict
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_id uuid not null,
  old_status public.order_status,
  new_status public.order_status not null,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  constraint order_history_order_same_shop foreign key (shop_id, order_id)
    references public.orders(shop_id, id) on delete cascade
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  description text not null check (char_length(trim(description)) between 1 and 200),
  category text,
  amount numeric(12,2) not null check (amount > 0),
  method public.payment_method not null default 'cash',
  spent_at timestamptz not null default now(),
  notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid,
  order_id uuid,
  channel text not null check (channel in ('whatsapp_redirect', 'whatsapp_cloud_api')),
  message_type text not null,
  outcome text not null default 'prepared' check (outcome in ('prepared', 'sent', 'delivered', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint notification_customer_same_shop foreign key (shop_id, customer_id)
    references public.customers(shop_id, id) on delete restrict,
  constraint notification_order_same_shop foreign key (shop_id, order_id)
    references public.orders(shop_id, id) on delete restrict
);

create index customers_shop_name_idx on public.customers (shop_id, full_name);
create index customers_shop_phone_idx on public.customers (shop_id, phone_normalized);
create index orders_shop_status_idx on public.orders (shop_id, status);
create index orders_shop_received_idx on public.orders (shop_id, received_at desc);
create index orders_shop_due_idx on public.orders (shop_id, due_at);
create index order_items_order_idx on public.order_items (shop_id, order_id);
create index payments_shop_recorded_idx on public.payments (shop_id, recorded_at desc);
create index payments_order_idx on public.payments (shop_id, order_id);
create index expenses_shop_spent_idx on public.expenses (shop_id, spent_at desc);

create or replace function public.is_shop_member(target_shop_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.shop_members m
    where m.shop_id = target_shop_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_shop_role(target_shop_id uuid, allowed_roles public.shop_member_role[])
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.shop_members m
    where m.shop_id = target_shop_id and m.user_id = (select auth.uid())
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_shop_member(uuid) from public;
revoke all on function public.has_shop_role(uuid, public.shop_member_role[]) from public;
grant execute on function public.is_shop_member(uuid) to authenticated;
grant execute on function public.has_shop_role(uuid, public.shop_member_role[]) to authenticated;

create or replace function public.create_shop(shop_name text, shop_phone text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  new_shop_id uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if char_length(trim(shop_name)) < 2 or char_length(trim(shop_name)) > 120 then
    raise exception 'Shop name must be between 2 and 120 characters';
  end if;
  insert into public.shops (name, phone, created_by)
  values (trim(shop_name), nullif(trim(shop_phone), ''), current_user_id)
  returning id into new_shop_id;
  insert into public.shop_members (shop_id, user_id, role)
  values (new_shop_id, current_user_id, 'owner');
  return new_shop_id;
end;
$$;

revoke all on function public.create_shop(text, text) from public;
grant execute on function public.create_shop(text, text) to authenticated;

alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.order_status_history enable row level security;
alter table public.expenses enable row level security;
alter table public.notification_logs enable row level security;

create policy "Members can view their shops" on public.shops for select to authenticated using (public.is_shop_member(id));
create policy "Owners and managers can update shop details" on public.shops for update to authenticated
  using (public.has_shop_role(id, array['owner','manager']::public.shop_member_role[]))
  with check (public.has_shop_role(id, array['owner','manager']::public.shop_member_role[]));
create policy "Members can view shop membership" on public.shop_members for select to authenticated using (public.is_shop_member(shop_id));
create policy "Owners and managers can add members" on public.shop_members for insert to authenticated with check (public.has_shop_role(shop_id, array['owner','manager']::public.shop_member_role[]));
create policy "Owners and managers can update members" on public.shop_members for update to authenticated
  using (public.has_shop_role(shop_id, array['owner','manager']::public.shop_member_role[]))
  with check (public.has_shop_role(shop_id, array['owner','manager']::public.shop_member_role[]));
create policy "Members can read customers" on public.customers for select to authenticated using (public.is_shop_member(shop_id));
create policy "Staff can add customers" on public.customers for insert to authenticated with check (public.is_shop_member(shop_id));
create policy "Staff can update customers" on public.customers for update to authenticated using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy "Members can read services" on public.services for select to authenticated using (public.is_shop_member(shop_id));
create policy "Managers can manage services" on public.services for insert to authenticated with check (public.has_shop_role(shop_id, array['owner','manager']::public.shop_member_role[]));
create policy "Managers can update services" on public.services for update to authenticated using (public.has_shop_role(shop_id, array['owner','manager']::public.shop_member_role[])) with check (public.has_shop_role(shop_id, array['owner','manager']::public.shop_member_role[]));
create policy "Members can read orders" on public.orders for select to authenticated using (public.is_shop_member(shop_id));
create policy "Members can create orders" on public.orders for insert to authenticated with check (public.is_shop_member(shop_id));
create policy "Members can update orders" on public.orders for update to authenticated using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy "Members can read order items" on public.order_items for select to authenticated using (public.is_shop_member(shop_id));
create policy "Members can create order items" on public.order_items for insert to authenticated with check (public.is_shop_member(shop_id));
create policy "Members can update order items" on public.order_items for update to authenticated using (public.is_shop_member(shop_id)) with check (public.is_shop_member(shop_id));
create policy "Members can read payments" on public.payments for select to authenticated using (public.is_shop_member(shop_id));
create policy "Members can record payments" on public.payments for insert to authenticated with check (public.is_shop_member(shop_id));
create policy "Members can read order history" on public.order_status_history for select to authenticated using (public.is_shop_member(shop_id));
create policy "Members can add order history" on public.order_status_history for insert to authenticated with check (public.is_shop_member(shop_id));
create policy "Members can read expenses" on public.expenses for select to authenticated using (public.is_shop_member(shop_id));
create policy "Managers can record expenses" on public.expenses for insert to authenticated with check (public.has_shop_role(shop_id, array['owner','manager']::public.shop_member_role[]));
create policy "Managers can update expenses" on public.expenses for update to authenticated using (public.has_shop_role(shop_id, array['owner','manager']::public.shop_member_role[])) with check (public.has_shop_role(shop_id, array['owner','manager']::public.shop_member_role[]));
create policy "Members can read notification logs" on public.notification_logs for select to authenticated using (public.is_shop_member(shop_id));
create policy "Members can create notification logs" on public.notification_logs for insert to authenticated with check (public.is_shop_member(shop_id));

grant usage on schema public to authenticated;
grant select, update on public.shops to authenticated;
grant select, insert, update on public.shop_members to authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.services to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, insert, update on public.order_items to authenticated;
grant select, insert on public.payments to authenticated;
grant select, insert on public.order_status_history to authenticated;
grant select, insert, update on public.expenses to authenticated;
grant select, insert on public.notification_logs to authenticated;

-- Follow-up migration should add transactional order creation, status-history triggers,
-- immutable financial records, loyalty, branches, and subscription entitlements before launch.
