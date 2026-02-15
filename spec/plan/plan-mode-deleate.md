最小変更Plan（実装はまだしない）
1) 変更対象ファイル一覧（最小限）
src/core/modeAvailability.js（新規）

モード有効/無効を一元管理する定数を追加

例: ENABLED_MODES = { dash: true, stage: false, free: false }

画面単位のガード対象もここで定義（BLOCKED_SCREENS など）

src/screens/titleScreen.js

タイトル画面の導線を Dash Run のみに絞る

Stage/Free ボタンを hidden または disabled（推奨: hidden）

Dashボタンを主導線化（primary-button 化や aria 補助）

Stage/Freeクリックハンドラのバインドをフラグ連動で抑止

src/core/screenManager.js

画面遷移の最終ゲートを追加

changeScreen(nextName) で Stage/Free 系画面（stage-select, settings, game, result）を遮断

遮断時は安全遷移先（dash-stage-select があればそこ、なければ title）へフォールバック

（必要なら）src/main.js

window.__debug.showStageSelect が残っていても screenManager 側で遮断されるため、原則変更不要

ただし意図明確化のため、デバッグヘルパー名や注釈を軽く調整する案はあり（必須ではない）

（任意・ごく小）styles/style.scoped.css

Dashボタン強調をCSSで行う場合のみ最小追加（例: #title-dash-button の軽微な強調）

既存Dash Run専用セレクタ（#dash-game-screen ...）は触らない

2) 画面導線の変更点（Before / After）
Before

タイトルから

「ステージであそぶ」→ stage-select

「じゆうにあそぶ」→ settings

「ダッシュラン」→ dash-stage-select / dash-game

内部コードから screenManager.changeScreen('stage-select'|'settings'|'game'|'result') で到達可能

After

タイトルは実質「ダッシュラン」単線導線

Stage/Free は表示しない（または disabled + 操作不可）

Dash Run が視覚的主導線

screenManager で Stage/Free系画面への遷移を常時ブロック

直接呼び出し・デバッグ呼び出し含め、最終的に Dash開始側へ戻す

3) ガード実装方針（どこで遮断するか）
A. UI層ガード（入口）
titleScreen.enter() で modeAvailability を見て:

title-start-button, title-free-button を hidden = true（または disabled = true + aria-disabled="true"）

該当イベント登録もしない（誤発火防止）

title-dash-button を主ボタン見た目に寄せる（クラス差し替え/追加）

B. 遷移層ガード（最終防壁）
screenManager.changeScreen() 冒頭で:

nextName が無効モード画面なら、resolveSafeScreen() に置換

resolveSafeScreen():

dash-stage-select が利用可能ならそこへ

なければ title

これで「内部関数呼び出し」や将来の誤導線追加にも耐える

C. 既存コードは削除しない
stageSelectScreen/settingsScreen/gameScreen/resultScreen は残置

到達不能化のみ実施（現フェーズ要件準拠）

4) Dash Run への影響が無いことの理由（依存確認）
Dash Run の主経路
title -> dash-stage-select -> dash-game -> dash-result
は screenManager ガード対象外にするためフロー不変

Dash専用状態は gameState.dash と dash*Screen 群で完結しており、Stage/Free用 playMode（'stage'|'free'）依存が薄い

BGM/SFX は Dash画面内で既存呼び出しを維持し、変更対象は「タイトル導線」と「遷移拒否」のみ

保存データも Dash用ストア（例: dashStatsStore）には手を入れないため破壊的変更リスクが低い

5) 受け入れ基準（Acceptance Criteria）
ホーム/メニューから Dash Run 以外に入れない

直リンク/内部呼び出しでも Stage/Free に入れない（ガードが効く）

Dash Run の開始〜プレイ〜リザルトが従来どおり動く

既存保存データ（記録/設定/進行）に破壊的変更がない

変更差分が小さく、意図がフラグで明確に管理されている

6) 手動テスト手順（最低限）
起動後、プロフィール選択→タイトルへ進む

Stage/Free ボタンが非表示 or 無効であること

Dash Run ボタンが最も目立つ導線であること

タイトルから Dash Run を開始

dash-stage-select（または直接 dash-game）へ遷移できること

ステージ選択→プレイ→リザルト→タイトル戻りが従来通り

開発者コンソール等から内部遷移を試す

screenManager.changeScreen('stage-select')

screenManager.changeScreen('settings')

screenManager.changeScreen('game')

screenManager.changeScreen('result')
いずれも Dash開始画面または安全画面へフォールバックすること

既存データ確認

Dashのセッション記録が保存・表示されること

プロファイル切替後もDashフローに異常がないこと

実施した確認コマンド（静的調査のみ）
✅ rg --files | head -n 200
✅ sed -n '1,220p' src/screens/titleScreen.js && sed -n '1,260p' src/core/screenManager.js && sed -n '1,260p' src/main.js
✅ sed -n '1,260p' src/ui/domRefs.js && sed -n '1,320p' index.html && sed -n '1,260p' src/ui/uiRenderer.js
✅ rg -n "title-(start|free|dash)-button|ステージであそぶ|じゆうにあそぶ|ダッシュ" index.html src -g '!spec/**'
✅ sed -n '1,260p' src/screens/stageSelectScreen.js && sed -n '1,300p' src/screens/settingsScreen.js && sed -n '1,320p' src/screens/resultScreen.js && sed -n '1,260p' src/screens/profileSelectScreen.js
✅ nl -ba src/screens/stageSelectScreen.js | sed -n '130,220p'; nl -ba src/screens/settingsScreen.js | sed -n '35,190p'; nl -ba src/screens/titleScreen.js | sed -n '1,120p'; nl -ba src/main.js | sed -n '1,120p'
✅ rg -n "changeScreen\\('stage-select'|changeScreen\\('settings'|changeScreen\\('game'|changeScreen\\('result'|playMode = 'free'|playMode = 'stage'" src | head -n 200
✅ nl -ba src/screens/resultScreen.js | sed -n '620,740p'
✅ nl -ba src/screens/dashStageSelectScreen.js | sed -n '1,220p'; nl -ba src/screens/dashGameScreen.js | sed -n '1,180p'; nl -ba src/screens/dashResultScreen.js | sed -n '1,220p'
✅ nl -ba index.html | sed -n '30,90p'; rg -n "title-actions|primary-button|secondary-button|title-dash-button|title-start-button|title-free-button" styles/style.scoped.css | head -n 120; nl -ba styles/style.scoped.css | sed -n '1,220p'
✅ nl -ba styles/style.scoped.css | sed -n '300,360p'
✅ sed -n '1,260p' src/core/testFlags.js
✅ find .. -name AGENTS.md -print