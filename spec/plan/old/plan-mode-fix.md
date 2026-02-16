1) 調査サマリ（重要論点 Top 5）
モード戦略の責務はあるが、dashGameScreen 側にロジック重複が残っている

根拠: dashGameScreen.buildBarModel() で goalRun/scoreAttack60 の表示計算を直接実装（src/screens/dashGameScreen.js:2001-2041）、一方で mode 側にも getHudState() が存在（goalRunMode.js, scoreAttack60Mode.js）。

時間処理がモード間で非対称で、体感仕様が読み取りづらい

根拠: 正解/撃破ボーナスは scoreAttack60 のみ無効 (dashGameScreen.js:2186-2194)。
ただし誤答/衝突ペナルティは全モード共通適用 (2215, 2340)。
モード説明文（index.html:81-83, dashStageSelectScreen.js:28-32）にこの差分の明示が薄い。

終了理由と結果表示の設計が一部不整合

根拠: 結果画面は collision 理由を表示可能 (dashResultScreen.js:120-126) だが、実際の終了判定は mode 側 checkEnd() で timeup/goal 中心（infiniteMode.js, goalRunMode.js, scoreAttack60Mode.js）。

manual 終了時の retired 扱いが mode ごとに不一致（infiniteMode.js と goalRunMode.js/scoreAttack60Mode.js）。

初期化シーケンスに二重処理がある

根拠: enter() 内で resolveModeStrategy() + initRun() が2回呼ばれている (dashGameScreen.js:2597-2613)。将来 side effect を入れた時の不具合温床。

拡張性（新モード/複数目標）に対する定数・runtime設計が散在

根拠: 1000m/60000ms が mode と screen に分散（goalRunMode.js, scoreAttack60Mode.js, dashGameScreen.js:2010,2022-2024）。

modeRuntime は可変オブジェクトを直接 mutate する運用（scoreAttack60Mode.js:onAnswer/onCollision）。

A) 現状仕様の根拠（簡潔）
モード定義: DASH_MODE_TYPES = infinite, goalRun, scoreAttack60
(src/game/dash/modes/modeTypes.js)

モード戦略解決: getDashModeStrategy()
(src/game/dash/modes/dashModes.js)

infinite: 時間<=0で終了、結果 retired = endReason !== 'timeup'
(src/game/dash/modes/infiniteMode.js)

goalRun: distance>=1000 で goal 終了、時間<=0で失敗、ランク算出あり
(src/game/dash/modes/goalRunMode.js)

scoreAttack60: 初期60秒、コンボ倍率スコア、時間<=0終了
(src/game/dash/modes/scoreAttack60Mode.js)

実行中ロジック（共通）:

正解で加速、誤答で減算、衝突で減算・被弾カウント (dashGameScreen.js:2180-2217, 2332-2343)

毎フレーム時間減算 (2449)

終了判定は modeStrategy.checkEnd() (274-281)

モード選択UI: index.html と dashStageSelectScreen.js (data-dash-mode-id)

結果表示: 共通グリッド + mode summary (dashResultScreen.js:159-182)

2) モード共通の改善候補（P0/P1/P2）
P0-1. enter() の mode 初期化二重実行を解消
根拠コード: src/screens/dashGameScreen.js:2597-2613

なぜ問題か

プレイヤー視点: 直ちに見える不具合は少ないが、将来「開始時演出/初期ボーナス」が追加されると、二重適用で挙動がぶれる。

保守視点: initRun() の副作用前提が破綻しやすく、デバッグ困難。

影響範囲: 全モード、開始直後の runtime/time 初期化

優先度: P0

リスク: 中（初期化順依存の回帰）

検証方法:

各モード開始直後の timeLeftMs, modeRuntime をログ確認

連続リトライで初期値が毎回同一か

既存開始演出/BGM開始タイミングにズレがないか

Acceptance Criteria:

各 run 開始時に resolveModeStrategy()/initRun() が論理的に1回分のみ有効

scoreAttack60 の combo/maxCombo/totalScore が開始時に必ず 0

goalRun の goalDistanceM が開始時に必ず期待値

お勧めのタスク
dashGameScreen のモード初期化を単一フローへ統一

タスクを開始
P1-1. 時間増減ルールのモード差分を明文化し、ロジックの定義位置を統一
根拠コード:

正解/撃破ボーナス除外: dashGameScreen.js:2186-2194

誤答/衝突ペナルティ共通: 2215, 2340

説明文: index.html:81-83, dashStageSelectScreen.js:28-32

なぜ問題か

プレイヤー視点: 「ScoreAttack60 は60秒固定のはずなのに早く終わる」など納得感を損なう可能性。

保守視点: ルール差分が screen 内 if で散るため、追加モード時に漏れやすい。

影響範囲: 全モード、HUD、ステージ選択説明

優先度: P1

リスク: 中（ゲームバランス変化）

検証方法:

