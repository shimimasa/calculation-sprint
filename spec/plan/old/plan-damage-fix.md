最有力原因トップ3（根拠：コード箇所）
1) 配信物の取り違え（最新JS/CSS未反映）
根拠:

index.html が src/main.js と styles/style.scoped.css を固定パスで直接読み込み（ハッシュ付きファイル名なし）

tools/build.js は "[build] No build step configured for static assets."（ビルドで fingerprint していない）

vercel.json も outputDirectory: "." のみで、配信バージョン識別の仕組みが見えない

この構成だと、ブラウザ/CDNキャッシュ・「見ているURL/ブランチ違い」で体感が全く変わらない状態が起きやすいです。

お勧めのタスク
Dash画面にビルド識別子を常時2秒表示し、配信中コミットを可視化する

タスクを開始
2) domRefs.dashGame.screen 依存で可視デバッグが消えている
根拠:

showDebugToast() は domRefs.dashGame.screen が null の場合 return（何も出ない）

showDebugToast() は localStorage.calcSprintDebug === "1" の時しか出ない

domRefs はモジュールロード時に静的取得（src/ui/domRefs.js）。DOMタイミング/埋め込み構成で不整合になると参照が古い可能性

つまり「実行されていても見えない」経路が既にあります。

お勧めのタスク
dashGameScreenの可視デバッグ表示をscreen null時でも必ず表示できるようにする

タスクを開始
3) 衝突ペナルティ分岐が実行条件で落ちている（未発火/攻撃扱い/クールダウン）
根拠:

ペナルティ適用は handledCollision = enemyUpdate.collision && !enemyUpdate.attackHandled（src/screens/dashGameScreen.js）

enemyUpdate.attackHandled は attackActive 時の衝突で true（src/features/dashEnemySystem.js）

さらに COLLISION_COOLDOWN_MS 判定も通過が必要

playerRect が null なら intersects 評価に入らない（getPlayerRect() が null を返す経路あり）

つまり「衝突は起きているが attack 扱い」「そもそも playerRect 不成立」「CD中」でペナルティ未発火が起き得ます。

お勧めのタスク
衝突判定パイプラインの各ゲートをHUD表示し、どこで止まるか可視化する

タスクを開始
検証ステップ（ユーザーが実際に踏める順序）
Dash画面に入る

期待: 右上に DASH BUILD: <tag> が2秒出る

出ない場合は「コード未反映」か「dashGameScreen未使用」の可能性が高い

同じ操作をシークレットウィンドウで再実施

同じタグなら配信一致、違う/出ないならキャッシュまたはURL違い

debug ON（localStorage.calcSprintDebug="1"）で再実施

HUDの PR/COLL/ATK/CD を確認

敵に接触する動作を行う

COLL=1 になるか

ATK=1 なら「攻撃処理に吸われてペナルティ無効」

CD>0 なら「クールダウン中で無効」

PR=0 が出る場合

runner DOM参照不成立。domRefs 再取得策を優先

お勧めのタスク
ユーザー検証用チェックリストをDashデバッグ運用として整備する

タスクを開始
追加する最小の可視化（ビルド印 / HUDデバッグ）
ビルド印（必須）: DASH BUILD: <tag> をDash enter時に2秒表示（screen null時は body）

HUDデバッグ（最小）: PR:<0/1> COLL:<0/1> ATK:<0/1> CD:<ms>

お勧めのタスク
最小可視化セット（ビルド印 + 4指標HUD）をDash画面に導入する

タスクを開始
検証結果ごとの分岐（if / else）
if ビルド印が出ない
→ dashGameScreen.enter() が使われていない or 配信物が古い
→ screen登録/遷移起点を確認（src/main.js, src/core/screenManager.js, src/screens/dashStageSelectScreen.js）

else if ビルド印は出るが PR=0
→ runner DOM参照不成立
→ verifyRunnerDom() 強化 + domRefs 再取得を実装

else if COLL=0 のまま
→ 衝突起点が別ルート or player/enemy座標更新が未接続
→ 閾値調整ではなく、実際に enemy update が呼ばれる起点にフック

else if COLL=1 かつ ATK=1
→ attack処理に吸収されてペナルティが抑止
→ 仕様通りか確認し、必要なら「ATK時でも可視エフェクト」だけ追加

else if COLL=1 かつ CD>0
→ クールダウンで未適用
→ CD残時間を明示し想定動作か検証

お勧めのタスク
分岐別の恒久対応先をコード上で明確化する

タスクを開始
最終的な実装修正案（対象ファイルと差分方針）
src/screens/dashGameScreen.js

enter時ビルド印表示（必ず見える）

screen null時 body fallback

HUDデバッグ（PR/COLL/ATK/CD）

src/ui/domRefs.js

Dash関連参照を再取得する関数追加（初期取得失敗に強く）

styles/style.scoped.css

ビルド印/HUDの最小スタイル追加

（必要時）src/main.js / src/core/screenManager.js

Dash画面ルーティングの起点ズレ修正

お勧めのタスク
最小差分で“必ず見える”診断導線を本線コードに追加する

タスクを開始
実施した静的チェック
✅ pwd; rg --files | head -n 200
✅ rg -n "dashGameScreen|domRefs\\.dashGame\\.screen|handledCollision|collision|attackHandled|screenManager|register" src/screens src/core src/ui src/features
✅ sed -n '1,240p' src/ui/domRefs.js; sed -n '1,240p' src/ui/uiRenderer.js; sed -n '1,220p' src/core/screenManager.js; sed -n '1,260p' src/main.js
✅ sed -n '1080,1185p' src/screens/dashGameScreen.js; sed -n '970,1045p' src/screens/dashGameScreen.js
✅ sed -n '1,220p' src/features/dashEnemySystem.js; rg -n "serviceWorker|navigator\\.serviceWorker|sw\\.js|workbox|CacheStorage|caches\\." src index.html scripts tools

（この依頼は read-only QA のため、ファイル変更・コミット・PR作成は実施していません。）