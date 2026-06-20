import { useEffect, useRef, useSyncExternalStore } from "react";
import { createDemoStudioController } from "../core/controller.js";
import type {
  DemoStudioActions,
  DemoStudioController,
  DemoStudioOptions,
  DemoStudioState,
} from "../core/controller.js";

export type { DemoStudioState, DemoStudioActions };

/**
 * Subscribe to an existing DemoStudioController and re-render on state changes.
 * Use this in components that receive a controller prop from the host application.
 */
export function useControllerState(controller: DemoStudioController): DemoStudioState {
  return useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );
}

/**
 * Create and bind a DemoStudioController from options.
 * Use this in the all-in-one <DemoStudio> component.
 */
export function useDemoStudio(
  opts: DemoStudioOptions,
): { state: DemoStudioState; actions: DemoStudioActions } {
  const controllerRef = useRef<DemoStudioController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = createDemoStudioController(opts);
  }

  const controller = controllerRef.current;

  useEffect(() => {
    return () => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []);

  const state = useControllerState(controller);
  return { state, actions: controller.actions };
}
