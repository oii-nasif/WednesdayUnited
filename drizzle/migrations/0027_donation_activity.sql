-- Social proof for the home page fund panel: how many have chipped in and who did so most recently, without
-- opening the payments table to everyone. Same audience as donation goals: approved players and staff.
CREATE OR REPLACE FUNCTION public.donation_activity(_goal_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT CASE WHEN auth.uid() IS NULL OR NOT (public.is_approved(auth.uid()) OR public.is_staff(auth.uid())) THEN NULL ELSE jsonb_build_object(
  'donor_count', (SELECT count(DISTINCT p.user_id) FROM public.payments p WHERE p.goal_id = _goal_id AND p.purpose = 'donation' AND p.status = 'verified'),
  'donation_count', (SELECT count(*) FROM public.payments p WHERE p.goal_id = _goal_id AND p.purpose = 'donation' AND p.status = 'verified'),
  'week_amount', (SELECT coalesce(sum(p.amount), 0) FROM public.payments p WHERE p.goal_id = _goal_id AND p.purpose = 'donation' AND p.status = 'verified' AND coalesce(p.reviewed_at, p.created_at) > now() - interval '7 days'),
  'recent', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', r.full_name, 'avatar_url', r.avatar_url, 'amount', r.amount, 'at', r.at) ORDER BY r.at DESC), '[]'::jsonb)
            FROM (SELECT d.full_name, d.avatar_url, p.amount, coalesce(p.reviewed_at, p.created_at) AS at
                  FROM public.payments p LEFT JOIN public.player_directory d ON d.id = p.user_id
                  WHERE p.goal_id = _goal_id AND p.purpose = 'donation' AND p.status = 'verified'
                  ORDER BY coalesce(p.reviewed_at, p.created_at) DESC LIMIT 6) r)
 ) END
$$;
REVOKE ALL ON FUNCTION public.donation_activity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.donation_activity(uuid) TO authenticated;