import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Football } from "@/components/Football";
import { BALL_DESIGNS, getBallDesign, setBallDesign } from "@/lib/ball-design";

// The squad bought a Molten F5C3555 (size 5), so that is the ball the site shows by default.
describe("default ball design", () => {
  it("is the Molten the squad plays with", () => {
    expect(getBallDesign()).toBe("molten");
    expect(BALL_DESIGNS.molten?.label).toBe("Molten");
  });

  it("is selectable and remembered", () => {
    setBallDesign("tango");
    expect(getBallDesign()).toBe("tango");
    setBallDesign("molten");
    expect(getBallDesign()).toBe("molten");
    expect(localStorage.getItem("wu-ball-design")).toBe("molten");
  });
});

// The default ball is a photo of the ball the squad bought, cut to a circle; the drawn designs are built
// from projected 3D geometry, where a broken projection shows up as NaN coordinates.
describe("ball artwork", () => {
  it("shows the photographed Molten as the default", () => {
    const { container } = render(<Football design="molten" />);
    const img = container.querySelector("image");
    expect(img?.getAttribute("href")).toContain("ball-molten");
    expect(container.querySelector("circle")?.getAttribute("fill")).toBe("#fbfbfa");
  });

  it("draws the other designs without broken geometry", () => {
    for (const design of ["classic", "tango", "rihla"] as const) {
      const { container } = render(<Football design={design} />);
      const d = Array.from(container.querySelectorAll("path"))
        .map((p) => p.getAttribute("d") ?? "")
        .join(" ");
      expect(d).not.toContain("NaN");
      expect(d.length).toBeGreaterThan(1000);
    }
  });
});
