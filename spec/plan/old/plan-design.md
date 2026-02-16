Summary（狙いと結論）
「計算スプリント」はすでに構造が素直で、UIクラスも整理されているため、ロジックを崩さずCSS主導で“子どもが押したくなる”体験へ強化できます。
方針は次の3本柱です。

全画面共通のデザイントークン化（色・角丸・影・余白・タイポ）

主要6画面の情報設計再配置（CTA優先、説明は短く）

軽量演出の段階導入（hover/press、結果の祝福、ステージ識別）

特に重要なのは、

ステージ選択を「白い箱」から脱却して演算ごとの一瞬識別を作ること

結果画面を「記録表示」から達成感の演出画面に変えること
です。

現状診断
1) 「寂しい/刺さりにくい」具体点
画面全体のベースが #fff + 薄い青 に寄っており、子ども向けの楽しさ（コントラスト/遊び感）が弱い。

タイトル・ダッシュ選択・設定・記録で、見出し/カード/ボタンの見た目差が小さく、画面ごとの“気分転換”が少ない。

ダッシュステージ選択（#dash-stage-select-screen）が文字中心で、plus/minus/multi/divide/mix を視覚的に即判別しにくい。

結果画面（#dash-result-screen）は数値カード中心で機能的だが、「がんばった感」のご褒美演出が弱い。

設定/統計は実用的だが、ゲーム全体のポップトーンとの接続が薄い（管理画面風）。

プロフィール選択は押しやすいが、「選ぶ楽しさ」（称号・色・マスコット感）が不足。

2) 残すべき良い点
レイアウト構造は明快（screen-header / main / footer）で拡張しやすい。

ボタン・カード・グリッドの基礎クラスがすでにあり、共通部品化しやすい。

44px前後のタップ領域は概ね確保されている。

Dash本編のHUD/走行画面は作り込まれており、外周UIの強化だけで印象を上げられる。

コンセプト案A/B（比較）
項目	A案：ポップ学習アプリ	B案：ゲームUI寄り
世界観	明るい・安心・かわいい	冒険・達成・バッジ収集
配色	パステル基調 + 高彩度アクセント	濃淡強め + ネオン寄りアクセント
角丸	大きめ（16〜24）	中〜大（12〜20）
影	ふんわり多層影	コントラスト強めの立体影
タイポ	太字見出し + 丸みのある印象	太字数値 + ラベルは小さめ明快
装飾	ステッカー、雲、星、ドット	バッジ、ランク、ゲージ、リボン
向く画面	タイトル/プロフィール/設定	ステージ選択/結果/記録
推奨：Aを基調にしつつ、結果画面とステージ選択のみB要素を混ぜるハイブリッド。
（“やさしさ”と“達成感”を両立）

デザインシステム（トークン案）
導入先: styles/style.scoped.css の先頭（既存 :root と .calc-sprint の直下）
方針: :root でグローバル定義 + .calc-sprint でローカル上書き可能に

Color Tokens（例）
:root {
  --color-bg: #f7f8ff;
  --color-surface: #ffffff;
  --color-surface-soft: #f3f6ff;
  --color-text: #1f2937;
  --color-text-sub: #5b6475;

  --color-primary: #4f7cff;
  --color-primary-strong: #3867ff;
  --color-secondary: #ffb703;
  --color-accent: #ff6b9a;
  --color-success: #22c55e;
  --color-danger: #ef4444;

  --stage-plus: #5bb7ff;
  --stage-minus: #34d399;
  --stage-multi: #a78bfa;
  --stage-divide: #f59e0b;
  --stage-mix: #fb7185;
}
Radius / Shadow / Spacing
--radius-sm: 10px;
--radius-md: 14px;
--radius-lg: 18px;
--radius-xl: 24px;
--radius-pill: 999px;

--shadow-1: 0 4px 10px rgba(31,41,55,.08);
--shadow-2: 0 10px 24px rgba(31,41,55,.12);
--shadow-3: 0 16px 36px rgba(31,41,55,.16);

--space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
--space-5: 20px; --space-6: 24px; --space-8: 32px;
Typography Scale
--font-hero: clamp(28px, 4vw, 40px);
--font-h1: 28px;
--font-h2: 22px;
--font-body: 16px;
--font-caption: 13px;
--font-number-lg: clamp(32px, 5vw, 48px);
Component Variants
Button

btn-primary: 主CTA（強コントラスト、軽い浮き）

btn-secondary: 次点CTA（薄背景）

btn-ghost: 補助・戻る

Card

card-menu（タイトル/設定）

