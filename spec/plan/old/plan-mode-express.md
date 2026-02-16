1) 関連ファイル特定
モード定義/切替

src/game/dash/modes/modeTypes.js

src/game/dash/modes/dashModes.js

各モード戦略

src/game/dash/modes/infiniteMode.js

src/game/dash/modes/goalRunMode.js

src/game/dash/modes/scoreAttack60Mode.js

実行側（共通進行・時間減算・回答処理・HUD反映・終了処理）

src/screens/dashGameScreen.js

モード表示（選択UI/結果UI）

src/screens/dashStageSelectScreen.js

src/screens/dashResultScreen.js

index.html

時間加減算定数

src/features/dashConstants.js

infinite
モード名

infinite（DASH_MODE_TYPES.infinite）

初期化処理

モード固有 initRun() は未定義（modeRuntime は null）

制限時間は dashGameScreen.enter() で

modeStrategy.getInitialTimeLimitMs() が未定義のため

dashGameScreen.getInitialTimeLimitMs() を使用

gameState.timeLimit（秒）×1000×難易度倍率（easy 1.2 / normal 1 / hard 0.85）

未指定時は DEFAULT_TIME_LIMIT_MS = 30000 を同倍率適用

進行ロジック

毎フレーム distanceM += effectivePlayerSpeed * dt

正解時:

correctCount++, streak++, playerSpeed 増加

timeBonusOnCorrect(500ms) 加算

敵撃破時 defeatedCount++ と timeBonusOnDefeat(5000ms) 加算

不正解時:

wrongCount++, streak=0

timePenaltyOnWrong(800ms) 減算

衝突時:

timePenaltyOnCollision(3000ms) 減算

hits 相当の collisionHits が増加（結果にモード固有では未保存）

終了条件

checkEnd({timeLeftMs}): timeLeftMs <= 0 で ended=true, endReason='timeup'

それ以外の終了（manual等）は共通の endSession() 呼び出し経由（モード固有条件ではない）

スコア計算方法

専用 score は計算しない

結果は距離・正誤・撃破数・最大連続等の実績値中心

時間処理ロジック

初期時間: 共通計算（上記）

進行中: timeLeftMs -= dtMs

正解/撃破で加算、不正解/衝突で減算

HUD表示仕様

モード固有 getHudState() なし → 共通HUD

距離カード: 「走ったきょり」m

速度カード: 「はやさ」m/s

連続カード: 「せいかいコンボ」回

Next Area 表示あり（hideNextArea 指示なし）

タイムバーは秒表示（残量比に応じて safe/caution/danger）

使用している主要変数

timeLeftMs, initialTimeLimitMs

gameState.dash.distanceM, correctCount, wrongCount, defeatedCount, streak

playerSpeed, enemySpeed, maxStreak

関連関数一覧

infiniteMode.checkEnd

infiniteMode.buildResult

dashGameScreen.resolveModeStrategy

dashGameScreen.tryEndByMode

dashGameScreen.submitAnswer

dashGameScreen.updateFrame

dashGameScreen.updateHud

dashGameScreen.endSession

他モードとの違い

目標距離・スコア制なし

固有HUD上書きなし

時間延長ボーナス（正解/撃破）が有効

goalRun
モード名

goalRun（DASH_MODE_TYPES.goalRun）

初期化処理

initRun() で modeRuntime.goalDistanceM = 1000

制限時間は infinite と同じ共通計算（モード固有上書きなし）

進行ロジック

距離加算・回答処理・衝突処理は共通ロジック

正解/撃破の時間加算も有効（scoreAttack60のみ無効化されるため）

終了条件

checkEnd({distanceM,timeLeftMs,modeRuntime})

distanceM >= goalDistanceM → ended=true, endReason='goal', cleared=true

それ以外で timeLeftMs <= 0 → ended=true, endReason='timeup', cleared=false

スコア計算方法

専用点数はなし

buildResult() で以下を算出:

accuracy = correct / (correct + wrong) * 100

cleared = (endReason === 'goal')

clearTimeMs = cleared ? (initialTimeLimitMs - timeLeftMs) : null

rank = computeRank({cleared, accuracy, hits})

未クリア: C

クリア時:

S: accuracy>=95 かつ hits<=1

A: accuracy>=85 かつ hits<=3

B: accuracy>=70

それ以外 C

時間処理ロジック

初期時間は共通

毎フレーム減算 + 正解/撃破加算 + 不正解/衝突減算

clearTimeMs は終了時に初期時間との差分で算出

HUD表示仕様

getHudState() で上書き:

距離カード: ラベル「進ちょく」, "{現在距離} / {goalDistance}", 単位 m

progressRatio / progressText: "GOAL xx%"

hideNextArea = true

dashGameScreen.buildBarModel() も goalRun 分岐:

バー比率 = distance/goal

表示値 = 残距離（m）

使用している主要変数

modeRuntime.goalDistanceM

distanceM, timeLeftMs, initialTimeLimitMs

hits（collisionHitsを結果へ反映）

cleared, clearTimeMs, rank

関連関数一覧

goalRunMode.initRun

goalRunMode.checkEnd

goalRunMode.getHudState

