現状把握（音周りの構造図：呼び出し元 → audioManager → assets）
1) 音源定義レイヤ
src/core/audioManager.js

BGM_URLS に bgm_add/sub/mul/div/mix/dash があるが、現状 add~mix が free.mp3 を指している。

SFX_URLS に attack/damage は未定義。

既存の重要仕様:

相対パス運用（ADR-004コメントあり）

unknown-id warn (warnUnknownBgmId / warnUnknownSfxId)

fallback (resolveBgmId: unknown BGM→bgm_free)

mute/unlock (setMuted, unlock, pendingBgmId)

fade/transition (setBgm, transitionBgm, fadeAudio)

2) BGM呼び出しレイヤ（画面責務）
通常ゲーム

src/screens/gameScreen.js

enter() で stage時は audioManager.setBgm(stage.theme.bgmId)、free時は audioManager.setBgm('bgm_free')

結果画面

src/screens/resultScreen.js

enter() で bgm_clear または bgm_result

リトライ/次ステージ遷移で transitionBgm(resolveStageBgmId(...))

Dash

src/screens/dashGameScreen.js

startBgm() で audioManager.playBgm('bgm_dash')

Title / StageSelect / DashResult

現状、bgm_title を直接再生している呼び出しは見当たらない（要確認項目）

3) ステージ種別とBGMキー
src/features/stages.js

各ステージ定義に bgmId が明示されている（bgm_add/sub/mul/div/mix）

settings.mode は add/sub/mul/div/mix

つまり、実質のBGM選択キーは stage.theme.bgmId（modeではなく定義済みbgmId）

4) 攻撃/被弾の確定点（Dash）
攻撃成功（撃破）確定

src/screens/dashGameScreen.js submitAnswer()

正解時に enemySystem.defeatNearestEnemy(...) 呼び出し

defeatResult?.defeated === true が撃破確定点

被弾（接触）確定

src/features/dashEnemySystem.js update(...)

collision / attackHandled を返却

src/screens/dashGameScreen.js updateFrame()

handledCollision = enemyUpdate.collision && !enemyUpdate.attackHandled

ここが「攻撃で相殺されていない接触ダメージ」確定点

変更方針（BGM切替の責務、SFX差し込みポイント、ガード方針）
A. ステージ別BGMの修正方針
変更は audioManager.js の URL マップ修正のみ を第一候補とする。

stages.js 側は既に bgm_add/sub/mul/div/mix が割り当て済みのため、呼び出し責務を変えない。

具体対応:

bgm_add -> assets/audio/bgm/add.mp3

bgm_sub -> assets/audio/bgm/minus.mp3

bgm_mul -> assets/audio/bgm/multi.mp3

bgm_div -> assets/audio/bgm/divide.mp3

bgm_mix -> assets/audio/bgm/mix.mp3

bgm_dash -> assets/audio/bgm/bgm-1.mp3 維持

これにより、game/result遷移時の setBgm/transitionBgm の既存設計（fade, fallback）を壊さず反映可能。

B. SFX追加・差し込み方針
audioManager.js の SFX_URLS に2件追加

sfx_attack -> assets/audio/sfx/attack.mp3

sfx_damage -> assets/audio/sfx/damage.mp3

発火ポイント

sfx_attack:

dashGameScreen.submitAnswer() 内の if (defeatResult?.defeated) ブロック直後に追加（撃破確定時のみ）

sfx_damage:

dashGameScreen.updateFrame() 内の if (handledCollision) かつ実際にペナルティ適用する箇所（COLLISION_COOLDOWN_MS ガード内）で追加

これで多重発火を抑制（既存クールダウン再利用）

C. 多重発火ガード方針
現状:

被弾側は lastCollisionPenaltyAtMs + COLLISION_COOLDOWN_MS がある

撃破側は 1回の正解submitで1回の defeatNearestEnemy 呼び出し

方針:

被弾SFXは クールダウンを通過した時のみ らす

撃破SFXは defeatResult?.defeated === true のみ鳴らす

追加Setガードが要るかは、実装前に submitAnswer() が同一入力で複数回走らないことを確認（canSubmit / input lock 既存実装の確認）。

D. 仕様衝突回避（title/free/result/clear/dash/stage）
stage/free/result/clear/dash は呼び出し元が分離済み。

titleは現状BGM呼び出しが未確認のため、今回要件外で挙動変更しない（ただし調査結果をPlanに残し、必要なら別タスク化）。

タスク分解（Task 1..N）
Task 1: 音IDとアセット対応表の確定
対象ファイル

src/core/audioManager.js

src/features/stages.js

変更内容

変更前に、bgm_* / sfx_* IDの利用箇所を棚卸しして対応表を確定

影響範囲

全画面の音再生参照に影響

リスク

未使用IDや古いIDを見落とすと unknown warn増加

確認方法

検索クエリ:

rg -n "bgm_|sfx_" src

rg -n "setBgm|playBgm|transitionBgm|playSfx" src/screens src/core

Task 2: BGM URLマッピング修正
対象ファイル

src/core/audioManager.js

変更内容

BGM_URLS の bgm_add/sub/mul/div/mix を新音源に差し替え

影響範囲

