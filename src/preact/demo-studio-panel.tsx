/** @jsxImportSource preact */

import { isScreencastSupported } from "../core/screencast-recorder.js";
import { DEMO_SPEED_MAX, DEMO_SPEED_MIN } from "../core/pacing.js";
import type { DemoStudioController } from "../core/controller.js";
import { ClapperboardIcon, CloseIcon } from "./icons.js";
import { DemoStudioLauncher } from "./demo-studio-launcher.js";
import { useControllerState } from "./use-demo-studio.js";

export interface DemoStudioPanelProps { controller: DemoStudioController; }

export function DemoStudioPanel({ controller }: DemoStudioPanelProps) {
  const {
    open, settings, refinementText, runStatus, recorderState,
    errorMsg, stepLabel, running, journeys,
  } = useControllerState(controller);
  const { actions } = controller;

  const resolvedJourney = journeys.find((j) => j.id === settings.journeyId);

  return (
    <>
      {open && !running && (
        <div
          data-testid="kyzmet-demo-studio-panel"
          class="demo-studio-panel demo-studio-panel-shell"
          style={{ display: "flex", flexDirection: "column", maxHeight: "min(70vh, calc(100vh - 8rem))", zIndex: 9997 }}
        >
          <div class="demo-studio-panel-header">
            <div class="demo-studio-panel-header-icon-badge" aria-hidden><ClapperboardIcon /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p class="demo-studio-panel-header-title">Demo Studio</p>
              <p class="demo-studio-panel-header-subtitle">Create screencasts</p>
            </div>
            <div class="demo-studio-panel-header-actions">
              <button type="button" class="demo-studio-panel-header-close" aria-label="Close Demo Studio" onClick={() => actions.setOpen(false)}>
                <CloseIcon />
              </button>
            </div>
          </div>

          <div class="demo-studio-panel-body">
            <div class="demo-studio-field-group">
              <label htmlFor="demo-studio-journey" class="demo-studio-field-label">Journey</label>
              <select
                id="demo-studio-journey" class="demo-studio-select"
                value={settings.journeyId}
                onChange={(e) => actions.setSetting("journeyId", (e.target as HTMLSelectElement).value)}
                data-testid="kyzmet-demo-studio-journey-picker"
              >
                {journeys.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
              </select>
            </div>

            <div class="demo-studio-field-group">
              <label htmlFor="demo-studio-speed" class="demo-studio-field-label">Speed {settings.speed.toFixed(1)}×</label>
              <input
                id="demo-studio-speed" type="range"
                min={DEMO_SPEED_MIN} max={DEMO_SPEED_MAX} step={0.1}
                value={settings.speed}
                onInput={(e) => actions.setSetting("speed", parseFloat((e.target as HTMLInputElement).value))}
                data-testid="kyzmet-demo-studio-speed-slider"
                class="demo-studio-speed-slider"
              />
            </div>

            <div class="demo-studio-field-group">
              <label htmlFor="demo-studio-refine" class="demo-studio-field-label">Refine (optional)</label>
              <textarea
                id="demo-studio-refine" class="demo-studio-textarea"
                value={refinementText}
                onInput={(e) => actions.setRefinementText((e.target as HTMLTextAreaElement).value)}
                placeholder="faster · skip welcome · linger on share review"
                rows={2} data-testid="kyzmet-demo-studio-refine-textarea"
              />
            </div>

            <div class="demo-studio-settings-inset">
              <ToggleRow id="demo-studio-finger" label="Finger overlay" description="Show the guided tap dot during the demo." checked={settings.fingerEnabled} onChange={(v) => actions.setSetting("fingerEnabled", v)} testId="kyzmet-demo-studio-finger-toggle" />
              <ToggleRow id="demo-studio-captions" label="Captions" description="Show narration pills during caption steps." checked={settings.captionsEnabled} onChange={(v) => actions.setSetting("captionsEnabled", v)} testId="kyzmet-demo-studio-captions-toggle" />
              <ToggleRow id="demo-studio-default-mode" label="Read scroll mode" description="On: linger and read each page. Off: skim-scan pace." checked={settings.defaultMode === "read"} onChange={(readMode) => actions.setSetting("defaultMode", readMode ? "read" : "scan")} testId="kyzmet-demo-studio-default-mode" />
            </div>

            {stepLabel && <p class="demo-studio-status">→ {stepLabel}</p>}
            {errorMsg && <p class="demo-studio-status demo-studio-status--error">{errorMsg}</p>}
            {runStatus === "done" && <p class="demo-studio-status demo-studio-status--success">✓ Demo complete</p>}
            {recorderState === "done" && runStatus === "done" && <p class="demo-studio-status demo-studio-status--success">✓ Screencast downloaded</p>}

            <div class="demo-studio-actions">
              <button type="button" class="demo-studio-btn demo-studio-btn--primary" onClick={() => void actions.startRun()} disabled={!resolvedJourney} data-testid="kyzmet-demo-studio-run">
                Run demo
              </button>
              <button type="button" class="demo-studio-btn demo-studio-btn--secondary" onClick={() => void actions.startScreencast()} disabled={!resolvedJourney || !isScreencastSupported()} data-testid="kyzmet-demo-studio-screencast">
                Screencast
              </button>
            </div>
          </div>
        </div>
      )}
      <DemoStudioLauncher controller={controller} />
    </>
  );
}

interface ToggleRowProps {
  id: string; label: string; description: string;
  checked: boolean; onChange: (v: boolean) => void; testId: string;
}

function ToggleRow({ id, label, description, checked, onChange, testId }: ToggleRowProps) {
  return (
    <div class="demo-studio-toggle-row">
      <div class="demo-studio-toggle-text">
        <label htmlFor={id} class="demo-studio-toggle-label">{label}</label>
        <p class="demo-studio-toggle-description">{description}</p>
      </div>
      <button
        type="button" role="switch" id={id} class="demo-studio-toggle"
        aria-checked={checked ? "true" : "false"}
        onClick={() => onChange(!checked)}
        data-testid={testId}
      >
        <span class="demo-studio-toggle-knob" />
      </button>
    </div>
  );
}