各モードで「正解/撃破/誤答/衝突」時の time 変化を表にして実測

UI説明と実挙動が一致するか確認

0ms到達時の終了理由が期待通りか確認

Acceptance Criteria:

各モードの時間加減算ルールがコード上1つの責務に集約

ステージ選択の説明文が実挙動と一致

回帰テスト観点（4イベント×3モード）が定義されている

お勧めのタスク
モード別の時間加減算ルールを strategy 側に寄せる

タスクを開始
P1-2. 終了理由 (endReason) と retired の意味をモード横断で統一
根拠コード:

infiniteMode は retired: endReason !== 'timeup'

goalRunMode/scoreAttack60Mode は retired: false 固定

manual終了: dashGameScreen.js:2724,2522

なぜ問題か

プレイヤー視点: 同じ「途中終了」でもモードで記録意味が変わり、結果/統計の納得感が下がる。

保守視点: 統計集計時に mode ごとの例外分岐が増える。

影響範囲: 結果画面、統計集計、全モード終了処理

優先度: P1

リスク: 中

検証方法:

各モードで manual/timeup/goal の終了結果 JSON 比較

結果画面文言・統計反映が意図通りか確認

Acceptance Criteria:

retired の定義が全モードで同一

manual 終了が全モードで一貫して記録される

dashResultScreen で終了理由が矛盾なく表示される

お勧めのタスク
endReason と retired フラグの共通契約を定義して全モードへ適用

タスクを開始
P2-1. 定数の重複（1000m/60000ms）を SSoT 化
根拠コード: goalRunMode.js の GOAL_DISTANCE_M と dashGameScreen.js:2010 fallback、scoreAttack60Mode.js と dashGameScreen.js:2022-2024

なぜ問題か

プレイヤー視点: 将来の調整で HUD と実際の終了条件がズレると混乱。

保守視点: 値変更時の修正漏れリスク。

影響範囲: HUD、終了判定、結果表示

優先度: P2

リスク: 低

検証方法: 値を仮変更したとき HUD/判定/結果が同時に追随するか

Acceptance Criteria:

ゴール距離と制限時間の定義が各モード1箇所

screen 側は strategy 経由で参照

参照元に説明コメントがある

お勧めのタスク
モード定数を strategy の単一ソースに集約

タスクを開始
3) infinite の改善候補
P1-1. Infinite 専用の「上達実感」指標が弱い
根拠コード: infiniteMode.js は専用スコア/ランクなし、結果は共通指標中心。

なぜ問題か

プレイヤー視点: 何を伸ばせば良いかが曖昧。

保守視点: モード差別化が UI 側条件分岐増加につながる。

影響範囲: 結果画面、継続動機設計

優先度: P1

リスク: 低

検証方法: 1プレイ後に「次に改善すべき点」を説明できるかユーザーテスト

Acceptance Criteria:

Infinite 専用の評価軸（例: 生存効率/時間維持率）が結果で表示

他モードとの差が1画面で理解できる

お勧めのタスク
Infinite 用の専用評価メトリクスを結果画面に追加

タスクを開始
P2-1. retired の解釈を他モードと合わせる前提整理が必要
根拠コード: infiniteMode.js のみ retired を endReason 依存で計算

なぜ問題か

プレイヤー視点: 中断記録の比較がしづらい。

保守視点: 統計処理が mode 固有化。

影響範囲: 統計集計、結果文言

優先度: P2

リスク: 低

検証方法: manual終了の集計が全モードで同一条件か

Acceptance Criteria:

mode 非依存で中断判定可能

既存統計に互換影響が把握されている

お勧めのタスク
Infinite の retired 判定を共通終了契約に合わせる

タスクを開始
4) goalRun の改善候補
P1-1. ゴール達成時の説明/演出はあるが、失敗時の学習フィードバックが弱い
根拠コード: 成功時 onBeforeEnd() で GOAL! 演出あり (goalRunMode.js)。失敗時は rank C 返却中心。

なぜ問題か

プレイヤー視点: 失敗理由（時間不足/被弾過多/正答率不足）を改善行動に変換しづらい。

保守視点: UX課題を screen 側 ad-hoc で補い始めると責務分散。

影響範囲: goalRun 結果体験、継続率

優先度: P1

リスク: 低

検証方法: FAILED時に次アクションが明確かヒューリスティック評価

Acceptance Criteria:

FAILED 時に主因（例: 被弾/正答率）を1行で提示

次プレイ改善ヒントが1つ表示される

お勧めのタスク
GoalRun 失敗時のフィードバックを学習行動に変換

タスクを開始
P2-1. goalDistance の定義が screen fallback と二重管理
根拠コード: goalRunMode.js + dashGameScreen.js:2009-2011

なぜ問題か

プレイヤー視点: 将来調整時、HUD残距離と実判定ズレが起きる可能性。

保守視点: 値調整の修正漏れ。

影響範囲: goalRun HUD/判定

優先度: P2

リスク: 低

