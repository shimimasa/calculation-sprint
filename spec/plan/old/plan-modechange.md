0. ゴール（Phase3で達成する体験）
「タイムバー領域」がモードごとに意味を持つ状態にする。

infinite: 残り時間

Goal Run: ゴール距離進捗

Score Attack: 60秒カウントダウン

既存HUDレイアウト（長いバー＋右側丸バッジ、下部カード、入力UI位置）を維持し、表示ロジック差し替え中心で実装する。

既存のゲームループ／敵挙動／問題生成には影響を出さない（UI表示の責務に限定）。

1. 現状把握（コード上の実態）
モード定義・参照

定義: src/game/dash/modes/modeTypes.js（infinite / goalRun / scoreAttack60）

戦略選択: src/game/dash/modes/dashModes.js

実ロジック:

infiniteMode.js（timeupで終了）

goalRunMode.js（1000m到達 or timeup）

scoreAttack60Mode.js（初期制限時間60s、timeup、スコア/コンボ）

画面側参照: src/screens/dashGameScreen.js の resolveModeStrategy(), tryEndByMode(), modeStrategy.getHudState()

タイムバー描画の実体

DOM: index.html の #dash-game-time-wrap, #dash-game-timebar, #dash-game-time, #dash-game-time-note

参照: src/ui/domRefs.js (timeWrap, timeBar, timeRemaining, timeNote)

更新: dashGameScreen.updateHud()

現在は全モード共通で timeRatio = timeLeftMs / initialTimeLimitMs をバー幅に使用

右丸バッジ相当の数値は timeLeftMs 秒表示

caution/danger色は data-state でCSS切替（styles/style.scoped.css）

distance / goalDistance / timeRemaining / score のSSoT候補

distance: gameState.dash.distanceM（ループで加算）

goalDistance: GoalRun の modeRuntime.goalDistanceM（goalRunMode.initRun()）

timeRemaining: dashGameScreen.timeLeftMs（ローカル状態、結果保存時に引き渡し）

score: ScoreAttack の modeRuntime.totalScore（scoreAttack60Mode.onAnswer()で更新）

2. 仕様（Mode별バールール）
infinite：現状維持（意味の明文化）

バー意味: 「残り時間」

式: ratio = clamp(timeLeftMs / initialTimeLimitMs, 0..1)

右表示: ceil(timeLeftMs / 1000) 秒

timeNote: 低時間時のみ「残りわずか」（現状維持）

Goal Run：距離進捗バー

バー意味: 「GOALまでの距離進捗」

式: ratio = clamp(distanceM / goalDistanceM, 0..1)（goalDistanceMは既存1000を利用）

右表示（丸バッジ）: 残り距離m を主表示（例: 245 + m）

補助テキスト例（timeNote活用）:

755.2m / 1000m

GOALまで あと245m

既存枠維持: 長いバー＋右値表示のまま、中身の意味だけ置換

Score Attack：60秒固定タイムバー

バー意味: 「60秒固定の残り時間」

式: ratio = clamp(timeLeftMs / 60000, 0..1)（difficulty倍率や外部timeLimitに依存しない）

右表示: ceil(timeLeftMs / 1000) 秒

補助テキスト例: SCORE: 3200 を timeNote に表示（任意）

終了条件は既存どおり timeLeftMs <= 0（checkEnd準拠）で結果画面遷移

3. 実装方針（最小差分アーキテクチャ）
mode -> barModel の変換を1か所に集約

dashGameScreen.updateHud() 内に buildBarModel(modeContext, modeHud)（新規関数）を設置し、
ratio / value / unit / note / state を返す形にする。

既存 modeStrategy.getHudState() はカード表示用として維持し、バー専用モデルは画面層で合成（最小侵襲）。

HUD更新周期

既存どおりフレーム更新内 updateHud() で問題なし（すでに運用中）。

追加最適化は軽微に:

文字列が前回同一ならDOM更新しない（lastBarModel比較）

バー幅は小数1桁で丸めて不要なstyle更新を減らす

DOM/CSS変更方針（非破壊）

DOM構造は維持。ID追加は極力なし。

#dash-game-time-wrap に data-mode="infinite|goalRun|scoreAttack60" を付与して、必要なら色だけモード別微調整。

既存caution/dangerルールは time系モード（infinite/scoreAttack）優先、GoalRunは進捗色固定または成功近傍強調に限定。

4. 変更対象ファイル候補（具体的に）
src/screens/dashGameScreen.js

updateHud() のタイムバー更新を barModel 経由に差し替え。

GoalRun/ScoreAttack/infinite で ratio/value/unit/note を切替。

data-mode 付与と軽微な差分更新最適化を追加。

styles/style.scoped.css

