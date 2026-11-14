import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ApprovalNotice } from "@/components/ApprovalNotice";
import { PitchLines } from "@/components/PitchLines";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="bg-moonlight relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 text-pitch-foreground">
      <PitchLines className="text-white/[0.06]" />
      <div className="rise relative max-w-md text-center">
        <span className="inline-block rounded-md bg-accent px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-accent-foreground shadow-glow">Flag's up · 404</span>
        <h1 className="mt-5 text-8xl leading-none md:text-9xl">Offside<span className="text-accent">!</span></h1>
        <p className="mt-3 text-pitch-foreground/75">This page strayed beyond the last defender.</p>
        <div className="mt-8">
          <Link to="/" className="inline-flex h-12 items-center rounded-xl bg-accent px-7 font-semibold text-accent-foreground shadow-glow transition hover:-translate-y-px">
            Back onside
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-5xl text-foreground">Half-time hiccup</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page didn't load. Something went wrong. Try again.</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Wednesday United" },
      { name: "description", content: "Wednesday United football team management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Bebas+Neue&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  // Sign-in/sign-up are single-screen pages: no footer, so nothing nudges the page into a scroll.
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isAuthPage = path.startsWith("/auth") || path.startsWith("/signup");

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SiteHeader />
        <ApprovalNotice />
        <main className={isAuthPage ? "min-h-[calc(100dvh-65px)] lg:min-h-[calc(100dvh-73px)]" : "min-h-[calc(100dvh-4rem)] lg:min-h-[calc(100dvh-73px)]"}>
          <Outlet />
        </main>
        {!isAuthPage && <SiteFooter />}
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
