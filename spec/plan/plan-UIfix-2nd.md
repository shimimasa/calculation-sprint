A. 現在のDash DOM構造の整理（簡易）
対象: index.html の #dash-game-screen セクション

上UI（dash-top-hud）

.dash-top-info：次エリア表示 / ルール文

.dash-top-controls

.dash-problem-grid：問題表示 (#dash-game-question) / 解答入力 (#dash-game-answer-input) / フィードバック

.dash-keypad-stack：テンキー (#dash-game-keypad) / 確定ボタン (#dash-game-submit-button)

ゲーム画面（dash-run-zone）

.run-viewport → .run-host に run-layer をDOM移動（JSでマウント）

run-layer内に .run-world .run-ground .run-enemies .runner-wrap が配置される

下ステータス（dash-bottom-hud）

#dash-game-time-wrap：残り時間バー/秒数/注記

.dash-bottom-stats：速度/距離/敵数/連続正解

.dash-bottom-side：敵の接近 (#dash-game-enemy) + 終了ボタン (#dash-game-back-button)

B. 新しい3レイヤー設計図（テキスト）
dash-screen (#dash-game-screen)
  ├─ dash-hud-top (上UI / HUD)
  │    ├─ dash-problem (問題 + 解答入力)
  │    ├─ dash-keypad (テンキー + 確定)
  │    └─ dash-time (残り時間バー + 秒数)
  ├─ dash-run-zone (ゲーム画面 / メイン)
  │    ├─ run-layer (run-world / run-ground / run-enemies / runner)
  │    └─ (背景雲/空含む)
  └─ dash-hud-bottom (下ステータス / 情報のみ)
       └─ dash-bottom-stats (速度/距離/敵数/連続正解の1行)
Grid定義（必須）

grid-template-rows: auto 1fr minmax(56px, 80px);

上UI = auto

ゲーム画面 = 1fr（最大領域）

下ステータス = minmax(56px, 80px)

C. 各レイヤーの責務まとめ
1) 上UIレイヤー（dash-hud-top）
責務

問題表示・解答入力・テンキー・確定ボタン・残り時間バー

背景は 透過（空背景が見える）。白ベタは禁止。

触ってよいCSS

.dash-top-hud, .dash-top-controls, .dash-problem-grid, .dash-keypad-stack

.dash-time（時間バーをトップ側に移設）

触ってはいけないCSS

.run-world, .run-ground, .runner-wrap などゲーム画面のアセット配置

JSを触らずに済むか

DOM移動が必要なためHTML修正は必須。

時間バーは #dash-game-time-wrap のDOM移動のみでJS変更は不要。

2) ゲーム画面レイヤー（dash-run-zone）
責務

キャラ・敵・ground・雲/背景のみ。

操作UIを置かない。

触ってよいCSS

.dash-run-zone の grid-row: 2 / height: 100% / overflow: hidden

groundのY位置は CSS変数 --ground-surface-inset で制御

触ってはいけないCSS

run-layer のアニメーション・速度係数・JSでのenemy配置ロジック（dashEnemySystem）

JSを触らずに済むか

不要（groundYは --ground-surface-inset をJS側で読むため、CSS変数のみ変更可）

3) 下ステータスレイヤー（dash-hud-bottom）
責務

情報のみ（速度/距離/敵数/連続正解）を1行

操作UI・近接ゲージ・終了ボタンは置かない

背景は軽い透過 or なし（空を透かす）

触ってよいCSS

.dash-bottom-hud, .dash-bottom-stats, .dash-stat-card の高さ/余白/フォント

pointer-events: none を付与して視線邪魔を抑制（必要なら）

触ってはいけないCSS

.dash-proximity（削除前提）

JSを触らずに済むか

不要（DOM移動/削除のみ）

D. 次にAgentへ投げるための「実装タスク分解（5〜8個）」
Dash画面のGridを3行固定へ変更（CSSのみ・DOM移動なし）

お勧めのタスク
Dash画面を3行Grid（auto / 1fr / minmax(56,80)）に固定する

タスクを開始
残り時間バーを上UIに移動（DOM移動あり・CSS調整あり）

お勧めのタスク
残り時間バーを上UI（dash-top-hud）に移設する

タスクを開始
下ステータスを情報のみ1行に整理（CSSのみ・DOM移動なし）

お勧めのタスク
下ステータスを1行の情報列に縮小する

タスクを開始
敵の接近ボックスを下ステータスから除外（DOM移動 or 削除）

お勧めのタスク
下ステータスから敵接近ボックスを削除する

タスクを開始
終了ボタンを下段から外す（DOM移動あり）

お勧めのタスク
終了ボタンを下ステータスから上UI側へ移動する

タスクを開始
groundのY位置をゲーム画面下寄りに固定（CSSのみ・DOM移動なし）

お勧めのタスク
groundのY位置をゲーム画面下寄りに固定する

タスクを開始
下レイヤーの操作無効化（pointer-events）を整理（CSSのみ）

お勧めのタスク
下レイヤーの操作を無効化して情報のみ扱いにする

タスクを開始
E. 失敗しやすいポイント（ズレの原因）
gridと絶対配置の併用
#dash-game-screen はグリッド化されている一方、run-layer が絶対配置で被るため、HUDを固定せずに下段に押し込むと重なりが発生。

時間バーが下段に残るとレイヤー定義が崩れる
下段が「情報のみ」の前提なのに、時間バーが残ると「上UI / 下UI」の役割が曖昧になる。

下段の高さが可変すぎる
現状 --dash-bottom-min が 120px〜200px で下段が広すぎ、ゲーム画面が狭くなる。
→ minmax(56px, 80px) 固定が必須。

groundのYがHUDに近すぎる
--ground-surface-inset を狭くするとHUDと干渉。
→ 下段高さを考慮した数値を確定させる必要がある。

敵接近ボックスと終了ボタンの残留
これらが下段に残ると「操作なし・情報のみ」が崩れる。
→ DOMから外す判断をPlanで明示。

備考（運用）
本Planは実装しない前提。

以降は「Dのタスク分解」を Agent に渡して実装工程に移行。

Testing
Not run (read-only QA review; no tests executed).

Notes
本依頼は「変更禁止・読み取り専用」指示のため、コミット作成・PR作成は行っていません。