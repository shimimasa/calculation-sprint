調査結果まとめ（衝突判定の所在と呼び出し経路）
ループ入口

src/screens/dashGameScreen.js startLoop() → requestAnimationFrame(tick) → updateFrame(dtMs)（1823行付近）

衝突判定の主導関数

updateFrame() 内で this.enemySystem.update({...}) 呼び出し（1715行付近）

実体は src/features/dashEnemySystem.js system.update()（468行付近）

実際の当たり判定

dashEnemySystem.js の intersects(a,b)（AABB, 100行付近）

system.update() 内で if (playerRect && enemy.state==='approaching' && enemy.collisionEnabled) のとき intersects(playerRect, enemy)（603-607行付近）

座標系

ランナー: getPlayerRect() で runnerWrap.getBoundingClientRect - worldRect によりrun-worldローカル座標化（1126-1139）

敵: enemy.x/y/w/h（dashEnemySystem内部の同じrun-worldローカル座標）

＝ 判定座標系は一致設計

判定対象

敵: system.enemies（dashEnemySystem）

ランナー: domRefs.game.runnerWrap 経由で取得される playerRect

衝突時副作用（Dash画面側）

handledCollision = enemyUpdate.collision && !enemyUpdate.attackHandled（1743-1746）

かつ invincible でなければ、timeLeftMs 減少・slowUntilMs・runnerHitUntilMs・runnerInvincibleUntilMs・sfx_damage・スタンブル演出（1756-1785）

Root Cause（最有力）
1) ループ内例外で「通常フレーム」が落ちると、衝突処理が実質停止する可能性
startLoop() は updateFrame() 例外時に catch で updateFrame(0) を再実行します（1835-1840）。
一方 dashEnemySystem.update() は dtMs <= 0 だと衝突なしで早期return（474-483）。
そのため、debugEnemyRect is not defined のような例外が通常フレームで連続すると、衝突が「消えた」ように見えます。

お勧めのタスク
Dashループ例外時でも衝突判定パスが失われないようにする

タスクを開始
2) playerRect が null のとき衝突判定ブロック自体に入らない
dashEnemySystem.update() の衝突判定は if (playerRect && ...) 前提（603）。
getPlayerRect() は runWorld または runnerWrap が取れないと null を返す（1126-1131）。
run-layer移設（ensureRunLayerMounted()）やDOM参照の切れで null が続くと、衝突は永続的に不発になります。

お勧めのタスク
playerRect未取得時の原因を即時診断できるようにして衝突不発を復旧する

タスクを開始
“消えた理由”仮説と検証ポイント
ループから外れている

確認箇所: startLoop()/tick()/updateFrame()（1815-1853）

判定方法: loopFrameCount, lastFrameAtMs, lastLoopErrorMessage の変化確認（既存バッジあり）

checkCollision相当が呼ばれていない

確認箇所: updateFrame() の enemySystem.update() 呼び出し（1715）

判定方法: enemyUpdateCount増加と enemyUpdate の取得有無

早期returnで到達しない

確認箇所: updateFrame() 冒頭 timeLeftMs<=0、dashEnemySystem.update() の dtMs<=0/!worldEl return

判定方法: dtMs, timeLeftMs, worldEl のログ

参照壊れ（null/未定義）

確認箇所: getPlayerRect(), ensureRunLayerMounted(), verifyRunnerDom()

判定方法: playerRect null頻度、runnerWrap.isConnected、runWorld.clientWidth

enemy生成されていない

確認箇所: spawnEnemy() (worldWidth==0 return, START_GRACE_MS)

判定方法: system.enemies.length, spawnTimerMs, worldEl.clientWidth

無敵/クールダウン常時ON

確認箇所: runnerInvincibleUntilMs 更新 (1774)、初期化 (1920)

判定方法: nowMs < runnerInvincibleUntilMs が恒常 true か

判定は走るが副作用無効化

確認箇所: handledCollision、timePenaltyOnCollision、後続上書き

判定方法: timeLeftBefore/After, slowUntilMs, lastCollisionPenaltyAtMs

最小修正の実装手順（Plan）
先に例外停止要因を潰す（最優先）

ループ内例外の再発点を特定し、未定義参照・null参照の防御を追加。

