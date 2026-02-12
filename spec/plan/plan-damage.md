1) 現状把握サマリ（ファイル/関数/変数名つき）
衝突判定の場所
起点: src/screens/dashGameScreen.js の updateFrame(dtMs)

毎フレーム（requestAnimationFrame ループ）で this.enemySystem.update(...) を呼び出し。

実判定: src/features/dashEnemySystem.js の system.update(...)

intersects(playerRect, enemy) で矩形当たり判定。

enemy.state === 'walk' かつ nowMs >= enemy.ignoreCollisionUntilMs のとき衝突成立。

頻度: 実質 毎フレーム（dtMs は最大50msに丸め）。

ペナルティ適用の場所
src/screens/dashGameScreen.js updateFrame(dtMs) 内で

const handledCollision = enemyUpdate.collision && !enemyUpdate.attackHandled;

成立時に以下を適用:

audioManager.playSfx('sfx_damage')

this.timeLeftMs = Math.max(0, this.timeLeftMs - COLLISION_PENALTY_MS)（現状 5000ms）

this.slowUntilMs = nowMs + COLLISION_SLOW_MS（現状 1000ms）

this.lastCollisionPenaltyAtMs = nowMs（衝突ペナルティCD管理）

クールダウンの場所
2層あります。

画面側CD: dashGameScreen.js

COLLISION_COOLDOWN_MS = 500

nowMs - lastCollisionPenaltyAtMs >= COLLISION_COOLDOWN_MS でペナルティ再適用を制御。

敵個体側無敵: dashEnemySystem.js

COLLISION_INVULN_MS = 700

衝突した敵に enemy.ignoreCollisionUntilMs = nowMs + 700 を付与。

“消える演出”の場所
Dash衝突時に直接 opacity:0 を付けるJSは確認できず。

ランナー側で衝突時に付くのは #runner-sprite.hit（dashGameScreen.js updateRunLayerVisuals）

CSS: styles/style.scoped.css の .calc-sprint #runner-sprite.hit は 下方向オフセットのみ。

ただし、既存CSSに .runner-missing .runner-wrap::before があり、見え方に影響しうる定義は存在（現時点でDash側から runner-missing を付与するコードは見当たらず）。

したがって「一瞬消える」は、既存クラス残留/重なり/別モード由来クラス干渉の可能性が高い（後述Task 1で発火源を特定）。

タイム管理の場所
Dashの実時間は dashGameScreen.js のローカル状態 this.timeLeftMs が主。

毎フレーム this.timeLeftMs -= dtMs。

正解・不正解・衝突で加減算。

HUD反映は updateHud() (timeRemaining, timeBar, timeWrap.dataset.state)。

gameState.timeLeft はDash進行で直接主管理されていない。

SFX(damage) の場所
ID定義: src/core/audioManager.js SFX_URLS.sfx_damage = 'assets/audio/sfx/damage.mp3'（配線済み）

呼び出し: src/screens/dashGameScreen.js updateFrame の衝突処理。

ただし audioManager.playSfx は audioManager.unlocked === true 前提。未unlock時は再生しない実装。

2) 問題点と原因仮説（最小限）
衝突ペナルティ値が定数二重化しており、仕様の一貫性が崩れている

根拠:

src/features/dashConstants.js に timePenaltyOnCollision = 1500 がある。

しかし実際の衝突減算は dashGameScreen.js の COLLISION_PENALTY_MS = 5000 を使用。

仮説:

旧調整値と新調整値が分離したまま残り、仕様意図が不明瞭になっている。

お勧めのタスク
衝突タイム減少値を単一点定義に統一する

タスクを開始
“一瞬消える”の再現源がコード上で明示されておらず、演出置換前に原因特定が必要

根拠:

Dash衝突時に opacity:0 / display:none を付与する処理は dashGameScreen.js から確認できない。

一方で styles/style.scoped.css に .runner-missing など視覚的に見え方を変えるルールは存在。

仮説:

モード跨ぎのクラス残留、または別要素重なりにより「消えたように見える」可能性。

お勧めのタスク
Dash衝突時のランナー消失要因をログで特定してから転倒演出へ置換する

タスクを開始
SFX damage は既に呼んでいるが、再生保証条件が明文化されていない

