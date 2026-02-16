現状責務マップ（静的調査）
1) 問題生成（演算ロジック）
src/features/questionGenerator.js

questionGenerator.next(settings) が出題の中核。

resolveMode(settings) で stageId / mode / allowedModes から演算モードを決定。

桁・繰り上がり/繰り下がりの一部制御は digit, carry, allowedModes ベース。

生成結果は meta.mode を返す（例: add/sub/mul/div）。

src/screens/dashGameScreen.js

loadNextQuestion() で questionGenerator.next({...gameState.settings, stageId, questionMode}) を呼ぶ。

生成後に gameState.dash.currentMode = currentQuestion.meta.mode を保存。

2) 敵生成（種別・tier・HP）
src/features/dashEnemySystem.js

createDashEnemySystem(...) が敵スポーン/状態遷移/被ダメ処理の本体。

resolveEnemyTypeForStage({stageId,getEnemyType,getEnemyPool}) で敵タイプ決定。

現状、stageId===mix 時はランダムプール選択（問題演算との同期は未接続）。

tier/HP は normalizeEnemyTier, getEnemyHpByTier（enemyAssetResolver 側）を使用。

src/features/enemyAssetResolver.js

stageKey + tier + state -> path の候補解決とフォールバック。

3) 背景/BGM選択
背景:

src/features/backgroundThemes.js の toDashRunBgThemeId(stageId) で theme 決定。

src/screens/dashGameScreen.js の applyDashTheme() で data-bg-theme を適用。

BGM:

src/screens/dashGameScreen.js の resolveDashBgmId(stageId) → audioManager.playBgm(...)。

マップは DASH_STAGE_TO_BGM_ID（plus/minus/multi/divide/mix）。

4) ステージ選択UI
src/screens/dashStageSelectScreen.js

data-dash-stage-id ボタンで単一の gameState.dash.stageId を選択して開始。

index.html

ダッシュステージ選択画面に 5ボタン（plus/minus/multi/divide/mix）。

src/features/dashStages.js

現状は「world=stage」相当のフラット定義（level概念なし）。

指摘1: Dash側に World/Level の明示データ構造がなく、段階難易度を安定運用しにくい
お勧めのタスク
PR1: dash-world/level定義を追加し、既存stageId互換を維持する

タスクを開始
指摘2: 出題難易度が digit/carry/allowedModes 中心で、world×levelの段階設計を直接表現できない
お勧めのタスク
PR2: questionGeneratorにdifficulty schema適用レイヤを追加する

タスクを開始
指摘3: mixで「問題演算に対応する敵」が現在保証されていない（敵タイプ選択がランダム）
お勧めのタスク
PR2.5: mixの敵stageKey決定を単一関数に閉じ、questionと同期させる

タスクを開始
指摘4: ダッシュステージ選択UIが world/level選択に未対応
お勧めのタスク
PR3: dash-stage-selectをWorld/Level選択へ最小拡張する

タスクを開始
指摘5: 回帰観点が多岐に渡るため、Phase2移行用の静的チェックリストを先に固定すべき
お勧めのタスク
PR4: Phase2回帰テスト観点をspec化し、混在期間の不具合を抑止する

タスクを開始
段階PR提案（要約）
PR1: world/level/difficultyデータ導入（互換レイヤあり、挙動ほぼ不変）

PR2: difficulty schemaをquestionGeneratorへ接続

PR2.5: mixの敵同期（単一関数化）

PR3: World/Level選択UI接続（最小）

PR4: 回帰観点の文書化＋必要最小限の検証導線

Testing / Checks（静的調査のみ）
✅ pwd; rg --files -g 'AGENTS.md'
✅ rg --files | head -n 200
✅ rg -n "question|generate|operator|stageKey|enemy|bgm|background|dashStage|stage select|world|level" src/features src/screens src/core src/game | head -n 300
✅ sed -n '1,320p' src/features/questionGenerator.js
✅ sed -n '1,260p' src/features/dashStages.js; sed -n '1,260p' src/screens/dashStageSelectScreen.js; sed -n '1,220p' src/features/backgroundThemes.js; sed -n '1,260p' src/features/dashConstants.js
✅ rg -n "questionGenerator|next\\(|question\\.meta|modeId|stageId|allowedModes|carry|digit|questionMode|enemyPool|getEnemyType|toDashRunBgThemeId|bgm_" src/screens src/features src/core src/game | head -n 400
✅ sed -n '1,320p' src/screens/dashGameScreen.js; sed -n '320,760p' src/screens/dashGameScreen.js
✅ rg -n "questionGenerator\\.next|currentQuestion|operator|enemyStage|getEnemyType|getEnemyPool|toDashRunBgThemeId|DASH_STAGE_TO_BGM_ID|setBgm|stageId|allowedModes|digit|carry" src/screens/dashGameScreen.js
✅ sed -n '180,240p' src/screens/dashGameScreen.js; sed -n '2000,2095p' src/screens/dashGameScreen.js; sed -n '2388,2445p' src/screens/dashGameScreen.js; sed -n '2550,2625p' src/screens/dashGameScreen.js
✅ rg -n "resolveEnemyTypeForStage|getCurrentMode|getEnemyType|getEnemyPool|stageId|enemyType|applyEnemySpriteWithFallback|tier" src/features/dashEnemySystem.js; sed -n '1,180p' src/features/dashEnemySystem.js; sed -n '180,340p' src/features/dashEnemySystem.js; sed -n '520,760p' src/features/dashEnemySystem.js
✅ sed -n '340,560p' src/features/dashEnemySystem.js; rg -n "getCurrentMode|currentMode" src/features/dashEnemySystem.js
✅ sed -n '1,260p' src/ui/domRefs.js; rg -n "dash-stage-select|data-dash-stage-id|data-dash-mode-id|dash world|stage select" index.html styles/style.scoped.css src/screens/dashStageSelectScreen.js | head -n 200
✅ sed -n '1,180p' src/core/gameState.js; sed -n '1,260p' src/features/stages.js
✅ sed -n '1,240p' src/core/stageAssetPreloader.js
✅ rg -n "applyDashTheme|data-bg-theme|toDashRunBgThemeId|dashStageId|bg-theme" src/screens/dashGameScreen.js styles/style.scoped.css
✅ sed -n '1220,1265p' src/screens/dashGameScreen.js
✅ sed -n '60,125p' index.html