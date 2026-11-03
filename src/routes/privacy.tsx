import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Wednesday United" },
      { name: "description", content: "What Wednesday United stores about you, who can see it, and how to have it removed." },
      { property: "og:title", content: "Privacy Policy — Wednesday United" },
      { property: "og:description", content: "What Wednesday United stores about you and who can see it." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <LegalPage kicker="The small print" title={<>Privacy <span className="text-accent">policy</span></>} updated="4 November 2026"
      intro="Wednesday United is a small, volunteer-run app for organising our weekly after-office football. This page explains what we keep about you and why.">
      <LegalSection title="What we collect">
        <ul>
          <li><strong>Sign-in details.</strong> When you sign in with Google we receive your name, email address and profile photo. If you sign up with email, we store your email and the name you enter. We never see your Google password.</li>
          <li><strong>Profile.</strong> Your name, photo, preferred position and, if you or a moderator adds it, a phone number.</li>
          <li><strong>Matches.</strong> Which matches you join, how many guests you bring, and whether you played.</li>
          <li><strong>Payments.</strong> Amounts, transaction IDs and the payment screenshots you upload, plus match costs, cash and adjustments recorded on your balance, and any donations to the club funds.</li>
          <li><strong>Activity records.</strong> A log of changes to matches, payments and balances, kept so that money can always be traced.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Why we use it">
        <p>Only to run the club: approving new players, organising matches and team sheets, splitting match costs, verifying payments, keeping balances and showing fund progress. We don't sell your data, show ads or use it for marketing.</p>
      </LegalSection>
      <LegalSection title="Who can see it">
        <ul>
          <li><strong>Everyone, including visitors who aren't signed in:</strong> the name and photo of players on a published match, the same as a team sheet on a noticeboard.</li>
          <li><strong>Signed-in squad members:</strong> match line-ups, what's still due on a match, and the names of recent fund donors.</li>
          <li><strong>Only you and the club's moderators:</strong> your email, phone number, payments, payment screenshots and balance. Screenshots are kept in private storage and opened through links that expire within minutes.</li>
        </ul>
        <p>Your data is stored with our hosting providers (Lovable Cloud, built on Supabase), which process it on our behalf. Google handles sign-in if you choose it, and venue maps are shown using Google Maps.</p>
      </LegalSection>
      <LegalSection title="How long we keep it">
        <p>Your profile and match history stay while you're part of the squad. Payment and balance records are kept for as long as the club needs them to keep its accounts accurate, because the ledger only works if past entries stay in place.</p>
      </LegalSection>
      <LegalSection title="Your choices">
        <p>You can change your photo and position from your profile. To correct your name, have your phone number removed, your account deleted, or a copy of what we hold about you, ask any moderator. We'll remove what we can; payment records needed to keep other players' balances correct may be kept with your name.</p>
      </LegalSection>
      <LegalSection title="Changes">
        <p>If this policy changes, we'll update this page and the date above. See also our <Link to="/terms" className="text-primary underline">terms of use</Link>.</p>
      </LegalSection>
    </LegalPage>
  );
}
