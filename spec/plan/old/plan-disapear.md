CodeX 用プロンプト（Plan作成）

あなたはリポジトリ内の「計算スプリント（Dash）」のデバッグ担当です。
現象：被弾時、またはモンスターに当たった際に、走者が消えてしまう（スプライトが非表示、もしくはDOMごと消える/透明化/画面外へ飛ぶ/別スクリーンへ遷移している可能性）。

1) まず読むファイル（必須）

以下を必ず開いて、該当箇所を特定してください（パスはリポジトリ実体に合わせて探索してOK）:

src/screens/dashGameScreen.js（または Dash のゲームループ / updateFrame / collision handling があるファイル）

走者DOM/スプライト関連（例：runner / runner-wrap / runnerSprite / run-world 周辺）

敵・当たり判定（enemy spawn / collision / overlap / hit / damage / penalty）

画面遷移（screenManager.js / changeScreen() / retire / gameOver / result など）

CSS（styles/style.scoped.css 等）で runner に影響するクラス（例：.is-hit, .is-kicking, .is-dead, .hidden, opacity:0, display:none, visibility:hidden, transform, z-index）

2) “消える”の定義を切り分ける（Planで明文化）

次のどれが起きているかを ログで判定できる Planにしてください。

A. DOM要素が削除されている（remove / innerHTML置換 / rerender）
B. display:none / visibility:hidden / opacity:0 等で非表示化
C. transform や top/left で画面外へ移動
D. z-index / レイヤーで背景の裏に回って見えない
E. スクリーン遷移（リタイア/ゲームオーバー/メニュー）で Dash から抜けている
F. runner の描画更新が止まって「最後のフレームが消える」系（requestAnimationFrame停止、stateがfreeze）

3) 重点的に疑うべき「衝突〜被弾」周りの原因候補（Planで優先度順に列挙）

少なくとも以下を候補として挙げ、各候補を潰す観測方法（consoleログ/ブレークポイント/フラグ）をセットで提示してください。

(1) 被弾処理が “死亡/リタイア扱い” を誤発火している

例：HP未実装なのに gameOver() / retire() / changeScreen('stageSelect') が呼ばれる

(2) 被弾時に付与するクラスが強すぎて display:none / opacity:0 になる

例：.is-hit が .is-dead と同じ見た目を共有している、あるいは競合している

(3) “飛び蹴り演出/当たり判定無効化” のための state が競合し、runner を隠す分岐に入っている

(4) 衝突クールダウン（COLLISION_COOLDOWN_MS 等）や “handledCollision” の扱いミスで、連続で状態が壊れる

(5) runner の参照が差し替わり、更新対象が古いDOMを指している（null/別インスタンス）

(6) debugEnemyRect 等の例外で update が落ち、結果として runner の描画が消える/更新されない（※過去ログで ReferenceError が出ていたので、同系統も疑う）

4) すぐ入れられる「観測用インストルメンテーション」をPlanに含める

修正ではなく原因確定が目的。最小限で以下を入れる案を出してください（最終的に消せる形）。

衝突確定点でのログ（enemyId / time / runnerState / classes / computedStyle(display/opacity/visibility/transform/zIndex)）

changeScreen() 呼び出し元のスタックログ

runner DOM の生存監視（毎フレーム document.querySelector(...) の有無、bbox、opacity）

例外監視（window.onerror, unhandledrejection）で「消える直前に例外が出ていないか」

5) Planの成果物フォーマット（必須）

Planは次の形で出してください。

再現手順（最短）

期待動作 vs 実動作（観測ポイントつき）

原因候補（優先度順）＋それぞれの否定/肯定方法

追加するログ/計測の具体的コード位置（関数名/近傍の識別子でOK）

原因が確定した後の修正方針（パッチ方針を2〜3案、リスク付き）

“やってはいけない変更” （Dash のレイアウト/背景/CSS大改修など、今回の原因特定を邪魔する変更は禁止）

制約

UIの見た目改修はしない（原因調査が目的）

ログ追加は最小限、あとで消せる形

変更ファイルは必要最小限（まずPlan段階ではファイル候補だけ列挙でOK）
コピーする
使用スキル
今回は該当スキル（skill-creator / skill-installer）の対象外タスクのため未使用です。
（リポジトリ静的調査で Plan を作成）

再現手順（最短）
Dash を開始（#dash-game-screen に遷移）。

敵に接触する（正解攻撃なしで衝突を確定させる）。

衝突直後〜1秒の runner 表示状態を観測（DOM有無・style・座標・画面遷移・loop継続）。

期待動作 vs 実動作（観測ポイントつき）
期待動作

被弾時は timePenaltyOnCollision の減算・短時間の is-runner-hit 演出のみ。

