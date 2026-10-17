CREATE TABLE public.notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 kind text NOT NULL,
 title text NOT NULL,
 body text NOT NULL,
 match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
 subject_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 read_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX notifications_owner_created ON public.notifications(user_id, created_at DESC);
CREATE OR REPLACE FUNCTION public.mark_notifications_read(notification_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to read notifications'; END IF;
 UPDATE public.notifications SET read_at = now() WHERE user_id = auth.uid() AND read_at IS NULL AND (notification_id IS NULL OR id = notification_id);
END $$;
REVOKE ALL ON FUNCTION public.mark_notifications_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.set_player_role(player_id uuid, new_role text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Only super admins can change roles'; END IF;
 IF new_role NOT IN ('player','moderator') THEN RAISE EXCEPTION 'Choose player or moderator'; END IF;
 PERFORM 1 FROM public.profiles WHERE id = player_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Player not found'; END IF;
 IF public.has_role(player_id, 'super_admin') THEN RAISE EXCEPTION 'Super admin accounts are protected'; END IF;
 INSERT INTO public.user_roles(user_id, role) VALUES (player_id, 'player') ON CONFLICT (user_id, role) DO NOTHING;
 IF new_role = 'moderator' THEN
  INSERT INTO public.user_roles(user_id, role) VALUES (player_id, 'moderator') ON CONFLICT (user_id, role) DO NOTHING;
 ELSE
  DELETE FROM public.user_roles WHERE user_id = player_id AND role = 'moderator';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_player_role(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_player_role(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.notify_match_published() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status = 'draft') THEN
  INSERT INTO public.notifications(user_id, kind, title, body, match_id)
  SELECT id, 'match_published', 'New match: ' || NEW.title, 'A new match is open for registration.', NEW.id FROM public.profiles;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notify_published_match AFTER INSERT OR UPDATE OF status ON public.matches FOR EACH ROW EXECUTE FUNCTION public.notify_match_published();
CREATE OR REPLACE FUNCTION public.notify_player_approval() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NEW.approval_status = 'pending' THEN
   INSERT INTO public.notifications(user_id, kind, title, body, subject_user_id)
   SELECT DISTINCT user_id, 'approval_pending', 'Player awaiting approval', coalesce(NEW.full_name, 'A new player') || ' is waiting for squad approval.', NEW.id
   FROM public.user_roles WHERE role IN ('moderator','super_admin');
  END IF;
 ELSIF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
  INSERT INTO public.notifications(user_id, kind, title, body, subject_user_id)
  VALUES (NEW.id, 'approval_decision', 'Squad approval updated', 'Your squad approval is now ' || NEW.approval_status || '.', NEW.id);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notify_approval_change AFTER INSERT OR UPDATE OF approval_status ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.notify_player_approval();
INSERT INTO public.notifications(user_id,kind,title,body,subject_user_id)
SELECT DISTINCT r.user_id, 'approval_pending', 'Player awaiting approval', coalesce(p.full_name,'A new player') || ' is waiting for squad approval.', p.id
FROM public.profiles p CROSS JOIN public.user_roles r WHERE p.approval_status = 'pending' AND r.role IN ('moderator','super_admin');
REVOKE ALL ON FUNCTION public.notify_match_published() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_player_approval() FROM PUBLIC, anon, authenticated;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;