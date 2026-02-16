“runnerが消える”の定義（4分類）
非表示
DOMはあるが display:none / visibility:hidden / opacity:0（または実質見えないfilter/mask）になっている。

画面外
DOMはあり可視指定だが、transform や left/top で viewport外へ移動、または rect が極端値。

背面
DOM/可視指定は正常だが、z-index と stacking context（親の transform/opacity/isolation）で他レイヤー下に沈む。

DOM除去/差し替え
#runner-sprite / .runner-wrap が null・detach、または別要素へ置換。

優先度付きの原因仮説（A〜Dランク付け）
1位: B) runner-spriteだけ消える
index.html の #runner-sprite に onerror="this.style.display='none'..." があり、画像系問題だと本体だけ消える経路が存在。

2位: C) stacking contextで背面化
.dash-run-zone { isolation:isolate }、.run-layer のDOM移動、複数レイヤー構成があり、被弾タイミングで見え方崩れの温床。

3位: A) 転倒アニメ側の副作用
calc-sprint-runner-stumble 自体は opacity/visibilityを触っていないが、同時適用クラス競合の可能性は残る。

4位: D) 差し替えロジック
dashEnemySystem 側でrunner操作は薄く、優先度低め。ただしDOM detach確認は必須。

調査Plan（計器追加 → 判定確定 → 最小修正方針）
Issue 1: 被弾中のrunner状態を4分類で確定できる計測が未実装
お勧めのタスク
Dash専用デバッグトグルと被弾後1秒のrunner診断ログを追加する

タスクを開始
Issue 2: 目視で“枠は見えるのに中身が見えない”を即判定する可視計器がない
お勧めのタスク
runner矩形の固定オーバーレイ枠を描画して消失タイプを瞬時に切り分ける

タスクを開始
Issue 3: A/B/C/D仮説の検証順が未固定で調査効率が低い
お勧めのタスク
A/B/C/D仮説の検証シーケンスをDash専用チェックリスト化する

タスクを開始
Issue 4: 原因確定後の“最小diff方針”が未定義
お勧めのタスク
原因確定後に適用するDash限定の最小修正を2案で準備する

タスクを開始
受け入れ基準（今回のPlanで最終的に目指す判定/修正ゴール）
被弾後も runner本体が完全消失しない

転倒演出（is-runner-hit）は視認できる

無敵点滅（is-runner-invincible）は視認できる

二重被弾防止（cooldown）は維持される

Dash以外の画面表示/挙動は不変

次に投げる実装プロンプト（そのまま利用可）
Dashのrunner消失調査用に、Dash限定の最小デバッグ計器を実装してください（本修正はまだしない）。

対象:
- src/screens/dashGameScreen.js
- 必要最小限で styles/style.scoped.css

要件:
1) デバッグトグル
- window.__DASH_DEBUG_RUNNER === true または URLクエリ ?dashDebugRunner=1 で有効化

2) 被弾時ログ
- updateFrame() の collision && !attackHandled && !invincible 成立点を起点に1秒間だけ計測
- requestAnimationFrameで回し10フレームおきにconsole出力
- 対象: .runner-wrap, #runner-sprite, 親1段
- 出力: null判定 / computed(display,visibility,opacity,transform,zIndex) / rect(x,y,w,h) / className
- 判定ラベル: DOM_REMOVED / HIDDEN_STYLE / OFFSCREEN_OR_ZERO_RECT / STACKING_RISK

3) 可視デバッグ枠
- runner-wrapのrectに追従するposition:fixedの赤枠divを表示
- debug ON時のみ表示、画面遷移に必ず破棄
- 枠が見えるのにspriteが見えないケースを判定できるようにする

制約:
- dashEnemySystemは触らない
- Dash以外へ副作用を出さない
- 既存仕様（被弾・無敵・クールダウン）を壊さない

最後に、確認手順をREADMEではなく短いコメントとしてコード内に残してください（過剰な長文は不要）。
実施した静的チェック
✅ pwd; rg --files | head -n 200
✅ sed -n '1,260p' src/screens/dashGameScreen.js; sed -n '260,620p' src/screens/dashGameScreen.js
✅ rg -n "updateFrame|collision|is-runner-hit|invincible|runner|attackHandled|runner-sprite|runner-wrap|querySelector|classList|hit" src/screens/dashGameScreen.js | head -n 200
✅ sed -n '720,930p' src/screens/dashGameScreen.js; sed -n '1180,1335p' src/screens/dashGameScreen.js; sed -n '1380,1475p' src/screens/dashGameScreen.js
✅ sed -n '840,920p' src/screens/dashGameScreen.js
✅ rg -n "is-runner-hit|is-runner-invincible|runner-wrap|runner-sprite|runner-bob|runner-missing|run-layer|dash-game-run|hit" styles/style.scoped.css | head -n 240
✅ sed -n '2688,2835p' styles/style.scoped.css; sed -n '292,340p' styles/style.scoped.css; sed -n '840,910p' styles/style.scoped.css; sed -n '3088,3135p' styles/style.scoped.css
✅ rg -n "calc-sprint-runner-stumble|runner-stumble|visibility|opacity: 0|scale\\(0\\)" styles/style.scoped.css | head -n 80
✅ sed -n '2638,2678p' styles/style.scoped.css
✅ sed -n '2678,2698p' styles/style.scoped.css
✅ sed -n '3218,3250p' styles/style.scoped.css
✅ sed -n '1,260p' src/ui/domRefs.js
✅ rg -n "runner-wrap|runner-sprite|run-layer|run-host|dash-run-zone|run-world|run-enemies|runner-shadow" index.html src -g '!styles/*'
✅ sed -n '220,290p' index.html; sed -n '420,475p' index.html
✅ sed -n '1,260p' src/features/dashEnemySystem.js; rg -n "runner|replace|remove|innerHTML|run-layer|run-world|container|classList|display|visibility|opacity|z-index" src/features/dashEnemySystem.js