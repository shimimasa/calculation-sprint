Architectural Diagnosis (what’s wrong and why)
1) Dash is currently using two competing background systems
Dash has:

a pseudo-element background system on .screen-dash::before (sky) + .screen-dash::after (clouds), and

the existing run-world background system (.run-sky, .run-clouds, .run-ground) inside .run-viewport/.run-host.

At the same time, many Dash selectors force transparency/background reset on .run-world, .run-sky, etc. with !important.
So top/middle/bottom are not driven by one contract; they are stitched together by overrides, which causes remnant/bleed behavior by stage and region.

お勧めのタスク
Unify Dash background ownership under one base layer contract

タスクを開始
2) Stage theme variables are still wired to Dash container state
Theme rules include selectors like .screen-dash[data-bg-theme="bg_plus"] etc. that mutate --run-sky-image (plus/minus/multi/divide assets).
Even when some elements are made transparent, those variables can still feed pseudo-elements or inherited layers, so stage-specific sky remnants appear (notably plus).

お勧めのタスク
Cut stage-theme variable injection from Dash mode

タスクを開始
3) Clouds are force-rendered in Dash outside the sky system
Clouds are currently hard-coded in .screen-dash::after (double cloud image + animation), while normal run already has .run-clouds.
This duplicates responsibility and creates layering inconsistency (clouds can appear detached from sky logic).

お勧めのタスク
Move Dash clouds to sky-layer responsibility only (no forced overlays)

タスクを開始
Refactoring Plan (step-by-step)
Define Dash background contract first
Decide: “Dash background is global screen layer” (recommended) and document in CSS comments near Dash section.

Normalize variable source
Add Dash-only variables (--run-sky-image, --run-cloud-image) at #dash-game-screen, fixed to shared assets.

Detach Dash from stage theme selectors
Remove .screen-dash[data-bg-theme=...] from stage theme blocks; keep only .run-world[data-bg-theme=...] for normal mode.

Remove forced cloud overlay path
Delete/disable .screen-dash::after cloud painting; keep clouds only in the chosen sky system.

Guarantee full-height coverage (top/middle/bottom)
Ensure base sky layer spans entire Dash screen (inset: 0, no clipping, no white fallback on wrappers).

Preserve run-host/run-viewport and gameplay layers
Keep structure untouched; only CSS layering/ownership changes.

Tighten override scope
Replace broad “everything transparent” selector chains with focused Dash wrappers so enemy/render/collision visuals stay intact.

Z-index Contract Proposal (Dash)
z=0: Dash base sky layer (full-screen, owns bg-sky)

z=1: Sky-owned cloud layer (same system, not stage-forced)

z=2: Run world gameplay visuals (run-world, ground art, enemy container as currently used)

z=10+: Dash run-zone container if needed for layout isolation only (not as background owner)

z=30: Top HUD / bottom HUD / input UI

z=40: transient UI overlays (if any future modals/alerts)

Key rule: UI remains above sky; enemy layer stays in gameplay stack; no cloud overlays above HUD unless explicitly designed.

Proposed CSS Responsibility Separation
Dash screen wrapper (#dash-game-screen, .screen-dash)

Owns full-viewport background contract

Sets Dash-only background variables

Ensures no white fallback

Theme system (.run-world[data-bg-theme=...])

Normal mode stage art only

No Dash selector coupling

Run-world art layers (.run-sky, .run-clouds, .run-ground)

Used by run viewport system

In Dash, only the parts allowed by the contract remain active

No duplicate cloud source elsewhere

HUD/layout wrappers (.dash-top-hud, .dash-run-zone, .dash-bottom-hud)

Transparent containers only

Never own sky/cloud artwork

Minimal Change Strategy (index.html + CSS only)
index.html: keep DOM structure as-is unless a single semantic hook/class is needed for clearer scoping.

styles/style.scoped.css: do all architectural correction by:

removing Dash-stage theme coupling,

removing forced cloud overlay path,

consolidating Dash background ownership and z-index order.

This keeps run-host/run-viewport intact, avoids JS/collision risk, and minimizes regression surface.

Checks Performed
✅ pwd; rg --files -g 'AGENTS.md'
✅ find .. -name AGENTS.md -print
✅ sed -n '1,260p' index.html; sed -n '1,320p' styles/style.scoped.css
✅ rg -n "run-host|run-viewport|run-world|run-sky|cloud|bg-sky|dash|game-screen|run-layer|stage" index.html styles/style.scoped.css
✅ sed -n '170,290p' index.html; sed -n '2860,3070p' styles/style.scoped.css
✅ rg -n "run-sky|run-cloud|run-world|run-zone|run-ground|run-host|run-viewport|screen-dash|dash-run-zone|bg-sky|bg-cloud" styles/style.scoped.css | head -n 200
✅ sed -n '780,930p' styles/style.scoped.css; sed -n '1020,1225p' styles/style.scoped.css; sed -n '2288,2525p' styles/style.scoped.css
✅ sed -n '1140,1225p' styles/style.scoped.css; sed -n '2298,2415p' styles/style.scoped.css
✅ rg -n "run-viewport|run-host|run-layer|run-world|run-bg|run-sky|run-clouds|run-ground|run-enemies" index.html; sed -n '300,430p' index.html