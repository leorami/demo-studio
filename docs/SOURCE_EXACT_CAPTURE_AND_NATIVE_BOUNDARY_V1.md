# Demo Studio capture evidence: browser now, native adapter separately

Status: **CTO SOURCE CANDIDATE, DRAFT / NOT PUBLISHED** (2026-11-18). Owner requested cross-project screenshots without activating the owner's desktop, publishing private photographs, or mistaking synthetic previews for native pixels. This file describes the actual source candidate on this branch, not a shipped consumer integration.

## Current capability and limits

Demo Studio v0.3.0 has guided browser journeys and a video recorder based on `getDisplayMedia`. Its existing recorder invokes the browser's share picker. It cannot silently record a native macOS window or capture `WKWebView` pixels without a host adapter. The existing upstream PR #11 adds opt-in `runAutopilot({strict:true})`, which fails closed on absent click/navigation markers but still cannot prove product persistence, source parity or visual UAT.

This candidate adds a **separate CLI script** `scripts/capture-local-browser.mjs` for original still PNGs of an already running local **synthetic browser route**. It invokes host-provided `playwright-core` with a user-supplied trusted Chromium binary, headless and with its own transient browser context. It does **not** start another app, borrow an existing browser profile, navigate a signed-in owner session, use the desktop screenshot API, or invoke the browser share picker.

Host must independently expose, on the route to be captured, HTTP 200 `text/html`, `X-Demo-Source-Commit: <current 40-hex Git HEAD>` and `X-Demo-Synthetic-Only: true`. These headers are **host assertions**—not cryptographic evidence that every served asset equals the Git commit or that no private information is visible. Only deliberately synthetic routes whose operator has actually inspected them should set them. The CLI rejects missing, changed or nonlocal headers, cross-origin network requests, redirect/failed navigation, remote URLs, userinfo, and potentially secret-bearing query strings. The rest of the privacy guarantee still depends on the trusted host. The output stays in a local operator-chosen directory, not Git or CI by default.

The output pairs original PNG bytes with a JSON manifest recording the requested and actual image dimensions, PNG SHA-256, source Git SHA, served Git SHA, browser-only classification, capture date, and explicit `nativeUat:false` / `ownerUat:false`. That is a **browser screenshot** of a claimed-synthetic rendered route; not a source-exact **native** screenshot or owner UAT PASS. The operator must independently check the resulting PNG and package/build source parity before labeling it for product feedback.

### Existing local browser source-capture example

Prerequisites: a trusted host application already serving an **explicitly synthetic**, public-safe local route and source-SHA headers; Node 22+, git, Playwright Core available to the invoking script, and a trusted local Chromium executable. Do not install a browser, grant permissions, or launch another instance of an owner app merely because this script exists.

```sh
node scripts/capture-local-browser.mjs \
  --url http://127.0.0.1:5173/synthetic/photos \
  --repo /path/to/source-checkout \
  --sha <actual-full-40-character-commit> \
  --out /private/operator-controlled/approved-synthetic-only \
  --id photos-first-fold --browser /absolute/path/to/chromium \
  --width 390 --height 844
```

The `--out` directory must already exist. Never substitute an external or signed-in/private URL. This generic candidate uses only SHA-pinned local browser evidence and a deliberately independent script; the package's normal demo journeys/React/Preact adapters are unchanged.

### Native macOS: separate host capability, not a browser flag

Native `WKWebView` content is not equivalent to a Chromium rendering. A truthful Calliope native capture requires its own **debug-only, explicitly authorized, same-owner/same-build** host adapter with the platform's `WKWebView.takeSnapshot(with:completionHandler:)` and `WKSnapshotConfiguration` or other tested macOS-native mechanism. The adapter must:
- prove which **actual running window/webview**, installed binary/build/source, selected AP, scene, and exact rendered state it captured; reject if source/build is stale;
- never elevate the owner's current foreground app, change focus, choose other users/APs, reveal arbitrary macOS windows or run in a second GUI session without verified isolation;
- prove that pixels are captured **after** the relevant UI update, with actual viewport size/DPR and original PNG integrity, including negative cases where a background/hidden webview yields stale/blank pixels;
- keep owner-private captures strictly local with access control, short retention and an approved private transport; public/CI artifacts may contain **only separately screened synthetic pixels**;
- declare `NATIVE_WKWEBVIEW` only for actual platform-captured bytes; honest `BLOCKED_NATIVE_CAPTURE` or `SOURCE_MISMATCH` otherwise; source evidence + test PASS are not owner UAT.
- never assume a background WebView supports full window compositor/chrome or private image rendering without an actual tested adapter.

**The native adapter has NOT been authored, executed, installed, or validated by this upstream PR.** Plan139 in `leorami/calliope` returned with source changes but genuine native screenshot/cold-reopen still HOLD. Its actual app code, dirty owner Mac checkout and privileged media remain outside this upstream source change.

## Test/evidence contract

New Node built-in source tests verify browser source/hash, refusal when served SHA is stale, privacy header absence, nonloopback/credential URLs, and wrong repo SHA using an injected fake Playwright provider. These tests prove the script's **decision path**, not that a production Chrome UI or native macOS screenshot was captured. In a separately authorized suitable Linux/Mac runner, execute a real Chromium probe with a genuine synthetic local host and verify PNG pixels before enabling a consumer. Run full `npm ci && npm test && npm run typecheck && npm run build` before any package release. No npm release, protected branch merge, deployment, local app focus, model work, credentials or owner UAT has been performed here.

## Existing sibling evidence transport

Calliope's PR #221 already has a separate original-PNG / source-snippet packer and artifact manifest; its successful GitHub Actions run uploaded **zero** screenshot artifacts. Do not replace it with a second workflow. Lumen project source-verified original synthetic PNG artifact transport was observed and can inform final owner-visible bytes, but Lumen pixels are not Calliope native pixels. Demo Studio should capture, the project-specific evidence packer should verify/classify/transport, and CTO should inspect actual PNGs and display originals inline in the owner conversation—never claim that a link or artifact path was rendered.
