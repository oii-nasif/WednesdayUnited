-- One transfer can carry a donation on top of a match or advance payment. `amount` stays the whole transfer (still
-- capped at ৳2000); `donation_amount` is the part that goes to `goal_id`. review_payment credits the rest to the
-- player's ledger and the donation part to the fund. Donation-only payments keep donation_amount = 0.
ALTER TABLE public.payments ADD COLUMN donation_amount numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.payments ADD CONSTRAINT payments_donation_amount_check
 CHECK (donation_amount <> 'NaN'::numeric AND donation_amount >= 0 AND donation_amount < amount);

ALTER TABLE public.payments DROP CONSTRAINT payments_purpose_target_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_purpose_target_check CHECK (
 (purpose = 'match' AND match_id IS NOT NULL AND (goal_id IS NULL) = (donation_amount = 0))
 OR (purpose = 'advance' AND match_id IS NULL AND (goal_id IS NULL) = (donation_amount = 0))
 OR (purpose = 'donation' AND match_id IS NULL AND goal_id IS NOT NULL AND donation_amount = 0));

CREATE OR REPLACE FUNCTION public.validate_payment_submission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE required_amount numeric; match_state public.match_status; needs_payment boolean;
BEGIN
 IF auth.uid() IS NULL OR NEW.user_id <> auth.uid() OR NEW.status <> 'pending' THEN RAISE EXCEPTION 'Sign in to submit your own payment'; END IF;
 IF NOT public.is_approved(auth.uid()) THEN RAISE EXCEPTION 'Your account needs squad approval before you can send payments'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.payment_settings) THEN RAISE EXCEPTION 'Bank details have not been configured'; END IF;
 IF NEW.amount = 'NaN'::numeric OR NEW.amount <= 0 OR NEW.amount > 2000 THEN RAISE EXCEPTION 'A single payment can be at most ৳2000'; END IF;
 IF NEW.purpose = 'match' THEN
  SELECT m.status, m.prepayment_required, coalesce(m.prepayment_amount,0) * (1 + r.guest_count) INTO match_state, needs_payment, required_amount FROM public.matches m JOIN public.registrations r ON r.match_id = m.id AND r.user_id = NEW.user_id WHERE m.id = NEW.match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Join this match before submitting a payment'; END IF;
  IF match_state NOT IN ('published','completed') THEN RAISE EXCEPTION 'Payments are not accepted for this match'; END IF;
  -- The donation part never counts toward the prepayment.
  IF needs_payment AND match_state = 'published' AND NEW.amount - NEW.donation_amount < least(required_amount, 2000) THEN RAISE EXCEPTION 'Payment must cover you and your guests'; END IF;
 END IF;
 IF NEW.goal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.donation_goals WHERE id = NEW.goal_id AND active) THEN RAISE EXCEPTION 'This fund is no longer collecting'; END IF;
 IF NEW.receipt_path IS NOT NULL THEN
   IF split_part(NEW.receipt_path, '/', 1) <> NEW.user_id::text OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'payment-receipts' AND name = NEW.receipt_path) THEN RAISE EXCEPTION 'Invalid payment screenshot'; END IF;
 END IF;
 NEW.transaction_id := trim(NEW.transaction_id);
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.review_payment(payment_id uuid, decision text, note text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.payments;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only moderators can review payments'; END IF;
 IF decision NOT IN ('verified','rejected') THEN RAISE EXCEPTION 'Invalid payment decision'; END IF;
 IF length(coalesce(note,'')) > 1000 THEN RAISE EXCEPTION 'Review note is too long'; END IF;
 IF decision = 'rejected' AND length(trim(coalesce(note,''))) = 0 THEN RAISE EXCEPTION 'Provide a rejection reason'; END IF;
 SELECT * INTO p FROM public.payments WHERE id = payment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
 IF p.status <> 'pending' THEN RAISE EXCEPTION 'This payment has already been reviewed'; END IF;
 IF decision = 'verified' AND (p.amount = 'NaN'::numeric OR p.amount <= 0) THEN RAISE EXCEPTION 'This payment amount is invalid. Reject it and ask the player to resubmit'; END IF;
 UPDATE public.payments SET status = decision, review_note = nullif(trim(note),''), reviewed_by = auth.uid(), reviewed_at = now() WHERE id = payment_id;
 IF decision = 'verified' THEN
  IF p.purpose = 'donation' THEN
   UPDATE public.donation_goals SET collected_amount = collected_amount + p.amount WHERE id = p.goal_id;
  ELSE
   INSERT INTO public.ledger_entries(user_id, kind, amount, match_id, payment_id, note, created_by)
   VALUES (p.user_id, 'payment', p.amount - p.donation_amount, p.match_id, p.id, 'Payment ' || p.transaction_id, auth.uid());
   IF p.donation_amount > 0 THEN
    UPDATE public.donation_goals SET collected_amount = collected_amount + p.donation_amount WHERE id = p.goal_id;
   END IF;
  END IF;
 END IF;
END $$;

-- Count donations added to other payments too: any payment with a goal donated to it.
CREATE OR REPLACE FUNCTION public.donation_activity(_goal_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 WITH d AS (
  SELECT p.user_id, CASE WHEN p.purpose = 'donation' THEN p.amount ELSE p.donation_amount END AS amount, coalesce(p.reviewed_at, p.created_at) AS at
  FROM public.payments p WHERE p.goal_id = _goal_id AND p.status = 'verified'
 )
 SELECT CASE WHEN auth.uid() IS NULL OR NOT (public.is_approved(auth.uid()) OR public.is_staff(auth.uid())) THEN NULL ELSE jsonb_build_object(
  'donor_count', (SELECT count(DISTINCT d.user_id) FROM d),
  'donation_count', (SELECT count(*) FROM d),
  'week_amount', (SELECT coalesce(sum(d.amount), 0) FROM d WHERE d.at > now() - interval '7 days'),
  'recent', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', r.full_name, 'avatar_url', r.avatar_url, 'amount', r.amount, 'at', r.at) ORDER BY r.at DESC), '[]'::jsonb)
            FROM (SELECT pd.full_name, pd.avatar_url, d.amount, d.at FROM d LEFT JOIN public.player_directory pd ON pd.id = d.user_id ORDER BY d.at DESC LIMIT 6) r)
 ) END
$$;
REVOKE ALL ON FUNCTION public.donation_activity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.donation_activity(uuid) TO authenticated;
