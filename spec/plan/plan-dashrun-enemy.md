DashRun Phase1 計画（hit/end安定化 + 画面内スポーン）
前提として spec/plan/plan-update.md の Phase1（敵挙動の完全安定化） を最優先に据え、最小差分・既存構造尊重で組み立てます。
以下はコード静的読解ベースで、未実行部分は「推測」と明記します。

1) 現状把握（As-Is）
1-1. 実際の処理フロー（敵生成〜更新〜攻撃確定〜アニメ切替〜remove〜衝突判定）
画面初期化

src/screens/dashGameScreen.js の start() 相当初期化内で createDashEnemySystem(...) を生成し reset() 実行。

参照DOMは domRefs.game.runWorld / domRefs.game.runEnemies。

毎フレーム更新

dashGameScreen.updateFrame(dtMs) が enemySystem.update(...) を呼ぶ。

groundY（worldローカル換算）と worldGroundTopY（衝突用補正）を渡す。

敵生成

src/features/dashEnemySystem.js system.update(...) 内で spawn timer 消化時に system.spawnEnemy(...)。

現在の spawnX は
worldWidth + baseOffset + speedMagnitude * MIN_TIME_TO_COLLISION_SEC
で、画面外右から入ってくる。

敵状態・アニメの遷移

setEnemyState(enemy, nextState, nowMs) が唯一の状態遷移入口。

実状態: approaching / collision_resolved / defeated / despawning

defeated時:

collisionEnabled=false

hitAtTs = now + HIT_START_DELAY_MS

stateUntilMs = hitAtTs + HIT_DURATION_MS

pendingVisualState='hit'

updateループ内:

now >= hitAtTs で sprite を hit に変更

now >= stateUntilMs で despawning に遷移し sprite を dead

despawning の stateUntilMs 経過で isAlive=false → DOM remove

攻撃確定（正答時）

dashGameScreen.submitAnswer() が enemySystem.defeatNearestEnemy({playerRect, nowMs}) を即時実行。

ここで damageEnemy -> setEnemyState('defeated') が起こる。

同時に attackUntilMs = now + ATTACK_WINDOW_MS を設定し、次フレーム衝突処理で attackActive 判定にも使う。

衝突判定

enemySystem.update(...) 内で enemy.state==='approaching' && collisionEnabled の敵のみ当たり判定。

重なり時:

attackActive true なら setEnemyState('defeated'), attackHandled=true

false なら setEnemyState('collision_resolved'), collision=true

dashGameScreen.updateFrame 側は collision && !attackHandled のときのみペナルティ適用。

remove

removeはDOMアニメ終了イベントではなく、**時間ベース（stateUntilMs）**で管理。

1-2. 担当ファイル/関数一覧
敵システム本体

src/features/dashEnemySystem.js

createDashEnemySystem

spawnEnemy

update

setEnemyState

damageEnemy

defeatNearestEnemy

ゲームループ・回答処理・攻撃入力

src/screens/dashGameScreen.js

submitAnswer

updateFrame

getPlayerRect

getWorldGroundTopY

updateRunnerGroundAlignment

DOM構造

index.html（.run-world, .run-enemies, .runner-wrap）

見た目（敵のクラス反映）

styles/style.scoped.css（.enemy-wrap, .is-defeated, .is-collision-resolved）

2) 不具合仮説（hit/endが通らない原因候補）
ここでの「end」は現コード上では dead sprite + despawning 完了の意味で解釈（推測）。

仮説A: 攻撃経路が二重で、状態遷移のタイミング競合が起こる
事象候補:

正答時に defeatNearestEnemy() で即 defeated 化

同時に attackUntilMs で update衝突側でも defeated 化を試みる

現在 setEnemyState は同一stateならreturnするが、境界フレームで別イベントが混ざる可能性

検証:

setEnemyState に devログ（enemyId, prevState, nextState, nowMs, caller tag）

submitAnswer と update の双方から caller tag を渡す（開発時のみ）

条件: 連打/高FPS/低FPSで enemyId 単位の遷移順序を追う

