Below is a PLAN-only response based on static inspection. No files were modified, and no commands executed beyond file reads. I cannot commit or create a PR in this mode.

A) Findings (exact file paths + functions + current return types/DOM hooks)
src/features/dashEnemySystem.js

system.defeatNearestEnemy({ playerRect, nowMs })

Current return type: boolean (true when a nearest alive enemy ahead is set to hit, else false).

Behavior: chooses nearest enemy in front (ignores enemies already behind player), calls system.setEnemyState(nearestEnemy, 'hit', nowMs), returns true/false.

system.setEnemyState(enemy, nextState, nowMs)

For 'hit': sets enemy.hitAtTs = nowMs + HIT_START_DELAY_MS and delays sprite swap.

Enemy rendering:

DOM element: img.enemy-sprite.

Transform: getEnemyTransform(enemy) uses translate3d(x,y,0) translateX(var(--enemy-hit-pull)) scale(var(--enemy-hit-scale)).

Hit flash/pull: HIT_START_DELAY_MS = 150, HIT_PULL_DURATION_MS = 80, HIT_PULL_PX = 16, HIT_FLASH_MS = 40, HIT_FLASH_SCALE = 1.03.

src/screens/dashGameScreen.js

submitAnswer()

On correct: calls this.enemySystem?.defeatNearestEnemy({ playerRect: this.getPlayerRect(), nowMs }).

If returned true: sets this.kickUntilMs = nowMs + KICK_MS (300ms).

No target info returned; only boolean used.

Runner DOM hooks:

updateRunLayerVisuals() toggles .runner-wrap.is-kicking while nowMs < kickUntilMs.

getPlayerRect() uses runnerWrap.getBoundingClientRect() relative to runWorld for logical collision bounds.

Runner wrap positioned with runnerWrap.style.left/top in updateRunnerGroundAlignment() (fixed layout).

Attack window is separate: this.attackUntilMs = nowMs + ATTACK_WINDOW_MS (250ms).

styles/style.scoped.css

.runner-wrap.is-kicking applies animation: calc-sprint-runner-kick 300ms ease-out 1;

@keyframes calc-sprint-runner-kick uses fixed translate values (max ~14px).

.enemy-sprite supports CSS vars --enemy-hit-pull and --enemy-hit-scale.

No runner lunge variables exist today.

B) Proposed API change for defeatNearestEnemy (minimal, target info)
Option (minimal change + update only call sites):
Change defeatNearestEnemy return value from boolean to an object:

{ defeated: boolean, target: { x, y, w, h } | null }
Why minimal: only one call site in dashGameScreen.submitAnswer() uses the boolean; we can update it to read result.defeated and use result.target for lunge.

What target represents: the enemy’s current rect in world coordinates (x,y,w,h), derived from the same enemy entity used for collision.

Alternative (if backward compatibility needed):
Keep defeatNearestEnemy returning boolean, and add getNearestEnemyAheadRect(playerRect) returning { x, y, w, h } | null.

Then submitAnswer calls getNearestEnemyAheadRect first to compute lunge, then calls defeatNearestEnemy to preserve boolean semantics.

This keeps existing logic intact but requires one extra method.

C) Runner lunge computation (formula + clamps + where computed)
Where: src/screens/dashGameScreen.js inside submitAnswer() immediately after defeatNearestEnemy succeeds.

Formula (visual-only):

desiredRunnerRight = target.x + target.w * 0.35 (contact point slightly inside enemy).

currentRunnerRight = playerRect.x + playerRect.w

rawLungePx = desiredRunnerRight - currentRunnerRight

lungePx = clamp(rawLungePx, 0, MAX_LUNGE_PX) with MAX_LUNGE_PX ~ 120–160 (start at 140 for 360px width).

Apply lungePx as a CSS variable on .runner-wrap (visual only): runnerWrap.style.setProperty('--kick-lunge-px', ${lungePx}px).

Constraints compliance:

This uses CSS transform only; no changes to playerRect logic.

Collision, defeat rules, timing, and spawn unaffected.

D) Patch Plan (by file; no code yet)
src/features/dashEnemySystem.js

Update defeatNearestEnemy to return { defeated, target } instead of boolean.

target should be a shallow rect { x, y, w, h } for the chosen enemy (use enemy’s current x,y,w,h).

Keep all logic for hit/defeat unchanged.

(If you choose the alternative) Add getNearestEnemyAheadRect(playerRect) that uses the same search logic to return enemy rect, and leave defeatNearestEnemy boolean.

src/screens/dashGameScreen.js

In submitAnswer():

Capture the new return object.

If defeated, compute lungePx using player rect + target rect.

Store lungePx in a new state field (e.g., this.kickLungePx) or directly set the CSS var on runnerWrap.

Clear or reset --kick-lunge-px when the kick ends (e.g., in updateRunLayerVisuals when not kicking).

In updateRunLayerVisuals():

When .runner-wrap.is-kicking is true, ensure the CSS variable is set.

When false, reset to 0px to avoid lingering transforms.

styles/style.scoped.css

Introduce CSS custom properties for lunge and optional vertical kick offsets:

--kick-lunge-px, --kick-raise-px, --kick-rot-deg with defaults.

Modify @keyframes calc-sprint-runner-kick to use these vars, with peak around 50–60%:

Example: translateX(var(--kick-lunge-px)) at 60% and ease back to 0 at 100%.

Ensure .runner-wrap transform uses only CSS variables (no layout shift), keeping logical position intact.

E) Acceptance checklist + quick manual test steps
Acceptance criteria

On correct answer that defeats an enemy, runner visibly overlaps or nearly overlaps the enemy at kick peak (50–60%).

Contact is visible on ~360px width (small viewport).

HUD, layout, collision detection, bonus/penalty timing unchanged.

No changes to defeat logic, attack window, collision penalties, slow debuff, spawn rules, max enemies, or grace period.

Quick manual test steps

Start Dash Run and answer correctly to trigger kicks.

Observe the kick when an enemy is in front—runner should visually lunge to contact at peak.

Confirm time bonuses (+5s) and penalties (-5s) unchanged.

Verify collision slow/knockback still occurs when running into enemies without correct answers.

Resize viewport to ~360px width and confirm contact is still visible.

Testing
Not run (plan-only).

Notes
I did not commit or create a PR because you explicitly required PLAN-only, read-only work (no file modifications).