import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, LegalSection } from "@/components/LegalPage";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Use — Wednesday United" },
      { name: "description", content: "The ground rules for using the Wednesday United app." },
      { property: "og:title", content: "Terms of Use — Wednesday United" },
      { property: "og:description", content: "The ground rules for using the Wednesday United app." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <LegalPage kicker="The small print" title={<>Terms of <span className="text-accent">use</span></>} updated="4 November 2026"
      intro="Wednesday United is a friendly, volunteer-run football group. By using this app you agree to these ground rules.">
      <LegalSection title="Your account">
        <ul>
          <li>Use your real name so teammates know who's playing. One account per person.</li>
          <li>A moderator approves every new player before their first match, and may pause or remove an account that breaks these rules.</li>
          <li>Keep your sign-in to yourself. You're responsible for what's done through your account.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Matches">
        <ul>
          <li>Join a match only if you intend to play, and leave it in good time if you can't make it.</li>
          <li>Moderators set the line-up, may change or cancel matches (weather happens), and record who actually played.</li>
          <li>You play at your own risk. The club and its organisers aren't responsible for injuries or lost belongings.</li>
        </ul>
      </LegalSection>
      <LegalSection title="Payments and balances">
        <ul>
          <li>After each match its cost is split per head among the players who played, guests included, and charged to your balance.</li>
          <li>Payments only count once a moderator has verified them. Only submit transaction IDs and screenshots for payments you actually made.</li>
          <li>A single submitted payment is capped at ৳2000. Cash handed to a moderator is recorded by them.</li>
          <li>Donations to club funds go to the fund, not your balance, and aren't refundable once used.</li>
          <li>If you think a charge or balance is wrong, raise it with a moderator. Corrections are logged, never silently edited.</li>
        </ul>
      </LegalSection>
      <LegalSection title="The app">
        <p>The app is provided as-is by volunteers, without guarantees that it will always be available or error-free. Don't try to access data or features you aren't meant to, or interfere with how the app works.</p>
      </LegalSection>
      <LegalSection title="Changes">
        <p>We may update these terms; the date above shows the latest version. How we handle your data is covered in our <Link to="/privacy" className="text-primary underline">privacy policy</Link>.</p>
      </LegalSection>
    </LegalPage>
  );
}
