import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { GateCoordinatorPort, GateSnapshot } from "./gateCoordinator";

interface GateContextValue {
  readonly coordinator: GateCoordinatorPort;
  readonly snapshot: GateSnapshot;
}

const GateContext = createContext<GateContextValue | undefined>(undefined);

export function GateProvider({
  coordinator,
  children,
}: {
  readonly coordinator: GateCoordinatorPort;
  readonly children: ReactNode;
}) {
  const snapshot = useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  );

  useEffect(
    () => () => {
      coordinator.cancel("unmounted");
    },
    [coordinator],
  );

  const value = useMemo(
    () => ({ coordinator, snapshot }),
    [coordinator, snapshot],
  );

  return <GateContext.Provider value={value}>{children}</GateContext.Provider>;
}

export function useGate(): GateContextValue {
  const context = useContext(GateContext);
  if (!context) {
    throw new Error("useGate must be used within GateProvider.");
  }
  return context;
}
