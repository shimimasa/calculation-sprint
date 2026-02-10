1) 現状の理解（根拠：ファイルパス＋該当セレクタ）
対象DOM（Dash下部HUD）
index.html:225-259

.dash-bottom-hud

#dash-game-time-wrap.dash-time.dash-time-hud

.dash-timebar > #dash-game-timebar.dash-timebar__fill

.dash-bottom-stats > .dash-stat-card（4枚）

HUD関連CSSの定義場所（列挙）
ベース（Dash全体カード系）

styles/style.scoped.css:866-900
.screen-dash .dash-stat-card, .dash-stat-label, .dash-stat-value, .dash-stat-unit

Dash画面レイアウト（重要）

styles/style.scoped.css:946-956
#dash-game-screen を grid 化（grid-template-rows: auto 1fr minmax(72px,96px)）

styles/style.scoped.css:985-992
.dash-top-hud, .dash-bottom-hud の z-index:30

styles/style.scoped.css:1119-1134
.dash-bottom-hud（縦flex/中央寄せ/pointer-events:none/背景透過/overflow:visible）

styles/style.scoped.css:1164-1172
.dash-bottom-stats（4カラムgrid、overflow:hidden）

styles/style.scoped.css:1196-1208
下部HUD内カード文字サイズ縮小（value 18px, label/unit 11px）

タイムバー

styles/style.scoped.css:1555-1572
.dash-time, .dash-timebar（現状は薄いトラック）

styles/style.scoped.css:1573-1588
.dash-timebar__fill と caution/danger色

styles/style.scoped.css:1608-1617
.dash-time-note

透過強制・後勝ち上書き（影響大）

styles/style.scoped.css:2838-2889
#dash-game-screen配下の広範囲に background: transparent !important; ... box-shadow:none !important; border-color:transparent !important;

styles/style.scoped.css:2932-2937
.dash-bottom-hud { margin-top: clamp(-92px,-14vh,-80px) }

styles/style.scoped.css:2944-2948
.dash-timebarをさらに透明寄りへ上書き

Dash画面のレイアウト制約（親要素）
#dash-game-screen は3行grid（上HUD / run-zone / 下HUD）
styles/style.scoped.css:946-956, 2838-2842

.dash-run-zone は overflow:hidden + isolation:isolate
styles/style.scoped.css:994-1001

.dash-bottom-stats が overflow:hidden のため、強い外側shadow等は切れる可能性
styles/style.scoped.css:1164-1172

背景は意図的に透過化（空背景見せる設計）
styles/style.scoped.css:1119-1134, 2838-2889

“変更してはいけない領域”の境界（B）
.run-world（背景/明度/テーマ/overflow）
styles/style.scoped.css:2212-2290

.run-ground（地面レイヤ、高さ、z-index）
styles/style.scoped.css:2366-2377

.runner-wrap（固定配置、足元オフセット変数依存）
styles/style.scoped.css:2480-2495

これらはゲームアセット配置とレイヤー契約の中核なので、HUD改善では不触が安全。

レスポンシブ・セーフエリア（C）
Dash専用の主な分岐：@media (max-width:900px)（上部入力系中心）
styles/style.scoped.css:1848-1867

@media (max-width:640px)はカード最小幅/valueフォントのみ
styles/style.scoped.css:2051-2057

下部HUD専用のスマホ最適化（2列化やsafe-area padding）は未整備。

env(safe-area-inset-bottom) 等の指定は見当たらず（検索結果なし）。

2) 問題点の診断（原因仮説）
仮説1: 透過上書きが強すぎてHUDの境界が消える
2838-2889 の強い透明化 + 2944-2948 のタイムバー透明寄せで、トラック/カード境界の視認性が低いです。

お勧めのタスク
Dash下部HUDの透過強制ルールを限定し、可読性に必要な境界だけ復元する

タスクを開始
仮説2: タイムバーは存在するが“枠”の主張が弱く、ゲージ感が薄い
現状トラックはあるが薄色1px相当で、背景が明るい/雲が重なると視認が落ちる。

お勧めのタスク
残り時間バーのトラック枠を明確化して子どもでも瞬時認識できるようにする

