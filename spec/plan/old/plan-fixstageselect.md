以下、**実装前の Plan（静的調査ベース）**です。
（この段階ではコード変更・diffは出していません）

1) Root Cause Investigation（調査結果）
Issue 1: Worldカードクリック時の即開始トリガーは handleSelectStage 内で固定化されている
該当: src/screens/dashStageSelectScreen.js

enter() 内で this.events.on(domRefs.dashStageSelect.list, 'click', this.handleSelectStage) を登録（行215）

handleSelectStage でカード要素を拾った後、無条件で screenManager.changeScreen('dash-game') 実行（行183-206, 特に205）

つまり現在は「カードクリック=開始」が単一路線で、ON/OFF分岐が存在しません。

お勧めのタスク
カードクリックの開始処理を worldLevelEnabled で分岐させる

タスクを開始
Issue 2: worldLevelEnabled 判定経路が実質死んでいる（設定ストア側にキー保持がない）
該当:

src/screens/dashStageSelectScreen.js の getWorldLevelEnabled()（行99-104）

dashSettingsStore.getWorldLevelEnabled があれば呼ぶが、実装なし

フォールバックで dashSettingsStore.get()?.worldLevelEnabled === true

src/core/dashSettingsStore.js の normalizeSettings()（行22-30）

bgmEnabled/sfxEnabled/difficulty/schemaVersion しか返さず、worldLevelEnabled を保持しない

結果、dashSettingsStore.get() から worldLevelEnabled は基本消えるため、getWorldLevelEnabled() は常に false 寄り。

さらに getWorldLevelEnabled() の戻り値は現状 updateSelectionBadges() の表示制御にしか使われておらず、開始動線には未接続。

お勧めのタスク
dashSettingsStore に worldLevelEnabled を正式フィールドとして復元する

タスクを開始
Issue 3: World/Level UI DOM が現状存在せず、開始責務が分離されていない
該当: index.html の #dash-stage-select-list（行86-107）

各Worldカードは単純な <button data-dash-stage-id="..."> のみ

要求される「Level選択（LEVEL1..4）→このレベルでスタート」要素が無い

補足:

CSSには .dash-level-button, [data-role="dash-start"], .dash-stage-card__levels などのスタイルが残存（styles/style.scoped.css 825-857付近）

しかしHTML/JSに対応要素・イベントが無く、機能未接続状態

お勧めのタスク
ON時に使う Level選択UI と Start確定ボタンをカード内に再導入する

タスクを開始
二重発火・DOM/CSS干渉の検証結果
二重発火の主因は現状見当たらない

ステージクリックは domRefs.dashStageSelect.list への単一委譲リスナー（行215）

createEventRegistry は同一target/type/handler重複を抑止（src/core/eventRegistry.js）

カード内部に別クリック入口（「えらんだ！」ボタン等）は実装されていない（装飾spanのみ）

CSS pointer-events/overlay 起因の即開始も薄い

dash-stage-card 周辺にクリックを別要素へ透過する設定は見当たらず

そもそも handleSelectStage が無条件開始なので、CSS以前にロジックが即開始を決定

お勧めのタスク
クリック経路の単一化とイベントガードを追加して誤起動を防ぐ

タスクを開始
2) Fix Strategy（採用方針）
方針Aを採用します（推奨どおり、分岐を入口で統一）。

handleSelectStage（カードクリック入口）で最初に worldLevelEnabled を判定

false: 従来どおり startDash(stageId) へ

true: expandWorld(stageId) のみ（開始禁止）

ON時の開始は必ず startDashWithSelection(stageId, levelId, modeId)（同等関数）に一本化

screenManager.changeScreen('dash-game') は上記開始関数の中だけで呼ぶ（単一責務）

3) PR Split（提案）
PR1: 原因の局所修正（本命）
dashStageSelectScreen のクリック分岐復活

OFF/ONで開始ルートを分離

dashSettingsStore に worldLevelEnabled を復元（最低限）

PR2: 回帰防止
?dashDebug=1 時のみ、遷移決定ログを出力

例: clickSource, worldLevelEnabled, selectedStage, selectedLevel, willStart

小さな純関数（例: resolveDashStageClickAction(config, clickTargetState)）を追加し、判定ロジックを単体チェック可能にする

PR3: UI微調整（必要時のみ）
カード展開アニメーション・余白・アクセシビリティ属性調整

「このレベルでスタート」ボタンの視認性改善

1カードのみ展開ルールの視覚フィードバック改善

4) Regression Checklist
OFF時：Worldカード1クリックで即開始（従来通り）

ON時：Worldカードクリックで即開始しない（展開のみ）

ON時：Level選択 → 「このレベルでスタート」で開始

ON時：別World選択で前の展開が閉じる（同時展開は1つ）

Infinite / GoalRun / ScoreAttack60 を切り替えても上記が維持される

実行コマンド（静的確認のみ）
✅ sed -n '1,260p' src/screens/dashStageSelectScreen.js

✅ rg -n "dash-stage-select|data-dash-stage-id|dash-start|world|level" index.html src -g '!node_modules'

✅ cat src/core/dashSettingsStore.js

✅ rg -n "worldLevelEnabled|getWorldLevelEnabled|startDashWithSelection|data-role=\"dash-start\"|levelId" src index.html

✅ sed -n '700,910p' styles/style.scoped.css

✅ cat src/core/eventRegistry.js

✅ nl -ba src/screens/dashStageSelectScreen.js | sed -n '160,235p'

✅ nl -ba src/core/dashSettingsStore.js | sed -n '1,140p'

✅ nl -ba index.html | sed -n '84,118p'