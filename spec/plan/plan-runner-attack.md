A) Findings (runner DOM refs + where to hook)

Runner DOM refs live in src/ui/domRefs.js: domRefs.game.runner (#runner-sprite) and domRefs.game.runnerWrap (.runner-wrap). These are the elements to toggle a kick/attack visual state.

Dash attack/defeat hook is in src/screens/dashGameScreen.js → submitAnswer(). When correct, it calls this.enemySystem?.defeatNearestEnemy(...) and stores defeatedEnemy. This is the right place to start a kick animation only when an enemy is actually defeated.

Existing runner feedback hooks: updateRunLayerVisuals() toggles runner classes (speed-glow, hit) and runnerWrap classes (is-fast, is-rapid); runner also gets runner-bob. The “hit” class is already used for slow-debuff feedback.

Enemy collision handling uses attackUntilMs for collision-hits in updateFrame(), so adding a separate “kick” visual needs to avoid interfering with attackUntilMs (gameplay logic) and should be applied to the runner’s DOM only.

B) Animation spec (timing + transforms)

Total duration: 300ms (within 250–350ms requirement).

Phases (applied via CSS keyframes on .runner-wrap or .runner):

Launch (0–80ms): small forward/upward translate + slight rotate (e.g., translate(6px, -6px) rotate(-6deg)).

Impact (80–180ms): peak forward/up + stronger rotate (e.g., translate(14px, -8px) rotate(-12deg)); this visually aligns to the enemy hit.

Recovery (180–300ms): return to base pose (translate(0, 0) rotate(0deg)), easing out.

Implementation note: keep transforms only, no top/left changes; respect existing bob by applying the kick on .runner-wrap (so the sprite can keep its bob) or combine transforms with CSS variables if applied to #runner-sprite.

C) Patch plan (by file)

src/screens/dashGameScreen.js

Add a KICK_MS const (e.g., 300) near other timing constants.

In submitAnswer(), after defeatNearestEnemy, when defeatedEnemy is true, set this.kickUntilMs = now + KICK_MS (and optionally this.kickTargetX = ... if aligning to enemy position).

In updateRunLayerVisuals() (or per-frame loop), toggle a CSS class on runnerWrap (e.g., .is-kicking) when nowMs <= this.kickUntilMs. This keeps gameplay logic untouched while driving the animation.

styles/style.scoped.css

Add keyframes @keyframes calc-sprint-runner-kick.

Add .calc-sprint .runner-wrap.is-kicking to apply animation: ... 300ms ease-out 1; and keep it transform-only. Avoid clobbering the runner-wrap transform from gameScreen (dash uses fixed left/top; it should be safe).

(Optional) src/ui/domRefs.js

No change needed unless you want a new ref; existing runnerWrap/runner are sufficient.

D) Acceptance checklist (visual + no gameplay regression)

✅ Runner plays a short “flying kick” animation only when a correct answer defeats an enemy (defeatNearestEnemy returns true).

✅ Animation duration ~300ms and follows launch → impact → recovery with transform-only changes.

✅ No changes to defeat rules, time bonuses, collision penalties, slow debuff, or knockback behavior.

✅ Existing runner bob/speed glow/slow hit feedback still works.

✅ No layout shifts; .runner-wrap stays anchored and only transforms.

Testing

Not run (PLAN mode).