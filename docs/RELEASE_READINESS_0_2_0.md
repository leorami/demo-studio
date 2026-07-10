# Release readiness: `@leorami/demo-studio` v0.2.0

**Assessment date:** 2026-07-09  
**Base branch:** `main` @ `5e02b021576d6d08b4ef24d74d91e7d865351e98`  
**Assessor:** Plan E5 — Tag/Package Readiness Review  
**Status:** Release-prep PR (Plan E6) addresses version bump, `files` whitelist, and README publish path; ready for tag after merge

---

## Release-prep decisions (Plan E6)

| Item | Decision |
|------|----------|
| Version | `0.1.0` → `0.2.0` in `package.json` and `package-lock.json` |
| `files` whitelist | `dist`, `README.md`, `docs/JOURNEY_AUTHORING_TEMPLATE.md` — exports point to built artifacts only; no `src/` or test tooling in tarball |
| README publish path | Publishing section uses repo-root `npm run build` + `npm publish` (removed stale `cd packages/demo-studio`) |

---

## Current version

`0.1.0` (in `package.json` and `package-lock.json`)

No git tags exist. No package has been published to any registry.

---

## Recommended next version

**`0.2.0`**

### Why semver minor (not patch)

PRs #1–#3 land additive, backward-compatible public API and documentation on top of the pre-release `0.1.0` baseline:

| PR | Scope | Semver impact |
|----|-------|---------------|
| #1 | New exported types (`JourneyAuthoring*`) and helpers (`assertManifestMatchesJourneys`, `scanDocForBannedContent`); vitest harness; `package-lock.json` | **Minor** — new public exports |
| #2 | `docs/JOURNEY_AUTHORING_TEMPLATE.md`; documented `prepareDemo` host contract in README | **Minor** — new documented adapter surface (type already in `DemoStudioAdapters`) |
| #3 | Host-agnostic README cleanup + regression test | **Patch** — docs/tests only |

Bundled together, **0.2.0** correctly signals the first consumable release that includes authoring primitives and the `prepareDemo` contract. Staying at `0.1.0` would under-represent the new public surface relative to any downstream adoption or submodule pin.

A **major** bump is not warranted: no breaking changes to existing exports or runtime behavior.

---

## Public API changes (PRs #1–#3)

### PR #1 — authoring primitives

**New types** (from `@leorami/demo-studio`):

- `JourneyAuthoringEntry`
- `JourneyAuthoringAudience`
- `JourneyAuthoringCategory`
- `JourneyPrivacyClassification`
- `JourneyOwnership`
- `JourneyResetReplayExpectation`
- `JourneyTestGuidance`
- `JourneyIdSource`, `ManifestIdEntry`
- `DocHygieneOptions`, `DocHygieneViolation`

**New functions:**

- `assertManifestMatchesJourneys(journeys, manifest)`
- `scanDocForBannedContent(content, options?)`

**Infrastructure:** vitest harness, `package-lock.json`, rebuilt `dist/core/*`.

### PR #2 — journey template + `prepareDemo` contract

**Documentation only in repo artifacts:**

- `docs/JOURNEY_AUTHORING_TEMPLATE.md`
- README section documenting `prepareDemo?: (journeyId: string) => void` host contract

**Runtime:** `prepareDemo` was already optional on `DemoStudioAdapters`; controller invokes it before autopilot start. PR #2 documents the contract; no signature change.

### PR #3 — host-agnostic README cleanup

- README examples use neutral placeholders (no kyzmet/OS Lab-specific routes)
- `tests/readme-host-agnostic.test.ts` guards banned host-specific strings

---

## Export verification

`package.json` `exports` map:

| Subpath | Types | JS | Status |
|---------|-------|-----|--------|
| `.` | `dist/core/index.d.ts` | `dist/core/index.js` | OK — includes all PR #1 authoring exports |
| `./react` | `dist/react/index.d.ts` | `dist/react/index.js` | OK |
| `./preact` | `dist/preact/index.d.ts` | `dist/preact/index.js` | OK |
| `./styles.css` | — | `dist/demo-studio.css` | OK |

All four export targets exist on disk and match committed `dist/` after `npm run build` (no dirty tree).

Peer dependencies (`preact`, `react`, `react-dom`) are optional via `peerDependenciesMeta`.

---

## Build / dist verification

| Check | Result |
|-------|--------|
| `npm test` | 33 passed (6 files) |
| `npm run typecheck` | Pass |
| `npm run build` | Pass — ESM + DTS for core/react/preact, CSS bundle |
| `dist/` committed | Yes — 7 tracked files under `dist/` |
| Build dirty tree | No — committed `dist/` matches fresh build |

