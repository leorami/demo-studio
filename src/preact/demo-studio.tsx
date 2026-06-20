/** @jsxImportSource preact */

import { useEffect, useReducer, useRef } from "preact/hooks";
import type { JSX } from "preact";
import { createDemoStudioController } from "../core/controller.js";
import type { DemoStudioController, DemoStudioOptions } from "../core/controller.js";
import { DemoFingerOverlay } from "./demo-finger-overlay.js";
import { DemoStudioPanel } from "./demo-studio-panel.js";

export interface DemoStudioProps extends DemoStudioOptions {
  className?: string;
  style?: JSX.CSSProperties;
}

export function DemoStudio({ className, style, ...opts }: DemoStudioProps) {
  const controllerRef = useRef<DemoStudioController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createDemoStudioController(opts);
  }
  const controller = controllerRef.current;

  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const unsubscribe = controller.subscribe(() => forceUpdate(0));
    return () => {
      unsubscribe();
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, [controller]);

  return (
    <div class={className} style={style}>
      <DemoFingerOverlay controller={controller} />
      <DemoStudioPanel controller={controller} />
    </div>
  );
}
