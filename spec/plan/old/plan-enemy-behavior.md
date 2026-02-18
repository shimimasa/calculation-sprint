(1) 推奨仕様（結論）
推奨: A改良版（被弾した敵は即「危険終了」→0.12〜0.20sの短フェードで消滅）

UX的に最も明快です（「当たった／終わった」が一瞬で伝わる）。

現在の「後退→再接近→すり抜け」の曖昧さを根本解消できます。

実装コストが低く、既存構造（dashGameScreen.updateFrame と dashEnemySystem）に乗せやすいです。

多数敵でも視認性が崩れにくく、テンポ維持しやすいです。

現状コードで起きていそうな原因仮説
Issue 1: 衝突後の敵が「見えるまま移動継続」するため、当たり結果の認知が曖昧
dashEnemySystem.update() では衝突時に COLLISION_KNOCKBACK_PX を入れて敵を後ろへ戻し、ignoreCollisionUntilMs で無敵化しています。一方 dashGameScreen 側では hitEnemyIds で再ペナルティを抑制しており、敵表示は残るが危険性だけ消える状態が発生しています。これが「すり抜けてる？」に見える主因です。

お勧めのタスク
被弾時の敵を即時に危険終了し短時間で消す（通り抜け挙動を廃止）

タスクを開始
Issue 2: 衝突判定の責務が二重化（EnemySystem矩形判定 + DOM矩形判定）され、遷移意図が分かりにくい
dashEnemySystem.update() 内の intersects(playerRect, enemy) と、dashGameScreen.updateFrame() の intersectsDomRect(...) が混在し、collision と attackHandled の責務分離が弱いです。挙動の温床になりやすいです。

お勧めのタスク
衝突結果の単一責務化（EnemySystemを真実源に統一）

タスクを開始
Issue 3: 「正解時の飛び蹴り撃破」と「接触被弾」の終了条件が視覚的に近く、結果の差が弱い
いまは attackHandled と defeatSequenceActive で制御されていますが、UX的には「倒した」vs「食らった」をもっと瞬時に区別する必要があります。

お勧めのタスク
撃破と被弾の演出語彙を分離し、結果を一目で判別可能にする

タスクを開始
(2) 仕様詳細（状態遷移図レベル）
推奨ライフサイクル（敵1体）:

approaching(walk)

危険あり、当たり判定あり

collision_resolved（被弾時専用、0.12〜0.20s）

危険なし、当たり判定なし、短演出のみ

defeated(hit/dead)（正解攻撃時）

危険なし、撃破演出

despawning

remove待ち

inactive

配列から除去済み

遷移:

walk --(接触 & attack不成立)--> collision_resolved --> despawning --> inactive

walk --(正解攻撃命中)--> defeated(hit/dead) --> despawning --> inactive

(3) 実装タスク分解（ファイル候補・影響範囲・テスト観点）
実装タスク1（敵状態機械）
お勧めのタスク
dashEnemySystemに被弾専用状態を追加し、危険終了を即時化する

タスクを開始
実装タスク2（画面側ロジックの簡素化）
お勧めのタスク
dashGameScreenの被弾処理をイベント駆動にし、hitEnemyIds依存を縮小する

タスクを開始
実装タスク3（視認フィードバック）
お勧めのタスク
被弾/撃破の見た目差分をCSSで短時間表現する

タスクを開始
実装タスク4（回帰確認観点）
お勧めのタスク
敵挙動の回帰確認シナリオを追加し、すり抜け再発を防ぐ

タスクを開始
(4) 受け入れ基準（Acceptance Criteria）
被弾時、対象敵は0.2秒以内に危険状態を終了し、以後その敵で衝突ペナルティは発生しない。

被弾後に敵が「後退→再接近→通過」する挙動は発生しない。

撃破時のみ「飛び蹴り→撃破演出→消滅」が再生され、被弾時は別演出で終了する。

複数敵がいる場合でも、被弾済み敵と危険な次敵を即座に見分けられる。

1セッション中の敵数増加時にも、非危険敵が長く残留して更新コストを増やさない。

Testing / Checks
✅ pwd; rg --files -g 'AGENTS.md'（AGENTS.mdの配置確認。該当ファイルは検出されず）
✅ rg --files | head -n 200（リポジトリ構成の確認）
✅ sed -n '1,260p' src/screens/dashGameScreen.js; sed -n '261,520p' src/screens/dashGameScreen.js（対象画面ロジックの静的確認）
✅ rg -n "collision|collid|enemy|attack|defeat|despawn|hit|phase|stun|cooldown" src/screens/dashGameScreen.js | head -n 200（関連箇所の特定）
✅ sed -n '720,860p' src/screens/dashGameScreen.js; sed -n '1240,1460p' src/screens/dashGameScreen.js（衝突後処理と近傍敵抽出の確認）
✅ sed -n '1,280p' src/features/dashEnemySystem.js; sed -n '280,620p' src/features/dashEnemySystem.js（敵状態機械と更新処理の確認）
✅ rg -n "spawnEnemy|reset|destroy|applyDamage|defeatNearestEnemy|createEnemy|ignoreCollision|state|isAlive" src/features/dashEnemySystem.js（状態遷移の入口確認）
✅ sed -n '230,390p' src/features/dashEnemySystem.js（spawn/damage/defeatの詳細確認）
✅ rg -n "run-enemies|enemy-wrap|enemy-sprite|is-hit|is-attack|enemy" styles/style.scoped.css | head -n 200（視覚表現の定義位置確認）
✅ sed -n '2480,2585p' styles/style.scoped.css（敵表示スタイルの静的確認）