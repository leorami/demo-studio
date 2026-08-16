# Changelog

All notable changes to `@leorami/demo-studio` are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] — 2026-08-16

Additive, backward-compatible release on top of tagged `v0.2.0`. Includes GitHub pull requests #6–#8.

### Added

- Navigate steps may set `waitForTestId` so autopilot waits for a host-mounted element after routing.
- Public DOM helpers: `waitForTestId`, `queryTestId`, `isElementVisible`, and `WaitForTestIdOptions`.
- `AutopilotOptions.elementWaitMs` (default 12s) for click and post-navigate waits; abort cancels in-flight polls.
- Screencast quality presets: `low` (720p), `standard` (1080p), `high` (1080p / higher bitrate), `maximum` (1440p).
- Page-contents-only capture (`hideBrowserChrome`, on by default): prefer this tab, exclude monitor surfaces, and enter fullscreen after the share picker.
- Operator settings for quality and page-contents-only capture persist in `localStorage`.
- Narration captions render just below the reading finger and clamp inside the viewport.

### Changed

- Click steps poll until the target is visible instead of silently skipping a missing `data-testid`.
- Scroll prefers an explicit container test id and skips full-page scrolling when nothing is scrollable.
- Missing click targets log a warning and continue the journey.

## [0.2.0] — 2026-07-09

First consumable public API after the `0.1.0` baseline. Tagged as `v0.2.0`.

### Added

- Journey authoring primitives (`JourneyAuthoringEntry` and related types).
- Test helpers `assertManifestMatchesJourneys()` and `scanDocForBannedContent()`.
- Journey authoring template and documented `prepareDemo` host contract.
- Host-agnostic README examples and hygiene tests.
- `files` whitelist for GitHub Packages publish (`dist`, `README.md`, `docs/JOURNEY_AUTHORING_TEMPLATE.md`).

## [0.1.0] — 2026-06-20

Initial package: autopilot runner, screencast recorder, and React / Preact admin UI.
