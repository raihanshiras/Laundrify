-- Security hardening: membership roles must not be self-assigned or escalated by direct table writes.
-- Shop creation remains available through the SECURITY DEFINER create_shop() RPC.
drop policy if exists "Owners and managers can add members" on public.shop_members;
drop policy if exists "Owners and managers can update members" on public.shop_members;

revoke insert, update, delete on public.shop_members from anon, authenticated;
grant select on public.shop_members to authenticated;

-- No public client should be able to change the ownership audit field directly.
-- Shop profile updates remain supported, but created_by is now immutable to clients.
create or replace function public.prevent_shop_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Shop creator cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists shops_prevent_owner_change on public.shops;
create trigger shops_prevent_owner_change
before update on public.shops
for each row execute function public.prevent_shop_owner_change();

revoke all on function public.prevent_shop_owner_change() from public;
