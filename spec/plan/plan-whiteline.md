調査（原因仮説の網羅と優先度）
対象は共通レイヤー（.run-world .run-bg .run-sky .run-ground .run-ground__tile）なので、全ステージで再現する前提で優先度を付けます。

優先度A（最有力）
共通CSSでのサブピクセル境界ズレ

top/height/transform/background-position/background-size に端数が入り、skyとgroundの接点に 1px の隙間や補間線が出る。

DPR/ブラウザズームで太さが変わる現象と整合。

共通レイヤーの合成時アンチエイリアス

transform: translate3d(...), scale(...), will-change, filter 等で別コンポジットレイヤー化され、境界に補間線が出る。

スクロール中のみちらつく場合は特にこれが疑わしい。

共通アセットの端1px（透明/半透明）

sky の下端または ground の上端に 1px の半透明行があると、背景色や下層が白っぽく見える。

過去の「mix ground 端1px問題」の再発パターンと一致。

優先度B（中程度）
border/outline/box-shadow/gradient の意図しない線

.run-sky / .run-ground / 親コンテナに薄い線が残っている可能性。

描画領域が1px重なっていない（または逆に空いている）

calc() や % 高さの丸めで合計がコンテナ高と一致していない。

優先度C（低）
ステージ別個別上書き

plus/minus/multi/divide/mix それぞれのテーマCSSで同じ不具合を誘発している可能性（全ステージ同時発生なので確率は低め）。

切り分け（DevToolsでの具体手順）
目的：CSS起因かアセット起因かを最短で判定すること。

境界要素の特定

Elementsで .run-world > .run-bg > .run-sky と .run-ground（必要なら .run-ground__tile）を選択。

Computed で top/bottom/height/transform/background-size/background-position の実数値確認（小数の有無）。

装飾線の除外

一時的に以下を当てる（DevTools上で）

.run-sky, .run-ground, .run-ground__tile {
  border: 0 !important;
  outline: 0 !important;
  box-shadow: none !important;
  filter: none !important;
}
線が消えるなら装飾系が原因。

アセット依存性の判定（単色化テスト）

background-image: none !important; にして background-color をベタ塗り

.run-sky { background: #00f !important; }

.run-ground { background: #0a0 !important; }

これで線が消えるなら画像端1pxまたは画像補間が原因。

それでも線が残るならレイアウト/合成の問題。

サブピクセル判定

.run-sky/.run-ground の top/height を整数pxで一時固定し再確認。

例：height: 240px, top: 240px など。

さらにズーム100%/125%で変を見る（線太さが変わるなら丸め/補間濃厚）。

コンポジット由来判定

transform を一時的に外す / translateZ(0) を外す。

スクロール中の線の出現・ちらつき有無を比較。

アセット端1pxの実ファイル確認

sky/ground の元画像を拡大表示し、上下端に透明・半透明行がないか確認。

ステージ別差分も確認（特に mix を基準に共通化漏れをチェック）。

修正案（3案以上、メリデメ・リスク）
案1: CSS-only最小修正（境界をわずかに重ねる）
内容

.run-ground を top: calc(var(--sky-height) - 1px) 的に 1px上へ重ねる、または .run-sky を height +1px。

併せて overflow: hidden と整数丸めを保証。

メリット

変更ファイル最小（styles/style.scoped.css だけで完結しやすい）。

即効性が高い。

デメリット

根本原因（画像端1pxや補間）を隠しているだけの可能性。

DPRによっては再発の余地。

リスク

当たり判定と別系統なら安全だが、見た目基準座標を参照している実装だと要注意。

案2: アセット修正（端1pxクリーン化）
内容

sky下端/ground上端の透明・半透明行を削除（または不透明に統一）。

必要なら書き出し設定（padding/trim/bleed）を見直し。

メリット

原因が画像なら最も根本的。

CSSハック不要。

デメリット

ステージごとのアセット確認コストがかかる。

書き出しミス再発時の保守負担。

リスク

画像更新に伴う色味/境界品質の意図せぬ変化。

案3: 併用（アセット是正 + CSSフェイルセーフ）
内容

まず画像端1px問題を潰す。

さらに共通CSSで 1pxオーバーラップ か clip を入れて再発耐性を持たせる。

メリット

再発防止の確実性が高い。

全ステージ共通問題への対処として強い。

デメリット

変更点が案1より増える。

「最小変更」観点ではやや重い。

リスク

過剰防御で将来の背景差し替え時に意図せぬ隠れを生む可能性。

案4: 画像補間・描画方式の見直し（必要時）
内容

背景タイルに image-rendering 調整、background-size を整数比へ固定、transformの使用箇所を限定。

メリット

合成・補間由来に効く。

デメリット

ブラウザ差が大きい。

画質に副作用が出やすい。

リスク

フロント全体に波及しやすく、最小変更から外れやすい。

推奨案
推奨：案3（併用）を“安全順序”で実施
理由：

全ステージ共通のため、共通CSS要因の可能性が高い。

ただし過去事例からアセット端1pxも十分あり得る。

どちらか一方に決め打ちすると取りこぼしが出るため、まず原因切り分け→必要最小限の併用が最も安全。

実装手順（安全に進めるための順序）
共通CSS観察（変更前）

styles/style.scoped.css の .run-world .run-bg .run-sky .run-ground .run-ground__tile 定義を確認。

端数値・transform・装飾線の有無を一覧化。

DevToolsで無変更切り分け

単色化テスト、装飾無効化、ズーム100/125比較で「CSS要因 vs アセット要因」を確定。

最小CSSフェイルセーフを先に適用

共通箇所に限定して 1px オーバーラップ（またはclip）を追加。

既存レイヤー契約は維持（DOM構造・position方式・z-indexを変えない）。

必要時のみアセット修正

端1px不正が確認できた画像だけ修正（全置換しない。

透過維持ポリシーがある場合は境界行のみ安全に調整。

スクロール時の再検証

停止時と移動時で線再出現がないか確認。

ちらつきがある場合のみ transform/composite 対策を追加検討。

変更範囲を最小化

可能な限り styles/style.scoped.css + 該当背景アセットのみで完結。

当たり判定・UIレイアウトに触れない。

検証チェックリスト（Plan末尾）
 plus / minus / multi / divide / mix の全ステージで白線が消えている

 ブラウザ倍率 100% / 125%、DPR違いでも再発しない

 横スクロール中に線の再出現・ちらつきがない

 タイムバー・テンキー・HUD など既存UI配置が崩れていない

 当たり判定やプレイフィールに影響がない（見た目変更のみ）

 パフォーマンス劣化（描画負荷増）がない

 変更ファイルが最小（原則 styles/style.scoped.css と必要最小限の背景アセットのみ）

必要なら次に、このPlanに沿って**実際の該当セレクタ単位の修正案（具体CSS差分案）**まで落とし込みます。