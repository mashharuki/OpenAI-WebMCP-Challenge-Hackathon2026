import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GateProvider, useGate } from "../../src/adgate/GateProvider";
import type {
  GateCoordinatorPort,
  GateSnapshot,
} from "../../src/adgate/gateCoordinator";

const createCoordinator = () => {
  let snapshot: GateSnapshot = {
    state: { type: "idle" },
    paymentAvailable: true,
  };
  const listeners = new Set<(snapshot: GateSnapshot) => void>();
  const cancel = vi.fn();
  const coordinator: GateCoordinatorPort = {
    requestAnalysis: vi.fn<GateCoordinatorPort["requestAnalysis"]>(
      () => new Promise(() => undefined),
    ),
    chooseSponsor: vi.fn(async () => undefined),
    choosePayment: vi.fn(async () => undefined),
    cancel,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const publish = (next: GateSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener(snapshot);
  };
  return { coordinator, cancel, listeners, publish };
};

function Consumer() {
  const { coordinator, snapshot } = useGate();
  return (
    <button type="button" onClick={() => coordinator.cancel("user")}>
      {snapshot.state.type}
    </button>
  );
}

describe("GateProvider", () => {
  it("shares one coordinator snapshot and cleans up on unmount", () => {
    const harness = createCoordinator();
    const { rerender, unmount } = render(
      <GateProvider coordinator={harness.coordinator}>
        <Consumer />
      </GateProvider>,
    );

    expect(screen.getByRole("button", { name: "idle" })).toBeVisible();
    expect(harness.listeners.size).toBe(1);
    rerender(
      <GateProvider coordinator={harness.coordinator}>
        <Consumer />
      </GateProvider>,
    );
    expect(harness.listeners.size).toBe(1);

    act(() => {
      harness.publish({
        state: {
          type: "awaiting_choice",
          attemptId: "attempt-1",
          input: { recipeId: "roasted-chickpea-quinoa-bowl" },
        },
        source: "webmcp",
        paymentAvailable: true,
      });
    });
    expect(
      screen.getByRole("button", { name: "awaiting_choice" }),
    ).toBeVisible();

    unmount();
    expect(harness.listeners.size).toBe(0);
    expect(harness.cancel).toHaveBeenCalledExactlyOnceWith("unmounted");
  });
});
