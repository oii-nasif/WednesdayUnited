ALTER TABLE public.profiles
  ADD COLUMN approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN approved_at timestamptz;

UPDATE public.profiles SET approval_status = 'approved';

ALTER TABLE public.profiles ADD CONSTRAINT profiles_approval_status_check
  CHECK (approval_status IN ('pending','approved','rejected'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare is_super boolean := lower(new.email) = 'nasif.bs1062@gmail.com';
begin
  insert into public.user_roles(user_id, role) values (new.id, 'player');
  if is_super then
    insert into public.user_roles(user_id, role) values (new.id,'moderator'),(new.id,'super_admin');
  end if;
  insert into public.profiles(id, full_name, email, avatar_url, approval_status, approved_at)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.email, new.raw_user_meta_data->>'avatar_url',
    case when is_super or public.is_staff(new.id) then 'approved' else 'pending' end,
    case when is_super or public.is_staff(new.id) then now() end);
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select exists(select 1 from public.profiles where id=_user_id and approval_status='approved')
    or public.is_staff(_user_id)
$$;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated, anon;

DROP POLICY IF EXISTS "join open match" ON public.registrations;
CREATE POLICY "join open match" ON public.registrations FOR INSERT TO authenticated
WITH CHECK (((auth.uid() = user_id) AND (added_by_staff = false) AND public.is_approved(auth.uid()) AND (EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.id = registrations.match_id) AND (m.status = 'published'::match_status) AND ((m.registration_deadline IS NULL) OR (m.registration_deadline > now())))))) OR is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.protect_profile_approval()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if (new.approval_status is distinct from old.approval_status
      or new.approved_by is distinct from old.approved_by
      or new.approved_at is distinct from old.approved_at)
     and coalesce(current_setting('app.approval_decision', true), '') <> 'on' then
    raise exception 'Approval can only be changed by staff';
  end if;
  return new;
end $$;
CREATE TRIGGER protect_profile_approval BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_approval();

CREATE OR REPLACE FUNCTION public.decide_player_approval(player_id uuid, decision text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if auth.uid() is null or not public.is_staff(auth.uid()) then raise exception 'Only staff can approve players'; end if;
  if decision not in ('approved','rejected') then raise exception 'Invalid approval decision'; end if;
  if public.is_staff(player_id) then raise exception 'Staff approval cannot be changed'; end if;
  perform 1 from public.profiles where id = player_id for update;
  if not found then raise exception 'Player not found'; end if;
  perform set_config('app.approval_decision', 'on', true);
  update public.profiles set approval_status = decision, approved_by = auth.uid(), approved_at = now() where id = player_id;
  perform set_config('app.approval_decision', 'off', true);
end $$;
REVOKE ALL ON FUNCTION public.decide_player_approval(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.decide_player_approval(uuid, text) TO authenticated;

DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();