現状把握（ファイル/関数/変数名つき）
Dash Run の衝突経路（実装上の事実）
enemySystem 生成

src/screens/dashGameScreen.js:1213-1219

createDashEnemySystem({ worldEl: domRefs.game.runWorld, containerEl: domRefs.game.runEnemies, ... })

毎フレーム更新

src/screens/dashGameScreen.js:1033-1101 の updateFrame(dtMs) 内で

this.enemySystem?.update({...}) を呼び出し（1053-1060）

戻り値仕様

src/features/dashEnemySystem.js:544-548

{ nearestDistancePx, collision, attackHandled }

衝突ペナルティ発火点

src/screens/dashGameScreen.js:1064-1076

handledCollision = enemyUpdate.collision && !enemyUpdate.attackHandled

ここで timePenaltyOnCollision, triggerRunnerStumble(), audioManager.playSfx('sfx_damage') 実行

playerRect / enemyRect の実体
playerRect

src/screens/dashGameScreen.js:473-487

runWorld.getBoundingClientRect() と runnerWrap.getBoundingClientRect() の差分で {x,y,w,h}

runWorld または runnerWrap が無ければ null（476-477）

enemyRect（実質 enemy オブジェクト）

生成: src/features/dashEnemySystem.js:309-317（x,y,w,h）

更新: 509-511（enemy.x += ..., enemy.y = ..., transform）

衝突判定: 96-101 の intersects(a,b)（px矩形AABB）

座標系

enemy は runWorld ローカル座標（translate3d(x,y,0)）

player も runnerRect - worldRect で runWorld ローカルに揃える設計

既存デバッグUIの制約
src/screens/dashGameScreen.js:220-239 updateDebugHud(...)

localStorage.calcSprintDebug === '1' のときのみ表示（isDebugEnabled()依存）

今回要件「常時表示（DevTools/localStorage不要）」と不一致

最有力原因TOP3（根拠：コード箇所）
1) groundY 未確定で enemy の Y が 0 に固定され、player と縦方向で重ならない可能性
enemy.y は enemy.update() 内で enemy.y = Math.max(0, (groundY ?? enemy.y) - enemy.h)（src/features/dashEnemySystem.js:510）。
groundY が null の場合、初期生成時 y=0 近傍になりやすく、playerRect.y（下段）とズレると intersects() が不成立。

お勧めのタスク
Dashの衝突診断にgroundY/playerY/enemyYの実測値を常時表示する

タスクを開始
2) playerRect が null になると、衝突判定ブロック自体がスキップされる
enemySystem.update() の衝突処理は if (playerRect && enemy.state === 'walk')（src/features/dashEnemySystem.js:518）。
getPlayerRect() は runWorld / runnerWrap のどちらか欠落で null（src/screens/dashGameScreen.js:476-477）。
このとき敵は描画更新されるが、接触成立は0件になる。

お勧めのタスク
playerRect取得失敗の根本条件を可視化し、null時の理由コードをHUD表示する

タスクを開始
3) 既存HUDがdebug依存で、enemySystem.update 呼出回数や座標ズレを平常時に観測できない
現状 updateDebugHud() は debug ON 時だけ（src/screens/dashGameScreen.js:220-239）。
そのため「updateが呼ばれていないのか／呼ばれているが不成立なのか」をユーザーが画面だけで判別できない。

お勧めのタスク
Dash専用の常時診断HUD（非debug依存）を追加し衝突経路を毎フレーム可視化する

タスクを開始
診断UIの実装案（最初のPRはこれのみ）
追加対象ファイル
src/screens/dashGameScreen.js

src/features/dashEnemySystem.js（診断用返却値追加のみ）

styles/style.scoped.css

追加項目（毎フレーム）
ENEMY_SYS: this.enemySystem ? 1 : 0

ENEMY_UPD: updateFrame 内で enemySystem.update() を呼んだ回数累積

PLAYER_RECT: 取得可否 + w/h（0なら WARN)

ENEMY_RECT: 最近傍敵のhitbox可否 + w/h（0なら WARN)

COLL: enemyUpdate.collision

ATK: enemyUpdate.attackHandled

COORD: 例 abs((enemy.x - player.x)) や dy が異常値なら WARN

Overlay枠（任意だが推奨）
#dash-game-screen 上に半透明矩形を2つ描画

player: 緑枠

enemy: 赤枠

DOM overlay で十分（canvas不要）

Dash画面に限定して表示（他モード非表示）

観測で分岐する修正ルート（結果Aなら…結果Bなら…）
A: ENEMY_UPD が増えない

updateFrame()/startLoop() 経路を修正（ループ起動漏れ or 早期return）

B: PLAYER_RECT=0 が継続

runnerWrap 再取得・マウント順序修正（ensureRunLayerMounted() と verifyRunnerDom() の順/再実行）

C: PLAYER_RECT=1 だが ENEMY_RECT=0

enemySystem.update() 返却へ最近傍敵情報を追加し、spawn条件/生存条件を点検

D: 双方1だが COORD WARN

座標系統一（position: fixed の runner と worldローカル差分の扱いを整理）

E: COLL=1 だがペナルティ未発火

attackHandled 条件と cooldown 条件（lastCollisionPenaltyAtMs）をUIで併記して分岐確認

次のPRで直す恒久修正案（px/座標系問題だった場合）
playerRect と enemy を同一座標系に固定

runWorld ローカル基準で統一（必要なら runner も absolute化）

getPlayerRect() に健全性チェック導入

w/h<=0 は null 扱い＋理由ログ

enemySystem.update() の診断値は feature flag 化して本番負荷を抑制

衝突閾値は meter ではなく px衝突一本化

collisionThreshold は近接HUD用の演出値へ分離

手動確認手順（画面上の数値を見るだけ）
Dash Run開始

右上診断HUDを確認

ENEMY_SYS=1

ENEMY_UPD が毎秒増加

敵接近時に確認

PLAYER_RECT=1 かつ ENEMY_RECT=1

COORD が OK か

接触瞬間

COLL=1 になるか

ATK=0 なら time減少/stumble発火

もし不発なら HUD のどこが0/WARNかで次PRの修正ルートを選ぶ

Checks
✅ pwd; rg --files | head -n 200

✅ rg -n "enemySystem|collision|attackHandled|getPlayerRect|enemyUpdate|createDashEnemySystem|timePenaltyOnCollision|stumble|COLLISION" src/screens/dashGameScreen.js src/features/dashEnemySystem.js

✅ nl -ba src/screens/dashGameScreen.js | sed -n '1020,1125p'

✅ nl -ba src/features/dashEnemySystem.js | sed -n '360,580p'

✅ nl -ba src/ui/domRefs.js | sed -n '1,260p'

✅ nl -ba index.html | sed -n '420,480p'

✅ nl -ba styles/style.scoped.css | sed -n '2488,2768p'