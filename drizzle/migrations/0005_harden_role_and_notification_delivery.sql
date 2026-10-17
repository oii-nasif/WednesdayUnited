REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM authenticated;
DROP POLICY "admin manage roles" ON public.user_roles;
CREATE UNIQUE INDEX notifications_match_once ON public.notifications(user_id, match_id) WHERE kind = 'match_published' AND match_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.notify_match_published() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published'::public.match_status) THEN
  INSERT INTO public.notifications(user_id, kind, title, body, match_id)
  SELECT id, 'match_published', 'New match: ' || NEW.title, 'A new match is open for registration.', NEW.id FROM public.profiles
  ON CONFLICT (user_id, match_id) WHERE kind = 'match_published' AND match_id IS NOT NULL DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_match_published() FROM PUBLIC, anon, authenticated;