検証方法: 目標値変更時、HUDと終了判定が一致するか

Acceptance Criteria:

goalDistance の値源が1つ

HUD残距離と終了条件が必ず一致

お勧めのタスク
GoalRun の目標距離を単一ソース化

タスクを開始
5) scoreAttack60 の改善候補
P1-1. 「60秒モード」の期待と実時間体験の乖離リスク
根拠コード: 初期60秒 (scoreAttack60Mode.js:getInitialTimeLimitMs) だが誤答/衝突で減算 (dashGameScreen.js:2215,2340)

なぜ問題か

プレイヤー視点: 「固定60秒で競う」期待と異なると不公平感。

保守視点: 将来ランキングの比較基準が曖昧になる。

影響範囲: scoreAttack60 の難易度認知、ランキング納得感

優先度: P1

リスク: 中（ルール変更時にスコア分布が変わる）

検証方法:

ノーミス/多ミスで実プレイ秒数がどう変わるか測定

表示文言と一致しているか確認

Acceptance Criteria:

ルールが「固定60秒」か「可変時間」か明確に定義

UI文言と実挙動が一致

旧記録比較方針が明文化される

お勧めのタスク
ScoreAttack60 の時間ルールを明確化しUIと同期

タスクを開始
P1-2. スコア式の可視性不足（倍率上限・計算根拠）
根拠コード: toScoreMultiplier() は最大 combo10 で 2.0x (scoreAttack60Mode.js)

なぜ問題か

プレイヤー視点: どの行動が高得点か学習しづらい。

保守視点: 調整時に「なぜこの値か」が仕様化されずブラックボックス化。

影響範囲: HUD、結果、チューニング運用

優先度: P1

リスク: 低

検証方法: コンボ別得点増分が HUD/結果から理解できるか確認

Acceptance Criteria:

現在倍率（または次倍率）が HUD で把握可能

結果画面で合計点の構成要素を最低1つ説明

お勧めのタスク
ScoreAttack60 のスコア計算根拠を HUD/結果で可視化

タスクを開始
6) 実装に入る場合の PR分割案
PR1（P0）: モード初期化シーケンス整理

dashGameScreen.enter() の二重 resolve/initRun 解消

PR2（P1共通）: 時間加減算ポリシーの strategy 化 + 文言同期

dashGameScreen / modes/* / dashStageSelectScreen / index.html

PR3（P1共通）: 終了契約統一（endReason, retired）

modes/* + dashResultScreen + stats影響点確認

PR4（P1 GoalRun）: failed時フィードバック強化

goalRunMode + dashResultScreen

PR5（P1 ScoreAttack60）: 60秒ルール明確化・得点可視化

scoreAttack60Mode + HUD/Result表示

PR6（P2）: 定数SSoT化（goal距離/制限時間）

dashGameScreen のハードコード排除

Testing / Checks
✅ pwd && rg --files | rg 'AGENTS.md|src/game/dash/modes/modeTypes.js|src/game/dash/modes/dashModes.js|src/game/dash/modes/infiniteMode.js|src/game/dash/modes/goalRunMode.js|src/game/dash/modes/scoreAttack60Mode.js|src/screens/dashGameScreen.js|src/screens/dashStageSelectScreen.js|src/screens/dashResultScreen.js|src/features/dashConstants.js|index.html'

✅ sed -n '1,220p' src/game/dash/modes/modeTypes.js; sed -n '1,260p' src/game/dash/modes/dashModes.js; sed -n '1,260p' src/game/dash/modes/infiniteMode.js; sed -n '1,260p' src/game/dash/modes/goalRunMode.js; sed -n '1,260p' src/game/dash/modes/scoreAttack60Mode.js

✅ rg -n "mode|timeLeft|checkEnd|onAnswer|onCollision|timeBonus|timePenalty|manual|retire|endReason|buildResult|getHudState|modeRuntime|goal|score|rank|HUD|barModel|pause|exit|result" src/screens/dashGameScreen.js src/screens/dashStageSelectScreen.js src/screens/dashResultScreen.js src/features/dashConstants.js

✅ nl -ba src/screens/dashGameScreen.js | sed -n '236,330p'; nl -ba src/screens/dashGameScreen.js | sed -n '1748,1798p'; nl -ba src/screens/dashGameScreen.js | sed -n '1988,2065p'; nl -ba src/screens/dashGameScreen.js | sed -n '2220,2368p'; nl -ba src/screens/dashGameScreen.js | sed -n '2438,2585p'; nl -ba src/screens/dashGameScreen.js | sed -n '2590,2650p'

✅ nl -ba src/screens/dashStageSelectScreen.js | sed -n '180,280p'; nl -ba src/screens/dashStageSelectScreen.js | sed -n '332,490p'; nl -ba src/screens/dashResultScreen.js | sed -n '1,230p'; nl -ba index.html | sed -n '60,120p'; nl -ba index.html | sed -n '340,410p'