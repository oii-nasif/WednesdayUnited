-- Player balances: an append-only ledger. Verified payments credit it, settled matches debit each player's share.
-- Balance = sum(amount); negative means the player owes, zero or positive means they're clear or in credit.

-- Donation goals (the match ball fund). collected_amount only moves when staff verify a donation.
CREATE TABLE public.donation_goals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
 target_amount numeric(12,2) NOT NULL CHECK (target_amount > 0 AND target_amount <= 1000000),
 collected_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (collected_amount >= 0),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX donation_goals_one_active ON public.donation_goals (active) WHERE active;
GRANT SELECT ON public.donation_goals TO authenticated;
GRANT INSERT (title, target_amount, active), UPDATE (title, target_amount, active) ON public.donation_goals TO authenticated;
GRANT ALL ON public.donation_goals TO service_role;
ALTER TABLE public.donation_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in players read goals" ON public.donation_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff create goals" ON public.donation_goals FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff edit goals" ON public.donation_goals FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER audit_donation_goals AFTER INSERT OR UPDATE OR DELETE ON public.donation_goals FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
INSERT INTO public.donation_goals(title, target_amount) VALUES ('Match ball', 3500);

-- Payments now have a purpose: a match prepayment, an advance top-up, or a donation to a goal.
ALTER TABLE public.payments ALTER COLUMN match_id DROP NOT NULL;
ALTER TABLE public.payments ADD COLUMN purpose text NOT NULL DEFAULT 'match';
ALTER TABLE public.payments ADD COLUMN goal_id uuid REFERENCES public.donation_goals(id);
ALTER TABLE public.payments ADD CONSTRAINT payments_purpose_check CHECK (purpose IN ('match','advance','donation'));
ALTER TABLE public.payments ADD CONSTRAINT payments_purpose_target_check CHECK (
 (purpose = 'match' AND match_id IS NOT NULL AND goal_id IS NULL)
 OR (purpose = 'advance' AND match_id IS NULL AND goal_id IS NULL)
 OR (purpose = 'donation' AND match_id IS NULL AND goal_id IS NOT NULL));
-- NOT VALID: applies to new payments without rejecting any older, larger ones.
ALTER TABLE public.payments ADD CONSTRAINT payments_max_amount_check CHECK (amount <= 2000) NOT VALID;

-- Settlement details on matches.
ALTER TABLE public.matches ADD COLUMN total_cost numeric(12,2) CHECK (total_cost > 0);
ALTER TABLE public.matches ADD COLUMN cost_per_head numeric(12,2) CHECK (cost_per_head > 0);
ALTER TABLE public.matches ADD COLUMN settled_at timestamptz;
ALTER TABLE public.matches ADD COLUMN settled_by uuid REFERENCES public.profiles(id);

CREATE TABLE public.ledger_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id),
 kind text NOT NULL CHECK (kind IN ('payment','match_charge','charge_reversal','adjustment')),
 amount numeric(12,2) NOT NULL CHECK (amount <> 0),
 match_id uuid REFERENCES public.matches(id),
 payment_id uuid UNIQUE REFERENCES public.payments(id),
 note text CHECK (length(note) <= 500),
 created_by uuid REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (kind <> 'payment' OR (payment_id IS NOT NULL AND amount > 0)),
 CHECK (kind <> 'match_charge' OR (match_id IS NOT NULL AND amount < 0)),
 CHECK (kind <> 'charge_reversal' OR (match_id IS NOT NULL AND amount > 0)),
 CHECK (kind <> 'adjustment' OR length(trim(coalesce(note,''))) > 0)
);
CREATE INDEX ledger_entries_owner_created ON public.ledger_entries(user_id, created_at, id);
CREATE INDEX ledger_entries_match ON public.ledger_entries(match_id) WHERE match_id IS NOT NULL;
-- Read-only to clients: every write goes through the staff-checked functions below.
GRANT SELECT ON public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_entries TO service_role;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and staff read ledger" ON public.ledger_entries FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER audit_ledger_entries AFTER INSERT OR UPDATE OR DELETE ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- Balances per player. security_invoker keeps RLS: players see their own row, staff see everyone.
CREATE VIEW public.player_balances WITH (security_invoker = true) AS
 SELECT p.id AS user_id, p.full_name, p.avatar_url, coalesce(sum(l.amount), 0)::numeric(12,2) AS balance, max(l.created_at) AS last_activity
 FROM public.profiles p LEFT JOIN public.ledger_entries l ON l.user_id = p.id
 GROUP BY p.id, p.full_name, p.avatar_url;
GRANT SELECT ON public.player_balances TO authenticated;

