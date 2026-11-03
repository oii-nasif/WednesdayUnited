-- Cash handed to a moderator for a fund. Staff record it as an already-verified donation payment on the donor's behalf,
-- so it counts toward the goal, shows in donation_activity and in the donor's payment history like any other donation.
-- The submission trigger only lets players file their own pending payments; record_cash_donation sets a
-- transaction-local flag that, together with a staff caller, lets this one insert through.
CREATE OR REPLACE FUNCTION public.validate_payment_submission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE required_amount numeric; match_state public.match_status; needs_payment boolean;
BEGIN
 IF current_setting('app.staff_cash_donation', true) = 'on' AND public.is_staff(auth.uid()) AND NEW.purpose = 'donation' AND NEW.status = 'verified' AND NEW.reviewed_by = auth.uid() THEN
  RETURN NEW;
 END IF;
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

-- Same amount limit as record_adjustment: cash isn't bound by the ৳2000 per-transfer cap.
CREATE FUNCTION public.record_cash_donation(_goal_id uuid, _player_id uuid, _amount numeric, _note text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid := gen_random_uuid();
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only moderators can record cash donations'; END IF;
 IF _amount IS NULL OR _amount = 'NaN'::numeric OR _amount <= 0 OR _amount > 100000 OR round(_amount, 2) <> _amount THEN RAISE EXCEPTION 'Enter an amount above zero up to 100,000 with at most two decimals'; END IF;
 IF length(coalesce(_note, '')) > 500 THEN RAISE EXCEPTION 'Keep the note under 500 characters'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _player_id) THEN RAISE EXCEPTION 'Player not found'; END IF;
 PERFORM 1 FROM public.donation_goals WHERE id = _goal_id AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This fund is no longer collecting'; END IF;
 PERFORM set_config('app.staff_cash_donation', 'on', true);
 INSERT INTO public.payments(id, user_id, purpose, goal_id, amount, transaction_id, status, review_note, reviewed_by, reviewed_at)
 VALUES (new_id, _player_id, 'donation', _goal_id, _amount, 'CASH-' || upper(left(replace(new_id::text, '-', ''), 10)), 'verified',
         coalesce(nullif(trim(_note), ''), 'Cash received'), auth.uid(), now());
 PERFORM set_config('app.staff_cash_donation', 'off', true);
 UPDATE public.donation_goals SET collected_amount = collected_amount + _amount WHERE id = _goal_id;
 RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.record_cash_donation(uuid, uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_cash_donation(uuid, uuid, numeric, text) TO authenticated;
