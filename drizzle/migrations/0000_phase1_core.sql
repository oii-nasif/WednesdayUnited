create type public.app_role as enum ('player','moderator','super_admin');
create type public.match_status as enum ('draft','published','completed','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant select on public.profiles to anon;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role in ('moderator','super_admin'))
$$;

-- profiles: public display (name/avatar) readable; only own update
create policy "profiles readable" on public.profiles for select using (true);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid()=id) with check (auth.uid()=id);
-- hide email from anon via column grants
revoke select on public.profiles from anon;
grant select (id, full_name, avatar_url) on public.profiles to anon;

create policy "own roles or staff" on public.user_roles for select to authenticated using (auth.uid()=user_id or public.is_staff(auth.uid()));
create policy "admin manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));
grant insert, delete on public.user_roles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, new.raw_user_meta_data->>'avatar_url');
  insert into public.user_roles(user_id, role) values (new.id, 'player');
  if lower(new.email) = 'nasif.bs1062@gmail.com' then
    insert into public.user_roles(user_id, role) values (new.id,'moderator'),(new.id,'super_admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  area text,
  maps_url text,
  created_at timestamptz not null default now()
);
grant select on public.locations to anon, authenticated;
grant insert, update, delete on public.locations to authenticated;
grant all on public.locations to service_role;
alter table public.locations enable row level security;
create policy "locations public" on public.locations for select using (true);
create policy "admin manage locations" on public.locations for all to authenticated using (public.has_role(auth.uid(),'super_admin')) with check (public.has_role(auth.uid(),'super_admin'));

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  location_id uuid references public.locations(id),
  description text,
  registration_deadline timestamptz,
  player_limit int,
  prepayment_required boolean not null default false,
  prepayment_amount numeric(10,2),
  status match_status not null default 'draft',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.matches to anon, authenticated;
grant insert, update, delete on public.matches to authenticated;
grant all on public.matches to service_role;
alter table public.matches enable row level security;
create policy "visible matches" on public.matches for select using (status <> 'draft' or public.is_staff(auth.uid()));
create policy "staff manage matches" on public.matches for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  guest_count int not null default 0 check (guest_count >= 0 and guest_count <= 20),
  added_by_staff boolean not null default false,
  created_at timestamptz not null default now(),
  unique(match_id, user_id)
);
grant select on public.registrations to anon, authenticated;
grant insert, update, delete on public.registrations to authenticated;
grant all on public.registrations to service_role;
alter table public.registrations enable row level security;
create policy "registrations visible" on public.registrations for select using (exists(select 1 from public.matches m where m.id=match_id and m.status<>'draft') or public.is_staff(auth.uid()));
create policy "join open match" on public.registrations for insert to authenticated with check (
  (auth.uid()=user_id and added_by_staff=false and exists(select 1 from public.matches m where m.id=match_id and m.status='published' and (m.registration_deadline is null or m.registration_deadline>now())))
  or public.is_staff(auth.uid()));
create policy "update own open" on public.registrations for update to authenticated using (
  (auth.uid()=user_id and exists(select 1 from public.matches m where m.id=match_id and m.status='published' and (m.registration_deadline is null or m.registration_deadline>now())))
  or public.is_staff(auth.uid()));
create policy "leave own open" on public.registrations for delete to authenticated using (
  (auth.uid()=user_id and exists(select 1 from public.matches m where m.id=match_id and m.status='published' and (m.registration_deadline is null or m.registration_deadline>now())))
  or public.is_staff(auth.uid()));

-- player limit enforcement
create or replace function public.check_player_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim int; total int;
begin
  select player_limit into lim from public.matches where id=new.match_id;
  if lim is null or public.is_staff(auth.uid()) then return new; end if;
  select coalesce(sum(1+guest_count),0) into total from public.registrations where match_id=new.match_id and id<>new.id;
  if total + 1 + new.guest_count > lim then raise exception 'Match is full'; end if;
  return new;
end $$;
create trigger trg_player_limit before insert or update on public.registrations for each row execute function public.check_player_limit();

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "staff read logs" on public.audit_logs for select to authenticated using (public.is_staff(auth.uid()));

create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs(actor_id, action, entity, entity_id, before_data, after_data)
  values (auth.uid(), lower(tg_op), tg_table_name,
    coalesce((case when tg_op='DELETE' then old.id else new.id end)::text, null),
    case when tg_op<>'INSERT' then to_jsonb(old) end,
    case when tg_op<>'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger audit_matches after insert or update or delete on public.matches for each row execute function public.audit_trigger();
create trigger audit_regs after insert or update or delete on public.registrations for each row execute function public.audit_trigger();
create trigger audit_locations after insert or update or delete on public.locations for each row execute function public.audit_trigger();
create trigger audit_roles after insert or update or delete on public.user_roles for each row execute function public.audit_trigger();

insert into public.locations(name, address, area) values
 ('DBOX', 'DBOX Futsal Arena', 'Mirpur'),
 ('Jaff Arena', 'Jaff Arena', 'Dhanmondi');
insert into public.matches(title, starts_at, location_id, description, status)
select 'Wednesday Football', '2026-10-28 15:00:00+00', id, 'Our weekly after-office game. Bring water and good vibes.', 'published' from public.locations where name='DBOX';