仮説B: 時間ベース遷移がフレーム落ちで「hit可視時間不足」になっている
事象候補:

HIT_DURATION_MS=120 と遅延 HIT_START_DELAY_MS=150 が短く、dt跳ねたとき hit がほぼ1フレーム以下

見た目として「hitを通っていない」ように見える

検証:

nowMs, hitAtTs, stateUntilMs, 実際に setEnemySprite('hit'/'dead') が呼ばれた時刻をログ

ブレークポイント: update内 pendingVisualState 消費箇所

条件: タブ非アクティブ復帰直後、CPU高負荷時

仮説C: y基準が複数あり、衝突座標と描画座標のズレで分岐が不安定
事象候補:

描画yは groundY - enemy.h

衝突用rectは worldGroundTopY - enemy.h を優先

groundY と worldGroundTopY の差分次第で重なり判定と見た目が乖離

検証:

1フレームごとに groundY, worldGroundTopY, enemy.y, enemyRectForHit.y, playerRect.y を記録

条件: ステージ切替直後・リサイズ直後・run-layer再マウント後

仮説D: 早期isAlive=false条件によりend演出保証が弱い
事象候補:

enemy.x + enemy.w < 0 でも即remove

defeat終端を待つ前に左外へ抜けるケースが理論上あり得る（推測）

検証:

remove理由コードを付与ログ（offscreen / collision_resolved_timeout / despawning_timeout）

条件: speed上昇時、敵密度高いとき

3) To-Be設計（ステートマシン）
3-1. 状態定義（提案）
spawning（任意: 初期表示安定用）

approaching

defeated_hit

defeated_end

removed

※既存に寄せるなら defeated を defeated_hit、despawning を defeated_end にリネーム/明確化。

3-2. 遷移ルール
approaching -> defeated_hit は **単一路（entry関数）**のみ。

defeated_hit 中:

collisionEnabled=false 強制

再被弾/再defeat要求は無視（idempotent）

defeated_hit 完了後のみ defeated_end へ

defeated_end 完了後のみ removed（DOM remove）

つまり removeはend完了後のみ。

3-3. 入口関数の一元化（idempotent）
requestDefeat(enemy, source, nowMs) を追加（または setEnemyState のラッパ）

役割:

既に defeated_* なら no-op

初回のみ defeated_hit へ

ログ/イベント起点を統一（submit由来・collision由来）

submitAnswer と update(overlap+attackActive) はこの関数を呼ぶだけにする。

4) 出現位置変更（画面内スポーン）
4-1. spawnXを画面内右寄りへ
spawnX = worldWidth * 0.78（例）を基準化。

既存の公平性チェッ（minGap/minReactionDistance）は維持し、条件未達ならそのフレームspawnスキップ。

速度依存オフセットは撤廃または最小化（不安定要因を減らす）。

4-2. spawnYの単一ソース化
候補（最小差分）:

dashGameScreen.getWorldGroundTopY() を唯一の地面基準とし、enemy側へ同じ値を供給

enemy.y = worldGroundTopY - enemy.h を描画/衝突で共通利用

実装位置案:

dashEnemySystem.update/spawnEnemy に spawnGroundY を追加し、以後この値を使う

ステージ別補正（必要なら）:

src/features/dashStages.js 側に将来拡張用 groundOffsetPx を置く（今回は既定0、推測）

5) 実装タスク分解（Step 1〜N）
Step 1: 計測/再現性確立（最優先）
変更ファイル

src/features/dashEnemySystem.js

src/screens/dashGameScreen.js

やること

遷移ログ（enemyId, prev->next, reason/source, timestamps, removeReason）追加

デバッグフラグ有効時のみ出力（既存 isDebugEnabled, query/storage の仕組みを流用）

100回連続検証の観測カウンタ（hit/end/remove成功数）をHUDかconsole集計

完了条件

同一enemyの状態遷移が時系列で追える

ログON/OFFが容易（本番ノイズなし）

リスク

ログ過多で可読性低下

Step 2: defeat入口の一元化 + idempotent化
変更ファイル