stageモード全ステージ、resultからのステージ遷移復帰

リスク

パス誤記でロード失敗（diagnoseAssetResponse warn）

確認方法

静的確認:

rg -n "bgm_add|bgm_sub|bgm_mul|bgm_div|bgm_mix" src/core/audioManager.js

呼び出し責務確認:

rg -n "resolveStageBgmId|setBgm\\(|transitionBgm\\(" src/screens

Task 3: SFX URL追加
対象ファイル

src/core/audioManager.js

変更内容

SFX_URLS に sfx_attack, sfx_damage 追加

影響範囲

Dash戦闘イベント音

リスク

ID typoでunknown warn

確認方法

rg -n "sfx_attack|sfx_damage|SFX_URLS" src/core/audioManager.js

Task 4: 撃破確定点への sfx_attack 差し込み
対象ファイル

src/screens/dashGameScreen.js

（参照）src/features/dashEnemySystem.js

変更内容

submitAnswer() の defeatResult?.defeated 確定分岐で audioManager.playSfx('sfx_attack') 実行

影響範囲

Dash正解時の敵撃破演出

リスク

sfx_correct との重なり音量バランス

確認方法

検索:

rg -n "defeatNearestEnemy|defeatResult\\?\\.defeated|sfx_correct" src/screens/dashGameScreen.js

実装位置が「撃破確定分岐の内側」であることを確認

Task 5: 被弾確定点への sfx_damage 差し込み（多重発火ガード込み）
対象ファイル

src/screens/dashGameScreen.js

変更内容

updateFrame() の handledCollision かつ COLLISION_COOLDOWN_MS 通過時に audioManager.playSfx('sfx_damage')

既存 sfx_wrong 被弾音があるため置換か併用かを決定（要件優先なら damageへ置換）

影響範囲

Dash接触被弾時

リスク

毎フレーム衝突で連打される可能性（クールダウン位置を誤ると発生）

確認方法

検索:

rg -n "handledCollision|COLLISION_COOLDOWN_MS|lastCollisionPenaltyAtMs|sfx_wrong" src/screens/dashGameScreen.js

playSfx('sfx_damage') がクールダウン条件ブロック内であることを確認

Task 6: 画面/モード別BGM責務の回帰確認（静的）
対象ファイル

src/screens/gameScreen.js

src/screens/resultScreen.js

src/screens/dashGameScreen.js

src/screens/titleScreen.js（確認のみ）

変更内容

BGM呼び出し責務の整合確認（stage/free/result/clear/dash/title）

影響範囲

画面遷移時の音体験全般

リスク

title BGM未使用が仕様齟齬とし残る可能性

確認方法

rg -n "setBgm|playBgm|transitionBgm|bgm_title|bgm_free|bgm_result|bgm_clear|bgm_dash" src/screens src/core

受け入れ条件（Acceptance Criteria）
ステージ別BGM

stageモードで bgm_add/sub/mul/div/mix がそれぞれ
add.mp3 / minus.mp3 / multi.mp3 / divide.mp3 / mix.mp3 を再生する。

Dash BGM維持

Dashでは従来どおり bgm_dash -> bgm-1.mp3 が再生される。

SFX追加

敵撃破確定時に sfx_attack が鳴る。

接触被弾確定時に sfx_damage が鳴る。

既存挙動維持

mute/unlock/unknown-id warn/fallback/fade/transition に退行がない。

パス方針順守

すべて assets/... の相対パスで実装され、絶対パスがない。

テスト手順（手動でOK）
stage-select → 各演算系ステージ（add/sub/mul/div/mix）を開始し、BGM差分を耳で確認。

freeモード開始で bgm_free が維持されることを確認。

result画面遷移時に bgm_result、ステージクリア時に bgm_clear を確認。

Dash開始で bgm_dash 再生を確認。

Dashで正解して敵を倒した瞬間に attack SFXが鳴ることを確認。

Dashで敵接触ペナルティ発生時に damage SFXが鳴ることを確認。

設定のmute ON/OFFでBGM/SFXとも反映されることを確認。

意図的に未知IDを呼ぶ既存デバッグ経路があれば、warn/fallback挙動が従来通りであることを確認。

実装に入る前に確認すべきチェックリスト（取りこぼし防止）
 audioManager.js 以外で BGM_URLS/SFX_URLS を直接参照していないか確認したか

rg -n "BGM_URLS|SFX_URLS" src

 stage BGMのキーソースが stage.theme.bgmId であることを再確認したか

rg -n "theme\\.bgmId|resolveStageBgmId" src

 Dash被弾確定点が handledCollision（attackHandled除外後）であることを再確認したか

rg -n "handledCollision|attackHandled|collision" src/screens/dashGameScreen.js src/features/dashEnemySystem.js

 被弾SFXをクールダウン外に置いていないか（多重発火対策）確認したか

 既存 sfx_wrong の用途（誤答音）と被弾音の役割分離を整理したか

 title/free/result/clear/dash/stage 各モードのBGM呼び出し責務表を更新したか

 すべての追加/変更パスが assets/... 相対パスか確認したか

必要なら次ターンで、このPlanをそのまま実装用の「作業順序付きチェックシート（PRテンプレ形式）」に落とし込みます。