goalRunMode.onBeforeEnd

goalRunMode.buildResult

goalRunMode.computeRank

dashGameScreen.buildBarModel（goalRun分岐）

dashResultScreen の result.mode==='goalRun' 表示分岐

他モードとの違い

1000m到達によるクリア判定あり

GOAL演出（GOAL!, sfx_goal, 1秒遅延遷移、goal-clear視覚効果）

ランク・クリアタイムを結果に保持

HUD/バーが「時間残量中心」ではなく「目標進捗中心」

scoreAttack60
モード名

scoreAttack60（DASH_MODE_TYPES.scoreAttack60）

初期化処理

initRun():

modeRuntime.combo = 0

modeRuntime.maxCombo = 0

modeRuntime.totalScore = 0

getInitialTimeLimitMs() で 固定60000ms

進行ロジック

正解時 onAnswer(isCorrect=true):

combo++

maxCombo = max(maxCombo, combo)

multiplier = 1 + min(combo,10)*0.1

addScore = floor(100 * multiplier)

totalScore += addScore

不正解時 onAnswer(false):

combo = 0

衝突時 onCollision():

combo = 0

共通の距離進行・正誤カウント・撃破処理は動作

終了条件

checkEnd({timeLeftMs}): timeLeftMs <= 0 で timeup

スコア計算方法

上記 totalScore が最終スコア

結果に score と totalScore の両方を同値で格納

併せて combo, maxCombo, hits を格納

時間処理ロジック

初期時間は固定60秒（難易度倍率・gameState.timeLimitを使わない）

毎フレーム減算あり

不正解減算（-800ms）・衝突減算（-3000ms）は共通適用

正解(+500ms) / 撃破(+5000ms) の時間加算は無効
（submitAnswer() 内で isScoreAttack60 の場合は加算しない）

HUD表示仕様

getHudState() で上書き:

距離カードを SCORE / pt 表示（値=totalScore）

速度カードを COMBO / x

連続カードを MAX COMBO / x

hideNextArea = true

タイムバーは buildBarModel() で分母固定60000ms

使用している主要変数

modeRuntime.totalScore, combo, maxCombo

timeLeftMs

gameState.dash.correctCount, wrongCount, defeatedCount

collisionHits（結果の hits）

関連関数一覧

scoreAttack60Mode.initRun

scoreAttack60Mode.getInitialTimeLimitMs

scoreAttack60Mode.onAnswer

scoreAttack60Mode.onCollision

scoreAttack60Mode.checkEnd

scoreAttack60Mode.getHudState

scoreAttack60Mode.buildResult

scoreAttack60Mode.toScoreMultiplier

dashGameScreen.submitAnswer（時間加算無効分岐）

dashGameScreen.buildBarModel（60000ms分岐）

dashResultScreen の result.mode==='scoreAttack60' 表示分岐

他モードとの違い

固定60秒

コンボ倍率スコア制

正解/撃破による時間延長なし

HUD中心値が距離ではなくスコア

実行チェック（静的確認で使用したコマンド）
✅ pwd; rg --files -g 'AGENTS.md'

✅ rg --files

✅ sed -n '1,220p' src/game/dash/modes/modeTypes.js; sed -n '1,260p' src/game/dash/modes/dashModes.js; sed -n '1,260p' src/game/dash/modes/infiniteMode.js; sed -n '1,320p' src/game/dash/modes/goalRunMode.js; sed -n '1,300p' src/game/dash/modes/scoreAttack60Mode.js

✅ sed -n '1,360p' src/screens/dashGameScreen.js

✅ rg -n "modeRuntime|modeStrategy|timeLeftMs|correctCount|wrongCount|hits|buildResult|getHudState|onAnswer|onCollision|getInitialTimeLimitMs|goalRun|scoreAttack60|infinite" src/screens/dashGameScreen.js

✅ sed -n '1740,2075p' src/screens/dashGameScreen.js; sed -n '2140,2275p' src/screens/dashGameScreen.js; sed -n '2310,2625p' src/screens/dashGameScreen.js

✅ sed -n '1860,2065p' src/screens/dashGameScreen.js; sed -n '2160,2265p' src/screens/dashGameScreen.js; sed -n '2320,2475p' src/screens/dashGameScreen.js

✅ nl -ba src/screens/dashGameScreen.js | sed -n '1988,2065p'; nl -ba src/screens/dashGameScreen.js | sed -n '2168,2248p'

✅ sed -n '1,320p' src/screens/dashResultScreen.js; sed -n '1,280p' src/screens/dashSettingsScreen.js

✅ nl -ba src/screens/dashResultScreen.js | sed -n '90,230p'

✅ sed -n '1,280p' src/screens/dashStageSelectScreen.js; sed -n '1,260p' src/core/gameState.js; sed -n '1,240p' src/core/dashStatsStore.js

✅ rg -n "mode|goalRun|scoreAttack60|infinite|MODE_NOTE_MAP|data-dash-mode-id" src/screens/dashStageSelectScreen.js index.html src/ui/domRefs.js

✅ nl -ba src/screens/dashStageSelectScreen.js | sed -n '214,275p'

✅ sed -n '1,220p' src/features/dashConstants.js