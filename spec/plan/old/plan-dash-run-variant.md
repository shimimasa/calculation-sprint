# Dash Run Variant — Implementation Plan

Status: Approved (Plan-level)
Type: Non-SSoT / Implementation Plan
Related Specs:
- spec/product-spec.md (SSoT)
- spec/tech-spec.md (SSoT)
- spec/new-product-spec.md (Delta spec)

Note:
This document constrains implementation scope.
Anything listed under “What is intentionally deferred” MUST NOT be implemented
without revising this plan.



Revised Plan (Dash Run Variant)
Specs used

SSoT: spec/product-spec.md, spec/tech-spec.md

Delta spec: spec/new-product-spec.md (non-SSoT, additive guidance only)

Integration choice:
Option B — separate dashGameScreen and dashResultScreen, registered and transitioned via existing screenManager.changeScreen pattern. No routing changes. All events are registered through eventRegistry and cleared on exit.

Feature 1 (PR1): Dash entry + screen registration (single entry point)
Goal / Scope
Add a single Dash entry point (one screen only; e.g., titleScreen) and register new Dash screens (dashGameScreen, dashResultScreen) using the existing screenManager pattern.

Do NOT do

Do not add Dash entry on multiple screens in the same PR.

Do not introduce new routing paradigms.

Do not add new inputActions.

Do not modify existing game modes’ flows.

Files likely to change

src/main.js (register new screens)

src/screens/titleScreen.js (single Dash entry)

src/ui/domRefs.js (new DOM refs for Dash screens)

index.html (Dash screen markup container)

styles/style.scoped.css (scoped button styles)

State additions (clear location)

Minimal global addition: gameState.playMode accept 'dash' (if mode is already enum-like).

Dash state must NOT be added top-level (reserved for Feature 2).

Acceptance criteria

Dash entry appears on only one screen.

Screen transition uses screenManager.changeScreen.

Dash can be started, played, ended, and exited using only on-screen controls (no Enter key).

Existing modes’ screen transitions remain unchanged.

Refer to acceptance checks in spec/test-results/adr-acceptance-latest.md (T1–T6) where relevant.

Risks & mitigations

InputActions invariant: ensure existing on-screen buttons use submit/back/next/toggle_keypad only.

Subpath: no absolute URLs in new DOM.

CSS scope: all styles under .calc-sprint.

Feature 2 (PR2): Dash state & constants foundation (namespaced)
Goal / Scope
Introduce Dash state and constants without polluting top-level gameState. Only state required for Dash gameplay should be added under gameState.dash.*. Prefer local state inside dash screen when possible.

Do NOT do

Do not add many top-level dash* fields.

Do not implement gameplay or UI yet.

Do not add new inputActions.

Files likely to change

src/core/gameState.js (add dash object only)

src/features/dashConstants.js (new constants module)

State additions (clear location)

gameState.dash = { ... } with minimal required fields (e.g., session stats for results).

Prefer keeping transient values (e.g., enemy position) local to dashGameScreen.

Parameter defaults (placeholders in constants)

baseSpeed, speedIncrementPerCorrect, enemyBaseSpeed,
enemySpeedIncrementPerStreak, collisionThreshold,
timePenaltyOnCollision, timeBonusOnDefeat,
streakAttack = 3, streakDefeat = 5
All in one constants file and referenced from logic.

Acceptance criteria

Dash state added only under gameState.dash.

No dash-related top-level fields introduced.

Existing state for non-dash modes unchanged.

Reference spec/test-results/adr-acceptance-latest.md (T1–T6) as applicable.

Risks & mitigations

State isolation: enforce namespace under gameState.dash.

Future persistence: keep only required result fields in gameState.dash, keep transient values local.

Feature 3 (PR3): Dash gameplay loop (core mechanics)
Goal / Scope
Implement core Dash mechanics in dashGameScreen: auto-run, math question flow, streak-driven speed, enemy chase, collision penalty, attack/defeat thresholds.

Do NOT do

Do not modify gameScreen.js.

Do not add new inputActions.

Do not add ranking/leaderboard.

Do not add assets.

Files likely to change

src/screens/dashGameScreen.js (new)

src/core/eventRegistry.js (register dash events)

src/core/inputActions.js (reuse only; no changes)

src/features/questionGenerator.js (reuse)

src/core/timer.js (if needed for update loop reuse)

State additions (clear location)

