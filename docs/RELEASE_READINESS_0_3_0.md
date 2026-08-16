# Release readiness: `@leorami/demo-studio` v0.3.0

**Assessment date:** 2026-08-16  
**Base branch:** `main` (post PRs #6–#8)  
**Status:** Documentation and version-bump PRs; tag `v0.3.0` and publish after merge

---

## Why 0.3.0

Tagged `v0.2.0` does not include caption placement, autopilot wait-for-testid, or screencast quality. GitHub Packages currently has `0.1.0` only. Shipping current `main` as **0.3.0** is a semver minor:

| PR | Scope | Semver |
|----|-------|--------|
| #6 | Captions sit below the reading finger | Patch (UI) |
| #7 | Click/navigate waits; `waitForTestId` step field and DOM exports | **Minor** — new public API |
| #8 | Screencast quality presets and page-contents-only capture | **Minor** — new settings and recorder options |

No breaking changes to existing exports or required adapter signatures.

---

## Public API added since 0.2.0

**Types / options**

- `DemoStep` navigate: optional `waitForTestId`
- `AutopilotOptions.elementWaitMs`
- `DemoStudioSettings.screencastQuality`, `hideBrowserChrome`
- `ScreencastRecorderOptions.quality`, `hideBrowserChrome`
- `ScreencastQuality`, `ScreencastQualityPreset`, `WaitForTestIdOptions`

**Functions / constants**

- `waitForTestId`, `queryTestId`, `isElementVisible`
- `SCREENCAST_QUALITIES`, `SCREENCAST_QUALITY_PRESETS`, `resolveScreencastQuality`

---

## Checks

| Check | Result |
|-------|--------|
| `npm test` | Required green before merge |
| `npm run typecheck` | Required green before merge |
| `npm run build` | Required; committed `dist/` must match |
| `npm pack --dry-run` | After version bump: `dist/`, `README.md`, `CHANGELOG.md`, `docs/JOURNEY_AUTHORING_TEMPLATE.md` |

---

## Publish target

GitHub Packages (`publishConfig.registry`: `https://npm.pkg.github.com`). Not configured for npmjs.org.

```sh
git tag -a v0.3.0 -m "Release v0.3.0: autopilot waits, screencast quality, caption placement"
git push origin v0.3.0
npm run build
npm pack --dry-run
npm publish
```

Requires a GitHub token with `write:packages`. Bump `package.json` / `package-lock.json` to `0.3.0` before publish.

---

## Out of scope

- No host-application changes
- No npmjs.org registry switch
- No secrets committed
