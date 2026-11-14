REVOKE SELECT ON public.donor_campaigns FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_donor_campaign_visibility(uuid, boolean) FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.donor_campaigns IS 'DEPRECATED: donor website banner feature was added by mistake and removed; retained only to preserve migration history.';
COMMENT ON FUNCTION public.set_donor_campaign_visibility(uuid, boolean) IS 'DEPRECATED: donor website banner feature was removed; execute access revoked.';