src/features/dashEnemySystem.js

src/screens/dashGameScreen.js

やること

requestDefeat 相当を追加し、submitAnswer と update の攻撃側経路を統一

既defeat状態への再入防止

完了条件

defeated遷移が1敵1回のみ

event重複が消える

リスク

既存スコア加算タイミングとの整合

Step 3: defeatedを hit/end の2段階へ明確化
変更ファイル

src/features/dashEnemySystem.js

styles/style.scoped.css（必要最小）

やること

defeated_hit -> defeated_end -> removed を時間管理で保証

remove条件を defeated_end 完了時に限定

defeat中衝突無効を再確認

完了条件

全defeatで hit/end が順に観測される

リスク

体感テンポ遅延（秒数調整必要）

Step 4: 画面内スポーン化（右寄り）
変更ファイル

src/features/dashEnemySystem.js

やること

spawnX を worldWidth * 0.78 基準へ変更

既存のspawn fairness（minGap/reactionDistance）維持

完了条件

敵が画面内右寄りから出現

リスク

既存難易度バランスが変化

Step 5: ground基準の単一化
変更ファイル

src/screens/dashGameScreen.js

src/features/dashEnemySystem.js

やること

描画Y・衝突Y・spawnYの参照元を揃える

ステージ差異の補正ポイントを1か所に集約（現時点0補正でも可）

完了条件

足元ズレが全ステージで再現しない

リスク

run-layer再配置時の一時null

Step 6: 回帰確認（ゲームフロー副作用チェック）
変更ファイル

なし（確認のみ）

やること

出題/距離/タイム/ペナルティ/報酬時間の挙動確認

衝突中の無敵時間や二重ペナルティが増えていないか確認

完了条件

既存フローに副作用なし

リスク

デバッグ条件でのみ再現する差分

6) 受け入れ条件（Acceptance Criteria）
100回連続で hit -> end -> remove が必ず発生（enemyId単位ログで検証可能）

defeat中は衝突無効（二重ペナルティなし）

全ステージで画面内スポーン成立（右寄り出現・足元一致）

出題/距離/タイムなどゲーム進行ロジックに副作用なし

7) 非目標（やらないこと）
新アセット追加はしない

UI刷新はしない

出題ロジックは変更しない（敵挙動のみに限定）

8) 確認すべき観測点（不明点を潰すための質問内包）
end の定義を「dead sprite表示 + remove待ち」で確定してよいか
（現実装に animationend が無いため）

hit/end の最低表示時間の希望値（体感優先か厳密優先か）

ステージ別の地面補正が実際に必要か（現状CSS差分起因の可能性）

100回連続検証は手動でよいか、簡易自動入力（既存デバッグ経路）を許容するか

確認コマンド（静的読解で実施）
✅ pwd; rg --files -g 'AGENTS.md'

✅ rg --files | head -n 200

✅ sed -n '1,220p' spec/plan/plan-update.md

✅ sed -n '1,260p' src/features/dashEnemySystem.js

✅ sed -n '260,620p' src/features/dashEnemySystem.js

✅ sed -n '620,980p' src/features/dashEnemySystem.js

✅ rg -n "enemySystem|defeatNearestEnemy|ATTACK_WINDOW_MS|attack|collision|run-enemies|groundY|worldGroundTopY" src/screens/dashGameScreen.js

✅ sed -n '1960,2325p' src/screens/dashGameScreen.js

✅ sed -n '1340,1515p' src/screens/dashGameScreen.js

✅ rg -n "run-enemies|enemy-wrap|enemy-sprite|is-defeated|is-collision-resolved|run-world|run-ground" -g '*.js' -g '*.css'

✅ sed -n '2988,3075p' styles/style.scoped.css

✅ sed -n '480,555p' index.html

✅ sed -n '1750,1835p' src/screens/dashGameScreen.js

✅ sed -n '2480,2605p' src/screens/dashGameScreen.js

✅ sed -n '2105,2235p' src/screens/dashGameScreen.js

✅ sed -n '1,220p' src/core/testFlags.js