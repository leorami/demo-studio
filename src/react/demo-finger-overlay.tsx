/** @jsxImportSource react */

import { useEffect, useRef, useState } from "react";
import type { DemoStudioController } from "../core/controller.js";
import type { AutopilotEvent } from "../core/types.js";
import { useControllerState } from "./use-demo-studio.js";

export interface DemoFingerOverlayProps {
  controller: DemoStudioController;
}

interface RippleState { id: number; x: number; y: number; }
let rippleCounter = 0;

export function DemoFingerOverlay({ controller }: DemoFingerOverlayProps) {
  const { fingerVisible, captionsEnabled, autopilotEvent, running } = useControllerState(controller);
  const visible = running && fingerVisible;

  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [caption, setCaption] = useState<string | null>(null);
  const [ripples, setRipples] = useState<RippleState[]>([]);
  const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventRef = useRef<AutopilotEvent | null>(null);

  useEffect(() => {
    const event = autopilotEvent;
    if (!event || event === lastEventRef.current || !visible) return;
    lastEventRef.current = event;

    switch (event.type) {
      case "move": setPos({ x: event.x, y: event.y }); break;
      case "click": {
        setPos({ x: event.x, y: event.y });
        const id = ++rippleCounter;
        setRipples((prev) => [...prev, { id, x: event.x, y: event.y }]);
        setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
        break;
      }
      case "caption":
        if (captionsEnabled) {
          if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
          setCaption(event.text);
          captionTimerRef.current = setTimeout(() => setCaption(null), event.durationMs);
        }
        break;
      case "caption-clear":
        if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
        setCaption(null);
        break;
      case "done": case "abort":
        setCaption(null);
        setPos({ x: -100, y: -100 });
        break;
    }
  }, [autopilotEvent, visible, captionsEnabled]);

  useEffect(() => () => { if (captionTimerRef.current) clearTimeout(captionTimerRef.current); }, []);

  if (!visible) return null;

  return (
    <>
      {captionsEnabled && caption && (
        <div className="demo-studio-caption-container">
          <div role="status" aria-live="polite" data-testid="kyzmet-demo-caption" className="demo-studio-caption">
            {caption}
          </div>
        </div>
      )}
      <div data-testid="kyzmet-demo-finger-overlay" className="demo-studio-finger-overlay">
        <div
          data-testid="kyzmet-demo-finger-dot"
          className="demo-studio-finger-dot"
          style={{ transform: `translate(${pos.x - 14}px, ${pos.y - 14}px)` }}
        />
        {ripples.map((r) => (
          <div key={r.id} className="demo-studio-ripple" style={{ left: r.x - 24, top: r.y - 24 }} />
        ))}
      </div>
    </>
  );
}
