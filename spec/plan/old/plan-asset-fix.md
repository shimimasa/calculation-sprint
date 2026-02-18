Plan (no patch yet)
Acknowledge and resolve specificity root cause

Confirmed root cause: --dash-sky-image is currently set on .calc-sprint #dash-game-screen, and that ID-based selector outranks .calc-sprint .screen-dash[data-bg-theme="..."], so theme values cannot win.

Minimal fix: remove --dash-sky-image from the base #dash-game-screen rule and keep fallback at usage site (#dash-game-screen::before) via:

background-image: var(--dash-sky-image, url("../assets/bg-sky.png"))

This preserves Dash pseudo-element ownership and layering while eliminating the override deadlock.

Make theme mapping selectors match/beat ID specificity

Update Dash theme variable mappings from:

.calc-sprint .screen-dash[data-bg-theme="..."] { --dash-sky-image: ... }

To:

.calc-sprint .screen-dash[data-bg-theme="..."] #dash-game-screen { --dash-sky-image: ... }

This keeps theme state attached to data-bg-theme while ensuring the mapped value applies on the Dash owner element itself.

Replace dual-URL layering with single URL + var fallback

Current pattern like url(theme), url(default) is not fallback; it paints two layers.

Change each Dash sky mapping to single URL only:

plus/add → url("../assets/plus/bg-sky.png")

minus/sub → url("../assets/minus/bg-sky.png")

multi/mul → url("../assets/multi/bg-sky.png")

divide/div → url("../assets/divide/bg-sky.png")

Let fallback be handled exclusively by var(--dash-sky-image, url("../assets/bg-sky.png")) in #dash-game-screen::before.

Mirror ground mapping path conventions exactly

Inspect existing ground mappings (../assets/<theme>/bg-ground.png) and apply the identical theme folder convention for sky:

../assets/plus/bg-sky.png

../assets/minus/bg-sky.png

../assets/multi/bg-sky.png

../assets/divide/bg-sky.png

Preserve alias coverage (bg_add/bg_plus, bg_sub/bg_minus, bg_mul/bg_multi, bg_div/bg_divide) so existing theme keys continue to work.

Keep Dash background architecture unchanged

Do not alter JS/DOM.

Keep #dash-game-screen::before as sky owner and ::after as cloud owner.

Keep current z-index contract (::before below gameplay layers, ::after cloud overlay layer).

Validation checklist (manual)

Set Dash data-bg-theme="bg_plus" → plus sky appears.

Set Dash data-bg-theme="bg_minus" → minus sky appears.

Set Dash data-bg-theme="bg_multi" (or bg_mul) → multi sky appears.

Set Dash data-bg-theme="bg_divide" (or bg_div) → divide sky appears.

Remove/unknown theme → fallback sky ../assets/bg-sky.png appears.

Confirm no double-painted skies (single sky layer only).