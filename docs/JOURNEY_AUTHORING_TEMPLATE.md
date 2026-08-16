# Journey authoring template

Host-agnostic worksheet for documenting a single demo journey before implementation in a downstream application.

Copy this template into your host repo (one file per journey or a shared catalog) and fill in every section. Keep content generic — no production IDs, invite tokens, custody artifacts, or real user data.

## Related primitives (demo-studio PR #1)

This template aligns with upstream types and test helpers exported from `@leorami/demo-studio`:

- `JourneyAuthoringEntry` — canonical metadata shape
- `assertManifestMatchesJourneys()` — manifest/journey ID parity checks
- `scanDocForBannedContent()` — doc hygiene before publishing or sharing

Validate filled templates in CI with `scanDocForBannedContent()` and keep `JourneyAuthoringEntry.id` in sync with runtime `DemoJourney.id` values.

---

## Journey id

```
<journey-id>
```

Must match the runtime `DemoJourney.id` and any host manifest entry. Use kebab-case placeholder IDs in docs and tests.

## Title

```
<journey-title>
```

Short operator-facing label shown in demo picker UI.

## Audience

```
<internal | external | developer | stakeholder>
```

Who this journey is written for and who may watch recordings.

## Category

```
<onboarding | feature-tour | workflow | regression | showcase>
```

How hosts group journeys for cataloging and test selection.

## Purpose

```
<one-paragraph summary of what the journey proves or teaches>
```

What outcome a successful run demonstrates. Avoid product slogans tied to a single deployment.

## Scenario references

```
- <fixture or seed target id>
- <route id or screen reference>
- <data prerequisite description>
```

List host fixtures, routes, seeds, or mock data the journey depends on. Use placeholder identifiers only.

## Reset / replay expectations

```
requiresReset: <true | false>
idempotentReplay: <true | false>
notes: <what must be cleared or re-seeded between runs>
```

Document whether operators must reset host state before replay and whether consecutive runs should produce the same result.

## Privacy classification

```
<public | internal-only | sensitive | restricted>
```

Maps to `JourneyPrivacyClassification`. Governs external sharing, redaction, and review requirements.

## Sanitization notes

```
- <caption or screenshot redaction rule>
- <fields that must use synthetic data>
```

What authors must scrub before publishing docs, recordings, or templates derived from this journey.

## Test guidance

```
smoke: <true | false>
regression: <true | false>
manualVerification:
  - <observable checkpoint>
automatedChecks:
  - <test name or harness step>
```

Maps to `JourneyTestGuidance`. Tie to host test suites; do not embed host CI product names here.

## Downstream ownership

```
team: <host team name>
maintainer: <role or handle — no personal email in shared docs>
contact: <issue tracker or team channel>
```

Who maintains the journey in the host application. Product-specific setup and fixtures remain downstream.

## Upstream candidate notes

```
- <reusable step pattern that could move to demo-studio>
- <metadata field that might generalize upstream>
```

Optional feedback for generic patterns worth extracting to `@leorami/demo-studio`. Do not paste host-specific routes or deployment details.

---

## Autopilot targeting

```
click test ids:
  - <stable data-testid for each click step>
navigate waitForTestId:
  - <optional host-shell test id that must be mounted after routing>
scroll containerTestId:
  - <optional overflow container test id; omit to use the host main scroller>
```

Click steps poll until the target is visible. After `navigate`, set `waitForTestId` when the destination shell mounts asynchronously so autopilot does not click too early. Keep identifiers generic in this worksheet.

## prepareDemo reminder

Before autopilot starts, the host should implement `prepareDemo(journeyId)` to satisfy the reset/replay expectations above. See the **prepareDemo host contract** section in the package README for required behavior.
