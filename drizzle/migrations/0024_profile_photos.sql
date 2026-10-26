-- Profile photos. The "avatars" bucket is created in Lovable storage: public, 300 KB limit, JPEG/PNG/WebP only.
-- Photos are public because match pages show participant avatars to anyone through player_directory.
-- Each player writes only inside a folder named after their own user id.
CREATE POLICY "Anyone reads profile photos" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Owners upload profile photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text AND lower(storage.extension(name)) IN ('png', 'jpg', 'jpeg', 'webp'));
CREATE POLICY "Owners replace profile photos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners remove profile photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
