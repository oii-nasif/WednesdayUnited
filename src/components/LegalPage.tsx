import type { ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";

// Shared shell for the privacy policy and terms: plain readable prose under the usual page header.
export function LegalPage({ kicker, title, updated, intro, children }: { kicker: string; title: ReactNode; updated: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="page-enter">
      <PageHeader compact kicker={kicker} title={title}>{intro}</PageHeader>
      <article className="mx-auto max-w-3xl px-4 py-10 text-[15px] leading-relaxed text-foreground/85 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:leading-none [&_h2]:text-foreground [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        <p className="text-sm text-muted-foreground">Last updated {updated}</p>
        {children}
      </article>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2>{title}</h2>{children}</section>;
}
