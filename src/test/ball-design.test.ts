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

// The print is built from projected 3D geometry, so a broken projection shows up as NaN coordinates.
describe("molten ball artwork", () => {
  it("renders hatch wedges without broken geometry", () => {
    const { container } = render(<Football design="molten" />);
    const d = Array.from(container.querySelectorAll("path"))
      .map((p) => p.getAttribute("d") ?? "")
      .join(" ");
    expect(d).not.toContain("NaN");
    expect(d.length).toBeGreaterThan(1000);
    expect(container.querySelector("circle")?.getAttribute("fill")).toBe("#fbfbfa");
  });
});
