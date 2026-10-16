ALTER POLICY "Players read payment instructions" ON public.payment_settings USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.registrations r WHERE r.user_id = auth.uid()));
ALTER POLICY "locations public" ON public.locations USING (public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.matches m WHERE m.location_id = locations.id AND m.status <> 'draft'));
ALTER POLICY "profiles readable" ON public.profiles TO authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()));
REVOKE SELECT ON public.profiles FROM anon;

CREATE TABLE public.player_directory (
 id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 full_name text,
 avatar_url text
);
GRANT SELECT ON public.player_directory TO anon, authenticated;
GRANT ALL ON public.player_directory TO service_role;
ALTER TABLE public.player_directory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible match participant names and photos" ON public.player_directory FOR SELECT TO anon, authenticated USING (id = auth.uid() OR public.is_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.registrations r JOIN public.matches m ON m.id = r.match_id WHERE r.user_id = player_directory.id AND m.status <> 'draft'));
INSERT INTO public.player_directory(id, full_name, avatar_url) SELECT id, full_name, avatar_url FROM public.profiles;
CREATE FUNCTION public.sync_player_directory() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.player_directory(id, full_name, avatar_url) VALUES (NEW.id, NEW.full_name, NEW.avatar_url)
 ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, avatar_url = EXCLUDED.avatar_url;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_player_directory() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_public_player_identity AFTER INSERT OR UPDATE OF full_name, avatar_url ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_player_directory();