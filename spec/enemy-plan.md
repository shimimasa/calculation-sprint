# Enemy System Plan (計算スプリント) — SSoT

目的：
- ダッシュ中（runner lane）に「棒人間へ近づく敵」を追加し、緊張感と“連続正解＝撃破”の爽快感を作る。
- 実装の核は「敵を右端から出現させて左へ流す」。撃破は後付け可能な“判定ルール（attack window）”で成立させる。  

---

## 0. 現状前提（固定）
- ワールド座標（px）で管理する（ランナー下段がフィールド）。
- プレイヤーXは基本固定（左寄せ）でOK。敵が左へ動けばマリオ風の“迫ってくる”が成立。
- 敵は「右端からスポーン → 左へ移動 → 接触で衝突判定」。

用語：
- groundY：地面のY（棒人間/敵の接地ライン）
- playerX：基本固定（baseX）
- viewportW：ランナー表示領域の幅

---

## 1. アセット（既存前提）
保存先：
- `assets/enemy/`

既存ファイル命名（3状態 × 4種）：
- たし算（plus）
  - enemy_plus_walk.png
  - enemy_plus_hit.png
  - enemy_plus_dead.png
- ひき算（minus）
  - enemy_minus_walk.png
  - enemy_minus_hit.png
  - enemy_minus_dead.png
- かけ算（multi）
  - enemy_multi_walk.png
  - enemy_multi_hit.png
  - enemy_multi_dead.png
- わり算（divide）
  - enemy_divide_walk.png
  - enemy_divide_hit.png
  - enemy_divide_dead.png

状態定義：
- walk：通常接近（移動中）
- hit：攻撃が当たった瞬間の“1拍”演出（短時間）
- dead：撃破後（ぺちゃんこ/気絶など、短時間で消える）

※ 将来 walk を2フレ化する可能性はあるが、v1は単フレで進める。

---

## 2. アセット規格（SSoT）
- 形式：PNG（透過）
- 向き：左向き（←方向へ進む）に統一
- 接地：足元が同じ高さに揃う（地面に置いたとき違和感が出ない）
- 影：なし（影はゲーム側で付けるなら統一しやすい）
- 余白：上下左右 10–20px 程度（切れ防止）
- 表示サイズ：ゲーム側で縮小して揃える（例：表示 72〜96px など）

---

## 3. ランタイム設計（最小コア）
### 3.1 Enemy Entity（最小データ）
- id: string
- type: "plus" | "minus" | "multi" | "divide"
- state: "walk" | "hit" | "dead"
- x, y, w, h: number
- vx: number（左へ動く速度。負の値）
- tStateUntil?: number（hit/deadの期限。now > until で次状態へ）
- isAlive: boolean（画面外 or dead完了で false）

### 3.2 Player（敵との判定に必要な最小）
- baseX: number（固定位置）
- x: number（演出で前に出すなら一時的に変化）
- y, w, h: number
- attackUntil: number（攻撃ウィンドウ。now < attackUntil なら攻撃中）
- kickUntil?: number（強攻撃の見た目用：一時的に前へ）

---

## 4. 実装順（破綻しない順）
### Step 1：敵1体を描画（静止）
- 右端に walk 画像を出す（座標だけ決める）
- yは必ず groundY に接地させる（y = groundY - h）

### Step 2：左へ移動（dt対応）
- 毎フレーム：enemy.x += enemy.vx * dt
- 画面外（enemy.x + enemy.w < 0）で削除

### Step 3：衝突判定（当たったら終了）
- AABBで playerRect と enemyRect を判定
- ヒットしたら endReason="collision" で終了
- ※この段階では「倒す」は入れない（まず脅威として成立させる）

### Step 4：スポーン（複数体）
- spawnTimer を持つ
- 0以下になったら敵生成して右端へ
- 生成後、spawnInterval を徐々に短く（難易度）

### Step 5：連続正解＝攻撃ウィンドウ（判定ルール）
- 連続正解が起きた瞬間：
  - player.attackUntil = now + ATTACK_WINDOW_MS（例：250ms）
- attack中に衝突が起きたら「被弾」ではなく「撃破」に分岐

撃破分岐（v1は簡易でOK）：
- if (playerIsAttacking && intersects) -> enemy.state="hit" -> すぐ dead
- ※踏み判定（上から）や飛び蹴り判定（横から）は v1.1 で強化しても良い

### Step 6：hit / dead の状態遷移
- hit は短い（例：120ms）→ dead へ
- dead は短い（例：300ms）→ 削除
- ここでSEやエフェクトを足せる

---

## 5. 難易度（速度・頻度スケール）
- enemySpeed = -(base + correctCount*k1 + elapsedSec*k2)
- spawnInterval = max(MIN, START - elapsedSec*k3)

初期案（例）：
- baseSpeed=220px/s
- k1=2.0, k2=1.5
- START=1500ms, MIN=650ms, k3=18ms/sec

---

## 6. “連続正解”の仕様（おすすめ）
- streak >= 2：小攻撃（attack window 付与）
- streak >= 4：強攻撃（attack window 延長 or 判定拡大 + 見た目：前に出る）
- streakが途切れたら攻撃なし

---

## 7. 受け入れ条件（Acceptance）
最低合格（v1）：
- [ ] 敵が右から出て左へ近づく
- [ ] 接触でゲームオーバー（collision）
- [ ] 一定間隔で複数スポーンする
- [ ] 連続正解直後だけ、接触しても死なず敵が倒れる（hit→dead→消滅）

追加合格（v1.1）：
- [ ] hit/dead の演出時間が自然
- [ ] 強攻撃で“前に出る”見た目が付く（kickUntil）

---

## 8. CodeX投入用：実装タスク（そのまま貼る）
### 8.1 新規/変更の想定（例）
- 追加：EnemyManager / enemySystem（スポーン・更新・描画・判定）
- 変更：dashGameScreen（update/renderに敵更新を差し込む）
- 変更：assets読み込み（enemy画像4種×3状態の参照）

### 8.2 実装要件（厳守）
- 既存のゲームループ・画面遷移・BGM仕様は壊さない
- 敵の状態は walk/hit/dead のみ（v1）
- 画像パスは `assets/enemy/enemy_${type}_${state}.png` を使用（typeは plus/minus/multi/divide）
- 衝突はAABB
- 攻撃は “attack window（ms）” で分岐（連続正解イベントをフック）