import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const roles = vi.hoisted(() => ({ value: [{ role: "player" }, { role: "moderator" }] as { role: string }[] }));
vi.mock("@/integrations/supabase/client", () => {
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        getSession: async () => ({ data: { session: { user: { id: "staff-1" } } } }),
      },
      from: () => ({ select: () => ({ eq: async () => ({ data: roles.value, error: null }) }) }),
      channel: () => channel,
      removeChannel: async () => {},
    },
  };
});
import { AuthProvider, useAuth } from "@/lib/auth";

function Probe() {
  const { isStaff, staffAccount, playerView, roles, setPlayerView } = useAuth();
  return (
    <div>
      <p>staff:{String(isStaff)} account:{String(staffAccount)} view:{String(playerView)} roles:{roles.join(",")}</p>
      <button onClick={() => setPlayerView(!playerView)}>toggle</button>
    </div>
  );
}

describe("player view", () => {
  beforeEach(() => { localStorage.clear(); roles.value = [{ role: "player" }, { role: "moderator" }]; });

  it("lets staff switch to player permissions in the UI and back", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText(/staff:true account:true view:false/)).toBeInTheDocument());
    act(() => screen.getByText("toggle").click());
    expect(screen.getByText("staff:false account:true view:true roles:player")).toBeInTheDocument();
    expect(localStorage.getItem("wu-player-view")).toBe("1");
    act(() => screen.getByText("toggle").click());
    expect(screen.getByText(/staff:true account:true view:false roles:player,moderator/)).toBeInTheDocument();
    expect(localStorage.getItem("wu-player-view")).toBeNull();
  });

  it("ignores a stored player view for accounts that aren't staff", async () => {
    localStorage.setItem("wu-player-view", "1");
    roles.value = [{ role: "player" }];
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("staff:false account:false view:false roles:player")).toBeInTheDocument());
  });
});
