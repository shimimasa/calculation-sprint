A) 現状コードで背景参照箇所を特定する調査手順
調査結果サマリ（先に結論）
背景レイヤー DOM は共通の .run-layer > .run-world > .run-bg > .run-sky/.run-clouds/.run-ground 構造（index.html）。

実際の sky/ground は CSS変数経由で描画されている。

.run-sky → --run-sky-image（fallback: assets/bg-sky.png）

.run-ground__tile → --run-ground-image（fallback: assets/bg-ground.png）

定義箇所: styles/style.scoped.css の run-world[data-bg-theme=...] ブロック

通常ゲーム (gameScreen.js) は data-bg-theme を設定しているが、現状は各 theme の --run-sky-image / --run-ground-image が共通画像のまま。

Dash Run (dashGameScreen.js) は run-layer を DOM 移動して再利用しているが、ステージ種別→背景切替の明示適用がない。

さらに Dash には .screen-dash::before で固定 assets/bg-sky.png を敷く CSS があり、ここがステージ別化のボトルネックになりうる。

調査で見るべき分岐（CSS/JS/canvas）
CSS url(...) 参照: styles/style.scoped.css の --run-*-image と background-image

JS 直差し <img>: 背景は未使用（cloud のみ JS生成 img）

canvas 描画: 背景用 canvas は見当たらず（DOM/CSS方式）

お勧めのタスク
背景参照のSSoTを確定するため、sky/ground参照経路を文書化する

タスクを開始
B) 背景差し替え設計案（2案）と推奨
案1: JSでステージ種別から URL を組み立て、.run-world に直接反映
例: runWorld.style.setProperty('--run-sky-image', 'url(...)')

Pros: 実行時に完全制御しやすい。fallbackロジックをJSで一元化しやすい。

Cons: CSS責務をJSへ寄せるため、既存の data-bg-theme 体系と二重管理になりやすい。Dash向け疑似要素との整合確認が必要。

お勧めのタスク
案1（JS直指定）の実現可能性を評価し、運用時の二重管理リスクを明確化する

タスクを開始
案2: CSS変数をSSoTにし、ステージ開始時に「テーマID/変数」だけ切替
例: data-bg-theme="bg_add" などをDashにも適用し、CSS側で
--run-sky-image: url("../assets/plus/bg-sky.png")
--run-ground-image: url("../assets/plus/bg-ground.png")

Pros: 既存構造（DOM・z-index・run-layer再利用）をほぼ維持。差分が小さく低リスク。通常ゲームとDashを同じ仕組みに寄せられる。

Cons: CSSマッピング更新が中心。fallbackを「CSSの多段 fallback」か「JSの存在確認＋代替設定」どちらで担うかを決める必要あり。

お勧めのタスク
案2（CSS変数SSoT）の採用設計を固める

タスクを開始
推奨案
案2（CSS変数SSoT）推奨。
理由: 既存DOM/配置ロジック不変更、Dash共存しやすい、差分小、見た目破壊リスクが最小。

C) 推奨案の具体的実装タスク分解（チェックリスト）
お勧めのタスク
ステージ種別背景切替（推奨: CSS変数SSoT）を最小差分で実装する

タスクを開始
D) Acceptance Criteria と手動テスト手順
お勧めのタスク
ステージ別背景切替の受け入れ条件と手動テストを定義する

タスクを開始
チェック実行ログ（静的確認のみ）
✅ pwd; rg --files -g 'AGENTS.md'
✅ rg --files | head -n 200
✅ rg -n "bg-sky|bg-ground|run-world|run-ground|runner-wrap|background|assetDiagnostics|404|missing|asset" src styles index.html
✅ sed -n '180,420p' src/screens/gameScreen.js; sed -n '1000,1120p' src/screens/gameScreen.js; sed -n '120,360p' src/screens/dashGameScreen.js; sed -n '2860,3065p' styles/style.scoped.css
✅ rg -n "run-sky|run-cloud|run-ground__tile|--run-ground-image|--run-sky|data-bg-theme|bg_add|bg_sub|bg_mul|bg_div|bg_mix" styles/style.scoped.css src/screens src/features src/core
✅ sed -n '2288,2498p' styles/style.scoped.css; sed -n '160,230p' styles/style.scoped.css; sed -n '1,180p' src/features/stages.js; sed -n '1,220p' src/screens/dashStageSelectScreen.js; sed -n '1,220p' src/features/dashStages.js
✅ rg -n "dash.stageId|data-bg-theme|runWorld|stageId|toDashStageId|getDashStage" src/screens/dashGameScreen.js src/core/gameState.js src/ui/domRefs.js src/screens/gameScreen.js
✅ sed -n '920,1055p' src/screens/dashGameScreen.js; sed -n '1,120p' src/screens/dashGameScreen.js; sed -n '1,120p' src/core/gameState.js
✅ sed -n '390,520p' index.html
✅ rg -n "dash-game-screen|screen-dash|run-layer" index.html
✅ sed -n '180,320p' index.html
✅ rg -n "ensureRunLayerMounted|runLayerOriginalParent|run-host|appendChild|insertBefore" src/screens/dashGameScreen.js src/screens/gameScreen.js
✅ sed -n '132,210p' src/screens/dashGameScreen.js
✅ sed -n '1,60p' styles/style.scoped.css