根拠:

audioManager.playSfx('sfx_damage') は衝突成立時に呼ばれる。

ただし audioManager 側は未unlock時に無音で return。

仮説:

ユーザー体感で「鳴らない」ケースは unlock タイミングや衝突CD抑制と混同されている可能性。

お勧めのタスク
damage SFXの再生条件を衝突仕様として明文化し、クールダウンと整合させる

タスクを開始
3) 提案する最終仕様（決め打ち提案）
衝突時ペナルティ

タイム: -3秒（3000ms）

理由: 現状 -5秒 は重く、wrong が -0.8秒 のため差が極端。子ども向けテンポ維持のため中間値。

速度: 一時減速あり（現状踏襲）

slow 1000ms, 係数 0.7 を基本維持。

無敵時間（再被弾抑制）:

画面側CD: 500ms 維持

敵個体側無敵: 700ms 維持

実質は「短時間で連打ペナルティにならない」挙動を維持。

演出（消える禁止）

仕様: コミカル転倒（よろけ → しりもち風 → 復帰）

実装: 画像追加なし、Dash専用CSSアニメで実現。

runner or runner-wrap に is-stumble クラスを一定時間付与。

transform/rotate/translate + shadow変形で転倒感を出す。

opacity を 1 固定（消失禁止）。

画面点滅: なし（怖さ回避）。必要なら軽い“ぷるっ”揺れ程度。

SFX

sfx_damage は 衝突成立かつペナルティ適用時のみ 再生。

クールダウン中は再生しない。

攻撃判定で attackHandled の場合は damage 再生しない（現行踏襲）。

4) 実装タスク分解（手順）
Task 1: 調査/ログ追加（必要最小限）
対象: src/screens/dashGameScreen.js

handledCollision 分岐内で一時的に以下を確認:

ランナー要素のクラス

opacity/visibility/display

dash-game-screen / run-layer クラス

目的: “消える”原因を特定し、誤診修正を防止。

実装後にログは除去。

Task 2: ロジック変更
対象: src/features/dashConstants.js, src/screens/dashGameScreen.js

衝突タイム減少量を dashConstants 参照へ統一。

Math.max(0, ...) ガード維持。

timeLeftMs <= 0 の endSession('timeup') 分岐は既存のまま。

Task 3: SFX差し込み（厳密化）
対象: src/screens/dashGameScreen.js

既存 audioManager.playSfx('sfx_damage') の位置を

「ペナルティ適用確定時のみ」

「CD未満時は呼ばない」
で明示。

必要に応じてコメント追加。

src/core/audioManager.js は配線済みなので基本変更不要。

Task 4: CSS/演出置換
対象: styles/style.scoped.css, src/screens/dashGameScreen.js

Dash専用転倒クラス（例: runner.classList.add('stumble') 互換 or is-stumble）を衝突時に短時間付与。

新規 keyframes 追加（Dashスコープセレクタ配下のみ）。

opacity:0 系/消失系ルールはDash衝突演出として使わない。

prefers-reduced-motion 分岐で軽量化。

Task 5: テスト観点（再現手順、期待結果）
手順:

Dash開始、敵に意図的接触

連続接触（500ms以内/以降）

攻撃成立で接触（attackHandled）

タイム0付近で衝突

期待:

衝突成立時のみ sfx_damage 再生

クールダウン中はタイム減少なし/音なし

タイム表示・タイムバーが即時反映

ランナーは消えず、コミカル転倒して復帰

Dash以外モードに影響なし

5) 差分方針（安全策）
触らない領域

src/screens/gameScreen.js（通常ランモード）

問題生成ロジック・敵撃破ロジック本体（Dash衝突仕様に無関係）

audioManager の汎用再生基盤（必要最小限以外は不変更）

影響範囲

主要: src/screens/dashGameScreen.js

調整: src/features/dashConstants.js

見た目: styles/style.scoped.css（Dashセレクタ限定）

リグレッション回避ガード

Dashセレクタ (#dash-game-screen / .screen-dash) でCSSを閉じる

衝突CD・enemy invuln の二重防御は維持

timeLeftMs 下限0と endSession('timeup') の既存終了条件を維持

既存の正解/不正解/撃破ボーナスの加算仕様は変更しない