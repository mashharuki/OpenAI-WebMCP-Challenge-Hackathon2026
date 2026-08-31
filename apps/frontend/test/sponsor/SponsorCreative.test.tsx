import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SponsorCreative } from "../../src/sponsor/SponsorCreative";

describe("SponsorCreative", () => {
  it("presents a clearly labelled moving product message with viewing progress", () => {
    render(<SponsorCreative remainingSeconds={5} requiredSeconds={8} />);

    expect(screen.getByText("Sponsored message")).toBeVisible();
    expect(
      screen.getByRole("img", { name: /seasonal pantry box/i }),
    ).toHaveAttribute("src", "/sponsor/open-table-weekly-poster.webp");
    expect(
      screen.getByRole("heading", { name: "Seasonal Pantry Box" }),
    ).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "38",
    );
    expect(screen.getByText("5 seconds remaining")).toBeVisible();
  });
});
