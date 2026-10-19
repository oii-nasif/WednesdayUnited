DROP POLICY IF EXISTS "Players read payment instructions" ON public.payment_settings;
CREATE POLICY "Players read payment instructions" ON public.payment_settings
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()) OR public.is_approved(auth.uid()) OR EXISTS (SELECT 1 FROM public.registrations r WHERE r.user_id = auth.uid()));