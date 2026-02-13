以下、既存Dashランを壊さずに拡張する前提で、要件順に提案します。

1) 追加モード案（最低3案）
案A：ゴールラッシュ（Goal Run）
勝利条件：規定距離（例: 1000m）到達

失敗条件：残り時間0秒

プレイ時間目安：2〜4分

学習効果：

ペース配分（早解きしないと間に合わない）

正答率（ミスで時間を失うので精度が重要）

爽快ポイント：

距離ゲージがゴールへ近づく高揚感

ゴール演出（減速→テープカット→クリアSE）

既存流用度：高（距離・時間・敵・衝突・出題をそのまま活用）

実装難易度：低〜中

案B：60秒スコアアタック（Score Attack 60）
勝利条件：制限時間終了時のスコア最大化

失敗条件：なし（時間切れで終了）

プレイ時間目安：1分固定

学習効果：

短時間反復

テンポ重視の暗算訓練

爽快ポイント：

コンボ/連続正解で加点演出

最後10秒のBGM盛り上げ

既存流用度：高（時間管理・敵・正解処理を流用）

実装難易度：中

案C：20問チャレンジ（Question Sprint）
勝利条件：規定問題数（例: 20問）を解き切る

失敗条件：なし（タイム計測型）または時間切れ（任意）

プレイ時間目安：1.5〜3分

学習効果：

問題数ベースで学習量を担保

正答率可視化がしやすい

爽快ポイント：

残り問題数カウントダウン

最終問題正解時のフィニッシュ演出

既存流用度：中〜高（出題/正誤判定流用、終了条件追加）

実装難易度：中

案D：ノーミスゴール（Perfect Run）
勝利条件：規定距離到達かつミス上限以内（例: 2ミスまで）

失敗条件：ミス上限超過 or 時間切れ

プレイ時間目安：2〜4分

学習効果：精度重視、慎重な暗算

爽快ポイント：

“PERFECT維持”演出

緊張感のある終盤

既存流用度：中

実装難易度：中〜やや高

2) 今の実装に最も自然で価値が高い2モード（詳細設計）
選定：

ゴールラッシュ（Goal Run）（ゴール型の主軸）

60秒スコアアタック（Score Attack 60）（短時間反復とランキング性）

2-1. ゴールラッシュ（Goal Run）
ゲームフロー
開始：タイトル→ステージ選択→モード選択（デフォルトは既存Infinite）

進行：既存Dashと同様に走行・出題・敵処理。距離ゲージに「GOAL」表示。

終了：

距離 >= goalDistance でクリア

time <= 0 で失敗

結果：クリア可否、到達距離、残り時間、正答率、被弾数、ランク表示

ルール
時間：初期時間は既存difficulty係数を流用（例：Easy長め）

距離：固定ゴール（1000m固定）

問題数：自然発生（既存出題頻度）

敵/衝突/無敵：既存そのまま

正解ボーナス：既存の有利効果・時間加算を継続

調整ポイント：ゴール到達率が極端に低い場合のみgoalDistance調整

UI追加/変更
HUD差分：

「DIST: xxx / GOAL」

進捗バー（現在距離/目標距離）

ゴール演出：

画面フラッシュ + “GOAL!”テキスト + クリアSE

結果画面項目：

クリア可否（CLEAR/FAILED）

ゴールタイム or 残り時間

ランク（S/A/B/C：残り時間と正答率で算出）

記録
保存例：dashStats.modes.goalRun

1ラン記録：{ runId, mode, stage, difficulty, cleared, goalDistance, finishTimeSec, remainTimeSec, accuracy, hits, score, playedAt }

集計：

ステージ別最速クリアタイム

クリア率

連続クリア数

既存dashStatsにmode別ネスト追加が自然（runId重複防止ロジック再利用）

2-2. 60秒スコアアタック（Score Attack 60）
ゲームフロー
開始：ステージ選択後にモード「ScoreAttack60」

進行：60秒固定。正解・連続正解でスコア稼ぎ

終了：time<=0 で必ず終了（失敗概念なし）

結果：総スコア、最大コンボ、正答数、正答率、ランキング更新表示

ルール
時間：60秒固定（difficultyで敵密度のみ可変）

距離：表示は補助指標（演出上は走り続ける）

問題数：時間内で可能な限り

敵/衝突/無敵：既存踏襲

正解ボーナス：

既存ボーナス + コンボ倍率（例: 1.0〜2.0）

誤答/被弾でコンボ減衰（0リセット or -2）

