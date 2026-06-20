/** @jsxImportSource react */

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createDemoStudioController } from "../core/controller.js";
import type { DemoStudioController, DemoStudioOptions } from "../core/controller.js";
import { DemoFingerOverlay } from "./demo-finger-overlay.js";
import { DemoStudioPanel } from "./demo-studio-panel.js";

export interface DemoStudioProps extends DemoStudioOptions {
  className?: string;
  style?: React.CSSProperties;
}

export function DemoStudio({ className, style, ...opts }: DemoStudioProps) {
  const controllerRef = useRef<DemoStudioController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createDemoStudioController(opts);
  }
  const controller = controllerRef.current;

  useEffect(() => () => { controllerRef.current?.destroy(); controllerRef.current = null; }, []);

  useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);

  return (
    <div className={className} style={style}>
      <DemoFingerOverlay controller={controller} />
      <DemoStudioPanel controller={controller} />
    </div>
  );
}
