# @leorami/demo-studio

Embeddable in-browser demo automation: autopilot step runner, screen capture, and a self-contained admin UI for both React and Preact projects.

## Installing from GitHub Packages

```sh
npm install @leorami/demo-studio
```

You'll need an `.npmrc` in your project root pointing npm at GitHub's registry for the `@leorami` scope:

```
@leorami:registry=https://npm.pkg.github.com
```

GitHub Packages requires authentication even for public packages. Generate a [Personal Access Token](https://github.com/settings/tokens) with `read:packages` scope and add it:

```
//npm.pkg.github.com/:_authToken=YOUR_TOKEN
```

---

## Dropping it into another project (workspace, no publish)

The `dist/` directory is pre-built and committed, so you can copy the whole `packages/demo-studio/` folder into another project's `packages/` directory and be done in three steps:

1. **Copy the directory**
   ```sh
   cp -r packages/demo-studio /path/to/other-project/packages/
   ```

2. **Add it to your workspace** — make sure your `pnpm-workspace.yaml` (or equivalent) includes `packages/*`:
   ```yaml
   packages:
     - "packages/*"
   ```

3. **Add it as a dependency** in the app that needs it (`apps/my-app/package.json`):
   ```json
   "dependencies": {
     "@leorami/demo-studio": "workspace:*"
   }
   ```
   Then run `pnpm install`.

That's it. No build step required in the other project — `dist/` ships with the package.

If you later edit the source and want to rebuild: `cd packages/demo-studio && pnpm build`.

---

## Package exports

| Import path | Contents |
|---|---|
| `@leorami/demo-studio` | Framework-neutral core: types, engine, headless controller |
| `@leorami/demo-studio/react` | React components and hook |
| `@leorami/demo-studio/preact` | Preact components and hook |
| `@leorami/demo-studio/styles.css` | Self-contained CSS with themeable `--demo-studio-*` variables |

## Peer dependencies

```
preact >= 10.x   (optional — only needed when you use /preact)
react  >= 18.x   (optional — only needed when you use /react)
react-dom >= 18.x (optional — only needed when you use /react)
```

## Usage — Preact

```tsx
import { createDemoStudioController } from "@leorami/demo-studio";
import {
  DemoStudioLauncher,
  DemoStudioPanel,
  DemoFingerOverlay,
} from "@leorami/demo-studio/preact";
import "@leorami/demo-studio/styles.css";

import { myJourneys } from "./journeys";

// Create the controller once (outside your component or in a stable ref).
const controller = createDemoStudioController({
  journeys: myJourneys,
  navigate(routeId, options) {
    // Navigate the host app. routeId is a plain string from your journey steps.
    window.location.hash = "#/" + routeId;
  },
  seed(target) {
    // Optional: seed demo state into the host app (e.g. mock localStorage entries).
  },
  prepareDemo(journeyId) {
    // Optional: run before autopilot starts — reset state, close overlays, etc.
  },
});

// Render the three components in your app shell.
function AppShell() {
  return (
    <>
      <YourMainContent />
      <DemoStudioLauncher controller={controller} />
      <DemoStudioPanel controller={controller} />
      <DemoFingerOverlay controller={controller} />
    </>
  );
}
```

Alternatively, use the all-in-one component which creates the controller internally:

```tsx
import { DemoStudio } from "@leorami/demo-studio/preact";
import "@leorami/demo-studio/styles.css";

function App() {
  return (
    <>
      <YourMainContent />
      <DemoStudio
        journeys={myJourneys}
        navigate={(routeId) => (window.location.hash = "#/" + routeId)}
      />
    </>
  );
}
```

## Usage — React

Identical API, just swap the import path:

```tsx
import { DemoStudio } from "@leorami/demo-studio/react";
import "@leorami/demo-studio/styles.css";
```

## Usage — headless (custom UI)

```tsx
import { createDemoStudioController } from "@leorami/demo-studio";
import { useDemoStudio } from "@leorami/demo-studio/preact"; // or /react

const controller = createDemoStudioController({ journeys, navigate });

function MyUI() {
  const state = useDemoStudio(controller);
  return (
    <button onClick={() => controller.actions.startRun()}>
      {state.running ? "Running…" : "Start"}
    </button>
  );
}
```

## Defining journeys

```ts
import type { DemoJourney } from "@leorami/demo-studio";

const myJourney: DemoJourney = {
  id: "hello-world",
  label: "Hello World",
  description: "Quick demo tour",
  estimatedSeconds: 30,
  steps: [
    { kind: "caption", text: "Welcome!", durationMs: 1500 },
    { kind: "navigate", routeId: "home", label: "Home" },
    { kind: "scroll", mode: "scan" },
    { kind: "click", testId: "my-button", label: "Click the button" },
  ],
};
```

Step kinds: `caption`, `navigate`, `scroll` (`scan` | `read`), `click`, `seed`, `pause`.

## Journey authoring metadata

Downstream hosts can attach product-agnostic authoring metadata to journeys for documentation, privacy review, and test selection:

```ts
import type {
  JourneyAuthoringEntry,
  JourneyPrivacyClassification,
} from "@leorami/demo-studio";

const authoring: JourneyAuthoringEntry = {
  id: "hello-world",
  label: "Hello World",
  description: "Quick demo tour for new contributors.",
  audience: "developer",
  category: "onboarding",
  privacy: "public",
  ownership: { team: "demo-platform" },
  resetReplay: { requiresReset: true, idempotentReplay: true },
  testGuidance: { smoke: true },
};
```

`JourneyAuthoringEntry.id` must match the runtime `DemoJourney.id` and any host manifest entry.

## Authoring test helpers

The core package exports lightweight helpers for downstream CI and doc hygiene:

```ts
import {
  assertManifestMatchesJourneys,
  scanDocForBannedContent,
} from "@leorami/demo-studio";

// Fail fast when manifest IDs drift from authored journeys.
assertManifestMatchesJourneys(journeys, manifest);

// Scan markdown/docs for secrets, env files, and private artifact paths.
const violations = scanDocForBannedContent(readme, {
  additionalPatterns: [/HOST_SPECIFIC_MARKER_\d+/],
});
if (violations.length > 0) {
  throw new Error(`Doc hygiene failed: ${violations.map((v) => v.pattern).join(", ")}`);
}
```

`scanDocForBannedContent` ships with generic banned-pattern defaults (API keys, `.env` references, custody/sealed artifacts, emails, invite tokens). Hosts extend detection with `additionalPatterns` and can whitelist lines via `allowedPatterns`.

Use [`docs/JOURNEY_AUTHORING_TEMPLATE.md`](docs/JOURNEY_AUTHORING_TEMPLATE.md) when authoring new journeys. Fill one template per journey and keep IDs aligned with `assertManifestMatchesJourneys()`.

## prepareDemo host contract

`prepareDemo` is a **host-provided hook** — it is implemented by the downstream host application, not by Demo Studio core. Demo Studio invokes it immediately before autopilot starts for the selected `journeyId`.

```ts
prepareDemo?: (journeyId: string) => void;
```

### When it runs

Core calls `prepareDemo(journeyId)` once per run, after the operator starts autopilot and before the first step executes. Core does not await promises returned from host code; hosts that need async setup must either complete critical work synchronously or finish within the host's own preparation window before steps rely on that state.

### Host responsibilities

| Concern | Expectation |
|---|---|
| **Setup** | Put the host into a known baseline for the requested journey (fixtures, feature flags, mock data). Product-specific setup stays in the host repo. |
| **Reset** | Clear stale state from prior runs: selections, drafts, cached panels, modal stacks, and route query fragments as applicable. |
| **Replay safety** | Make consecutive replays deterministic when `JourneyResetReplayExpectation.idempotentReplay` is true. |
| **Overlays / panels** | Dismiss dev tools, toasts, drawers, or other overlays that would block autopilot targeting. |
| **Asynchronous work** | Host code may trigger async preparation internally, but the typed contract is synchronous (`void`). Do not assume core awaits background jobs. |
| **Idempotency** | Safe to call multiple times for the same `journeyId` without worsening state. |
| **Secrets / logs** | Do not log tokens, env values, or private artifact paths. Operator-facing output only. |
| **Errors** | When setup cannot complete, surface a clear operator-facing message in the host UI and avoid starting autopilot against broken state. |
| **Ownership** | Each host team owns `prepareDemo` behavior for its journeys and documents expectations in `JourneyAuthoringEntry.resetReplay`. |

### Example (generic host)

```ts
prepareDemo(journeyId) {
  hostStore.resetDemoBaseline();
  hostRouter.clearTransientQueryState();
  hostOverlays.closeNonEssentialPanels();
  if (!hostFixtures.applyForJourney(journeyId)) {
    hostNotifier.showOperatorError(
      `Demo setup failed for "${journeyId}". Reset the host fixture and try again.`,
    );
  }
}
```

Pair implementation with `JourneyAuthoringEntry` metadata and validate docs with `scanDocForBannedContent()` before sharing journey write-ups externally.

## Adapter contract

| Adapter | Signature | Required | Purpose |
|---|---|---|---|
| `navigate` | `(routeId: string, options?: { hashQuery?: string }) => void` | Yes | Navigate the host app to a route |
| `seed` | `(target: string) => void` | No | Seed demo data into the host app |
| `prepareDemo` | `(journeyId: string) => void` | No | Host-provided pre-run setup — see [prepareDemo host contract](#preparedemo-host-contract) |

## Controller options

```ts
createDemoStudioController({
  journeys,          // DemoJourney[]
  navigate,          // required adapter
  seed,              // optional adapter
  prepareDemo,       // optional adapter
  mainScrollTestId,  // data-testid of the main scroll container (default: auto-detect)
  storageKey,        // localStorage key for persisted settings (default: "demo-studio-settings")
  defaultSettings,   // Partial<DemoStudioSettings> — override initial values
})
```

## Theming

Import `@leorami/demo-studio/styles.css` and override CSS variables in `:root` (or a scoped selector):

```css
:root {
  /* FAB and panel background (dark inverted theme) */
  --demo-studio-bg: #1a1a2e;
  --demo-studio-fg: #e2e8f0;

  /* Recording indicator */
  --demo-studio-record-bg: #dc2626;
  --demo-studio-record-fg: #ffffff;

  /* Panel field chrome */
  --demo-studio-panel-field-bg: rgb(255 255 255 / 0.06);
  --demo-studio-panel-field-border: rgb(255 255 255 / 0.12);
  --demo-studio-panel-accent: #6366f1;
}
```

Narration pills sit just below the reading finger (`--demo-studio-reading-finger-y`) and clamp inside the viewport so they do not collide with the launcher.

Full variable list: see `src/styles/demo-studio.css`.

Downstream hosts can map Demo Studio variables to existing **host theme tokens** so the panel matches the surrounding application chrome:

```css
:root {
  /* ExampleHost maps demo-studio tokens to its design system */
  --demo-studio-bg: var(--example-host-dev-tool-studio-bg);
  --demo-studio-fg: var(--example-host-dev-tool-studio-fg);
  --demo-studio-panel-accent: var(--example-host-accent);
  /* … */
}
```

Keep token names and mapping logic in the downstream application — upstream docs use neutral placeholders only.

---

## Publishing to GitHub Packages

```sh
# One-time: authenticate
npm login --registry=https://npm.pkg.github.com --scope=@leorami

# Build, then publish (from the repo root)
npm run build
npm publish
```

Requires a GitHub token with `write:packages` scope. Bump `version` in `package.json` before each publish.