タスクを開始
仮説3: 下部カードが縮小されすぎ、背景上で情報階層が弱い
1196-1208 で value 18px / label 11px まで小さく、カード背景も薄い (1633-1638) ため、瞬読性が不足。

お勧めのタスク
下部4ステータスカードのタイポ階層と枠コントラストを再設計する

タスクを開始
仮説4: 小画面時の下部HUD配置戦略が不足
現在は4列固定寄り＋margin-top負値運用で、幅が狭い時に圧縮・重なりリスクがある。

お勧めのタスク
モバイル幅で下部HUDの折り返しと安全余白を保証する

タスクを開始
3) 改善アプローチ案（3案）
案1: HUDパネルを“軽いガラス調”にしてコントラスト確保
内容: 下部HUD全体に薄い半透明面＋細枠＋ごく弱いblur（任意）を入れる。カードはやや控えめ。

メリット: 一括で可読性改善しやすい。背景透過要件をりつつ視認向上。

デメリット: 画面全体のトーン変化が比較的大きい。backdrop-filter の見え差・負荷注意。

リスク: “派手すぎる/重い”評価になる可能性。端末差分。

適用範囲: .dash-bottom-hud, #dash-game-time-wrap, .dash-bottom-stats

案2: カードとタイムバー枠を強化、HUDコンテナ背景は最小
内容: HUD全体は透明維持。タイムバー枠と4カードの枠/タイポだけ強化。

メリット: 要望（枠明確化・子ども瞬読）に直結。作風変化が小さい。

デメリット: 背景が非常に明るい場面では限界が残る。

リスク: セレクタ競合（1564系 vs 2944系、2838系強制透明）を整理しないと効かない。

適用範囲: .dash-timebar, .dash-timebar__fill, .dash-bottom-stats .dash-stat-card 周辺のみ

案3: 最小変更（タイポ＋線のみ）
内容: フォントサイズ/ウェイトとボーダーのみ調整、影や層は最小。

メリット: 実装リスク最小、既存デザインへの干渉が最小。

デメリット: 背景への埋もれ改善が不十分な可能性。

リスク: 要件「一瞬で読める」に届かない恐れ。

適用範囲: .dash-stat-value, .dash-stat-label, .dash-timebar border中心

4) 採用案（提案）
採用: 案2（カード＋タイムバー枠強化、背景最小）

決定理由

絶対制約順守: .run-world/.run-ground/.runner-wrap を触らず、HUD配下だけで完結。

子ども視認性: 枠・階層・数字サイズに直接効く。

実装リスク低: DOM変更ほぼ不要、CSS限定で進めやすい。

拡張性: 将来テーマ追加時もカード/バー単位で調整可能。

5) 具体的な編集計画（実装前Plan）
競合整理（最優先）

styles/style.scoped.css の後半上書き (2838-2889, 2932-2948) と中盤定義 (1555-1588, 1633-1638, 1196-1208) の優先関係を整理。

タイムバー枠の再定義

.dash-timebar を最終勝ちで定義し、トラック枠・内側コントラスト・状態色の見えを固定。

4カードの可読性改善

.dash-bottom-stats .dash-stat-card の枠/背景/角丸/影を控えめに再設計。

.dash-stat-value を主役に、label/unit を補助へ。

モバイル折り返し追加

下部HUD専用 @media を追加（4→2列またはauto-fit）。

可能なら safe-area を下余白に組み込む（背景は透過維持）。

不干渉確認

.run-world, .run-ground, .runner-wrap と関連変数は非変更。

ID/ARIA/DOM構造は維持。

追加/変更候補セレクタ（CSSのみ）
変更候補:

#dash-game-screen .dash-bottom-hud

#dash-game-screen .dash-bottom-hud > #dash-game-time-wrap

#dash-game-screen .dash-timebar, .dash-timebar__fill

#dash-game-screen .dash-bottom-stats

#dash-game-screen .dash-bottom-stats .dash-stat-card

#dash-game-screen .dash-bottom-stats .dash-stat-value/.dash-stat-label/.dash-stat-unit

追加候補（必要最小）:

CSSカスタム変数（例: --dash-hud-border, --dash-hud-surface, --dash-hud-text-strong）を #dash-game-screen スコープ内に限定。

