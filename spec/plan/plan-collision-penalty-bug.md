以下、リポジトリの静的読解のみで整理した実装Planです（差分なし）。

1) 現状フローの特定（衝突 / ペナルティ / 撃破演出）
衝突判定の計算箇所
主要ループは src/screens/dashGameScreen.js の updateFrame(dtMs)。

衝突関連は2段構えです。

enemySystem.update({... attackActive }) 呼び出し

src/features/dashEnemySystem.js の system.update() 内で intersects(playerRect, enemy) を使って当たり判定。

衝突した敵に ignoreCollisionUntilMs（敵ごとの無敵時間）を付与し、ノックバック。

attackActive が true の場合のみ attackHandled = true にし、敵を hit 状態へ。

その後 dashGameScreen.updateFrame() 側で DOM Rect 再判定

collisionByDomRect = intersectsDomRect(...)

handledCollision = collisionByDomRect && !enemyUpdate.attackHandled

handledCollision が true のとき衝突ペナルティ適用（減速・時間減少・ダメージSE等）

ペナルティ適用条件
src/screens/dashGameScreen.js の updateFrame() 内:

handledCollision が true

かつ nowMs - lastCollisionPenaltyAtMs >= COLLISION_COOLDOWN_MS（500ms）

適用内容:

timeLeftMs -= timePenaltyOnCollision

slowUntilMs = nowMs + COLLISION_SLOW_MS（1000ms）

audioManager.playSfx('sfx_damage')

triggerRunnerStumble()

つまり、ペナルティ抑止は enemyUpdate.attackHandled に依存しています。

撃破（正解→飛び蹴り）状態の管理箇所
src/screens/dashGameScreen.js の submitAnswer():

正解時 enemySystem.defeatNearestEnemy({ playerRect, nowMs })

defeatResult.defeated なら

kickUntilMs = nowMs + KICK_MS（300ms）

kickLungePx 設定

sfx_attack 再生

あわせて attackUntilMs = now + ATTACK_WINDOW_MS（250ms）を設定

見た目は updateRunLayerVisuals() で

nowMs < kickUntilMs の間 runnerWrap.classList.add('is-kicking')

要点：見た目（kickUntilMs:300ms）と衝突抑止に効く攻撃判定窓（attackUntilMs:250ms）が別管理。

2) 根本原因（1〜2行）
撃破演出中（kickUntilMs 有効）でも、衝突ペナルティ抑止条件が attackUntilMs にしか連動していないため、演出後半で attackHandled=false になり衝突ペナルティが通る。

つまり「撃破中 state が衝突ペナルティ判定へ十分に伝播していない」状態です。

3) 修正方針（複数案）
案A（画面側で早期return/抑止）
dashGameScreen.updateFrame() の handledCollision 判定に、isDefeatSequenceActive（例: nowMs < kickUntilMs）を直接加える。

お勧めのタスク
撃破演出中はDash画面側で衝突ペナルティを無効化する

タスクを開始
メリット: 最小変更、影響範囲が狭い。

デメリット: 衝突ロジックが「画面側条件」に寄る。

リスク: 将来ロジック再利用時に enemySystem 単体では再発余地。

案B（敵システム側でゴースト/無衝突状態を持つ）
enemySystem.update() に defeatSequenceActive を渡し、衝突検知そのものをスキップ。

お勧めのタスク
敵システムに撃破演出中の衝突無効状態を導入する

タスクを開始
メリット: 判定責務をロジック層へ寄せられる。

デメリット: シグネチャ変更で影響点がやや増える。

リスク: 他画面・将来呼び出し箇所が増えると引数漏れ注意。

案C（衝突種別を分離）
damageCollision と defeatCollision を分け、状態で適用先を切り替える。

お勧めのタスク
衝突判定をダメージ用と撃破演出用に分離して状態依存を明確化する

タスクを開始
メリット: 拡張性が高い（ボス多段ヒット対応に強い）。

デメリット: 変更量が最も多い。

リスク: 既存HUD/デバッグ表示との整合調整が必要。

4) 推奨案と実装ステップ（推奨：案B）
理由: 最小変更の案Aでも直りますが、**「衝突制御は衝突側で管理」**できる案Bのほうが、今後のボス実装（多段HP・段階演出）に自然に拡張できます。

お勧めのタスク
推奨実装: dashEnemySystemにdefeatSequenceActiveを通し撃破演出中のペナルティ衝突を抑止する

タスクを開始
5) 手動テスト観点
お勧めのタスク
回帰確認: 撃破演出中の衝突ペナルティ抑止と通常衝突維持を手動検証する

タスクを開始
実施コマンド（静的調査）
✅ pwd; rg --files -g 'AGENTS.md'
✅ rg --files | head -n 200
✅ rg -n "collision|cooldown|handledCollision|kicking|defeat|attack|damage|is-kicking|kick|defe" src/screens/dashGameScreen.js src/features/dashEnemySystem.js src/core/gameState.js src/features/dashConstants.js src/core/audioManager.js
✅ nl -ba src/screens/dashGameScreen.js | sed -n '1240,1465p'
✅ nl -ba src/features/dashEnemySystem.js | sed -n '330,610p'
✅ nl -ba src/screens/dashGameScreen.js | sed -n '1,130p'; nl -ba src/features/dashConstants.js | sed -n '1,220p'
✅ nl -ba src/features/dashEnemySystem.js | sed -n '1,120p'
✅ nl -ba src/screens/dashGameScreen.js | sed -n '1480,1585p'; nl -ba src/screens/dashGameScreen.js | sed -n '900,1035p'