runner (.runner-wrap / #runner-sprite) は表示継続。

Dash 画面 (dash-game) に留まる（screenManager.changeScreen は呼ばれない）。

実動作（報告現象）

被弾/接触で runner が「消える」。

以下 A〜F のどれかを判定する必要あり：

A DOM削除

B 非表示化（display/visibility/opacity）

C 画面外移動

D レイヤー埋没

E 画面遷移

F 描画更新停止

原因候補（優先度順）＋肯定/否定方法
1) 被弾処理が死亡/終了扱いを誤発火（E）
updateFrame() の衝突処理で timeLeftMs 減算後に endSession('timeup') → screenManager.changeScreen('dash-result') が走る経路が最優先。
（src/screens/dashGameScreen.js の handledCollision ブロック〜endSession()）

お勧めのタスク
被弾時に意図しない screen 遷移が起きていないか特定する

タスクを開始
2) 被弾クラス付与で runner が非表示化（B）
triggerRunnerStumble() / updateRunnerDamageState() が付ける is-runner-hit, is-runner-invincible と CSS 競合を確認。
現在 CSS 上は is-runner-hit #runner-sprite { opacity:1 !important; } で直接は消えにくいが、上位要素/別クラス競合は未否定。

お勧めのタスク
被弾時クラスの style 競合で runner が消える経路を切り分ける

タスクを開始
3) キック演出/状態競合（C/B/F）
defeatSequenceActive, kickUntilMs, is-kicking と被弾状態が同時に絡むと transform/状態遷移競合の可能性。

お勧めのタスク
被弾とキック演出の状態競合を確認する

タスクを開始
4) クールダウン/連続衝突の状態破壊（F/B）
COLLISION_COOLDOWN_MS, runnerInvincibleUntilMs, handledCollision の連続判定で状態が壊れる可能性。

お勧めのタスク
衝突クールダウン処理の連打時不整合を可視化する

タスクを開始
5) runner 参照差し替え不整合（A/F）
run-layer は Dash で DOM 移動されるため、domRefs.game.runnerWrap/runner が古い参照を持つリスク。verifyRunnerDom() は補正するが、タイミング起因は未否定。

お勧めのタスク
runner DOM参照の切替不整合を監視する

タスクを開始
6) 例外で更新停止（F）
既往の ReferenceError 系。startLoop() は try-catch ありだが、毎フレーム例外で描画が進まない可能性は残る。

お勧めのタスク
消失直前の例外発生を網羅的に捕捉する

タスクを開始
追加するログ/計測の具体的コード位置（最小）
src/screens/dashGameScreen.js

updateFrame() の handledCollision 判定直後（被弾確定点）

triggerRunnerStumble()

updateRunnerDamageState(nowMs)

verifyRunnerDom()

endSession(endReason)

既存 startRunnerHitDebugProbe() / logRunnerDebugProbeFrame() を活用（すでに A〜D 判別ロジックあり）

src/core/screenManager.js

changeScreen(nextName, params) 冒頭（console.trace 追加）

index.html

#runner-sprite の onerror="this.style.display='none'..." は B候補の補助確認ポイント

styles/style.scoped.css

.runner-wrap, #runner-sprite, .is-runner-hit, .is-runner-invincible, [hidden], z-index 周辺

原因確定後の修正方針（2〜3案、リスク付き）
画面遷移誤発火なら
endSession('timeup') 条件を「衝突減算直後即時」ではなく、単一箇所で厳密判定に統一。

リスク: 終了タイミングが1フレーム遅れる可能性。

CSS競合なら
被弾クラスの責務分離（is-runner-hit は演出のみ、表示制御禁止）し、runner可視性を守るガードCSSを局所追加。

リスク: 既存演出（点滅/影）が弱くなる可能性。

参照/例外起因なら
verifyRunnerDom() の再バインドをフレーム先頭で安全化し、null時は fail-soft（描画継続・再取得）にする。

リスク: 毎フレーム照合でわずかなコスト増。

やってはいけない変更
Dash の背景/レイアウト/テーマの大改修（原因特定を濁す）。

CSS全体の整理・リネーム祭り。

衝突仕様そのものの変更（ダメージ量・敵速度など）を先に触ること。

大量ログ恒久化（必ず一時フラグ配下に置いて後で削除可にする）。

実施チェック（静的調査ログ）
✅ rg --files | head -n 200
✅ rg -n "updateFrame|collision|hit|damage|runner|changeScreen|gameOver|retire|requestAnimationFrame|handledCollision|COOLDOWN|is-hit|is-dead|hidden|opacity|visibility|transform|z-index" src/screens/dashGameScreen.js src/features/dashEnemySystem.js src/core/screenManager.js styles/style.scoped.css src/ui/domRefs.js
✅ sed -n '1408,1535p' src/screens/dashGameScreen.js
✅ sed -n '1535,1618p' src/screens/dashGameScreen.js
✅ sed -n '1,180p' src/core/screenManager.js
✅ sed -n '1,280p' src/features/dashEnemySystem.js; sed -n '280,620p' src/features/dashEnemySystem.js
✅ sed -n '2688,2840p' styles/style.scoped.css
✅ sed -n '1,180p' src/ui/domRefs.js
✅ sed -n '180,330p' index.html; sed -n '420,480p' index.html