“殺さない”既存スタイル
#dash-game-screen の3行grid構成

dash-run-zone の overflow:hidden / isolation

.run-* と .runner-wrap 系

既存ID/ARIA/HTML構造

6) 受け入れ条件（AC）と手動テスト観点
AC
残り時間バーに明確なトラック枠があり、背景に埋もれない。

4カードが「ポップで見やすい」が、画面主役（プレイ領域）を邪魔しない。

背景透過は維持（白ベタ全面パネル化しない）。

PC/スマホ幅で、HUDがはみ出し・重なり・クリップしない。

.run-world/.run-ground/.runner-wrap の配置/レイヤーに影響なし。

手動テスト観点
PC幅（>=901）: 通常/注意/危険状態でタイムバーとカード可読性確認。

タブレット〜スマホ（<=900, <=640）: 4カード折り返し、文字潰れ、下端欠け確認。

長い数値（距離やコンボ増加）: カード内収まり確認。

背景が明るい場面: 枠と文字のコントラスト維持確認。

アクセシビリティ: ARIAライブ領域やID連携を壊していないこと（DOM不変更前提）。

実行した確認コマンド
✅ pwd; rg --files -g 'AGENTS.md'

✅ rg --files | head -n 200

✅ rg -n "dash-bottom-hud|dash-timebar|dash-bottom-stats|dash-stat-card|run-world|run-ground|runner-wrap|calc-sprint|safe-area|dash-time" styles/style.scoped.css index.html src/screens/dashGameScreen.js

✅ sed -n '210,330p' index.html; sed -n '380,440p' index.html; sed -n '2830,2975p' styles/style.scoped.css; sed -n '960,1125p' styles/style.scoped.css; sed -n '1125,1265p' styles/style.scoped.css; sed -n '1490,1625p' styles/style.scoped.css; sed -n '2660,2825p' styles/style.scoped.css

✅ rg -n "\\.dash-bottom-hud|\\.dash-bottom-stats|\\.dash-stat-card|\\.dash-timebar|#dash-game-time-wrap|\\.dash-time-hud|\\.dash-timevalue|\\.dash-time-note|\\.run-world|\\.run-ground|\\.runner-wrap|overflow|safe-area|@media \\(max-width" styles/style.scoped.css | head -n 200

✅ sed -n '820,930p' styles/style.scoped.css; sed -n '950,1225p' styles/style.scoped.css; sed -n '1400,1695p' styles/style.scoped.css; sed -n '1838,2095p' styles/style.scoped.css; sed -n '2198,2415p' styles/style.scoped.css; sed -n '2468,2525p' styles/style.scoped.css; sed -n '2838,2965p' styles/style.scoped.css

✅ nl -ba styles/style.scoped.css | sed -n '960,1225p'

✅ nl -ba styles/style.scoped.css | sed -n '1468,1635p'; nl -ba styles/style.scoped.css | sed -n '1838,2088p'; nl -ba styles/style.scoped.css | sed -n '2198,2405p'; nl -ba styles/style.scoped.css | sed -n '2838,2965p'

✅ nl -ba styles/style.scoped.css | sed -n '1630,1715p'; nl -ba styles/style.scoped.css | sed -n '1848,1988p'; nl -ba styles/style.scoped.css | sed -n '2048,2095p'; nl -ba styles/style.scoped.css | sed -n '2208,2298p'; nl -ba index.html | sed -n '210,320p'; nl -ba index.html | sed -n '388,432p'

✅ rg -n "dash-bottom-hud|dash-bottom-stats|dash-stat-card|dash-timebar|safe-area|env\\(" styles/style.scoped.css

✅ nl -ba styles/style.scoped.css | sed -n '900,960p'; nl -ba styles/style.scoped.css | sed -n '2790,2860p'; nl -ba styles/style.scoped.css | sed -n '2200,2255p'; nl -ba styles/style.scoped.css | sed -n '2360,2400p'; nl -ba styles/style.scoped.css | sed -n '2480,2515p'; nl -ba styles/style.scoped.css | sed -n '2050,2080p'

✅ nl -ba index.html | sed -n '150,265p'