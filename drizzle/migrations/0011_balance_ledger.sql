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
 CHECK (kind <> 'charge_reversal' OR (match_id IS NOT NULL AND amount > 0))
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

-- How each player's credit is spread over their match costs. A payment made for a specific match covers that match
-- first; whatever is left over, plus untagged payments and positive adjustments, pays off the remaining debts oldest
-- first (negative adjustments count as debts). Internal: callers go through match_dues / player_match_dues.
CREATE FUNCTION public.ledger_allocation(_user_ids uuid[])
 RETURNS TABLE(user_id uuid, match_id uuid, charged numeric, covered numeric, due numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 WITH e AS (
  SELECT * FROM public.ledger_entries l WHERE l.user_id = ANY(_user_ids)
 ), debts AS (
  SELECT e.user_id, e.match_id, -sum(e.amount) AS charge, max(e.created_at) FILTER (WHERE e.kind = 'match_charge') AS at
  FROM e WHERE e.kind IN ('match_charge', 'charge_reversal') GROUP BY e.user_id, e.match_id HAVING sum(e.amount) < 0
 ), tagged AS (
  SELECT e.user_id, e.match_id, sum(e.amount) AS paid FROM e WHERE e.kind = 'payment' AND e.match_id IS NOT NULL GROUP BY e.user_id, e.match_id
 ), direct AS (
  SELECT d.user_id, d.match_id, d.charge, d.at, least(d.charge, coalesce(t.paid, 0)) AS covered FROM debts d LEFT JOIN tagged t USING (user_id, match_id)
 ), pool AS (
  SELECT u.user_id,
   coalesce((SELECT sum(x.amount) FROM e x WHERE x.user_id = u.user_id AND ((x.kind = 'payment' AND x.match_id IS NULL) OR (x.kind = 'adjustment' AND x.amount > 0))), 0)
   + coalesce((SELECT sum(t.paid - least(coalesce(d.charge, 0), t.paid)) FROM tagged t LEFT JOIN debts d USING (user_id, match_id) WHERE t.user_id = u.user_id), 0) AS total
  FROM unnest(_user_ids) AS u(user_id)
 ), remaining AS (
  SELECT d.user_id, d.match_id, d.charge - d.covered AS owing, d.at, d.match_id::text AS tiebreak FROM direct d
  UNION ALL
  SELECT e.user_id, NULL, -e.amount, e.created_at, e.id::text FROM e WHERE e.kind = 'adjustment' AND e.amount < 0
 ), ordered AS (
  SELECT r.*, sum(r.owing) OVER (PARTITION BY r.user_id ORDER BY r.at, r.tiebreak ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running FROM remaining r
 ), result AS (
  SELECT d.user_id, d.match_id, d.charge, d.covered + least(o.owing, greatest(0, p.total - (o.running - o.owing))) AS covered
  FROM direct d JOIN ordered o ON o.user_id = d.user_id AND o.match_id = d.match_id JOIN pool p ON p.user_id = d.user_id
 )
 SELECT user_id, match_id, charge::numeric(12,2), covered::numeric(12,2), (charge - covered)::numeric(12,2) FROM result
$$;
REVOKE ALL ON FUNCTION public.ledger_allocation(uuid[]) FROM PUBLIC, anon, authenticated;

-- Paid / due for everyone on a settled match. Open to every signed-in player, so the squad can see who has paid.
CREATE FUNCTION public.match_dues(_match_id uuid)
 RETURNS TABLE(user_id uuid, charged numeric, covered numeric, due numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT a.user_id, a.charged, a.covered, a.due
 FROM public.ledger_allocation(ARRAY(SELECT DISTINCT l.user_id FROM public.ledger_entries l WHERE l.match_id = _match_id AND l.kind = 'match_charge')) a
 WHERE a.match_id = _match_id AND auth.uid() IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = _match_id AND (m.status <> 'draft' OR public.is_staff(auth.uid())))
$$;
REVOKE ALL ON FUNCTION public.match_dues(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_dues(uuid) TO authenticated;

-- One player's dues per match, so they can choose which match a payment is for. Their own, or anyone's for staff.
CREATE FUNCTION public.player_match_dues(_user_id uuid)
 RETURNS TABLE(match_id uuid, title text, starts_at timestamptz, charged numeric, covered numeric, due numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT a.match_id, m.title, m.starts_at, a.charged, a.covered, a.due
 FROM public.ledger_allocation(ARRAY[_user_id]) a JOIN public.matches m ON m.id = a.match_id
 WHERE auth.uid() = _user_id OR public.is_staff(auth.uid())
 ORDER BY m.starts_at DESC
$$;
REVOKE ALL ON FUNCTION public.player_match_dues(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.player_match_dues(uuid) TO authenticated;

-- Completing a match and changing its settlement only happen through settle_match.
CREATE FUNCTION public.protect_match_settlement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF coalesce(current_setting('app.match_settlement', true), '') = 'on' THEN RETURN NEW; END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND (NEW.status = 'completed' OR OLD.status = 'completed') THEN
  RAISE EXCEPTION 'Enter the match cost to mark it played. To change a played match, edit its settlement';
 END IF;
 IF (NEW.total_cost, NEW.cost_per_head, NEW.settled_at, NEW.settled_by) IS DISTINCT FROM (OLD.total_cost, OLD.cost_per_head, OLD.settled_at, OLD.settled_by) THEN
  RAISE EXCEPTION 'Match costs can only change by settling the match';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_match_settlement() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_match_settlement BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.protect_match_settlement();

CREATE FUNCTION public.protect_insert_settlement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.status = 'completed' OR NEW.total_cost IS NOT NULL OR NEW.cost_per_head IS NOT NULL OR NEW.settled_at IS NOT NULL OR NEW.settled_by IS NOT NULL THEN
  RAISE EXCEPTION 'Create the match first, then enter its cost to mark it played';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_insert_settlement() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_insert_settlement BEFORE INSERT ON public.matches FOR EACH ROW EXECUTE FUNCTION public.protect_insert_settlement();

-- A settled team sheet only changes through settle_match, which re-charges everyone in the same step.
CREATE FUNCTION public.lock_settled_registrations() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF coalesce(current_setting('app.match_settlement', true), '') = 'on' THEN RETURN coalesce(NEW, OLD); END IF;
 IF EXISTS (SELECT 1 FROM public.matches WHERE id = coalesce(NEW.match_id, OLD.match_id) AND settled_at IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND NEW.match_id IS DISTINCT FROM OLD.match_id AND EXISTS (SELECT 1 FROM public.matches WHERE id = OLD.match_id AND settled_at IS NOT NULL)) THEN
  RAISE EXCEPTION 'This match has been settled. Edit the settlement to change the team sheet';
 END IF;
 RETURN coalesce(NEW, OLD);
END $$;
REVOKE ALL ON FUNCTION public.lock_settled_registrations() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER lock_settled_registrations BEFORE INSERT OR UPDATE OR DELETE ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.lock_settled_registrations();

-- Staff can go over the guest cap (the player limit trigger already lets staff through).
CREATE OR REPLACE FUNCTION public.check_guest_limit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cap int;
BEGIN
 IF public.is_staff(auth.uid()) THEN RETURN NEW; END IF;
 IF TG_OP = 'UPDATE' AND NEW.guest_count <= OLD.guest_count THEN RETURN NEW; END IF;
 SELECT max_guests INTO cap FROM public.matches WHERE id = NEW.match_id;
 IF NEW.guest_count > cap THEN RAISE EXCEPTION 'You can bring at most % guests to this match', cap; END IF;
 RETURN NEW;
END $$;

-- Staff confirm who played (players and guests) and the total cost. The team sheet is updated to match, the cost is
-- split per head and each player is charged, all in one step. Running it again on a completed match re-settles it:
-- the earlier charges are reversed in the ledger and replaced.
-- _lineup: [{"user_id": "...", "guest_count": 0}, ...]
CREATE FUNCTION public.settle_match(_match_id uuid, _total_cost numeric, _lineup jsonb) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.matches; heads int; per_head numeric(12,2); resettle boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only moderators can settle matches'; END IF;
 IF _total_cost IS NULL OR _total_cost <= 0 OR _total_cost > 1000000 THEN RAISE EXCEPTION 'Enter a total cost between 1 and 1,000,000'; END IF;
 IF round(_total_cost, 2) <> _total_cost THEN RAISE EXCEPTION 'Use at most two decimal places'; END IF;
 IF _lineup IS NULL OR jsonb_typeof(_lineup) <> 'array' OR jsonb_array_length(_lineup) = 0 THEN RAISE EXCEPTION 'Add the players who played'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(_lineup) x WHERE jsonb_typeof(x->'guest_count') <> 'number' OR (x->>'guest_count')::numeric NOT IN (SELECT generate_series(0, 20))) THEN
  RAISE EXCEPTION 'Guests must be a whole number from 0 to 20';
 END IF;
 IF (SELECT count(DISTINCT x->>'user_id') FROM jsonb_array_elements(_lineup) x) <> jsonb_array_length(_lineup) THEN RAISE EXCEPTION 'A player is listed twice'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(_lineup) x WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id::text = x->>'user_id')) THEN RAISE EXCEPTION 'Unknown player in the team sheet'; END IF;

 SELECT * INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
 IF m.status NOT IN ('published', 'completed') THEN RAISE EXCEPTION 'Only booked or played matches can be settled'; END IF;
 resettle := m.settled_at IS NOT NULL;

 PERFORM set_config('app.match_settlement', 'on', true);
 DELETE FROM public.registrations r WHERE r.match_id = _match_id AND r.user_id::text NOT IN (SELECT x->>'user_id' FROM jsonb_array_elements(_lineup) x);
 INSERT INTO public.registrations(match_id, user_id, guest_count, added_by_staff)
 SELECT _match_id, (x->>'user_id')::uuid, (x->>'guest_count')::int, true FROM jsonb_array_elements(_lineup) x
 ON CONFLICT (match_id, user_id) DO UPDATE SET guest_count = EXCLUDED.guest_count;

 SELECT sum(1 + guest_count) INTO heads FROM public.registrations WHERE match_id = _match_id;
 per_head := round(_total_cost / heads, 2);
 IF per_head <= 0 THEN RAISE EXCEPTION 'The cost per head rounds to zero'; END IF;

 IF resettle THEN
  INSERT INTO public.ledger_entries(user_id, kind, amount, match_id, note, created_by)
  SELECT user_id, 'charge_reversal', -sum(amount), _match_id, 'Settlement edited', auth.uid()
  FROM public.ledger_entries WHERE match_id = _match_id AND kind IN ('match_charge', 'charge_reversal')
  GROUP BY user_id HAVING sum(amount) < 0;
 END IF;

 INSERT INTO public.ledger_entries(user_id, kind, amount, match_id, note, created_by)
 SELECT r.user_id, 'match_charge', -(per_head * (1 + r.guest_count)), _match_id,
  m.title || CASE WHEN r.guest_count > 0 THEN ' (you + ' || r.guest_count || ' guest' || CASE WHEN r.guest_count > 1 THEN 's' ELSE '' END || ')' ELSE '' END,
  auth.uid()
 FROM public.registrations r WHERE r.match_id = _match_id;

 UPDATE public.matches SET status = 'completed', total_cost = _total_cost, cost_per_head = per_head, settled_at = now(), settled_by = auth.uid(), updated_at = now() WHERE id = _match_id;
 PERFORM set_config('app.match_settlement', 'off', true);

 INSERT INTO public.notifications(user_id, kind, title, body, match_id)
 SELECT r.user_id, 'match_settled', CASE WHEN resettle THEN 'Match cost updated: ' ELSE 'Match cost: ' END || m.title,
  'Your share is ৳' || to_char(per_head * (1 + r.guest_count), 'FM999999990.00') || '. Check your balance on the Payments page.', _match_id
 FROM public.registrations r WHERE r.match_id = _match_id;
 RETURN per_head;
END $$;
REVOKE ALL ON FUNCTION public.settle_match(uuid, numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_match(uuid, numeric, jsonb) TO authenticated;

-- Cash handed over at the pitch, refunds and corrections, by any moderator for any player (themselves included).
CREATE FUNCTION public.record_adjustment(_player_id uuid, _amount numeric, _note text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Only moderators can adjust balances'; END IF;
 IF _amount IS NULL OR _amount = 0 OR abs(_amount) > 100000 OR round(_amount, 2) <> _amount THEN RAISE EXCEPTION 'Enter a non-zero amount up to 100,000 with at most two decimals'; END IF;
 IF length(coalesce(_note, '')) > 500 THEN RAISE EXCEPTION 'Keep the note under 500 characters'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _player_id) THEN RAISE EXCEPTION 'Player not found'; END IF;
 INSERT INTO public.ledger_entries(user_id, kind, amount, note, created_by) VALUES (_player_id, 'adjustment', _amount, nullif(trim(_note), ''), auth.uid());
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