card-stage（左帯＋アイコン＋難易度バッジ）

card-stat（数値強調）

Badge

badge-stage, badge-rank, badge-streak

画面別改善（6画面分）
1) タイトル画面
情報設計

最優先CTAを1つ（例: 「ダッシュラン」or「ステージであそぶ」）

その下に2nd CTA群（設定・記録など）

具体UI

ヒーロー帯（タイトル + マスコット絵文字 + ミッション）

CTAを2段構成（主1 + 補助）

遊び方は3ステップをチップ化

触りたくなる仕掛け

ボタン押下時に transform: scale(.98) + キラっと擬似要素

実装ポイント

index.html の #title-screen 内ボタングループ再構成

styles/style.scoped.css の .title-actions, .primary-button 強化

2) ダッシュステージ選択
情報設計

「どの演算か」が最優先、説明文は短く

具体UI

card-stage 化（左色帯 + 演算アイコン + 1行説明 + 難易度目安）

選択中カードを発光リング＋チェック

触りたくなる仕掛け

hoverでカード上昇、pressで沈む

実装ポイント

#dash-stage-select-list button[data-dash-stage-id] に stage別クラス付与

dashStageSelectScreen.js で is-current に加えバッジ更新

3) 結果（記録）画面
情報設計

1st: 今回の称号（例「コンボマスター」）

2nd: 距離・正答率・最大連続正解

3rd: 詳細（ミス率・残り時間・終了理由）

具体UI

ヘッダーに「今回のランク」「今日のベストとの差」

数値カードは重要3項目を大きく、他は小さく

触りたくなる仕掛け

紙吹雪（軽量CSSアニメ）/スター点滅（reduced-motion対応）

“自分で終了しました”の表現

文言を「ここでいったん終了」に変更し、理由エリアを下段へ

実装ポイント

dashResultScreen.js の endReason文言・優先表示順を調整

.screen-dash-result 周辺CSS（既存 2097行付近）を拡張

4) 設定画面
情報設計

まず「すぐ効く設定」（BGM/SFX）→ 次に難易度

具体UI

トグルをスイッチUI化、難易度はセグメント風

補足文は注意アイコン付き小さめ

触りたくなる仕掛け

ON時に色が変わる + アイコン変化

実装ポイント

#dash-settings-screen の入力部品クラス追加

.dash-setting-row と select を variant化

5) 記録/統計画面
情報設計

総ハイスコアをヒーロー表示

次にステージ別ベスト、最後に履歴

具体UI

テーブルを完全な表のまま維持しつつ、上部に「ハイライトカード」

ステージ行に色ドットで識別

触りたくなる仕掛け

新記録行に「NEW」バッジ

実装ポイント

dashStatsScreen.js で stageIdに応じた class 付与

.dash-stats-table に stage-color ドット用CSS追加

6) プロフィール画面
情報設計

どれを選んでいるかを強調、続行CTAを固定

具体UI

A〜Hボタンを「キャラカード風」（色違い背景 + 小アイコン）

選択中に枠＋影＋小バッジ「えらんだ！」

触りたくなる仕掛け

選択時に軽いポップアニメ

実装ポイント

profileSelectScreen.js の is-selected 演出強化

.profile-select-button の state設計をトークン準拠化

“演算×ステージ”の見せ方（重要）
0.5秒判別のために、以下を同時適用：

ステージ色固定（plus/minus/multi/divide/mix）

演算アイコン固定（＋, −, ×, ÷, 🎲）

背景パターン固定（ドット/波/グリッド/斜線/ミックス）

カード左帯 + 上部バッジで二重符号化

可能なら敵シルエット小表示（既存素材流用）

ステージカード脱“白箱”案：

linear-gradient 背景 + 左帯 + バッジ + 小さな進捗（ベスト距離）

選択中は outline + glow、未選択はニュートラル

結果画面のご褒美設計（重要）
称号システム（軽量）

例: 連続正解10回→「コンボスター」、正答率90%→「せいかいマスター」

祝福演出

3秒以内の軽量CSS confetti（DOM少数）

reduced-motion時は静的バッジのみ

自己ベスト可視化

「今日のベスト」「前回比 +Xm」をヘッダーに表示

終了理由の心理設計

manual終了はネガティブ扱いしない:

「ここでいったん終了」

下段サブ情報に配置（主成果の邪魔をしない）

実装フェーズ計画（Phase 1〜3）
Phase 1（低リスク：見た目のみ）
成果物

CSSトークン導入、既存クラスの見た目統一

ボタン/カード/見出しの一括アップデート

