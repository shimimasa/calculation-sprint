1) Root Cause（特定結果）
RC1: Level 数が UI で 5 固定になっている
src/screens/dashStageSelectScreen.js で DASH_LEVEL_OPTIONS = [1,2,3,4,5] がハードコードされ、expandWorld() 内の Level ボタン生成が常にこの配列を .map() しています。
そのため stage ごとの levelCount（mix=2 等）を参照する経路が存在せず、mix も 5 個表示されます。

お勧めのタスク
ステージ別 levelCount を導入し、Level ボタン描画を固定5から脱却する

タスクを開始
RC2: Level 選択値が Start 以降の出題ロジックに渡っていない（実質未接続）
dashStageSelectScreen では gameState.dash.levelId へ保存しているものの、dashGameScreen 側で levelId を読み取る処理がありません。
loadNextQuestion() は questionGenerator.next({...gameState.settings, stageId, questionMode}) のみを渡しており、levelId が入力に含まれないため、Lv1/Lv4 で出題差分が発生しません。

お勧めのタスク
Start時に選択 levelId をゲーム初期化へ引き渡し、dashGameScreen で確実に参照する

タスクを開始
RC3: 問題生成器が (stageKey, levelId) ではなく実質 stageKey のみで分岐
src/features/questionGenerator.js の resolveMode() / next() は stage 依存分岐（minus/divide 特例）はありますが、levelId 分岐は存在しません。
よって、たとえ UI で level を選んでも難易度パラメータ（桁、範囲、演算セット等）が変わらない設計になっています。

お勧めのタスク
problem generator を stageKey+levelId 入力に対応させ、難易度/演算セットをレベル連動化する

タスクを開始
2) Fix Strategy（修正方針）
Single Source of Truth 化
src/features/dashStages.js を stage/level 定義の唯一ソースにし、UI（levelCount）と generator（difficulty）と enemy policy が同じ定義を参照する。

Start 時の状態受け渡しを固定化
dashStageSelectScreen.startDashWithSelection() → gameState.dash.{stageId, levelId, modeId} を確定保存。
dashGameScreen.enter() でそれを読み込み、以後 questionGenerator / enemy system の入力へ明示伝搬。

出題 API を level-aware に統一
questionGenerator.next({ stageId, levelId, ... }) を正式インターフェース化し、(stageKey, levelId) で難易度と演算セットが必ず変わることを保証する。

3) PR Split（提案）
PR1: stage→levelCount 定義 + UI描画修正

stage 定義に levelCount/levels 追加

dashStageSelect の Level ボタンを stage別 N で描画

mix=2 を UI 反映

PR2: Start→gameState→dashGameScreen の level 伝搬保証

gameState.dash.levelId 明示化

Start 時保存の一本化、固定値上書き排除

dashGameScreen 初期化で levelId を保持・引き渡し

PR3: problem generator の (stage, level) 対応

questionGenerator に level 分岐導入

stage-level ごとの難易度/演算セット反映

mix レベル差分の定義・適用

4) Regression Checklist（回帰観点）
plus Lv1 vs Lv4 で問題パラメータ（例: 桁・範囲・演算出現）が実際に変化する

mix の Level 表示数が 2 になる

Start 後、選択した worldKey(stageId)/levelId が gameState.dash に保持され、dashGameScreen でも同値参照される

ステージ選択に戻って再入場しても、直近選択 level が破綻しない（stageごとの有効範囲内で復元）

確認コマンド（静的調査）
✅ pwd; rg --files | head -n 200

✅ rg --files -g '**/AGENTS.md'

✅ rg -n "dashWorldLevelStore|levelCount|selectedLevel|levelId|worldKey|Start|start" src/screens/dashStageSelectScreen.js src/screens/dashGameScreen.js src/core/gameState.js src/features/dashStages.js src/features/stages.js src/features/questionGenerator.js src/game/dash -S

✅ sed -n '1,260p' src/screens/dashStageSelectScreen.js

✅ sed -n '260,560p' src/screens/dashStageSelectScreen.js

✅ sed -n '1,220p' src/core/gameState.js

✅ rg -n "levelId|level\\b|stageId|worldKey|question|generator|dash\\.level" src/screens/dashGameScreen.js src/features/questionGenerator.js src/features/dashStages.js src/features/dashConstants.js src/features/stages.js src/game/dash -S

✅ sed -n '1,220p' src/features/dashStages.js; sed -n '1,280p' src/features/questionGenerator.js

✅ sed -n '1980,2095p' src/screens/dashGameScreen.js; sed -n '2520,2665p' src/screens/dashGameScreen.js

✅ rg -n "dash\\.level|levelId|level" src/screens/dashGameScreen.js -S

✅ rg -n "worldLevel|dashWorldLevelStore|levelStore|levelCountByStage|levelsByStage|levelCount|DASH_LEVEL_OPTIONS" src -S

✅ sed -n '1,260p' src/ui/domRefs.js

✅ rg -n "dash-stage-select|data-dash-levels-for|dash-world-card|dash-start|dash-level" index.html -n -S; sed -n '1,280p' index.html

✅ rg -n "gameState\\.dash\\.|dash:\\s*\\{|currentMode|stageId\\s*=|levelId\\s*=|changeScreen\\('dash-stage-select'|dash-stage-select" src/main.js src/screens/*.js src/core/*.js -S

✅ sed -n '1,240p' src/features/dashEnemySystem.js; rg -n "level|stageId|getCurrentMode|mix" src/features/dashEnemySystem.js -S

✅ sed -n '280,620p' src/features/dashEnemySystem.js

✅ sed -n '1,220p' src/core/dashSettingsStore.js

✅ sed -n '1,240p' src/core/storageKeys.js

✅ rg -n "mix.*(2|two)|level.*mix|LEVEL 5|DASH_LEVEL_OPTIONS|world level|レベル" spec src -S