playerRect取得失敗の可視化と再取得導線を強化

Dash開始直後とフレーム中で参照状態を明確化。

衝突判定ロジックは既存を維持

dashEnemySystem.intersects() と handledCollision は温存、周辺ガードのみ最小追加。

（必要時のみ）無敵/キック中の誤爆制御を明確化

今回主目的は“復活”だが、既存フラグの意味を崩さず条件順序を明文化。

検証手順（再現→修正確認）
Dash開始後、敵スポーンまで待機（START_GRACE_MS=2.5s）

敵へ接触（不正解・未攻撃状態）

期待: collision=true → handledCollision=true → 時間減少/SFX/減速

正解直後のキック演出中に接触

期待: 既存仕様に従い誤爆しない（少なくとも例外で止まらない）

連続接触

期待: COLLISION_COOLDOWN_MS 中は連続被弾しない

コンソールで例外ゼロ確認

期待: loop error が増えない、enemyUpdateCount が継続増加

リスクと副作用
Dash画面のデバッグ出力増加（本番ログノイズ）

ループ保護コードの追加で軽微な分岐増（FPS影響は小）

run-layer参照の補強が他モード共有DOMに触れるため、適用範囲は Dash限定にすること

次の一手（実装フェーズ移行用）
上記2件（例外耐性 / playerRect可視化）を先に最小Diffで入れ、
その後に「衝突発火率」「誤爆率」を手動確認する順序が最短です。

実行コマンド（静的確認）
✅ pwd && rg --files | head -n 200

✅ rg --files -g '**/AGENTS.md'

✅ rg -n "collision|collide|hit|damage|overlap|intersect|AABB|rect|enemyRect|runnerRect|getBoundingClientRect|COOLDOWN|handledCollision|updateFrame|requestAnimationFrame|tick|isKicking|invincible|cooldown" src/screens src/features src/core src/ui

✅ sed -n '1,260p' src/features/dashEnemySystem.js && sed -n '260,620p' src/features/dashEnemySystem.js

✅ sed -n '620,860p' src/features/dashEnemySystem.js

✅ nl -ba src/features/dashEnemySystem.js | sed -n '280,620p'

✅ nl -ba src/screens/dashGameScreen.js | sed -n '1580,1870p'

✅ nl -ba src/screens/dashGameScreen.js | sed -n '1690,1765p'

✅ rg -n "debugEnemyRect|getPlayerRect|runnerInvincibleUntilMs|COLLISION_COOLDOWN_MS|attackUntilMs|kickUntilMs|enemySystem" src/screens/dashGameScreen.js

✅ nl -ba src/screens/dashGameScreen.js | sed -n '1080,1185p' && nl -ba src/screens/dashGameScreen.js | sed -n '1888,2015p' && nl -ba src/screens/dashGameScreen.js | sed -n '120,360p'

✅ rg -n "debugEnemyRect" src

✅ nl -ba src/screens/dashGameScreen.js | sed -n '1960,2035p'

✅ rg -n "startLoop\\(|stopLoop\\(|enter\\(\\).*dash-game|changeScreen\\('dash-game'|dashGameScreen" src/screens src/core src/main.js

✅ nl -ba src/screens/dashGameScreen.js | sed -n '2168,2255p' && nl -ba src/screens/dashGameScreen.js | sed -n '600,700p'

✅ nl -ba src/screens/dashGameScreen.js | sed -n '1,120p'

✅ nl -ba src/features/dashConstants.js

✅ nl -ba src/ui/domRefs.js | sed -n '1,220p'

✅ rg -n "run-world|runner-wrap|dash-game-screen|game-screen" index.html

✅ nl -ba index.html | sed -n '180,330p' && nl -ba index.html | sed -n '330,500p'

✅ rg -n "ensureRunLayerMounted|restoreRunLayer|runHost|runLayer" src/screens/dashGameScreen.js && nl -ba src/screens/dashGameScreen.js | sed -n '920,1085p'

✅ rg -n "updateDebugHud\\(|enemyRect|nearestDxPx|collided" src/screens/dashGameScreen.js && nl -ba src/screens/dashGameScreen.js | sed -n '700,820p'

✅ nl -ba src/features/dashEnemySystem.js | sed -n '220,290p'