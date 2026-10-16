import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteEntity } from "@/lib/deletion";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export type DeleteTarget = { entity: "match" | "venue"; id: string; name: string };

export function DeleteConfirmation({ target, onClose }: { target: DeleteTarget | null; onClose: () => void }) {
  const qc = useQueryClient();
  const deletion = useMutation({
    mutationFn: async () => { if (target) await deleteEntity(target.entity, target.id); },
    onSuccess: async () => {
      toast.success(target?.entity === "venue" ? "Venue deleted" : "Match deleted");
      onClose();
      await Promise.all(["matches", "match", "locations", "my-regs"].map((key) => qc.invalidateQueries({ queryKey: [key] })));
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return <AlertDialog open={!!target} onOpenChange={(open) => { if (!open && !deletion.isPending) onClose(); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this {target?.entity}?</AlertDialogTitle>
        <AlertDialogDescription>
          <span className="mb-2 block font-semibold text-foreground">{target?.name}</span>
          {target?.entity === "match" ? "This permanently removes the match and its registrations. Matches with payment records cannot be deleted." : "This permanently removes the venue. Venues used by a match cannot be deleted until those matches are reassigned."}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <Button variant="outline" disabled={deletion.isPending} onClick={onClose}>Keep {target?.entity}</Button>
        <Button variant="destructive" disabled={deletion.isPending} onClick={() => deletion.mutate()}><Trash2 />{deletion.isPending ? "Deleting…" : `Delete ${target?.entity}`}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}