-- Per-player dues for one settled match. Each match's charges (net of reversals) and every negative adjustment are
-- debts, paid off oldest first by the player's payments and positive adjustments. A match is paid once every debt up
-- to and including it is covered. Runs as the caller, so players get their own row and staff get everyone's.
CREATE FUNCTION public.match_dues(_match_id uuid)
 RETURNS TABLE(user_id uuid, charged numeric, covered numeric, due numeric)
 LANGUAGE sql STABLE SET search_path = public AS $$
 WITH players AS (
  SELECT DISTINCT l.user_id FROM public.ledger_entries l WHERE l.match_id = _match_id AND l.kind = 'match_charge'
 ), debts AS (
  SELECT l.user_id, l.match_id, -sum(l.amount) AS charge, max(l.created_at) FILTER (WHERE l.kind = 'match_charge') AS at, min(l.id::text) AS tiebreak
  FROM public.ledger_entries l JOIN players USING (user_id)
  WHERE l.kind IN ('match_charge', 'charge_reversal') GROUP BY l.user_id, l.match_id HAVING sum(l.amount) < 0
  UNION ALL
  SELECT l.user_id, NULL, -l.amount, l.created_at, l.id::text
  FROM public.ledger_entries l JOIN players USING (user_id) WHERE l.kind = 'adjustment' AND l.amount < 0
 ), ordered AS (
  SELECT d.*, sum(d.charge) OVER (PARTITION BY d.user_id ORDER BY d.at, d.tiebreak ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running FROM debts d
 ), credits AS (
  SELECT l.user_id, sum(l.amount) AS total FROM public.ledger_entries l JOIN players USING (user_id)
  WHERE l.kind = 'payment' OR (l.kind = 'adjustment' AND l.amount > 0) GROUP BY l.user_id
 ), paid AS (
  SELECT o.user_id, o.charge, least(o.charge, greatest(0, coalesce(c.total, 0) - (o.running - o.charge))) AS covered
  FROM ordered o LEFT JOIN credits c USING (user_id) WHERE o.match_id = _match_id
 )
 SELECT user_id, charge::numeric(12,2), covered::numeric(12,2), (charge - covered)::numeric(12,2) FROM paid
$$;
GRANT EXECUTE ON FUNCTION public.match_dues(uuid) TO authenticated;

-- Completing a match and changing its settlement only happen through settle_match / reopen_match.
CREATE FUNCTION public.protect_match_settlement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF coalesce(current_setting('app.match_settlement', true), '') = 'on' THEN RETURN NEW; END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND (NEW.status = 'completed' OR OLD.status = 'completed') THEN
  RAISE EXCEPTION 'Enter the match cost to complete it, or reopen it to change it';
 END IF;
 IF (NEW.total_cost, NEW.cost_per_head, NEW.settled_at, NEW.settled_by) IS DISTINCT FROM (OLD.total_cost, OLD.cost_per_head, OLD.settled_at, OLD.settled_by) THEN
  RAISE EXCEPTION 'Match costs can only change by settling or reopening the match';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_match_settlement() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_match_settlement BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.protect_match_settlement();

CREATE FUNCTION public.protect_insert_settlement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.status = 'completed' OR NEW.total_cost IS NOT NULL OR NEW.cost_per_head IS NOT NULL OR NEW.settled_at IS NOT NULL OR NEW.settled_by IS NOT NULL THEN
  RAISE EXCEPTION 'Create the match first, then enter its cost to complete it';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_insert_settlement() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_insert_settlement BEFORE INSERT ON public.matches FOR EACH ROW EXECUTE FUNCTION public.protect_insert_settlement();

-- The team sheet of a settled match is frozen, since everyone's share depends on it.
CREATE FUNCTION public.lock_settled_registrations() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.matches WHERE id = coalesce(NEW.match_id, OLD.match_id) AND settled_at IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND NEW.match_id IS DISTINCT FROM OLD.match_id AND EXISTS (SELECT 1 FROM public.matches WHERE id = OLD.match_id AND settled_at IS NOT NULL)) THEN
  RAISE EXCEPTION 'This match has been settled. Reopen it to change the team sheet';
 END IF;
 RETURN coalesce(NEW, OLD);
END $$;
REVOKE ALL ON FUNCTION public.lock_settled_registrations() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER lock_settled_registrations BEFORE INSERT OR UPDATE OR DELETE ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.lock_settled_registrations();

