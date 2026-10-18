-- Per-match guest cap. Defaults to 5; staff can change it per match.
ALTER TABLE public.matches ADD COLUMN max_guests int NOT NULL DEFAULT 5;
ALTER TABLE public.matches ADD CONSTRAINT matches_max_guests_check CHECK (max_guests BETWEEN 0 AND 20);

-- Only checks new or increased guest counts, so lowering a cap never blocks players who are already over it from reducing.
CREATE OR REPLACE FUNCTION public.check_guest_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cap int;
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.guest_count <= OLD.guest_count THEN RETURN NEW; END IF;
 SELECT max_guests INTO cap FROM public.matches WHERE id = NEW.match_id;
 IF NEW.guest_count > cap THEN RAISE EXCEPTION 'You can bring at most % guests to this match', cap; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.check_guest_limit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_guest_limit BEFORE INSERT OR UPDATE OF guest_count ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.check_guest_limit();

-- Preferred position, editable by the owner through the existing "own profile update" policy.
ALTER TABLE public.profiles ADD COLUMN position text;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_position_check CHECK (position IN ('GK','DEF','MID','FWD','ALL'));

-- Moderators manage venues alongside super admins.
DROP POLICY "admin manage locations" ON public.locations;
CREATE POLICY "staff manage locations" ON public.locations FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- Email/password sign-ups insert into auth.users before the address is confirmed. Only grant the designated
-- super admin roles to a confirmed address (Google sign-ins arrive confirmed), so nobody can claim it by signing up first.
-- Everyone else, SSO or email, starts as a pending player until staff approve them.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE is_super boolean := lower(new.email) = 'nasif.ishtiaque.islam@gmail.com' AND new.email_confirmed_at IS NOT NULL;
BEGIN
 INSERT INTO public.user_roles(user_id, role) VALUES (new.id, 'player');
 IF is_super THEN
  INSERT INTO public.user_roles(user_id, role) VALUES (new.id,'moderator'),(new.id,'super_admin');
 END IF;
 INSERT INTO public.profiles(id, full_name, email, avatar_url, approval_status, approved_at)
 VALUES (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email, new.raw_user_meta_data->>'avatar_url', CASE WHEN is_super OR public.is_staff(new.id) THEN 'approved' ELSE 'pending' END, CASE WHEN is_super OR public.is_staff(new.id) THEN now() END);
 RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
