A) Repo Findings

src/main.js registers the Dash Run screen (dash-game) via dashGameScreen.

src/screens/dashGameScreen.js is the Dash Run entry point (enter), update/tick loop (startLoop → updateFrame), and render/visual updates (updateRunLayerVisuals, updateHud).

submitAnswer() in src/screens/dashGameScreen.js is where “correct answer” processing happens and current enemy speed/gap logic is updated.

Player positioning and ground reference are computed in dashGameScreen.updateRunnerGroundAlignment() and stored in gameState.run.groundSurfaceY / gameState.run.groundY.

Collision is currently handled abstractly via enemyGapM and collisionThreshold inside updateFrame() in dashGameScreen.

src/ui/domRefs.js exposes Dash HUD elements (including enemy proximity UI) and run-layer elements (runner, run-world, etc.).

index.html contains the .run-layer and .run-world DOM used for the runner; Dash Run moves this layer into its screen during enter().

styles/style.scoped.css likely defines run-layer visuals; no explicit enemy sprite styles found yet.

src/features/dashConstants.js defines enemy speed/collision constants used in Dash Run.

Missing SSoT: enemy-plan.md is not present in the repo (could not locate via rg).

Assets note: assets/enemy/ is not present in the current repo layout.

B) Implementation Plan (step-by-step)

Step 0: Prerequisites

Locate/restore enemy-plan.md (SSoT) and confirm enemy assets exist at assets/enemy/enemy_${type}_${state}.png.

Confirm desired enemy timing constants if specified in enemy-plan.md (e.g., spawn cadence, hit/dead durations, attack window duration).

Step 1: Define Enemy System module

Add a minimal enemy system module (e.g., src/features/dashEnemySystem.js) responsible for:

Spawning enemies off-screen right, moving left, and removing once off-screen left.

Tracking enemy state: walk → hit (120ms) → dead (300ms) → removed.

Maintaining a list of active enemies with per-entity fields: id, type, state, x, y, width, height, speedPxPerSec, spawnTs, stateUntilTs, el, hitAtTs.

Step 2: Integrate enemy system into Dash Run lifecycle

In dashGameScreen.enter():

Initialize the enemy system (create container in .run-world if not present).

Reset attack window tracker (e.g., this.attackUntilMs = 0).

In dashGameScreen.exit():

Dispose of enemy elements and timers to avoid leaks.

Step 3: Hook into update loop

In dashGameScreen.updateFrame(dtMs):

Convert enemySpeed (m/s) into pixel speed using run-world width or a constant conversion (per spec if provided).

Update enemy positions and animations each tick.

Compute AABB between player and each enemy. If collision occurs:

If inside attack window (now <= attackUntilMs), transition enemy to hit then dead, then remove (no game over).

Otherwise, preserve current behavior: play SFX, apply penalty/time, and endSession('collision').

Update HUD proximity using nearest enemy distance (replace enemyGapM usage with distance to closest enemy).

Step 4: Hook attack window on correct answers

In dashGameScreen.submitAnswer() after a correct answer:

Set attackUntilMs = now + ATTACK_WINDOW_MS (value from enemy-plan.md).

Optionally trigger enemy “hit” feedback when collision occurs during that window.

Step 5: Rendering and assets

Render enemies as <img> or <div> elements positioned in .run-world.

Use the asset path rule assets/enemy/enemy_${type}_${state}.png.

Add minimal CSS in styles/style.scoped.css for size/positioning (e.g., .enemy-sprite, z-index vs. runner).

Step 6: Keep game runnable

Ensure no change breaks the Dash game loop, screen navigation, or audio.

Make enemy system opt-in to Dash Run only; do not affect normal game screen.

C) Patch Plan (by file)

File: src/features/dashEnemySystem.js (new)

Change: Add an enemy manager with spawn/update/render/cleanup methods, AABB helpers, and state transition timers (walk→hit→dead).

Rationale: Encapsulates enemy logic to minimize changes to Dash screen logic.

File: src/screens/dashGameScreen.js

Change: Instantiate enemy manager in enter(), update it in updateFrame(), and dispose in exit().

Change: On correct answer in submitAnswer(), set attackUntilMs to enable the brief attack window.

Change: Replace enemyGapM usage with “distance to closest enemy” from the enemy system, for HUD proximity.

Rationale: Hook points for spawn/movement/collision and for the attack window.

File: src/ui/domRefs.js

Change: Add refs for a new enemy container if created in HTML (e.g., .run-enemies), or rely on query within enemy system.

Rationale: Centralized DOM access for the enemy layer.

File: index.html

Change: Add an enemy container inside .run-world (e.g., <div class="run-enemies"></div>) to host enemy sprites.

Rationale: Stable DOM anchor for enemy rendering.

File: styles/style.scoped.css

Change: Add styles for enemy sprites, sizing, and z-layering vs. runner and ground.

Rationale: Visual clarity and proper placement.

D) Acceptance Checklist

 Enemy sprites spawn from the right edge and move left across the run-world.

 Enemies spawn repeatedly after removal.

 AABB collision with the player ends the run (collision) when no attack window is active.

 Right after a correct answer, collisions produce hit→dead→remove instead of game over.

 Enemy states used are only walk, hit, dead.

 Enemy types used are only plus, minus, multi, divide, with paths assets/enemy/enemy_${type}_${state}.png.

 Dash Run loop, screen navigation, and audio behavior remain intact.

E) Risks / Unknowns

enemy-plan.md is missing in the repo; SSoT details (timings, spawn rules, scaling) cannot be confirmed. Next: locate or restore the file and re-align the plan.

assets/enemy/ does not exist in this repo. Next: verify asset paths or ensure assets are added.

No existing image cache for enemy sprites; need to confirm if preloading is required for smooth animation.

The AABB dimensions for the player are not explicitly defined; likely need to derive from runnerWrap/runner DOM bounds and gameState.run.groundY.