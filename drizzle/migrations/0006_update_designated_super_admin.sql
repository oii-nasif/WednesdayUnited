CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $$
DECLARE is_super boolean := lower(new.email) = 'nasif.ishtiaque.islam@gmail.com';
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