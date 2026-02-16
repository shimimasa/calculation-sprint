A. 現状把握（必須）
1) Dash Run 開始の入口（ボタン → 関数 → screen遷移）
入口ボタン: #title-dash-button

ハンドラ:

src/screens/titleScreen.js

handleDashRun() 内で screenManager.changeScreen('dash-game')

画面管理:

src/main.js で 'dash-game': dashGameScreen を登録

src/core/screenManager.js が changeScreen で遷移制御

**現状は「タイトル → 直接 dash-game」**で、ステージ選択を挟んでいない。

2) 問題生成の所在（どこで演算を決めているか）
呼び出し元:

src/screens/dashGameScreen.js

loadNextQuestion() → questionGenerator.next(gameState.settings)

実装本体:

src/features/questionGenerator.js

settings.mode（add/sub/mul/div/mix）と digit/carry/allowedModes で分岐

補足:

現在 Dash Run は独自設定を持たず、**グローバル gameState.settings**を流用

3) 敵ID/敵アセット参照の所在（どこで enemy 種別が決まるか）
実装:

src/features/dashEnemySystem.js

問題点（現状仕様上）:

ファイル先頭に const ENEMY_TYPE = 'plus';

spawnEnemy() で常に type = ENEMY_TYPE

アセットは assets/enemy/enemy_${type}_${state}.png で決定

結果:

Dash Run の敵は常に plus 敵になっている

B. 設計方針（必須）
1) 「ステージ」概念の置き場所
提案: Dash専用 state を gameState.dash に追加

追加候補:

gameState.dash.stageId (plus|minus|multi|divide|mix)

gameState.dash.currentMode (add|sub|mul|div) ※mix時の直近出題演算

理由:

既存 gameState.settings（通常モード/ステージモードと共有）を汚さず、影響局所化

Dash開始～結果まで同一セッションで参照しやすい

2) 永続化する/しない
提案: dash.session に stageId を追加して永続化する

保存先: src/core/dashStatsStore.js (dash.session.v1 実体)

追加フィールド:

stageId（不正値時は null）

理由:

結果画面で「どのDashステージの記録か」表示可

既存保存形式に後方互換的追加（未保存データは null 扱い）

3) UI上のステージ選択位置
提案: 新screen追加（dash-stage-select）

既存 dash-game にサブビュー挿入せず、画面分離

遷移:

title(dash button) → dash-stage-select → dash-game

dash-stage-select からキャンセルで title 戻り

理由:

既存 Dash HUD/入力/タイマーDOMを触る範囲を最小化

条件「Dash Run専用の前段」を明確に満たす

C. データモデル案（必須）
1) stageId 列挙
DashStageId = 'plus' | 'minus' | 'multi' | 'divide' | 'mix'
2) stage定義（Dash専用設定）
新規定義ファイル例: src/features/dashStages.js

各stageに持たせる:

id, labelJa, descriptionJa

problemPolicy（演算・桁制約）

enemyPolicy（出現敵種）

マッピング:

plus -> add / enemy plus

minus -> sub / enemy minus

multi -> mul / enemy multi

divide -> div / enemy divide

mix -> add|sub|mul|div 抽選 / enemy 4種抽選

3) mixの挙動（問題・敵の抽選）
問題抽選

毎問 add/sub/mul/div をランダム（均等）

直近偏り抑制（例: 同一モード3連続禁止）を入れる設計にして偏り体感を抑える

敵抽選

原則「その題の mode と同種 enemy」を採用（ズレ防止）

これで「mixで4種出る」かつ「問題と敵の意味一致」を両立

4) 結果画面/記録への stageId反映
反映する（推奨）

gameState.dash.result.stageId

dashStatsStore.normalizeSession() に stageId

表示

dashResultScreen に「ステージ: たし算/ひき算/...」1行追加（既存グリッド上部か理由欄近傍）

D. 実装タスク分解（最重要・段階導入）
12タスク。各段階でアプリが動く状態を維持。

Task 1: Dash stage 定義の追加（データのみ）
対象:

src/features/dashStages.js（新規）

内容:

DASH_STAGE_IDS, DASH_STAGES, findDashStageById, toQuestionMode(stageId) 等を定義