mix対応：演算ランダムでも“正答数×速度”評価なので成立

UI追加/変更
HUD差分：

大きめ残り時間（60→0）

現在スコア、コンボ数、ハイスコア差分（+/-）

終盤演出：

残り10秒で色変化・SE・BGMレイヤー強調

結果画面項目：

Total Score

Max Combo

Correct / Wrong

New Record バッジ

記録
保存例：dashStats.modes.scoreAttack60

1ラン記録：{ runId, mode, stage, difficulty, score, maxCombo, correct, wrong, accuracy, hits, playedAt }

集計：

ステージ別ハイスコアTop3

直近20件推移

difficulty別ベスト

既存集計にmodeキーを追加し、無限モード既存表示は据え置き

3) 実装アーキテクチャ提案（既存を壊さない拡張）
mode概念の導入
Strategy Pattern推奨
GameModeStrategyインターフェース（擬似）：

initRun(state)

onTick(state, dt)

onAnswer(state, result)

onCollision(state, enemy)

checkEnd(state) -> { ended, resultType }

buildResult(state)

既存Infiniteは InfiniteModeStrategy として明示化
→ デフォルト挙動は完全維持

既存 dashGameScreen の最小変更方針
dashGameScreenは「共通ループ・描画・入力」を担当

終了判定・スコア計算・HUD派生値を modeStrategy に委譲

既存条件分岐をモード毎に増やさず、strategy呼び出しに一本化

追加/変更ファイル候補
追加

src/game/dash/modes/dashModes.js（モード定義レジストリ）

src/game/dash/modes/infiniteMode.js

src/game/dash/modes/goalRunMode.js

src/game/dash/modes/scoreAttack60Mode.js

src/game/dash/modes/modeTypes.js

変更

src/game/dash/dashGameScreen.js（strategy注入）

src/store/dashStatsStore.js（mode別保存/集計）

src/ui/title/*.js（モード選択導線）

src/ui/result/*.js（モード別結果表示）

4) 互換性・移行・リスク
既存無限モードをデフォルトに残す
初期選択を mode=infinite

新モードは「モード選択」UIから任意で入る

A/B導入可（まず非表示フラグで内部実装→解放）

既存記録との整合性
runIdの二重計上防ロジックは共通化

既存履歴構造に mode を追加（未指定は infinite とみなすマイグレーション）

表示は

既存「Dash総合」= infinite中心のまま維持

新規「モード別タブ」追加で分離表示

バグが出やすい点
終了条件競合（例: ゴール達成と時間切れ同フレーム）

衝突無敵中に終了判定が走る順序

pause/exit時のrun保存重複

BGM/SFX切り替え時の終盤演出レイヤー

モバイルでHUD追加情報が潰れる（最小フォント保証）

5) CodeX実装タスク分割（Phase/PR）
PR1 / Phase1: mode基盤
内容

mode registry + strategy interface

infiniteをstrategy化（挙動不変）

Done定義

infiniteのプレイ感・結果・保存値が回帰なし

既存ステージ全種で起動可能

E2Eチェック

✅ Infinite開始→終了→結果→履歴反映

✅ runId重複保存が起きない

PR2 / Phase2: Goal Run追加
内容

goalDistance終了条件

HUD進捗バー、GOAL演出

結果画面（クリア/失敗・ランク）

Done定義

ゴール到達で確実にクリア遷移

時間切れ失敗が既存挙動と矛盾しない

E2Eチェック

✅ plus/minus/multi/divide/mix で完走可能

✅ 同フレーム競合時の優先順位が仕様通り

PR3 / Phase3: ScoreAttack60追加
内容

60秒固定タイマー

スコア/コンボ算出

結果画面拡張（New Record）

Done定義

60秒で必ず終了

スコア計算が再現可能（同入力で同値）

E2Eチェック

✅ 残り10秒演出の発火/解除

✅ 誤答・被弾時のコンボ減衰

PR4 / Phase4: 記録UI・統合仕上げ
内容

mode別履歴・ランキング表示

既存dashStatsとの共存マイグレーション

Done定義

旧データでクラッシュしない

mode別タブで集計が正しい

E2Eチェック

✅ 旧profile読み込み→プレイ→保存→再読込

✅ BGM/SFX OFF設定維持

✅ モバイル解像度でHUD崩れなし

子どもに説明するときの一言コピー（2モード）
ゴールラッシュ：
「計算して走って、ゴールまでたどりつこう！」

60秒スコアアタック：
「1分でどこまで点をのばせるかチャレンジ！」