Transient gameplay state stays local in dashGameScreen.

Only result-necessary values stored in gameState.dash (e.g., distance, correct, wrong, streak).

Acceptance criteria

Dash gameplay works end-to-end using on-screen keypad only (no Enter key required).

submit/back/next/toggle_keypad are the only actions used.

Events are registered via eventRegistry and cleared on exit.

screenManager.changeScreen handles transitions.

Reference spec/test-results/adr-acceptance-latest.md (T1–T6), especially T6 input wiring.

Risks & mitigations

InputActions contract: no new actions; ensure keypad supports full gameplay.

Event cleanup: call events.clear() on exit to avoid duplicate handlers.

Subpath: avoid absolute references.

Feature 4 (PR4): Dash UI & scoped visuals (no white background)
Goal / Scope
Create Dash UI and visuals with scoped CSS: HUD, background, enemy indicator, question panel. Ensure “no white background” without touching global styles.

Do NOT do

Do not use global selectors (body/html/:root).

Do not add unprefixed keyframes/custom properties.

Do not change existing global layout.

Files likely to change

index.html (dash layout)

styles/style.scoped.css (Dash styles under .calc-sprint)

src/ui/domRefs.js (Dash HUD refs)

State additions (clear location)

None required beyond existing Dash state.

Acceptance criteria

Dash UI is scoped under .calc-sprint.

No global CSS added.

Keyframes/custom properties prefixed with calc-sprint-.

Background is not white (per Dash spec) using scoped styles only.

Reference spec/test-results/adr-acceptance-latest.md (T1–T6) for CSS scope checks.

Risks & mitigations

CSS collisions: scoped selectors only.

Reduced motion: ensure animation intensity can be reduced using prefers-reduced-motion within Dash styles.

Feature 5 (PR5): Dash result screen + storage (profile-scoped)
Goal / Scope
Introduce a dedicated dashResultScreen for Dash outcomes. Persist only required Dash stats in profile-scoped storage.

Do NOT do

Do not modify resultScreen.js beyond minimal routing if unavoidable.

Do not add rankings or cross-profile comparisons.

Do not use “clear/complete/合格/習得” wording.

Files likely to change

src/screens/dashResultScreen.js (new)

index.html (Dash result markup)

src/ui/domRefs.js

src/core/storageKeys.js (new Dash store names)

src/core/*Store.js (new Dash store module, if needed)

State additions (clear location)

gameState.dash.result (minimal: distance, correct, wrong, streak, time left).

Persist only what’s needed for result display (e.g., daily stats).

Storage key naming (aligned with existing patterns)

Example:

calc-sprint::<profile>::dash.daily.v1

calc-sprint::<profile>::dash.session.v1 (if needed)
No ranking keys.

Acceptance criteria

Dash results shown on dashResultScreen without affecting existing resultScreen flows.

Storage keys are profile-scoped and use calc-sprint namespace.

No ranking/leaderboard shown.

Reference spec/test-results/adr-acceptance-latest.md (T1–T6), especially storage separation checks.

Risks & mitigations

Storage separation: use makeStoreKey(profileId, ...) only.

Result isolation: new screen prevents regression in standard results.

Feature 6 (PR6): Optional audio hooks + reduced-motion handling
Goal / Scope
Wire optional Dash audio using existing audioManager, and reinforce reduced-motion behavior via Dash-specific visuals.

Do NOT do

Do not add new audio assets.

Do not add audio-related motion toggles as the primary reduced-motion solution.

Files likely to change

src/core/audioManager.js (reuse existing patterns if needed)

styles/style.scoped.css (Dash reduced-motion variants)

State additions (clear location)

None required.

Acceptance criteria

Dash audio is optional and consistent with existing AudioManager behavior.

prefers-reduced-motion reduces animation intensity in Dash visuals.

Reference spec/test-results/adr-acceptance-latest.md (T1–T6) where relevant.

Risks & mitigations

Accessibility: ensure Dash visuals remain playable with reduced motion.

Audio optionality: default safe to off or reuse existing toggles.

What is intentionally deferred beyond this plan
Tuning/balancing of speed, penalties, and streak thresholds (human decision required).

New visual/audio assets (animations, backgrounds, SFX/BGM).

Ranking/leaderboards (explicitly deferred due to Product SSoT constraints).

Any new routing or SPA changes (out of scope by Tech SSoT).