**Convention:** README states *"The `dist/` directory is pre-built and committed"* for git/submodule copy workflows. Release workflow should run `npm run build` and commit any `dist/` delta when source changes (already satisfied on `main`).

---

## Publish target assessment

**Known target: GitHub Packages (npm)**

Evidence:

- `package.json` → `publishConfig.registry`: `https://npm.pkg.github.com`
- `publishConfig.access`: `public`
- README documents GitHub Packages install (`.npmrc` scope `@leorami`) and publish (`npm login` + `npm publish`)

**Not configured for:** public npmjs.org registry.

**Pre-publish gap (addressed in Plan E6 PR):** `files` whitelist added — `dist`, `README.md`, `docs/JOURNEY_AUTHORING_TEMPLATE.md`. Baseline `npm pack --dry-run` without `files` included 49 files (`src/`, `tests/`, vitest/tsconfig tooling); post-PR dry-run should include only publish artifacts.

**README publish path (addressed in Plan E6 PR):** Publishing section updated to repo-root commands; workspace-copy section still documents monorepo `packages/demo-studio/` layout for git-copy adopters.

---

## `package-lock.json`

**Intentional.** Introduced in PR #1 with the vitest/jsdom dev toolchain. Lockfile is tracked in git and pins reproducible CI/local installs. Appropriate for an npm-published package.

---

## Tag recommendation

**Recommend creating tag `v0.2.0`** after a release-prep PR merges that:

1. Bumps `version` to `0.2.0` in `package.json` and `package-lock.json`
2. Optionally adds `files` field before publish

Tag is **recommended before** downstream `kyzmet-ui` submodule bump so consumers can pin `v0.2.0` or `@leorami/demo-studio@0.2.0`.

**Exact future tag command (not executed):**

```sh
git checkout main
git pull origin main
git tag -a v0.2.0 -m "Release v0.2.0: authoring primitives, journey template, prepareDemo contract"
git push origin v0.2.0
```

---

## Publish recommendation

**Defer publish** until Leo authorizes Plan E6 (or equivalent) and `files` field is added.

Submodule/git-copy adoption does **not** require registry publish. GitHub Packages publish is optional for consumers who prefer `npm install` over submodule pin.

**Exact future publish command (not executed):**

```sh
npm login --registry=https://npm.pkg.github.com --scope=@leorami
npm run build
# verify dist clean / committed
npm publish
```

Requires GitHub token with `write:packages`. Version in `package.json` must be `0.2.0` (or target version) before publish.

---

## Downstream adoption prerequisites

For `kyzmet-ui` (or other hosts):

1. **Tag or SHA pin** — submodule/adoption should reference `v0.2.0` tag (or post-bump `main` SHA), not pre-PR #1 history
2. **Registry auth** — if using GitHub Packages: project `.npmrc` with `@leorami:registry=https://npm.pkg.github.com` and `read:packages` token
3. **Host adapters** — implement `navigate`, optional `seed`, optional `prepareDemo` per README contract
4. **Authoring** — use `JourneyAuthoringEntry` + `docs/JOURNEY_AUTHORING_TEMPLATE.md`; validate with `assertManifestMatchesJourneys` and `scanDocForBannedContent` in CI
5. **Framework entry** — `@leorami/demo-studio/preact` or `/react` plus `./styles.css`
6. **No kyzmet-ui changes in this Plan** — submodule bump is a separate authorized Plan

---

## Branch hygiene

Merged remote branches still exist (cleanup deferred):

- `issue/authoring-primitives`
- `issue/authoring-template-prepare-demo-contract`
- `issue/readme-host-agnostic-cleanup`

Safe to delete after Leo authorizes; not required for release.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| No `files` field → bloated npm tarball | Medium | Add `files` before first `npm publish` |
| README publish path `packages/demo-studio` | Low | Update README in release-prep PR |
| First publish never done — no registry smoke test | Low | Dry-run `npm pack` before publish |
| `0.1.0` never published — version jump may confuse | Low | Document in release notes; 0.2.0 is first public API-complete release |
| Merged feature branches clutter remote | Low | Delete when authorized |

---

## Non-goals (this Plan)

- No tag created
- No package published
- No `kyzmet-ui` changes or submodule bump
- No airluum / kyzmetOS changes
- No branch deletion
- No direct push to `main`
- No secrets committed

---

## Recommended next Plan

**Plan E7 — Tag and optional publish** (separate authorization):

1. Merge Plan E6 release-prep PR
2. Tag `v0.2.0`
3. Optional: `npm publish` to GitHub Packages
4. **Plan E8** (or kyzmet-ui Plan): submodule bump to `v0.2.0`
