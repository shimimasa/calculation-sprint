了解です。実装は行わず、静的調査のみで Plan を作成します。
（index.html / styles/style.scoped.css / src/screens/dashStageSelectScreen.js / src/ui/domRefs.js / store系 を確認）

実施した確認コマンド
✅ rg --files | rg 'index.html|styles/style.scoped.css|dashStageSelectScreen.js|domRefs.js|store'
✅ sed -n '68,128p' index.html
✅ rg -n "dash-stage|dash-mode|dash-level|world-level|secondary-button|is-active|selected|aria-pressed|stage-select-list|stage-select-actions" styles/style.scoped.css
✅ sed -n '420,860p' styles/style.scoped.css
✅ sed -n '4500,4595p' styles/style.scoped.css
✅ sed -n '1,320p' src/screens/dashStageSelectScreen.js
✅ sed -n '1,260p' src/ui/domRefs.js
✅ sed -n '1,260p' src/core/dashSettingsStore.js && sed -n '1,320p' src/core/dashWorldLevelStore.js && sed -n '1,240p' src/core/gameState.js

1) 選択状態の責務マップ（mode/world/level）
Mode

状態保持: gameState.dash.modeId

初期化: dashStageSelectScreen.enter() で normalizeDashModeId(...)

反映先DOM: #dash-mode-select-list [data-dash-mode-id]

反映方法: .is-current + aria-pressed (updateModeSelectionState)

World（Stage）

状態保持:

World/Level ON時: dashStageSelectScreen.selectedWorldKey（内部）+ 実行時に dashWorldLevelStore.save

OFF時: クリック即開始で gameState.dash.stageId へ反映

反映先DOM: #dash-stage-select-list [data-dash-stage-id]（実行時に enhanceStageButton で .dash-stage-card 化）

反映方法: .is-current + aria-pressed + aria-current (updateSelectionState)

Level

状態保持: dashStageSelectScreen.selectedLevelId（内部）+ dashWorldLevelStore に保存

反映先DOM: #dash-level-select-list（renderLevelButtons() で毎回再生成）

反映方法: button.secondary-button.dash-level-button.is-current + aria-pressed

World/Levelトグル

状態保持: dashSettingsStore.worldLevelEnabled（localStorage経由）

反映: applyWorldLevelUiMode() で

#dash-level-select-panel.hidden

#dash-stage-select-start-button.hidden

world/level selection sync

2) 視認性の問題点（根拠付き、6点）
Issue 1: Mode選択の強調が弱い（selectedがほぼ色差/影のみ）
根拠:

styles/style.scoped.css

.dash-mode-select-list .secondary-button.is-current { border-color: ..., box-shadow: ... }

しかし .secondary-button 基本が border: none;（border-color単独だと枠が見えない）

太字化・アイコン・ラベル変化なしで「押せた感」が弱い

お勧めのタスク
Modeボタンのselected表現を“統一文法”で強化する

タスクを開始
Issue 2: Level選択も同様に強調不足（border-colorのみで枠が立たない）
根拠:

.dash-level-button.is-current { border-color: ..., box-shadow: ... }

ベース .secondary-button { border: none; }

視認上、未選択との差が薄い（特に淡色背景）

お勧めのタスク
Levelボタンにselectedの可視性を追加し、mode/world/startと同じ文法へ揃える

タスクを開始
Issue 3: StartボタンがCTAとして弱い（secondary扱いで最終確定に見えにくい）
根拠:

DOM: <button id="dash-stage-select-start-button" class="secondary-button" ...>

最終確定なのに secondary-button で戻るボタンと同格見え

お勧めのタスク
「このレベルでスタート」を最終CTAとして視覚的に昇格する

タスクを開始
Issue 4: Worldカードの“選択中”ラベルが小さく、色依存ぎみ
根拠:

.dash-stage-card__selected が font-size: 11px + 小バッジのみ

.is-current 時の差分は主に border/shadow + 小バッジ

「展開中＝選択中」を明確に示すには非色要素が不足

お勧めのタスク
Worldカードのselected表示を非色依存で拡張する

タスクを開始
Issue 5: World/Level（β）トグルが小さく、可視性・押しやすさが不足
根拠:

.dash-world-level-toggle { font-size: 12px }

.dash-world-level-toggle input { width:14px; height:14px }

モバイルでタップしにくいサイズ帯

お勧めのタスク
World/Levelトグルの可読性とタップ領域を拡張する

タスクを開始
Issue 6: 補助文言（mode note / level panel title）が淡く、情報優先度が低すぎる
根拠:

#dash-stage-select-screen .setting-note と .dash-level-select-panel__title が var(--dash-select-muted) 依存

背景の淡いガラス調 + 小サイズで読み取りにくい場面がある

お勧めのタスク
補助テキストのコントラストと文字組みを微調整する

タスクを開始
3) 改善方針（状態別デザイン: default / hover / selected / pressed / disabled）
統一文法（Mode / World / Level / Start の4箇所共通）

色以外で最低2要素以上を必須化（要望準拠）

①枠線太さ

②影（outer ring + 軽いinner glow）

③チェック/矢印アイコン

④ラベル太字

お勧めのタスク
選択状態のデザイントークンを共通化し、4箇所に同じ文法を適用する

タスクを開始
4) PR分割提案（最小差分）
お勧めのタスク
PR1: 選択状態クラスとARIAの整理（JS側）

タスクを開始
お勧めのタスク
PR2: CSSでselected強調（共通文法適用）

タスクを開始
お勧めのタスク
PR3: 現在選択バッジ（モード / World / Level）を追加

タスクを開始
お勧めのタスク
PR4: 微調整（視認性・タップ領域・文言）

タスクを開始
5) 回帰テスト観点（実装後に確認する項目）
フラグON/OFF

worldLevelEnabled=false で従来どおり「World押下で即開始」

worldLevelEnabled=true で Levelパネル/Start表示

Mode切替

3モードすべて selected が明確、modeNote 連動

World展開・切替

選択Worldの表示が1つだけ selected

World変更時にLevel再描画が正常

Level切替

LEVEL1..N で selected が単一

Worldごとのlevel数（plus/minus=4, others=2）に追従

Start

CTA見た目の主従が明確

押下で現在の mode/world/level が gameState.dash と store に正しく反映

A11y

selectedが色のみに依存しない

aria-pressed / aria-current 一貫

モバイル

タップ領域44px以上維持

改行崩れ・ーバーフローなし