-- Staff enter the total cost; it is split per head (players plus guests) and charged to each player.
CREATE FUNCTION public.settle_match(_match_id uuid, _total_cost numeric) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.matches; heads int; per_head numeric(12,2);
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only moderators can settle matches'; END IF;
 IF _total_cost IS NULL OR _total_cost <= 0 OR _total_cost > 1000000 THEN RAISE EXCEPTION 'Enter a total cost between 1 and 1,000,000'; END IF;
 IF round(_total_cost, 2) <> _total_cost THEN RAISE EXCEPTION 'Use at most two decimal places'; END IF;
 SELECT * INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
 IF m.settled_at IS NOT NULL THEN RAISE EXCEPTION 'This match has already been settled'; END IF;
 IF m.status <> 'published' THEN RAISE EXCEPTION 'Only booked matches can be completed'; END IF;
 SELECT coalesce(sum(1 + guest_count), 0) INTO heads FROM public.registrations WHERE match_id = _match_id;
 IF heads = 0 THEN RAISE EXCEPTION 'Nobody is on the team sheet. Add the players before settling'; END IF;
 per_head := round(_total_cost / heads, 2);
 IF per_head <= 0 THEN RAISE EXCEPTION 'The cost per head rounds to zero'; END IF;

 INSERT INTO public.ledger_entries(user_id, kind, amount, match_id, note, created_by)
 SELECT r.user_id, 'match_charge', -(per_head * (1 + r.guest_count)), _match_id,
  m.title || CASE WHEN r.guest_count > 0 THEN ' (you + ' || r.guest_count || ' guest' || CASE WHEN r.guest_count > 1 THEN 's' ELSE '' END || ')' ELSE '' END,
  auth.uid()
 FROM public.registrations r WHERE r.match_id = _match_id;

 PERFORM set_config('app.match_settlement', 'on', true);
 UPDATE public.matches SET status = 'completed', total_cost = _total_cost, cost_per_head = per_head, settled_at = now(), settled_by = auth.uid(), updated_at = now() WHERE id = _match_id;
 PERFORM set_config('app.match_settlement', 'off', true);

 INSERT INTO public.notifications(user_id, kind, title, body, match_id)
 SELECT r.user_id, 'match_settled', 'Match cost: ' || m.title,
  'Your share is ৳' || to_char(per_head * (1 + r.guest_count), 'FM999999990.00') || '. Check your balance on the Payments page.', _match_id
 FROM public.registrations r WHERE r.match_id = _match_id;
 RETURN per_head;
END $$;
REVOKE ALL ON FUNCTION public.settle_match(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_match(uuid, numeric) TO authenticated;

-- Undo a settlement (wrong cost, wrong team sheet): reverse each player's charge and put the match back to booked.
CREATE FUNCTION public.reopen_match(_match_id uuid, _reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.matches;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only moderators can reopen matches'; END IF;
 IF length(trim(coalesce(_reason, ''))) = 0 OR length(_reason) > 300 THEN RAISE EXCEPTION 'Give a reason (up to 300 characters)'; END IF;
 SELECT * INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
 IF m.status <> 'completed' THEN RAISE EXCEPTION 'Only completed matches can be reopened'; END IF;

 INSERT INTO public.ledger_entries(user_id, kind, amount, match_id, note, created_by)
 SELECT user_id, 'charge_reversal', -sum(amount), _match_id, 'Reopened: ' || trim(_reason), auth.uid()
 FROM public.ledger_entries WHERE match_id = _match_id AND kind IN ('match_charge', 'charge_reversal')
 GROUP BY user_id HAVING sum(amount) < 0;

 PERFORM set_config('app.match_settlement', 'on', true);
 UPDATE public.matches SET status = 'published', total_cost = NULL, cost_per_head = NULL, settled_at = NULL, settled_by = NULL, updated_at = now() WHERE id = _match_id;
 PERFORM set_config('app.match_settlement', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.reopen_match(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_match(uuid, text) TO authenticated;

-- Cash handed over at the pitch, refunds and corrections. Staff can't adjust their own balance; the super admin can.
CREATE FUNCTION public.record_adjustment(_player_id uuid, _amount numeric, _note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only moderators can adjust balances'; END IF;
 IF _player_id = auth.uid() AND NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'Ask another moderator to adjust your own balance'; END IF;
 IF _amount IS NULL OR _amount = 0 OR abs(_amount) > 100000 OR round(_amount, 2) <> _amount THEN RAISE EXCEPTION 'Enter a non-zero amount up to 100,000 with at most two decimals'; END IF;
 IF length(trim(coalesce(_note, ''))) = 0 OR length(_note) > 500 THEN RAISE EXCEPTION 'Describe the adjustment (up to 500 characters)'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _player_id) THEN RAISE EXCEPTION 'Player not found'; END IF;
 INSERT INTO public.ledger_entries(user_id, kind, amount, note, created_by) VALUES (_player_id, 'adjustment', _amount, trim(_note), auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.record_adjustment(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_adjustment(uuid, numeric, text) TO authenticated;

-- Payment submissions: purpose-aware, capped at 2000 per payment.
CREATE OR REPLACE FUNCTION public.validate_payment_submission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE required_amount numeric; match_state public.match_status; needs_payment boolean;
BEGIN
 IF auth.uid() IS NULL OR NEW.user_id <> auth.uid() OR NEW.status <> 'pending' THEN RAISE EXCEPTION 'Sign in to submit your own payment'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.payment_settings) THEN RAISE EXCEPTION 'Bank details have not been configured'; END IF;
 IF NEW.amount > 2000 THEN RAISE EXCEPTION 'A single payment can be at most ৳2000'; END IF;
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

-- Verifying a payment now credits the player's balance, or the fund for donations.
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

-- Payments verified before the ledger existed become opening credits, so nobody loses what they already paid.
INSERT INTO public.ledger_entries(user_id, kind, amount, match_id, payment_id, note, created_by, created_at)
SELECT user_id, 'payment', amount, match_id, id, 'Payment ' || transaction_id, reviewed_by, coalesce(reviewed_at, created_at)
FROM public.payments WHERE status = 'verified';
