# ADR Acceptance Checklist (Manual Runner)
- Timestamp: 2026-02-06T09:12:00+00:00
- Overall: PASS

## ADR Status
- ADR-001: 達成
- ADR-002: 達成
- ADR-003: 達成
- ADR-004: 達成
- ADR-005: 達成
- ADR-006: 達成

## Checks
- [PASS] S1 ADR-004 CSS selectors are fully scoped under .calc-sprint
- [PASS] S2 ADR-004 index.html references scoped CSS only
- [PASS] S3 ADR-004 legacy global CSS is removed from distribution
- [PASS] S4 ADR-006 keyframes/property names are prefixed to avoid global collisions
- [PASS] M1 ADR-002 profile selection is required on launch
- [PASS] M2 ADR-002 storage keys are separated per profile
- [PASS] M3 ADR-002 profile reset clears only targeted keys
- [PASS] M4 ADR-001 next stage unlocks after result (markCleared)
- [PASS] M5 ADR-003 action layer drives submit/back/next, Enter is shortcut, keypad is available
- [PASS] M6 ADR-005 SSoT references and acceptance record updated
- [PASS] M7 ADR-006 action contract supports Backspace/Delete and NumpadEnter

## Evidence
### S1 ADR-004 CSS selectors are fully scoped under .calc-sprint
Status: PASS

All selector lines in styles/style.scoped.css are scoped under .calc-sprint.

### S2 ADR-004 index.html references scoped CSS only
Status: PASS

index.html references styles/style.scoped.css: YES
index.html references styles/style.css: NO
index.html references styles/legacy/style.css: NO

### S3 ADR-004 legacy global CSS is removed from distribution
Status: PASS

styles/legacy/ directory removed.

### S4 ADR-006 keyframes/property names are prefixed to avoid global collisions
Status: PASS

1. Inspect styles/style.scoped.css for @keyframes/@property definitions.
2. Confirm they are prefixed with calc-sprint-.

### M1 ADR-002 profile selection is required on launch
Status: PASS

1. Load the app at the root URL.
2. Confirm profile selection screen is shown before title/settings.

### M2 ADR-002 storage keys are separated per profile
Status: PASS

1. Select profile A, play once, reach result screen.
2. Select profile B, play once, reach result screen.
3. Confirm localStorage keys are namespaced with p:A and p:B.

### M3 ADR-002 profile reset clears only targeted keys
Status: PASS

1. From settings, click "このプロファイルをリセット" for profile A.
2. Confirm profile A daily/rank/stage keys are removed.
3. Confirm profile B keys remain.

### M4 ADR-001 next stage unlocks after result (markCleared)
Status: PASS

1. In stage mode, play stage w1-1 and reach the result screen.
2. Confirm stage w1-2 is unlocked in stage select after the result is shown.

### M5 ADR-003 action layer drives submit/back/next, Enter is shortcut, keypad is available
Status: PASS

1. On game screen, answer using the "確定" button (no Enter required).
2. Use Enter as a shortcut to submit; confirm it behaves as a shortcut.
3. Open the on-screen keypad and input digits + backspace; confirm answer updates.

### M6 ADR-005 SSoT references and acceptance record updated
Status: PASS

1. Confirm README links to spec/product-spec.md and spec/tech-spec.md.
2. Confirm this acceptance record is the latest artifact.

### M7 ADR-006 action contract supports Backspace/Delete and NumpadEnter
Status: PASS

1. On game screen, enter digits.
2. Use Backspace/Delete to remove digits; confirm delete works and respects lock/time-up.
3. Use NumpadEnter or Enter to submit; confirm it behaves as submit shortcut.

## Unresolved Issues
- None
