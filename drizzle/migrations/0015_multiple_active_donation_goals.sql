DROP INDEX IF EXISTS public.donation_goals_one_active;
CREATE INDEX IF NOT EXISTS donation_goals_active_created_at ON public.donation_goals (created_at DESC) WHERE active;
COMMENT ON INDEX public.donation_goals_active_created_at IS 'Supports listing multiple active donation funds; staff-only creation remains enforced by existing RLS.';