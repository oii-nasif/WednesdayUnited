import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, History } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DONOR_ARTWORK, donorCampaignArchiveQuery, setDonorCampaignVisibility } from "@/lib/donor-campaigns";

const changedAt = (value: string) => new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Dhaka",
}).format(new Date(value));

/** Super-admin archive: hiding a poster never deletes it or its history. */
export function DonorCampaignAdmin() {
  const qc = useQueryClient();
  const { data = [], isPending, isError, refetch } = useQuery(donorCampaignArchiveQuery);
  const visibility = useMutation({
    mutationFn: ({ id, live }: { id: string; live: boolean }) => setDonorCampaignVisibility(id, live),
    onSuccess: (_, { live }) => {
      toast.success(live ? "Donor banner is live on every page" : "Donor banner hidden from every page");
      void qc.invalidateQueries({ queryKey: ["donor-campaigns"] });
    },
    onError: (error: { message?: string }) => toast.error(error.message ?? "Could not update the donor banner"),
  });

  return (
    <section aria-labelledby="donor-archive-title" className="mb-10 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent"><History className="size-4" />Website banner history</p>
          <h2 id="donor-archive-title" className="mt-2 font-display text-3xl">Donor appreciation</h2>
          <p className="mt-1 text-sm text-muted-foreground">Hide a poster from every page without deleting it, or make it live again.</p>
        </div>
      </div>
      {isPending ? <p className="text-sm text-muted-foreground">Loading banner history…</p> : isError ? (
        <div role="alert" className="flex items-center gap-3"><p className="text-sm">Could not load banner history.</p><Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></div>
      ) : (
        <ul className="grid gap-4">
          {data.map((campaign) => {
            const artwork = DONOR_ARTWORK[campaign.asset_key];
            return (
              <li key={campaign.id} className="flex flex-col gap-5 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center">
                {artwork && <img src={artwork.url} alt={artwork.alt} className="aspect-square w-full max-w-44 shrink-0 self-center rounded-lg object-cover shadow-md sm:w-36" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{campaign.title}</h3>
                    <Badge variant={campaign.active ? "accent" : "outline"}>{campaign.active ? <Eye className="size-3" /> : <EyeOff className="size-3" />}{campaign.active ? "Live" : "Hidden"}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{campaign.active ? "Shows as a 10-second popup when any page loads." : "Hidden from visitors, players and all other pages. Kept here for your records."}</p>
                  <p className="mt-3 text-xs text-muted-foreground">Added {changedAt(campaign.created_at)} · Last changed {changedAt(campaign.updated_at)}</p>
                </div>
                <Button
                  variant={campaign.active ? "outline" : "accent"}
                  className="shrink-0"
                  disabled={visibility.isPending}
                  onClick={() => visibility.mutate({ id: campaign.id, live: !campaign.active })}
                >
                  {campaign.active ? <EyeOff /> : <Eye />}
                  {visibility.isPending ? "Saving…" : campaign.active ? "Hide from website" : "Make live again"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
