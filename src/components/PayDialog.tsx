import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Pay without leaving the page: a wide two-column popup (details left, form right on desktop) that any
// "Pay" button can open. The caller supplies the form so match dues, advances and donations all fit.
export function PayDialog({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