影響範囲

styles/style.scoped.css 中心、HTML最小

リスク

既存Dash画面との色競合

検証

6画面でCTA視認、最小44px、コントラスト手動確認

Phase 2（共通コンポーネント化）
成果物

Button/Card/Badge variant命名整理

ステージカードの識別UI実装

影響範囲

index.html, src/screens/dashStageSelectScreen.js, dashStatsScreen.js

リスク

クラス名変更の取りこぼし

検証

画面遷移ごとの崩れチェック、is-current/is-selected 挙動確認

Phase 3（演出追加）
成果物

結果画面の祝福演出、称号表示、NEWバッジ

影響範囲

src/screens/dashResultScreen.js, styles/style.scoped.css

リスク

低スペック端末の負荷

検証

reduced-motion対応確認、アニメ無効時の情報成立確認

Acceptance Criteria
主要CTAが各画面で最初に視認できる

plus/minus/multi/divide/mixの判別が0.5秒以内で可能

本文文字が背景に埋もれず、可読性が保たれる（十分なコントラスト）

主要操作のタップ領域が44px以上

結果画面で「もう一回」が自然に押される導線になっている

演出追加後も初期表示体感が悪化しない（重い画像/動画なし）

変更が入りそうなファイル候補リスト
styles/style.scoped.css（トークン、ボタン/カード/画面別スタイル）

index.html（6画面のマークアップ調整、バッジ/ラッパー追加）

src/screens/dashStageSelectScreen.js（ステージ識別クラス、選択演出）

src/screens/dashResultScreen.js（称号/終了理由文言/表示優先）

src/screens/dashStatsScreen.js（ステージ色・NEWバッジ表示）

src/screens/profileSelectScreen.js（選択演出状態クラス拡張）

（必要最小限）src/ui/domRefs.js（参照要素追加時のみ）

リスクと回避策（ゲーム画面を壊さないために）
リスク: Dashラン本体のレイアウト破綻
回避: #dash-game-screen と .run-* は原則非変更。外側カード/ヘッダーのみ変更。

リスク: 色を派手にしすぎて可読性低下
回避: テキスト背景は明色を維持、アクセントは面積制御。

リスク: アニメ過多で負荷増
回避: CSS transform/opacity中心、要素数少なめ、prefers-reduced-motion 準拠。

リスク: 画面ごとのトーン不一致
回避: トークン先行導入（Phase 1）後に個別演出を足す。

Checks
✅ pwd; rg --files -g 'AGENTS.md'

✅ rg --files | head -n 200

✅ sed -n '1,240p' src/screens/titleScreen.js; sed -n '1,260p' src/screens/dashStageSelectScreen.js; sed -n '1,280p' src/screens/dashResultScreen.js; sed -n '1,260p' src/screens/dashSettingsScreen.js; sed -n '1,300p' src/screens/dashStatsScreen.js; sed -n '1,260p' src/screens/profileSelectScreen.js; sed -n '1,320p' styles/style.scoped.css

✅ sed -n '1,320p' index.html; sed -n '1,260p' src/ui/domRefs.js; sed -n '1,260p' src/screens/dashResultScreen.js; sed -n '1,260p' src/screens/dashSettingsScreen.js; sed -n '1,300p' src/screens/dashStatsScreen.js; sed -n '1,260p' src/screens/profileSelectScreen.js

✅ rg -n "dash-stage-select-screen|dash-result-screen|dash-settings-screen|dash-stats-screen|profile-select-screen|title-screen" index.html; nl -ba index.html | sed -n '1,260p'; nl -ba index.html | sed -n '260,520p'

✅ nl -ba index.html | sed -n '250,430p'

✅ rg -n "screen-title|title-actions|screen-stage-select|dash-result|dash-settings|dash-stats|profile-select|primary-button|secondary-button|stage-select-list|dash-setting-row|dash-stats-table|screen-kicker|screen-main|screen-header|screen-footer|stage-card" styles/style.scoped.css

✅ nl -ba styles/style.scoped.css | sed -n '1,220p'; nl -ba styles/style.scoped.css | sed -n '300,560p'; nl -ba styles/style.scoped.css | sed -n '820,940p'; nl -ba styles/style.scoped.css | sed -n '2088,2165p'; nl -ba styles/style.scoped.css | sed -n '3860,3935p'

⚠️ view_image /mnt/data/スクリーンショット 2026-02-13 151126.png（ファイルが見つからず確認不可）

⚠️ rg --files /mnt/data | head -n 50（/mnt/data 自体が存在せず確認不可）