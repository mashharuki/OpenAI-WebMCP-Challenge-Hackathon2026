import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import fixture from "../../../../test/fixtures/sponsor-access.json";
import { sponsorSessionStartResponseSchema } from "../../src/sponsor/contracts";
import { SponsorModal } from "../../src/sponsor/SponsorModal";

const session = sponsorSessionStartResponseSchema.parse(
  fixture.valid.startResponse,
);

describe("SponsorModal", () => {
  it("explains the free path and supports keyboard cancellation with focus restoration", () => {
    const opener = document.createElement("button");
    opener.textContent = "Choose sponsor access";
    document.body.appendChild(opener);
    opener.focus();
    const onStart = vi.fn();
    const onCancel = vi.fn();
    const { unmount } = render(
      <SponsorModal
        state={{
          type: "ready",
          attemptId: "attempt-123",
          nonce: "request-123",
          session,
        }}
        remainingSeconds={8}
        onStart={onStart}
        onContinue={vi.fn()}
        onCancel={onCancel}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Sponsor access" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText(/free access path/i)).toBeVisible();
    expect(screen.getByText(/8 seconds/i)).toBeVisible();
    expect(screen.getByText("Open Table Weekly")).toBeVisible();
    const start = screen.getByRole("button", { name: "Start sponsor view" });
    expect(start).toHaveFocus();
    fireEvent.click(start);
    expect(onStart).toHaveBeenCalledOnce();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("confines focus and enables continuation only after viewing completes", () => {
    const onContinue = vi.fn();
    const onCancel = vi.fn();
    const viewingState = {
      type: "viewing" as const,
      attemptId: "attempt-123",
      nonce: "request-123",
      visibleElapsedMs: 3_000,
      visibleSince: 1_000,
      requiredMs: 8_000,
    };
    const { rerender } = render(
      <SponsorModal
        state={viewingState}
        remainingSeconds={5}
        onStart={vi.fn()}
        onContinue={onContinue}
        onCancel={onCancel}
      />,
    );

    const continueButton = screen.getByRole("button", {
      name: "Continue to recipe analysis",
    });
    expect(continueButton).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("5 seconds remaining");

    const cancel = screen.getByRole("button", { name: "Cancel sponsor view" });
    cancel.focus();
    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Tab",
    });
    expect(cancel).toHaveFocus();

    rerender(
      <SponsorModal
        state={{
          ...viewingState,
          visibleElapsedMs: 8_000,
          visibleSince: 9_000,
        }}
        remainingSeconds={0}
        onStart={vi.fn()}
        onContinue={onContinue}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Sponsor view complete",
    );
    expect(continueButton).toBeEnabled();
    cancel.focus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
    expect(continueButton).toHaveFocus();
    fireEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
