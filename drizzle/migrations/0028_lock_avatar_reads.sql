-- Lock avatar reads to the file's owner and staff. Photos are still shown to everyone: signed links are
-- now created by the app's server (avatar-sign), which checks the same visibility public match pages use.
DROP POLICY "Anyone reads profile photos" ON storage.objects;
CREATE POLICY "Owners and staff read profile photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_staff(auth.uid())));