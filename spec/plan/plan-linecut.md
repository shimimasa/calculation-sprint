以下は 静的レビューのみ（未実行・未改修）で作成した、Dash Run 画面の Sky/Ground レイヤリング不具合に対する原因分析＋最小リスク修正 Plan です。

原因仮説（Ground に背景がかかる理由 / 切れ目が出る理由）
1) Ground が透ける主因は mask-image のフェード指定
styles/style.scoped.css の Dash スコープで .run-ground__tile に以下が入っており、rgba(0,0,0,0.35) が 意図通りアルファ合成を発生させています。
その結果、Ground が「半透明化」し、背面の Sky が見えます。

--dash-ground-mask-cut: 58%

--dash-ground-mask-fade: 10%

-webkit-mask-image: linear-gradient(...)

mask-image: linear-gradient(...)

お勧めのタスク
Dash Groundのmaskフェードを撤回し、不透明表示を回復する

タスクを開始
2) 境界の線/帯/段差が出る要因（少なくとも2パターン）
パターンA: サブピクセル丸め＋位置ずれ
Dash側で .run-ground { height: calc(... + 1px); }、.run-ground__tile { background-position: left bottom; }、テーマ別 background-position-y 補正（mix の +7px）が混在しており、ズーム率やDPIで境界が 1px 露出しやすいです。

パターンB: 画像側の端ピクセル（透明行/明度差）＋ repeat-x 継ぎ目
bg-ground.png 上端/下端に半透明ピクセルや色差があると、Sky との境界やタイル接続部で帯が見えます。
repeat-x と background-size の組み合わせで目立つケースがあります。

お勧めのタスク
境界線アーティファクトの発生条件を切り分ける（位置ずれ vs 画像端ピクセル）

タスクを開始
3) アセット責務混在（Ground画像内にSky要素）
bg-ground.png 側に空/柱などが含まれていると、Sky/Ground の責務が視覚的に重複します。
CSSで「上部を隠す」必要は残るが、maskフェードでやると透け副作用が再発します。

お勧めのタスク
Sky/Ground責務混在に対する暫定・恒久対応を分離する

タスクを開始
検証手順（切り分け）
4) 透けと境界を最短で見分けるデバッグ手順
お勧めのタスク
Dash Sky/Ground不具合のデバッグ手順を標準化する

タスクを開始
採用する修正案（最終選定）
5) 採用案: 方式1（clip-path）を第一選択
理由:

透過フェードを作らないため Ground の不透明性を守れる

CSS差分が最小で、DOM/JS/当たり判定に触れない

Dashスコープに閉じて影響範囲を限定できる

お勧めのタスク
Dash Ground切り抜きをmaskからclip-pathへ置換する（最小リスク）

タスクを開始
6) フォールバック案（clip-pathでアンチエイリアス問題が出た場合）
お勧めのタスク
clip-pathで境界にじみが残る場合は擬似要素方式へ切替える

タスクを開始
実装タスク分解（Task 1..N）
7) 実行順
お勧めのタスク
実装順序を固定して回帰リスクを最小化する

タスクを開始
パッチ適用後の確認チェックリスト（要求反映）
Ground が半透明に見えない（Sky が透けない）

Sky は全面1枚として成立（画像＋--run-sky-fallback）

境界線（線・帯・段差・1pxギャップ）が出ない

plus / minus / multi / divide / mix の5テーマで破綻しない

横幅リサイズ時に破綻しない

90% / 110% ズームでも境界アーティファクトが増えない

連続スクロールで repeat-x 継ぎ目が見えない

Testing
⚠️ # 実行コマンドなし（本回答は静的解析ベースのPlan提示のみ）