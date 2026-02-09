以下は実装前の調査・設計Planです（リポジトリは読み取り専用のため変更・コミットは行っていません）。

1) Dash画面のDOM構造（主要要素・親子関係）
対象: index.html の #dash-game-screen

section#dash-game-screen.screen.screen-dash

背景/走行レイヤ受け皿

.run-viewport（絶対配置・全画面）

.run-host（ここに .run-layer がDOM移動）

ヘッダーHUD

header.dash-header

.dash-stats--header（距離 #dash-game-distance）

#dash-game-next-area（次エリア表示）

.dash-sidehud（連続正解 #dash-game-streak、敵接近バー #dash-game-enemy、終了ボタン）

プレイフィールド

.screen-main.dash-playfield

.dash-hud

.dash-lane

.game-focus

#dash-game-time-wrap（残り時間バー/秒）

.dash-problem-grid

.dash-problem-main

.question-area（問題 #dash-game-question / 入力 #dash-game-answer-input）

#dash-game-feedback

.game-actions → #dash-game-keypad-toggle

.dash-keypad-stack

#dash-game-keypad（テンキー）

.dash-keypad-actions → #dash-game-submit-button（確定）

走行レイヤ本体（通常ゲーム側に定義）

section#game-screen 内に .run-layer（.run-world / .run-ground / .run-enemies / runner 等）

src/screens/dashGameScreen.js の ensureRunLayerMounted() が .run-layer を .run-host に移動。

2) 3ゾーン分割の実現方法（CSS/レイヤ調整方針）
要件

上HUD: 0–45%

走行: 45–78%（ground & キャラ/敵をこの範囲に収める）

下HUD: 78–100%（走行描画の侵入禁止）

現状

.run-viewport が #dash-game-screen 全面に absolute で敷かれており、走行描画の縦範囲制限が無い。

HUD は absolute で配置されるため、ゾーン境界と衝突しやすい。

方針案（CSSでゾーン確定 → 走行レイヤ高さ制限）

#dash-game-screen を CSS Grid (3行) に変更し、

grid-template-rows: 45% 33% 22% でゾーンを固定。

.run-viewport を 「走行ゾーン」内に移動（DOM/または CSSで領域限定）し、

height: 100% + overflow: hidden で 走行描画が上下HUDへ侵入しないようにする。

groundを上げる（案B）

--ground-surface-inset を dash専用に上書き。

例: #dash-game-screen { --ground-surface-inset: <小さめ値>; }

dashGameScreen.getGroundSurfaceInsetPx() が CSS変数参照なので CSSのみで地面位置調整可。

結論

CSS grid + run-viewport/run-host の高さ固定が適切。

clip-path のみでは .run-world 全体のアニメーション/敵生成位置が画面外へ出る可能性があり、height/overflow制御が確実。

3) 下HUDに出す指標のデータ源（state/store/DOM）
希望: 残り時間（バー+秒）/ 速度 / 距離 / 敵数

残り時間

ソース: dashGameScreen.timeLeftMs（updateHud()で #dash-game-time を更新）

バー: #dash-game-timebar の width

距離

ソース: gameState.dash.distanceM（updateHud()で #dash-game-distance を更新）

速度

ソース: dashGameScreen.playerSpeed（updateFrame()内で effectivePlayerSpeed を算出）

現在 DOM 反映先なし → 下HUD用の新DOM + updateHud()で反映が必要

敵数

ソース: this.enemySystem.enemies（src/features/dashEnemySystem.js）

生存中の敵数を算出してHUDに表示する形が妥当
例: enemySystem.enemies.filter(e => e.isAlive && e.state !== 'dead').length

触るべきファイル一覧
index.html

#dash-game-screen のゾーン分割用DOM追加（上HUD/走行/下HUDコンテナ）

下HUD表示用の新要素（速度/敵数など）

styles/style.scoped.css

#dash-game-screen に Grid + 各ゾーンの layout

run-viewport/run-host を走行ゾーン内に限定

下HUDのレイアウト/固定位置

--ground-surface-inset の dash専用上書き

src/screens/dashGameScreen.js

updateHud() で速度/敵数を新DOMに反映

必要なら domRefs に下HUD要素を追加

src/ui/domRefs.js

下HUD用の要素参照追加

（必要なら）src/features/dashEnemySystem.js

敵数の取得用の補助メソッド追加（任意）

変更方針（DOM移動とCSS固定）
DOM移動

#dash-game-screen 内に dash-top-hud, dash-run-zone, dash-bottom-hud を新設。

.run-viewport（または .run-host）を dash-run-zone に配置し、height を 33% に固定。

CSS固定

#dash-game-screen を display: grid; grid-template-rows: 45% 33% 22%。

上HUD＝dash-top-hud、下HUD＝dash-bottom-hud に pointer-events: auto。

.run-viewport / .run-host に overflow: hidden。

--ground-surface-inset を dash限定で調整して地面を上へ。

実装タスク（5〜8、順序つき）
既存Dash DOMをゾーン構造に再配置

index.html の #dash-game-screen 内に dash-top-hud / dash-run-zone / dash-bottom-hud を新設。

.run-viewport を dash-run-zone の子として配置し、走行レイヤの視認領域を中段に限定。

上HUDの構成整理

dash-top-hud に #dash-game-time-wrap, .dash-problem-grid, .dash-keypad-stack を移動。

既存 .dash-hud / .dash-lane の役割を縮小 or 廃止。

下HUDのDOM追加

下HUDに以下のUIを追加:

残り時間（バー+秒）（既存要素を移動 or 複製）

速度表示（新DOM）

距離表示（#dash-game-distance を移動 or 複製）

敵数表示（新DOM）

CSSで3ゾーン確定

#dash-game-screen を Grid layout 化（45/33/22%）。

dash-run-zone に overflow: hidden を付与して走行描画の侵入を防止。

groundを上げる（案B）

#dash-game-screen 限定で --ground-surface-inset を調整。

dashGameScreen.getGroundSurfaceInsetPx() の仕様を活用してCSSのみで反映。

下HUDのデータバインド

domRefs.dashGame に新DOM参照を追加。

dashGameScreen.updateHud() で速度 (playerSpeed)、敵数 (enemySystem.enemies) を更新。

走行レイヤのZ-index/重なり確認

上HUD/下HUDが走行レイヤの上に固定されるよう z-index を整理。

走行ゾーンの描画が上下HUDに侵入しないか確認。

Testing
（実行なし：読み取り専用）

必要なら、次のステップとして **実装前の詳細設計（DOM差分/新CSSクラス定義）**も作成します。