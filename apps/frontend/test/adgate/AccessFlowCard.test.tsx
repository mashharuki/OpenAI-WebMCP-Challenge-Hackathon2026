import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccessFlowCard } from "../../src/adgate/AccessFlowCard";

describe("AccessFlowCard", () => {
  it("explains the two human-approved paths before an analysis starts", () => {
    render(
      <AccessFlowCard
        snapshot={{
          state: { type: "idle" },
          paymentAvailable: true,
        }}
        webMCP={{
          supported: true,
          registered: true,
          source: "document",
          error: null,
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Your access, your choice" }),
    ).toBeVisible();
    expect(screen.getByText("analyze_recipe · WebMCP ready")).toBeVisible();
    expect(screen.getByText("Review 0.01 testnet USDC")).toBeVisible();
    expect(screen.getByText("Watch an 8-second sponsor message")).toBeVisible();
    expect(screen.getByText("Protected recipe analysis")).toBeVisible();
  });

  it("marks the active sponsor path and the one-time grant", () => {
    render(
      <AccessFlowCard
        snapshot={{
          state: {
            type: "viewing_sponsor",
            attemptId: "attempt-1",
            sponsorId: "open-table-weekly",
          },
          source: "visible_ui",
          paymentAvailable: true,
        }}
        webMCP={{ supported: false, registered: false, error: null }}
      />,
    );

    expect(screen.getByText("Sponsor message in progress")).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByText("One-time sponsor grant")).toBeVisible();
  });

  it("marks the payment review while an agent invocation is waiting", () => {
    render(
      <AccessFlowCard
        snapshot={{
          state: {
            type: "awaiting_payment",
            attemptId: "attempt-1",
            paymentRequestId: "request-1",
          },
          source: "webmcp",
          paymentAvailable: true,
        }}
        webMCP={{
          supported: true,
          registered: true,
          source: "navigator",
          error: null,
        }}
      />,
    );

    expect(screen.getByText("Payment review in progress")).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("guides wallet-free browsers to the sponsor route", () => {
    render(
      <AccessFlowCard
        snapshot={{
          state: { type: "idle" },
          paymentAvailable: false,
        }}
        webMCP={{
          supported: true,
          registered: true,
          source: "document",
          error: null,
        }}
      />,
    );

    expect(
      screen.getByText("Compatible browser wallet required"),
    ).toBeVisible();
    expect(
      screen.getByText("Sponsor access works in this browser."),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Go to sponsor access" }),
    ).toHaveAttribute("href", "#premium-analysis-title");
  });
});
