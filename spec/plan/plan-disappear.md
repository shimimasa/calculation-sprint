了解です。実装は行わず、原因特定に最短で当たりを引くための調査Planを作成します。
（静的確認ベースで、次ステップでそのまま実行できる形にしています）

有力原因ランキング（1〜3位）
CSSの状態クラス競合（runner可視性/animation系の上書き）

根拠: runner-wrap に is-runner-hit / is-runner-invincible / is-kicking が同時に乗る設計で、animation を複数ルールが触っているため、派生セレクタで可視性が崩れる可能性が高い。

特に #dash-game-screen / .screen-dash の強いスコープが多く、想定外の上書き余地がある。

JSの旧「被弾時非表示」ロジック残存（直接style/class操作）

根拠: Dash側では runner を直接隠すコードは目立たないが、run-layer/runner は共有DOM参照で扱っており、他画面ロジックや過去互換処理が干渉する余地がある。

classList.add('is-hidden'), .hidden, .style.opacity の発火点を実行時ログで押さえるのが早い。

レイヤ/スタッキングコンテキスト問題（透明でなく背面化）

根拠: dash UI 側に高 z-index の層が多く、position/transform/fixed が混在。opacity=1でも見えないケースがあり得る。

runner 自体は z-index を持つが、親や兄弟コンテキスト次第で背面化しうる。

調査手順（A〜E）
A) 走者DOMの“本体要素”特定
Dash実行中に対象ノードを固定:

#runner-sprite

.runner-wrap

親: .run-layer, .run-world, .run-host, .run-viewport

DevTools Elements で「被弾前→被弾直後→見えない期間」の同一ノードを追跡し、ノード差し替え有無を確認。

B) 被弾前後 Computed Style 差分比較
比較対象プロパティ（必須）:

可視性系: opacity, visibility, display

レイヤ系: z-index, position, transform, filter

手順:

被弾直前に runner-wrap / runner-sprite の Computed を記録

被弾直後（消える瞬間）に再取得

差分が出たプロパティの「Styles」パネルで勝っているセレクタを特定

C) 被弾瞬間のクラス付与/解除ログ
Consoleで一時監視（実装前デバッグ）:

runner-wrap.className

runner-sprite.className

付与/解除時刻（performance.now()）

被弾トリガー時の isRunnerHit / isRunnerInvincible 判定値

狙い:

「消える瞬間」に追加されたクラスを一本釣りする。

D) “runnerを隠す”発火点（CSSセレクタ or JS行）特定
先に打つ検索語（そのまま使う）
CSS側キーワード:

opacity: 0

visibility: hidden

display: none

is-hidden

runner

wrap

sprite

invincible

hit

damage

JS側キーワード:

.style.opacity

.hidden

.classList.add(

isInvincible

invincibleUntil

hitUntil

COLLISION_COOLDOWN

対象ファイル優先順
src/screens/dashGameScreen.js

styles/style.scoped.css

src/screens/gameScreen.js（共有runner干渉チェック）

index.html（runner DOM定義/inline onerror）

E) 最小変更の修正方針（2案）
案1（推奨）
runner本体は常時表示のまま固定し、点滅は ::after オーバーレイ等で表現

本体（runner-wrap / #runner-sprite）の opacity/visibility/display を触らない

被弾演出は filter / outline / 擬似要素点滅で実装

メリット: 消失回帰を起こしにくい。要件「runnerを消さない」に合致

案2（代替）
既存ロジックを残しつつ、dash-run スコープだけ可視性を強制override

例: #dash-game-screen ... #runner-sprite { opacity:1 !important; visibility:visible !important; }

リスク: 根本原因を隠す対症療法になり、将来の演出追加で再発しやすい

却下条件: JS側で display:none 付与が発火している場合（CSS overrideだけでは不十分）

受け入れ基準（Definition of Done）
被弾（collision & attack不成立）後も、runner本体が一度も完全消失しない

被弾演出として転倒（stumble）＋点滅が視認できる

敵の collision_resolved フェード挙動は維持（EnemySystemは変更不要）

修正影響は dash screen 内に限定（他画面のrunner表示に副作用なし）

実施チェック（静的確認）
✅ rg -n "is-hit|is-damaged|is-invincible|is-collision|is-kicking|is-hidden|runner|invincible|hit|damage|opacity:\\s*0|visibility:\\s*hidden|display:\\s*none|scale\\(0\\)|z-index|collision_resolved|COLLISION_COOLDOWN|invincibleUntil|hitUntil|style\\.opacity|\\.hidden|classList\\.add\\(" src styles index.html

✅ rg -n "is-runner-hit|is-runner-invincible|runner-wrap|runner-sprite|runner-bob|is-kicking|is-hit|is-damaged|is-invincible|is-collision|is-hidden|screen-dash|dash-game-screen|run-layer|z-index|opacity" styles/style.scoped.css

✅ rg -n "runner.*opacity|opacity.*runner|runnerEl|#runner-sprite|runnerWrap.*hidden|runner.*hidden|is-hidden|classList\\.add\\('is-hidden'|classList\\.add\\(\\\"is-hidden\\\"|style\\.opacity\\s*=\\s*'0'|style\\.visibility\\s*=\\s*'hidden'|style\\.display\\s*=\\s*'none'|aria-hidden" src styles index.html

✅ rg -n "runner\\.src|setAttribute\\('src'|runner-sprite|runner-missing|onerror|runner\\.classList|runnerWrap\\.classList" src

必要なら次ターンで、このPlanに沿って**調査ログテンプレ（貼るだけで使えるConsole snippet）**まで用意します。