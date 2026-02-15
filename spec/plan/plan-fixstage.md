了解。実装はまだ行わず、静的調査ベースで Plan を作成します。
（確認対象: src/screens/dashStageSelectScreen.js, index.html, styles/style.scoped.css, src/ui/domRefs.js）

実施した静的チェック
✅ rg -n "worldLevelEnabled|startDashWithSelection|dashDebug|dash-stage|data-role" /workspace/calculation-sprint/src /workspace/calculation-sprint/index.html /workspace/calculation-sprint/styles/style.scoped.css

✅ sed -n '1,620p' /workspace/calculation-sprint/src/screens/dashStageSelectScreen.js

✅ sed -n '60,155p' /workspace/calculation-sprint/index.html

✅ sed -n '700,930p' /workspace/calculation-sprint/styles/style.scoped.css

✅ sed -n '1,220p' /workspace/calculation-sprint/src/ui/domRefs.js

1) 根因（イベント/再描画/CSS）
根因A（主因）: #dash-stage-select-list の単一クリック委譲で、子操作と親カード操作の判定が曖昧
dashStageSelectScreen.enter() 内 handleSelectStage は以下の順で判定しています。

event.target.closest('[data-role]') があれば handleLevelAction(...) して return

なければ event.target.closest('[data-dash-stage-id]') でカード処理（expand/start）

この設計自体は正しい方向ですが、
[data-role] が ボタン以外（data-role="dash-level-title", data-role="dash-level-actions"）にも付与されており、
「押下対象が何か」のガードが弱く、カードクリックとの競合が起きる余地があります。
特に World/Level ON 時に「カード拡張」「レベル選択」「開始」が同じ委譲ハンドラで混在しており、
クリック経路の誤判定で selectedLevel 更新や start が不達になる症状と整合します。

お勧めのタスク
クリック判定をボタン種別ベースに厳密化して親カード処理との競合を防ぐ

タスクを開始
根因B（再描画整合）: Level UI は innerHTML 再生成だが、イベントは委譲なので成立。ただしログがなく不具合追跡不能
expandWorld() で Level ボタン群を毎回 host.innerHTML = ... で再描画しています。
直接 addEventListener していないため「再描画でハンドラ消失」は本件の主因ではありません。
ただし現状は click 到達/selectedLevel 前後が可視化されず、症状時の原因切り分けが難しいです。

お勧めのタスク
dashDebug時のみクリック経路とselectedLevel遷移を詳細ログ出力する

タスクを開始
根因C（CSS）: pointer-events / z-index で押下阻害する明確な記述は見当たらない（主因ではない）
styles/style.scoped.css の該当領域（.dash-stage-card, .dash-stage-card__levels, .dash-level-select-list 付近）に
pointer-events:none や異常な z-index オーバーレイは見当たりません。
したがって「押せない」は CSS 被りよりイベント判定起因の可能性が高いです。
（ただし実機確認で被りが出る場合のため、軽量ガードはPR3候補）

お勧めのタスク
レベル領域のクリック可能性を保証するための最小CSSガードを追加する（必要時のみ）

タスクを開始
2) 最小修正方針（A/B/Cから選択）
選択: B（イベント委譲の厳密化） + Aの最小要素（必要箇所で stopPropagation）

理由:

すでに実装が委譲ベース（#dash-stage-select-list の1ハンドラ）なので、最小差分で安定化できる。

innerHTML 再描画と相性が良く、再バインド不要。

子ボタン判定を厳密化しつつ、必要箇所で stopPropagation() を補助的に使えば親カード誤判定を確実に抑止できる。

3) PR分割
PR1: レベルクリック修正（必須）

handleSelectStage の判定順・対象セレクタを厳密化

handleLevelAction を「ボタン種別限定」で処理

ON時: カード=expandのみ / LEVEL=selectedLevel更新 / Start=startDashWithSelection

PR2: 回帰防止ログ/ガード（必須）

?dashDebug=1 時のみ、LEVEL/親カード/Startの到達ログ追加

decidedAction と state遷移（before/after）を追跡可能化

必要最小限の stopPropagation/preventDefault を追加

PR3: CSS微調整（任意、必要時のみ）

pointer-events/z-index の安全ガードを最小導入（実機で被り再現時のみ）

4) 回帰チェック観点
ON (worldLevelEnabled=true)

Worldカードclickは expand のみ（即 start しない）

LEVEL 1..5 click で selectedLevel 更新、is-selected/aria-pressed 反映

「このレベルでスタート」で startDashWithSelection() 経由で dash-game 遷移

Closeで該当Worldのみ閉じる（他カード状態破壊なし）

OFF (worldLevelEnabled=false)

従来通りカードclickで即開始（startDash）

競合系

Start/Close/Level click が親カード処理に誤流入しない

Mode切替後も Level選択・Start が壊れない

world切替時の展開/折りたたみで state が破綻しない

以上、Planのみです。ここで停止します。