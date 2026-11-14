CREATE TABLE public.donor_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  asset_key text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT false,
  live_at timestamptz,
  hidden_at timestamptz,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.donor_campaigns TO anon, authenticated;
GRANT ALL ON public.donor_campaigns TO service_role;
ALTER TABLE public.donor_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Live campaigns public and admins read archive"
ON public.donor_campaigns FOR SELECT TO anon, authenticated
USING (active OR public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.donor_campaigns (title, asset_key, active, hidden_at)
VALUES ('Top donor appreciation — November 2026', 'donor-appreciation-2026-11', false, now());

CREATE OR REPLACE FUNCTION public.set_donor_campaign_visibility(campaign_id uuid, make_live boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can change donor banners';
  END IF;
  PERFORM 1 FROM public.donor_campaigns WHERE id = campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Donor banner not found'; END IF;
  UPDATE public.donor_campaigns
  SET active = make_live,
      live_at = CASE WHEN make_live THEN now() ELSE live_at END,
      hidden_at = CASE WHEN make_live THEN hidden_at ELSE now() END,
      changed_by = auth.uid(),
      updated_at = now()
  WHERE id = campaign_id;
END $$;
REVOKE ALL ON FUNCTION public.set_donor_campaign_visibility(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_donor_campaign_visibility(uuid, boolean) TO authenticated;

CREATE TRIGGER audit_donor_campaigns AFTER UPDATE ON public.donor_campaigns
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();