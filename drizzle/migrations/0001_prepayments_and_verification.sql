CREATE TABLE public.payment_settings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 singleton boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton),
 bank_name text NOT NULL CHECK (length(trim(bank_name)) BETWEEN 1 AND 120),
 account_name text NOT NULL CHECK (length(trim(account_name)) BETWEEN 1 AND 120),
 account_number text NOT NULL CHECK (length(trim(account_number)) BETWEEN 1 AND 120),
 instructions text NOT NULL DEFAULT '' CHECK (length(instructions) <= 2000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payment_settings TO authenticated;
GRANT ALL ON public.payment_settings TO service_role;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read payment instructions" ON public.payment_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin creates payment instructions" ON public.payment_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Super admin edits payment instructions" ON public.payment_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin')) WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER audit_payment_settings AFTER INSERT OR UPDATE OR DELETE ON public.payment_settings FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TABLE public.payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id),
 match_id uuid NOT NULL REFERENCES public.matches(id),
 amount numeric(12,2) NOT NULL CHECK (amount > 0),
 transaction_id text NOT NULL CHECK (length(trim(transaction_id)) BETWEEN 1 AND 120),
 receipt_path text,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
 review_note text CHECK (length(review_note) <= 1000),
 reviewed_by uuid REFERENCES public.profiles(id),
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_note IS NULL) OR (status <> 'pending' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
 CHECK (status <> 'rejected' OR length(trim(review_note)) > 0)
);
CREATE UNIQUE INDEX payments_transaction_unique ON public.payments (lower(trim(transaction_id)));
CREATE INDEX payments_owner_created ON public.payments(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and staff read payments" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "Players submit pending payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_note IS NULL);

CREATE FUNCTION public.validate_payment_submission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE required_amount numeric; match_state public.match_status; needs_payment boolean;
BEGIN
 IF auth.uid() IS NULL OR NEW.user_id <> auth.uid() OR NEW.status <> 'pending' THEN RAISE EXCEPTION 'Sign in to submit your own payment'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.payment_settings) THEN RAISE EXCEPTION 'Bank details have not been configured'; END IF;
 SELECT m.status, m.prepayment_required, coalesce(m.prepayment_amount,0) * (1 + r.guest_count) INTO match_state, needs_payment, required_amount FROM public.matches m JOIN public.registrations r ON r.match_id = m.id AND r.user_id = NEW.user_id WHERE m.id = NEW.match_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Join this match before submitting a payment'; END IF;
 IF match_state NOT IN ('published','completed') THEN RAISE EXCEPTION 'Payments are not accepted for this match'; END IF;
 IF needs_payment AND NEW.amount < required_amount THEN RAISE EXCEPTION 'Payment must cover you and your guests'; END IF;
 IF NEW.receipt_path IS NOT NULL THEN
   IF split_part(NEW.receipt_path, '/', 1) <> NEW.user_id::text OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'payment-receipts' AND name = NEW.receipt_path) THEN RAISE EXCEPTION 'Invalid payment screenshot'; END IF;
 END IF;
 NEW.transaction_id := trim(NEW.transaction_id);
 RETURN NEW;
END $$;
CREATE TRIGGER validate_payment BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.validate_payment_submission();
CREATE TRIGGER audit_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE FUNCTION public.review_payment(payment_id uuid, decision text, note text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_state text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only moderators can review payments'; END IF;
 IF decision NOT IN ('verified','rejected') THEN RAISE EXCEPTION 'Invalid payment decision'; END IF;
 IF length(coalesce(note,'')) > 1000 THEN RAISE EXCEPTION 'Review note is too long'; END IF;
 IF decision = 'rejected' AND length(trim(coalesce(note,''))) = 0 THEN RAISE EXCEPTION 'Provide a rejection reason'; END IF;
 SELECT status INTO current_state FROM public.payments WHERE id = payment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
 IF current_state <> 'pending' THEN RAISE EXCEPTION 'This payment has already been reviewed'; END IF;
 UPDATE public.payments SET status = decision, review_note = nullif(trim(note),''), reviewed_by = auth.uid(), reviewed_at = now() WHERE id = payment_id;
END $$;
REVOKE ALL ON FUNCTION public.review_payment(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_payment(uuid,text,text) TO authenticated;

CREATE POLICY "Owners upload payment screenshots" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text AND lower(storage.extension(name)) IN ('png','jpg','jpeg','webp'));
CREATE POLICY "Owners and staff read payment screenshots" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_staff(auth.uid())));
CREATE POLICY "Owners remove unattached screenshots" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'payment-receipts' AND (storage.foldername(name))[1] = auth.uid()::text AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.receipt_path = name));