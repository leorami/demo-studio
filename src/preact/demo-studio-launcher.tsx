/** @jsxImportSource preact */

import type { DemoStudioController } from "../core/controller.js";
import { useControllerState } from "./use-demo-studio.js";
import { ClapperboardIcon, ClapperboardOpenIcon, VideocameraIcon } from "./icons.js";

export type DemoStudioLauncherMode = "idle" | "open" | "demo" | "screencast";
export interface DemoStudioLauncherProps { controller: DemoStudioController; }

function fabClass(mode: DemoStudioLauncherMode): string {
  switch (mode) {
    case "idle": return "demo-studio-fab demo-studio-fab--idle";
    case "open": return "demo-studio-fab demo-studio-fab--open";
    case "demo": return "demo-studio-fab demo-studio-fab--demo demo-studio-fab--live";
    case "screencast": return "demo-studio-fab demo-studio-fab--screencast demo-studio-fab--live";
  }
}

export function DemoStudioLauncher({ controller }: DemoStudioLauncherProps) {
  const { runStatus, open } = useControllerState(controller);
  const isLive = runStatus === "running" || runStatus === "recording" || runStatus === "recording-start";
  const isScreencast = runStatus === "recording" || runStatus === "recording-start";

  const mode: DemoStudioLauncherMode = isScreencast ? "screencast" : isLive ? "demo" : open ? "open" : "idle";

  const ariaLabel =
    mode === "demo" ? "Stop demo" :
    mode === "screencast" ? "Stop screencast" :
    mode === "open" ? "Close Demo Studio" :
    "Open Demo Studio";

  const testId = isLive ? "kyzmet-demo-studio-abort-launcher" : "kyzmet-demo-studio-launcher";

  function handleClick() {
    if (isLive) controller.actions.abort();
    else controller.actions.toggleOpen();
  }

  return (
    <button
      type="button"
      data-testid={testId}
      class={fabClass(mode)}
      onClick={handleClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-demo-mode={mode}
      data-demo-running={isLive ? "true" : undefined}
      data-demo-recording={isScreencast ? "true" : undefined}
    >
      {mode === "demo" && (
        <>
          <span class="demo-studio-launcher-ring demo-studio-launcher-ring--demo" aria-hidden />
          <span class="demo-studio-launcher-ring demo-studio-launcher-ring--demo demo-studio-launcher-ring--offset" aria-hidden />
        </>
      )}
      {isScreencast && (
        <>
          <span class="demo-studio-launcher-ring demo-studio-launcher-ring--screencast" aria-hidden />
          <span class="demo-studio-launcher-ring demo-studio-launcher-ring--screencast demo-studio-launcher-ring--offset" aria-hidden />
          <span class="demo-studio-record-beacon" aria-hidden />
        </>
      )}
      <LauncherIcon mode={mode} />
    </button>
  );
}

function LauncherIcon({ mode }: { mode: DemoStudioLauncherMode }) {
  const iconCls = "demo-studio-fab-icon";
  if (mode === "screencast") {
    return <VideocameraIcon className={`${iconCls} demo-studio-screencast-icon--live`} aria-hidden />;
  }
  if (mode === "demo") {
    return (
      <span style={{ position: "relative", display: "grid", width: "1.5rem", height: "1.5rem", placeItems: "center" }} aria-hidden>
        <ClapperboardIcon className={`${iconCls} demo-studio-clapper-closed`} style={{ position: "absolute", inset: 0 }} />
        <ClapperboardOpenIcon className={`${iconCls} demo-studio-clapper-open`} style={{ position: "absolute", inset: 0 }} />
      </span>
    );
  }
  return <ClapperboardIcon className={iconCls} aria-hidden />;
}
