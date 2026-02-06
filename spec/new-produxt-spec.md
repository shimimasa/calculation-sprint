計算スプリント（Dash Run Variant）
ゲーム仕様書 v0.1（設計素材）
1. ゲーム概要

ジャンル

計算 × ダッシュゲーム（エンドレスラン系）

基本コンセプト

「正確に・連続して解けるほど、より速く・より長く走れる」

ただし、解けているほどモンスターも速く迫ってくるハイリスク構造

プレイヤーの目的

できるだけ長距離を走る

モンスターに追いつかれず、生存時間を伸ばす

2. 基本ルール
2.1 プレイフロー

ゲーム開始

プレイヤーが自動で走る（ダッシュ）

計算問題が出題される

正解・不正解によって状態が変化

モンスターが背後から迫る

時間切れ or モンスター接触でゲーム終了

3. プレイヤー状態
要素	説明
走行距離	メインスコア
制限時間	0になるとゲームオーバー
連続正解数	スピード・攻撃条件に使用
速度	正解で上昇
レベル	距離・討伐数などで上昇
ミス率	結果表示用
4. 計算問題仕様（前提）

四則演算（初期は足し算想定）

1問1入力

制限時間内に回答

※ 問題生成ロジックは別仕様とする

5. 連続正解システム（コンボ）
連続正解数	効果
1以上	走行速度アップ
3連続	攻撃アクション解放（飛び蹴りなど）
5連続	モンスター討伐
6. モンスター仕様
6.1 基本挙動

プレイヤーの後方から常に追走

初期速度はプレイヤーよりやや遅い

6.2 スピード変化

プレイヤーが連続正解するごとに

モンスターの追走速度も上昇

ハイリスク・ハイリターン構造

6.3 接触時ペナルティ

モンスターに接触すると

制限時間が減少

強い効果音・演出を発生

7. 攻撃・討伐システム
7.1 攻撃

条件：3連続正解

効果：

モンスターを一時的に押し戻す

演出：飛び蹴り、エフェクト、SE

7.2 討伐

条件：5連続正解

効果：

モンスター撃破

制限時間プラス

距離ボーナス

次エリアへ進行

8. 制限時間システム
状況	時間変化
正解	微増 or 維持
不正解	減少
モンスター接触	大幅減少
モンスター討伐	大幅回復
9. 視覚・演出仕様
9.1 背景

白背景は使用しない

走行距離やエリア進行で背景変化

風・スピード感のある演出

9.2 キャラクター

プレイヤーは常に走るアニメーション

速度に応じて走り方が変化

10. 音・効果音

BGMあり（疾走感）

正解SE

連続正解SE

モンスター接近SE

攻撃・討伐SE

時間減少警告音

11. 成長・評価要素

称号（例：〇〇メートルランナー）

レベル

走行距離

ミス率

ランキング（将来実装）

12. ストーリー要素（軽量）

明示的な物語は最小限

「追われながら走り続ける」体験を主軸

背景・音・敵の変化で世界観を表現

13. MVP（最小実装想定）

ダッシュ移動

計算問題

連続正解カウント

追走モンスター

時間増減

距離スコア

14. Cursor / CodeX 用プロンプト（そのまま使用可）
You are a game developer AI.

Implement a browser-based dash runner math game based on the following spec:
- The player automatically runs forward.
- Math questions appear one by one.
- Each correct answer increases player speed.
- Consecutive correct answers also increase enemy chase speed.
- An enemy monster chases the player from behind.
- Touching the enemy reduces remaining time.
- 3 consecutive correct answers trigger an attack that pushes the enemy back.
- 5 consecutive correct answers defeat the enemy and restore time.
- The main score is distance traveled.

Focus on core mechanics first.
No UI polish required.

15. 補足メモ（設計思想）

「うまくなるほど危険になる」構造

学力差より集中力と持続力が問われる

計算＝作業にならないための緊張感設計