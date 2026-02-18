以下、既存実装を壊さない増築前提でのレビュー＋提案＋実装Planです（静的確認ベース）。

A. 現行画面構成の推定と導線レビュー
推定される現行画面一覧（src/main.js / index.html / domRefs より）
profile-select（プロファイル選択）

title（ホーム）

dash-stage-select（Dashステージ選択：plus/minus/multi/divide/mix）

dash-game（Dash本編）

dash-result（Dash結果）

stage-select / settings / game / result（既存の通常モード系。現状 modeAvailability でブロック）

評価
Dash導線は成立（タイトル→Dashステージ→Dash本編→Dash結果→タイトル/リプレイ）
ただし、Dash系の独立した設定・記録導線が不足しています。dash-game 退出後は dash-result 経由でタイトルに戻るのみで、横移動が弱いです。

お勧めのタスク
Dash導線に「設定」「記録/統計」への遷移口を追加する

タスクを開始
記録の永続化は「直近1セッション」中心
dashStatsStore は dash.session を1件保存する設計で、履歴/集計（ステージ別ベスト、回数、日別）は不足。

お勧めのタスク
Dash記録ストアを「単発保存」から「履歴＋集計」へ拡張する

タスクを開始
音設定が「BGM/SFX別」に分かれていない
audioManager は実質 muted 1本でBGM/SFX共通制御。ユーザー要件（BGM/SFX ON/OFF個別）に未対応。

お勧めのタスク
audioManagerをBGM/SFX個別ON/OFFに対応させる

タスクを開始
B. 追加候補画面（優先度つき）
P1（最優先）
Dash設定画面

メリット: 体験個別化、運用時の調整容易化

コスト: 低〜中（UI追加＋localStorage＋audio/difficultyフック）

依存: audioManager, gameState, storageKeys

お勧めのタスク
Dash専用設画面（BGM/SFX・難易度・保存先表示）を追加する

タスクを開始
記録/統計画面

メリット: 継続学習の可視化、保護者/支援者説明が容易

コスト: 中（集計ロジック追加）

依存: dashStatsStore 拡張、ステージ定義

お勧めのタスク
Dash記録/統計画面（ハイスコア・ステージ別・履歴）を追加する

タスクを開始
P2（次点）
操作説明/チュートリアル画面（1枚）

メリット: 初回離脱低減

コスト: 低

依存: ほぼなし

お勧めのタスク
初回向けチュートリアル（1画面）を導入する

タスクを開始
アクセシビリティ設定画面（文字サイズ/色コントラスト）

メリット: モバイル/支援現場での可読性向上

コスト: 中

依存: CSS変数化

お勧めのタスク
アクセシビリティ設定（文字サイズ・高コントラスト）を追加する

タスクを開始
C. 「設定画面」「記録/統計画面」の具体実装Plan
設定画面 Plan（要件1〜3,6,7,8,9を包含）
お勧めのタスク
Dash設定画面を既存実装を壊さず追加する詳細Plan

タスクを開始
記録/統計画面 Plan（要件4,5,6,7,8,9を包含）
お勧めのタスク
Dash記録/統計画面を追加する詳細Plan（重複計上防止込み）

タスクを開始
D. MVP と理想形の切り分け
MVP（最小実装）

Dash設定: BGM/SFX ON/OFF、難易度プリセット3段階、localStorage保存

Dash記録: 総ハイスコア、ステージ別ベスト、直近20件

導線: title と dash-result からのみ遷移（dash-game内は後回し）

理想形（将来拡張）

Dash中の一時停止メニューから設定/統計へ

難易度custom（時間・速度・敵頻度を細分）

日別推移グラフ、期間フィルタ、目標設定（ただし比較ストレスを煽らない表示）

（将来）クラウド同期層追加時も、dashStatsStore のインターフェースを維持して差し替え可能にする

実行チェック（静的確認）
✅ rg --files | head -n 200

✅ sed -n '1,260p' src/core/screenManager.js; sed -n '1,260p' src/main.js

✅ sed -n '1,240p' src/screens/titleScreen.js

✅ sed -n '1,320p' src/ui/domRefs.js; sed -n '1,360p' index.html

✅ sed -n '1,260p' src/core/storageKeys.js; sed -n '1,300p' src/core/dashStatsStore.js

✅ rg -n \"getInitialTimeLimitMs|difficulty|timeLimit|changeScreen\\('dash\" src/screens/dashGameScreen.js src/core/testFlags.js src/core/modeAvailability.js