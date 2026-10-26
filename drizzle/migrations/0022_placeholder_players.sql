-- Placeholder players: members staff add before they have signed up. They have no auth account, can be put on team
-- sheets, charged and credited like anyone else, and are merged into the real account once the person signs up.

ALTER TABLE public.profiles
  ADD COLUMN placeholder boolean NOT NULL DEFAULT false,
  ADD COLUMN phone text CHECK (phone IS NULL OR length(phone) BETWEEN 1 AND 30);

-- A profile no longer has to be an auth user. The trigger below keeps real profiles tied to one.
DO $$
DECLARE c text;
BEGIN
 SELECT conname INTO c FROM pg_constraint
 WHERE conrelid = 'public.profiles'::regclass AND contype = 'f' AND confrelid = 'auth.users'::regclass
   AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.profiles'::regclass AND attname = 'id')];
 IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c); END IF;
END $$;

CREATE FUNCTION public.require_account_for_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT NEW.placeholder AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id) THEN
  RAISE EXCEPTION 'A profile belongs to a signed-up account or is a placeholder';
 END IF;
 IF TG_OP = 'UPDATE' AND NEW.placeholder IS DISTINCT FROM OLD.placeholder THEN
  RAISE EXCEPTION 'A placeholder is merged into an account, not converted';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.require_account_for_profile() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER require_account_for_profile BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.require_account_for_profile();

-- Replaces the cascade the dropped foreign key provided.
CREATE FUNCTION public.handle_deleted_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 DELETE FROM public.profiles WHERE id = OLD.id;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.handle_deleted_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_deleted AFTER DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_user();

-- Staff add a member who has not signed up. Approved straight away, since staff vouch for them by adding them.
CREATE FUNCTION public.create_placeholder_player(_full_name text, _phone text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid := gen_random_uuid(); nm text := nullif(trim(_full_name), ''); ph text := nullif(trim(_phone), '');
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only moderators can add members'; END IF;
 IF nm IS NULL OR length(nm) < 2 OR length(nm) > 80 THEN RAISE EXCEPTION 'Enter a name between 2 and 80 characters'; END IF;
 IF ph IS NOT NULL AND (length(ph) > 30 OR ph !~ '^\+?[0-9][0-9 ()-]*$') THEN RAISE EXCEPTION 'Enter a valid phone number'; END IF;
 INSERT INTO public.profiles(id, full_name, phone, placeholder, approval_status, approved_by, approved_at)
 VALUES (new_id, nm, ph, true, 'approved', auth.uid(), now());
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.create_placeholder_player(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_placeholder_player(text, text) TO authenticated;

CREATE FUNCTION public.update_placeholder_player(_player_id uuid, _full_name text, _phone text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text := nullif(trim(_full_name), ''); ph text := nullif(trim(_phone), ''); is_placeholder boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only moderators can edit members'; END IF;
 IF nm IS NULL OR length(nm) < 2 OR length(nm) > 80 THEN RAISE EXCEPTION 'Enter a name between 2 and 80 characters'; END IF;
 IF ph IS NOT NULL AND (length(ph) > 30 OR ph !~ '^\+?[0-9][0-9 ()-]*$') THEN RAISE EXCEPTION 'Enter a valid phone number'; END IF;
 SELECT placeholder INTO is_placeholder FROM public.profiles WHERE id = _player_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
 IF NOT is_placeholder THEN RAISE EXCEPTION 'Signed-up players edit their own profile'; END IF;
 UPDATE public.profiles SET full_name = nm, phone = ph WHERE id = _player_id;
END $$;
REVOKE ALL ON FUNCTION public.update_placeholder_player(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_placeholder_player(uuid, text, text) TO authenticated;

-- Removing a placeholder is only for mistakes: once money has been recorded against them, merge instead.
CREATE FUNCTION public.delete_placeholder_player(_player_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_placeholder boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only moderators can remove members'; END IF;
 SELECT placeholder INTO is_placeholder FROM public.profiles WHERE id = _player_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
 IF NOT is_placeholder THEN RAISE EXCEPTION 'Only members who have not signed up can be removed'; END IF;
 IF EXISTS (SELECT 1 FROM public.ledger_entries WHERE user_id = _player_id) OR EXISTS (SELECT 1 FROM public.payments WHERE user_id = _player_id) THEN
  RAISE EXCEPTION 'This member has balance history. Merge them into their account instead';
 END IF;
 PERFORM set_config('app.match_settlement', 'on', true);
 DELETE FROM public.profiles WHERE id = _player_id;
 PERFORM set_config('app.match_settlement', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.delete_placeholder_player(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_placeholder_player(uuid) TO authenticated;

-- Once the person has signed up and been approved, everything recorded against the placeholder moves to their
-- account in one step: team sheet rows (guests combined where both were on the same sheet), ledger entries, payments
-- and notifications. The placeholder is then deleted. The audit trigger logs every row that moves.
CREATE FUNCTION public.merge_placeholder_player(_placeholder_id uuid, _target_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.profiles; dst public.profiles;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only moderators can merge members'; END IF;
 IF _placeholder_id = _target_id THEN RAISE EXCEPTION 'Choose a different account to merge into'; END IF;
 SELECT * INTO src FROM public.profiles WHERE id = _placeholder_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
 IF NOT src.placeholder THEN RAISE EXCEPTION 'Only members who have not signed up can be merged'; END IF;
 SELECT * INTO dst FROM public.profiles WHERE id = _target_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 IF dst.placeholder THEN RAISE EXCEPTION 'Merge into a signed-up account'; END IF;
 IF NOT public.is_approved(dst.id) THEN RAISE EXCEPTION 'Approve the account before merging into it'; END IF;

 PERFORM set_config('app.match_settlement', 'on', true);
 UPDATE public.registrations t SET guest_count = least(20, t.guest_count + s.guest_count)
 FROM public.registrations s WHERE s.user_id = src.id AND t.user_id = dst.id AND t.match_id = s.match_id;
 DELETE FROM public.registrations s USING public.registrations t WHERE s.user_id = src.id AND t.user_id = dst.id AND t.match_id = s.match_id;
 UPDATE public.registrations SET user_id = dst.id, added_by_staff = true WHERE user_id = src.id;
 UPDATE public.ledger_entries SET user_id = dst.id WHERE user_id = src.id;
 UPDATE public.payments SET user_id = dst.id WHERE user_id = src.id;
 UPDATE public.notifications SET user_id = dst.id WHERE user_id = src.id;
 UPDATE public.notifications SET subject_user_id = dst.id WHERE subject_user_id = src.id;
 DELETE FROM public.profiles WHERE id = src.id;
 PERFORM set_config('app.match_settlement', 'off', true);

 INSERT INTO public.notifications(user_id, kind, title, body, subject_user_id)
 VALUES (dst.id, 'account_merged', 'Your history is linked', 'Games and balance recorded for "' || coalesce(src.full_name, 'you') || '" before you signed up are now on your account.', dst.id);
END $$;
REVOKE ALL ON FUNCTION public.merge_placeholder_player(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_placeholder_player(uuid, uuid) TO authenticated;
