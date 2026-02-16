了解です。まず静的読解で、最小リスクの挿入位置は次の判断です。

遷移入口（SSoT）: src/core/screenManager.js の changeScreen()（全画面遷移の一元点）

ステージ開始トリガー:

通常: src/screens/stageSelectScreen.js の handleStageClick

ダッシュ: src/screens/dashStageSelectScreen.js の handleSelectStage

画像生成の実体（SSoT）:

new Image() は src/screens/gameScreen.js / src/screens/dashGameScreen.js（雲幅計測）

敵画像 <img> 生成は src/features/dashEnemySystem.js の createEnemyElement / setEnemySprite

背景は主に CSS 背景画像（styles/style.scoped.css の --run-sky-image, --run-ground-image）なので、Canvasの既存 draw パイプラインはありません。
→ decode/暖機は「画像URLを明示抽出して Image オブジェクトで先読み」が低リスクです。

QA Findings（実装タスク化）
1) 計測基盤が未整備で、A/B/C/D 仮説の切り分けログを比較できない
現状、遷移開始〜初回描画周辺の時系列ログがなく、?perf=1 相当のゲートも未実装です。
changeScreen・ステージクリック・画像decode完了・最初の描画反映を同一フォーマットで記録できる軽量計測が必要です。

お勧めのタスク
ステージ遷移パフォーマンス計測をフラグ付きで追加する

タスクを開始
2) decodeプリロードが「雲幅計測」に限定され、背景・敵スプライトに適用されていない
waitForImageDecode は存在しますが、実運用の主要初期表示アセット（空/地面/敵）への再利用導線がありません。
同一URL decodeの重複抑止（Promise Map）も未整備です。

お勧めのタスク
画像プリロードに decode と重複抑止キャッシュを追加する

タスクを開始
3) 「次ステージだけ」の先読みフックがなく、遷移直前の準備が毎回本番タイミングに寄っている
通常ステージ選択・ダッシュ選択のどちらも、選択直後に即 changeScreen しており、プリロード起動ポイントがありません。
「遷移は止めないが、描画開始前に最大1フレーム程度待つ」制御が必要です。

お勧めのタスク
ステージ選択画面に次ステージ主要画像の先読みフックを追加する

タスクを開始
4) テクスチャ暖機（初回GPUアップロード回避）の実装経路が未定義
現実装はDOM/CSS描画中心で、既存レンダラに ctx.drawImage の前段がありません。
そのため暖機は、オフスクリーンCanvasに preload済み Image を1px描画する専用ユーティリティとして追加するのが安全です。

お勧めのタスク
初回表示前にオフスクリーン1px描画で画像暖機を追加する

タスクを開始
実行した確認コマンド（静的読解のみ）
✅ pwd && rg --files | head -n 200

✅ rg --files -g '**/AGENTS.md'

✅ sed -n '1,220p' src/core/assetDiagnostics.js && sed -n '1,260p' src/screens/stageSelectScreen.js && sed -n '1,280p' src/screens/gameScreen.js && sed -n '1,260p' src/core/screenManager.js

✅ rg -n "new Image|decode\\(|drawImage\\(|load.*image|preload|asset|changeScreen\\(|enter\\(" src/main.js src/core src/screens src/features | head -n 300

✅ sed -n '1,260p' src/features/stages.js && sed -n '1,240p' src/features/backgroundThemes.js && sed -n '1,260p' src/screens/dashGameScreen.js

✅ sed -n '1,260p' src/screens/stageSelectScreen.js

✅ rg -n "drawImage\\(" src | head -n 200

✅ rg -n "run-sky|run-ground|background-image|enemy|runner|--run-" styles/style.scoped.css | head -n 260

✅ sed -n '1,260p' src/ui/domRefs.js

✅ rg -n "runner-sprite|run-ground|run-sky|enemy" index.html | head -n 120 && sed -n '120,280p' index.html

✅ sed -n '400,520p' index.html

✅ sed -n '1,280p' src/features/dashEnemySystem.js

✅ sed -n '1,260p' src/core/testFlags.js && sed -n '1,220p' src/main.js

✅ sed -n '1,260p' src/core/utils.js

✅ sed -n '1,200p' src/screens/dashStageSelectScreen.js && sed -n '1,220p' src/features/dashStages.js

✅ sed -n '1,220p' src/ui/uiRenderer.js

Notes
今回の環境指示に「read-only QA（ファイル変更禁止・テスト実行禁止）」があったため、実装・コミット・PR作成は実施していません。