日本語ラベル（たし算/ひき算/かけ算/わり算/ミックス）をここに集約

Task 2: gameState に Dash専用 stage 状態を追加
対象:

src/core/gameState.js

内容:

dash.stageId（初期 null）

dash.currentMode（初期 null）追加

差分方針:

既存プロパティ保持、追加のみ

Task 3: 新screen dash-stage-select のDOM追加
対象:

index.html

内容:

section#dash-stage-select-screen 新設

5つのステージボタン + 「戻る（キャンセル）」ボタン

文言は日本語統一

Task 4: DOM参照追加
対象:

src/ui/domRefs.js

内容:

screens['dash-stage-select']

dashStageSelect.{list/buttons/backButton} を追加

Task 5: 新スクリーン実装
対象:

src/screens/dashStageSelectScreen.js（新規）

内容:

enter/exit とイベント登録

クリックで gameState.dash.stageId を設定し screenManager.changeScreen('dash-game')

戻るで title に遷移

補足:

audioManager と createEventRegistry は既存流儀を踏襲

Task 6: screen登録とタイトル遷移変更
対象:

src/main.js

src/screens/titleScreen.js

内容:

main.js に 'dash-stage-select' 登録

handleDashRun() の遷移先を 'dash-game' → 'dash-stage-select' に変更

Task 7: Dash問題生成をステージ対応化（まずplus固定互換）
対象:

src/screens/dashGameScreen.js

必要なら src/features/questionGenerator.js または src/features/dashQuestionFactory.js（新規）

内容:

loadNextQuestion() が gameState.dash.stageId を見て mode を決定

未設定時は plus にフォールバック（壊さないため）

段階導入:

まず plus固定で既存互換

次Taskで minus/multi/divide/mixを有効化

Task 8: minus/divide 難易度制御を追加
対象:

src/features/questionGenerator.js（既存拡張）または Dash専用生成モジュール

内容:

minus:

2桁−1桁を主、必要に応じ2桁−2桁を少量混在

負数回避（a >= b）

divide:

2桁÷1桁中心

余りなし優先（dividend = divisor * quotient 方式）

重要:

通常モード副作用を避けるため、Dash専用パラメータで分岐

Task 9: Enemy system を型可変化
対象:

src/features/dashEnemySystem.js

内容:

ENEMY_TYPE 固定を廃止

createDashEnemySystem({ getEnemyType }) などで spawn時 type決定

未指定時は 'plus' を返す既定値で後方互換

Task 10: DashGame と Enemy type を連動
対象:

src/screens/dashGameScreen.js

内容:

createDashEnemySystem 呼び出し時に getEnemyType を渡す

non-mix: stage固定敵

mix: その問題の currentMode 由来の敵種を返す（ズレ防止）

Task 11: リプレイ/戻る導線の整合
対象:

src/screens/dashResultScreen.js

src/screens/dashGameScreen.js

内容:

「もう一回はしる」は同じ dash.stageId で再開

stageId 未設定時のみ dash-stage-select へ誘導するガード追加（任意）

Task 12: 保存・表示（stageId）の追加
対象:

src/core/dashStatsStore.js

src/screens/dashGameScreen.js

src/screens/dashResultScreen.js

index.html（結果表示1項目追加する場合）

内容:

endSession() で stageId を resultに格納

ストア normalize/save/get に stageId 対応

結果画面に日本語ステージ名表示

E. 受け入れ基準（Acceptance Criteria）
手動テスト手順（5ステージ）
タイトルで「ダッシュラン」押下 → Dashステージ選択画面が出る

plus 選択:

問題が加算のみ

敵が enemy_plus_* のみ

終了後、結果まで到達できる

minus 選択:

減算のみ（2桁−1桁中心、難易度暴走なし）

敵が enemy_minus_* のみ

multi 選択:

乗算のみ

敵が enemy_multi_* のみ

divide 選択:

除算のみ

原則整数解（余りなし）

敵が enemy_divide_* のみ

mix 選択:

問題に add/sub/mul/div が混在

敵も plus/minus/multi/divide が混在

ステージ選択画面の「戻る（キャンセル）」でタイトルへ戻れる

Dash結果画面のリプレイ導線が動作（同ステージ再プレイ）

