ALTER POLICY "Eligible players read payment QR" ON storage.objects TO authenticated USING (
  bucket_id = 'payment-qr-codes'
  AND (SELECT auth.uid()) IS NOT NULL
  AND (
    public.is_staff((SELECT auth.uid()))
    OR public.is_approved((SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.registrations r WHERE r.user_id = (SELECT auth.uid()))
  )
  AND EXISTS (SELECT 1 FROM public.payment_settings s WHERE s.qr_code_path = storage.objects.name)
);
COMMENT ON POLICY "Eligible players read payment QR" ON storage.objects IS 'Shared team payment QR: explicitly checks caller eligibility matching payment settings; never grants access to other uploaded objects.';