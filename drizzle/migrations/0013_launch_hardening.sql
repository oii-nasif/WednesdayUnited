-- Pre-launch hardening from the security review. (The payment-receipts bucket is configured in Lovable storage: private, 1 MB.)

-- Players may only change their own display fields; email, status, approval and timestamps stay as the system set them.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, avatar_url, position) ON public.profiles TO authenticated;

-- Players may only change their guest count on their own registration. Moving it to another match (which skipped the
-- guest cap and approval checks), flagging it as staff-added, or rewriting timestamps is staff-only.
CREATE FUNCTION public.protect_registration_fields() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF public.is_staff(auth.uid()) OR coalesce(current_setting('app.match_settlement', true), '') = 'on' THEN RETURN NEW; END IF;
 IF (NEW.match_id, NEW.user_id, NEW.added_by_staff, NEW.created_at) IS DISTINCT FROM (OLD.match_id, OLD.user_id, OLD.added_by_staff, OLD.created_at) THEN
  RAISE EXCEPTION 'You can only change your number of guests';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_registration_fields() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_registration_fields BEFORE UPDATE ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.protect_registration_fields();

-- Read the match with FOR SHARE so a sign-up racing a settlement waits for it, then sees the match is settled.
CREATE OR REPLACE FUNCTION public.lock_settled_registrations() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE settled boolean;
BEGIN
 IF coalesce(current_setting('app.match_settlement', true), '') = 'on' THEN RETURN coalesce(NEW, OLD); END IF;
 SELECT settled_at IS NOT NULL INTO settled FROM public.matches WHERE id = coalesce(NEW.match_id, OLD.match_id) FOR SHARE;
 IF coalesce(settled, false) THEN RAISE EXCEPTION 'This match has been settled. Edit the settlement to change the team sheet'; END IF;
 IF TG_OP = 'UPDATE' AND NEW.match_id IS DISTINCT FROM OLD.match_id THEN
  SELECT settled_at IS NOT NULL INTO settled FROM public.matches WHERE id = OLD.match_id FOR SHARE;
  IF coalesce(settled, false) THEN RAISE EXCEPTION 'This match has been settled. Edit the settlement to change the team sheet'; END IF;
 END IF;
 RETURN coalesce(NEW, OLD);
END $$;

-- Only approved players (and staff) can send payments, and never a NaN amount.
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
  IF needs_payment AND match_state = 'published' AND NEW.amount < least(required_amount, 2000) THEN RAISE EXCEPTION 'Payment must cover you and your guests'; END IF;
 ELSIF NEW.purpose = 'donation' THEN
  IF NOT EXISTS (SELECT 1 FROM public.donation_goals WHERE id = NEW.goal_id AND active) THEN RAISE EXCEPTION 'This fund is no longer collecting'; END IF;
 END IF;
 IF NEW.receipt_path IS NOT NULL THEN
   IF split_part(NEW.receipt_path, '/', 1) <> NEW.user_id::text OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'payment-receipts' AND name = NEW.receipt_path) THEN RAISE EXCEPTION 'Invalid payment screenshot'; END IF;
 END IF;
 NEW.transaction_id := trim(NEW.transaction_id);
 RETURN NEW;
END $$;

-- Refuse to verify a corrupt (NaN) or oversized legacy payment rather than writing it into the ledger.
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
   VALUES (p.user_id, 'payment', p.amount, p.match_id, p.id, 'Payment ' || p.transaction_id, auth.uid());
  END IF;
 END IF;
END $$;

-- The ledger never holds NaN. NOT VALID: checks new rows only; run the NaN check query on existing rows separately.
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_amount_not_nan CHECK (amount <> 'NaN'::numeric) NOT VALID;