必要最小限で #dash-game-time-wrap[data-mode="goalRun"] などの見た目調整。

既存サイズ/配置は維持し、色・可読性のみ補正。

（任意・最小）src/game/dash/modes/scoreAttack60Mode.js

60秒固定を明示する定数利用の再確認（60000 SSoT）とコメント整備。

実挙動変更は原則不要。

（任意）src/screens/dashResultScreen.js

既にモード別サマリはあるため、Phase3では文言微調整のみ（優先度低）。

5. 受け入れ基準（Acceptance Criteria）
Goal Run

distanceM 増加に応じてバーが単調増加し、goalDistanceM 到達時に100%。

GOAL到達後、既存のクリア演出・結果遷移と矛盾しない。

Score Attack

毎回60秒で開始し、バーと秒表示が0へ向かって減少。

timeLeftMs <= 0 で既存どおり終了・結果画面遷移する。

infinite

現行の時間バー挙動（時間増減、低時間警告、色遷移）が変わらない。

表示品質

PC/スマホでバー・数値・補助テキストの可読性が維持される（既存レイアウト崩れなし）。

6. テスト計画（手動 + 軽い自動があれば）
手動確認（モード別）

Stage Selectで各モード開始

infinite: 正解/誤答/被弾で残時間バー挙動確認

GoalRun: 走行でバー増加、ゴール直前〜到達で100%確認

ScoreAttack: 開始時60秒、毎秒減少、0秒で終了確認

境界値・丸め

ratio下限/上限: 0 と 1 にクランプされること

秒表示: ceil(ms/1000) の端数（59999ms, 1000ms, 1ms, 0ms）

GoalRun残距離: max(0, goal - distance) で負値非表示

軽い自動（可能なら）

barModel純関数化した場合、mode x input でユニットテスト（0/max/overrun）

7. リスクと対策
state二重管理

リスク: bar専用の独自値を持ち始めると乖離。

対策: 参照元は既存SSoT (timeLeftMs, gameState.dash.distanceM, modeRuntime) のみ。

UI更新頻度

リスク: 毎フレーム文字列再描画で無駄更新。

対策: 前回値比較でDOM更新を抑制、幅の丸め更新。

結果画面/記録保存との整合

リスク: HUD表示変更に伴い結果値解釈がズレる。

対策: 結果生成は既存 modeStrategy.buildResult() を不変更、表示層だけ変更。

8. 追加で直した方が良い点（任意、ただし優先度付き）
P0: ゲーム中にモード名を小さく明示（例: timeNote先頭に Goal Run）

理由: 同じHUD枠でも「何モードか」が即時認知でき、誤解が減る。

お勧めのタスク
ゲーム中HUDに現在モード名を常時表示する

タスクを開始
P1: GoalRun時の進捗カード文言を「進ちょく」に統一（timeバー表現と一致）

理由: 現在はカード側で既に進捗表示があるが、表記ゆれを減らすと理解しやすい。

お勧めのタスク
Goal Runの進捗ラベルをバー表示と一貫した文言に統一する

タスクを開始
実施コマンド（静的確認）
✅ pwd && rg --files | head -n 200
✅ sed -n '1,220p' spec/plan/plan-update.md
✅ sed -n '1,260p' src/game/dash/modes/modeTypes.js && sed -n '1,260p' src/game/dash/modes/dashModes.js && sed -n '1,260p' src/game/dash/modes/infiniteMode.js && sed -n '1,260p' src/game/dash/modes/goalRunMode.js && sed -n '1,260p' src/game/dash/modes/scoreAttack60Mode.js
✅ sed -n '1,320p' src/screens/dashGameScreen.js
✅ sed -n '1860,2070p' src/screens/dashGameScreen.js
✅ sed -n '1,260p' src/ui/domRefs.js
✅ rg -n "dash-game-time-wrap|dash-game-timebar|dash-game-time-note|dash-game-time|dash-game-next-area|dash-game-enemy" -g '*.html' -g '*.js' -g '*.css'
✅ sed -n '240,360p' index.html && sed -n '1660,1785p' styles/style.scoped.css && sed -n '2140,2215p' styles/style.scoped.css
✅ sed -n '1,280p' src/screens/dashStageSelectScreen.js && sed -n '1,220p' src/features/dashConstants.js && sed -n '1,240p' src/core/gameState.js
✅ sed -n '140,240p' src/screens/dashResultScreen.js && sed -n '1,190p' src/core/dashStatsStore.js
✅ sed -n '2480,2605p' src/screens/dashGameScreen.js && sed -n '2340,2425p' src/screens/dashGameScreen.js && sed -n '2425,2515p' src/screens/dashGameScreen.js
✅ sed -n '1748,1808p' src/screens/dashGameScreen.js