既存DashのHUD/テンキー/タイマー/バック挙動が維持される

最低限の非回帰確認（gate/lint/build前提）
スクリーン遷移が壊れていない（title, dash-stage-select, dash-game, dash-result）

既存通常モード（stage/free/game/result）に副作用なし

例外発生時フォールバック（stageId null で plus扱い or 選択へ戻す）

F. 互換性・リスク
1) 壊しやすい箇所
index.html のscreen追加（id不整合で domRefs が null になりやすい）

domRefs.screens 未登録で screenManager 遷移不可

dashEnemySystem を直接書き換えると既存挙動を壊しやすい

2) 起きがちなバグと防止策
stage未設定で開始

防止: dashGameScreen.enter() でガード（未設定なら plus fallback or selectへ戻す）

mix偏り

防止: 抽選履歴バッファで同一mode連続上限を設ける

divideが小数になる

防止: 生成式を dividend = divisor * quotient 固定

敵と演算のズレ

防止: mix時は currentQuestion.meta.mode を単一ソースとして enemy type 決定

通常モードへの副作用

防止: Dash専用 state/モジュールで閉じる（gameState.settings 直接改変を最小化）

実装時の推奨順（最短で安全）
画面導線（title→dash-stage-select→dash-game）

stageId state保持

問題生成切替（plus→全5種）

敵種切替

結果保存/表示

最後にUI文言・微調整

確認コマンド（静的確認のみ）
✅ pwd; rg --files -g 'AGENTS.md'
✅ rg --files | head -n 200
✅ sed -n '1,220p' src/screens/titleScreen.js; sed -n '1,260p' src/core/screenManager.js; sed -n '1,260p' src/main.js
✅ sed -n '1,320p' src/screens/dashGameScreen.js; sed -n '1,260p' src/features/questionGenerator.js; sed -n '1,320p' src/features/dashEnemySystem.js; sed -n '1,260p' src/core/dashStatsStore.js; sed -n '1,260p' src/core/storageKeys.js; sed -n '1,260p' src/ui/domRefs.js
✅ rg -n "dash|questionGenerator|enemy|stage|session|storage|operator|operation" src/screens/dashGameScreen.js src/features/questionGenerator.js src/features/dashEnemySystem.js src/core/dashStatsStore.js src/core/storageKeys.js src/screens/dashResultScreen.js src/ui/uiRenderer.js index.html styles/style.scoped.css
✅ sed -n '1,260p' src/features/questionGenerator.js; sed -n '1,280p' src/features/dashEnemySystem.js; sed -n '1,260p' src/core/gameState.js; sed -n '1,220p' src/screens/dashResultScreen.js; sed -n '700,1060p' src/screens/dashGameScreen.js; sed -n '1060,1260p' src/screens/dashGameScreen.js; sed -n '1,280p' src/ui/uiRenderer.js; sed -n '1,240p' src/core/storageKeys.js; sed -n '1,260p' src/core/dashStatsStore.js
✅ nl -ba src/features/dashEnemySystem.js | sed -n '1,260p'; nl -ba src/features/dashEnemySystem.js | sed -n '260,560p'
✅ nl -ba src/core/gameState.js | sed -n '1,260p'
✅ nl -ba src/screens/dashResultScreen.js | sed -n '1,260p'; nl -ba src/screens/titleScreen.js | sed -n '1,200p'; nl -ba src/screens/stageSelectScreen.js | sed -n '1,280p'
✅ nl -ba src/screens/titleScreen.js | sed -n '1,90p'
✅ nl -ba index.html | sed -n '130,340p'
✅ nl -ba src/screens/dashGameScreen.js | sed -n '920,1045p'; nl -ba src/screens/dashGameScreen.js | sed -n '1045,1165p'
✅ nl -ba src/screens/dashGameScreen.js | sed -n '730,840p'
✅ nl -ba src/screens/settingsScreen.js | sed -n '1,260p'; nl -ba src/features/stages.js | sed -n '1,260p'
✅ nl -ba src/ui/domRefs.js | sed -n '1,180p'
✅ rg -n "dash\\.session|dash\\.result|dashStage|selectedDash|dash" src | head -n 200