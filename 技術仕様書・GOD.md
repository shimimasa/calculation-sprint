# 計算スプリント（Calculation Sprint）

## 1. 企画概要

### 1.1 目的

* 四則演算（加減乗除）の**計算速度**と**正確性**を同時に高める
* 即時フィードバックにより、**丸付け・採点作業を不要**にする
* 教師・支援員・保護者の負担を減らし、反復練習を成立させる

### 1.2 想定ユーザー

* 小学校高学年〜中学生（学力差あり）
* 計算が苦手／遅いが、反復練習は可能な層
* 発達特性（ADHD・LDなど）を含む

### 1.3 利用シーン

* 支援教室・放課後等デイサービス
* 学校の補習・家庭学習
* PC・タブレット・スマートフォン（最初はPC優先）

---

## 2. ゲームデザイン書（GDD）

### 2.1 ゲームコンセプト

> 「考えすぎる前に手が動く」状態を作る、60秒集中型計算トレーニング

* 制限時間内にできるだけ多く正確に解く
* 1問ごとに即時で正誤が返る
* 成否が明確で、テンポを阻害しない

### 2.2 基本ルール

* 制限時間：60秒（初期値）
* 問題は1問ずつ表示
* 回答入力 → Enterキーで判定
* 正解／不正解を即時表示後、次の問題へ

### 2.3 ゲームフロー

1. タイトル画面
2. モード選択（たし・ひき・かけ・わり・ミックス）
3. 難易度選択（桁数・繰り上がり等）
4. ゲーム開始（60秒）
5. 結果画面（スコア・正答率）
6. リトライ or 終了

### 2.4 評価・スコア設計

* 正解数
* 不正解数
* 正答率（正解数 / 総回答数）
* 平均回答時間（オプション）

※ ランキング・競争要素はv1では入れない

### 2.5 フィードバック設計

| 状態  | 表示   | 補足       |
| --- | ---- | -------- |
| 正解  | ◯（緑） | 効果音（任意）  |
| 不正解 | ×（赤） | 正解を小さく表示 |

* 視覚フィードバックは**0.5秒以内**
* 次の問題への遷移を妨げない

### 2.6 難易度設計（初期）

**共通パラメータ**

* 数値範囲（例：1〜9 / 10〜99）
* 繰り上がり・繰り下がりの有無

**演算別制御**

* 加算：繰り上がりON/OFF
* 減算：負の数は出さない
* 乗算：九九のみ（1〜9）
* 除算：割り切れる問題のみ

---

## 3. 技術仕様書（Technical Spec）

### 3.1 技術スタック

* HTML5
* CSS3（Flexbox）
* JavaScript（Vanilla JS）
* 外部ライブラリ：使用しない（v1）

### 3.2 対応環境

* PC（Chrome / Edge 最新）※優先
* タブレット・スマホ（後対応）

### 3.3 画面構成

#### ① タイトル画面

* タイトル表示
* スタートボタン

#### ② 設定画面

* 演算モード選択（checkbox or radio）
* 難易度選択

#### ③ ゲーム画面

* 問題表示エリア
* 回答入力欄
* 残り時間表示
* 現在の正解数

#### ④ 結果画面

* 正解数
* 不正解数
* 正答率
* 再挑戦ボタン

### 3.4 データ設計（JSオブジェクト）

```js
const gameState = {
  timeLimit: 60,
  timeLeft: 60,
  currentQuestion: null,
  correctCount: 0,
  wrongCount: 0,
  totalAnswered: 0,
  settings: {
    mode: 'add',
    digit: 1,
    carry: false
  }
};
```

### 3.5 問題生成ロジック（概要）

* 設定に基づき乱数生成
* 除算は「答え×割る数」から逆算
* 問題と正解をセットで保持

### 3.6 正誤判定

* 入力値をNumberに変換
* 正解値と厳密比較
* NaN・空欄は不正解扱い

### 3.7 タイマー処理

* `setInterval` で1秒ごとに減算
* 0になったら強制終了 → 結果画面へ

---

## 4. フォルダ構成（ねこもじなぞり／漢字ヨミタビ寄せ・画面遷移しやすい形）

> 方針：**screen（画面）単位で分離**し、`screenManager` で遷移を一元管理。ゲームが増えても同じ構造で横展開できる構成。

```text
calculation-sprint/
├─ index.html                  # エントリーポイント（canvas / root）
├─ README.md
├─ src/
│  ├─ main.js                  # 初期化・ループ起動・グローバル配線
│  ├─ core/
│  │  ├─ screenManager.js       # 画面遷移（changeScreen / currentScreen）
│  │  ├─ gameState.js           # 共有状態（設定・スコア・タイマー等）
│  │  ├─ timer.js               # タイマー（start/stop/tick）
│  │  ├─ input.js               # 入力（keyboard / later: touch）
│  │  └─ utils.js               # 乱数・整形など汎用
│  ├─ screens/
│  │  ├─ titleScreen.js         # タイトル画面
│  │  ├─ settingsScreen.js      # 設定画面（モード・難易度）
│  │  ├─ gameScreen.js          # プレイ画面（出題・判定・表示）
│  │  └─ resultScreen.js        # 結果画面
│  ├─ features/
│  │  └─ questionGenerator.js   # 問題生成（四則・難易度）
│  └─ ui/
│     ├─ uiRenderer.js          # 共通UI描画（ヘッダ・ボタン等）
│     └─ domRefs.js             # DOM参照を一元化（getElementById集中）
├─ styles/
│  └─ style.css                 # 共通スタイル
├─ assets/
│  ├─ sounds/                   # SE/BGM（任意）
│  └─ images/                   # 背景・UI素材（任意）
└─ data/                        # 将来拡張（プリセットJSON等）
   └─ presets.json              # 学年・難易度プリセット（任意）
```

### 4.1 画面（screen）モジュールのインターフェイス（統一）

* ねこもじなぞり／漢字ヨミタビと同じ発想で、**全画面を同じI/F**に揃えると遷移が爆速になります。

* `enter(prev, params)` : 画面に入った瞬間（状態初期化・イベント登録）

* `update(dt)` : ループ更新（必要な画面のみ）

* `render()` : 表示更新（DOMなら最小化、canvasなら描画）

* `exit(next)` : 画面を出る瞬間（イベント解除）

#### 4.2 ファイル分割の基準

* **画面ごとに「イベント登録」を完結**させる（`enter/exit`で必ず付け外し）
* `gameState` は唯一の共有状態。画面間の値受け渡しは `params` を使用
* 問題生成・ロジックは `features/` に閉じ、screenは制御と表示に集中
* DOM参照は `domRefs.js` に集約し、IDの分散を防ぐ

---

### 4.3 画面遷移図（v1）

```text
[title]
  └─ start → [settings]
            └─ play   → [game]
                       ├─ time up → [result]
                       └─ quit    → [settings]   # v1では省略可

[result]
  ├─ retry  → [game]       # 同じ設定で再挑戦
  └─ back   → [settings]   # 設定変更
```

### 4.4 各screenの責務とライフサイクル（enter / exit で必ず完結）

#### `titleScreen.js`

* **enter**: ボタンイベント登録（Start）
* **render**: タイトル・説明・Startボタン表示
* **exit**: イベント解除

#### `settingsScreen.js`

* **enter**: 設定UIの初期値反映／Playボタンイベント登録
* **render**: モード（加減乗除/ミックス）、難易度（桁数・繰り上がり）を表示
* **exit**: イベント解除
* **注意**: 設定値は `gameState.settings` にのみ保存（DOMからの直接参照を残さない）

#### `gameScreen.js`

* **enter**:

  * `gameState` のスコア・残り時間を初期化（またはリトライ時は引き継ぎ規則に従う）
  * タイマー開始（`timer.start()`）
  * 入力イベント登録（Enter送信）
  * 最初の問題生成（`questionGenerator.next()`）
* **update(dt)**: タイマーtick・状態更新（DOMゲームなら最小限でも可）
* **render**: 問題表示／正誤フィードバック（0.5秒以内）／スコア・残り時間
* **exit**:

  * タイマー停止（`timer.stop()`）
  * 入力イベント解除
  * フィードバック用のタイムアウト解除（残るとバグる）

#### `resultScreen.js`

* **enter**: 結果値（正解/不正解/正答率）を `gameState` から読み込み、ボタンイベント登録
* **render**: 成績表示（必要なら平均回答時間も）
* **exit**: イベント解除

### 4.5 実装ルール（画面遷移が壊れないための約束）

* **イベントはscreen内で登録し、screen内で解除**（enter/exitのペア）
* `setTimeout / setInterval` を使ったら **IDを保持して必ず解除**
* 画面間の受け渡しは

  * 共有：`gameState`
  * 一時：`changeScreen(next, params)` の `params`
* `domRefs.js` 以外で `getElementById` を乱用しない（UIの破綻原因になる）
* `questionGenerator` は **UIを触らない**（純粋関数寄せ）

### 4.6 `screenManager.js` 最小API仕様（ねこもじなぞり／漢字ヨミタビ互換）

> 目的：遷移ロジックを1か所に閉じ、screen側はI/Fに従うだけにする。

#### 4.6.1 公開API

* `registerScreens(map)`

  * 引数：`{ [screenName: string]: ScreenModule }`
  * 役割：screenモジュールを辞書で登録

* `changeScreen(nextName, params = {})`

  * 役割：現在screenの `exit()` → 次screenの `enter()` を順に呼び出し、`currentScreen` を差し替える
  * `params`：一時的に渡したいデータ（例：`{ retry: true }`）

* `update(dt)`

  * 役割：`currentScreen.update(dt)` を呼ぶ（未実装なら何もしない）

* `render()`

  * 役割：`currentScreen.render()` を呼ぶ

#### 4.6.2 ScreenModule インターフェイス（統一）

* 必須：`enter(prevName, params)` / `render()` / `exit(nextName)`
* 任意：`update(dt)`

#### 4.6.3 遷移の呼び出し規約

* screen内では「状態を作ってから遷移」ではなく、

  * **状態は `gameState` に書く**
  * **遷移は `changeScreen()` を呼ぶ**
    の2段に分ける

例：設定画面での開始

* `gameState.settings = {...}`
* `changeScreen('game', { from: 'settings' })`

#### 4.6.4 例外・安全策

* `changeScreen()` は多重呼び出し防止のため、内部で `isTransitioning` フラグを持つ（推奨）
* `exit()` 内で `changeScreen()` を呼ばない（循環・多重遷移の原因）

#### 4.6.5 main.js 側の責務（最小）

* screen登録（`registerScreens`）
* 最初の画面へ遷移（`changeScreen('title')`）
* `requestAnimationFrame` で `update(dt)` と `render()` を回す（DOM中心なら `update` は省略可）

### 4.6 screenManager.js 最小API仕様（共通）

> ねこもじなぞり／漢字ヨミタビと**完全に同じ思想**で使えるようにするための、最小かつ固定のインターフェイス。

#### 役割

* 現在表示中の screen を一元管理
* 画面遷移時に **exit → enter** を必ず保証
* main.js からは screenManager のみを触る

---

#### 想定ファイル

`src/core/screenManager.js`

#### 内部状態（例）

```js
let currentScreen = null;
let screens = {}; // { title: titleScreen, game: gameScreen, ... }
```

---

#### API一覧

##### `registerScreen(name, screenObject)`

* 画面モジュールを登録する
* 起動時（main.js）に一度だけ呼ぶ

```js
screenManager.registerScreen('title', titleScreen);
screenManager.registerScreen('settings', settingsScreen);
screenManager.registerScreen('game', gameScreen);
screenManager.registerScreen('result', resultScreen);
```

---

##### `changeScreen(name, params = {})`

* 画面遷移の唯一の入口
* 遷移順序を**必ず固定**する

**遷移手順（厳守）**

1. `currentScreen.exit(nextName)`（存在すれば）
2. `currentScreen = screens[name]`
3. `currentScreen.enter(prevName, params)`

```js
screenManager.changeScreen('game', { retry: true });
```

---

##### `update(dt)`

* mainループから毎フレーム呼ばれる
* `update` を持つ screen のみ実行

```js
if (currentScreen?.update) {
  currentScreen.update(dt);
}
```

---

##### `render()`

* DOM描画 or canvas描画
* **renderが空のscreenがあってもOK**（DOM固定画面用）

```js
if (currentScreen?.render) {
  currentScreen.render();
}
```

---

### 4.7 main.js との責務分離ルール

#### main.js がやること

* 初期化
* screen登録
* 最初の画面へ遷移
* ループ制御（requestAnimationFrame）

```js
init();
screenManager.changeScreen('title');
loop();
```

#### main.js が**やらないこと**

* DOM操作
* 設定値の直接変更
* 問題生成
* 画面ごとのイベント登録

---

### 4.8 この構成で得られるメリット

* 画面が増えても**迷子にならない**
* バグの発生源が「screen内」に閉じる
* 他ゲーム（計算・漢字・なぞり）で
  **同じ設計をコピペ再利用できる**

---

## 5. 画面遷移設計（Screen Flow）

### 5.1 画面遷移図（簡易）

```text
[TitleScreen]
      │ Start
      ▼
[SettingsScreen]
      │ 決定
      ▼
[GameScreen]
      │ 時間切れ / 終了
      ▼
[ResultScreen]
      │ Retry           │ Back to Title
      ├──────────────▶ [GameScreen]
      ▼
[TitleScreen]
```

* すべての遷移は `screenManager.changeScreen(next, params)` 経由
* 画面同士が直接他画面を import しない（疎結合）

---

## 6. 各Screenの責務定義

### 6.1 TitleScreen

**責務**

* ゲームタイトル表示
* スタート操作受付

**enter**

* UI初期化
* スタートボタンのイベント登録

**exit**

* イベント解除

---

### 6.2 SettingsScreen

**責務**

* 演算モード・難易度設定
* `gameState.settings` への反映

**enter**

* 現在設定の表示
* 決定ボタンイベント登録

**exit**

* イベント解除

---

### 6.3 GameScreen

**責務**

* 問題生成・表示
* 入力受付・正誤判定
* タイマー進行

**enter**

* スコア初期化
* タイマー開始
* 最初の問題生成

**update**

* タイマー残り時間更新

**exit**

* タイマー停止
* 入力イベント解除

---

### 6.4 ResultScreen

**責務**

* 結果表示（正解数・正答率）
* リトライ／タイトル戻り選択

**enter**

* 結果データ描画
* ボタンイベント登録

**exit**

* イベント解除

---

## 7. screenManagerの役割（設計原則）

* `currentScreen` を唯一保持
* 遷移時に必ず

  1. 現screen.exit()
  2. currentScreen差し替え
  3. nextScreen.enter(params)
* 画面ロジックはここに書かない（制御専用）

---

## 8. 実装フェーズへの接続

* この設計のまま **ねこもじなぞり／漢字ヨミタビと横断的に再利用可能**
* 新ゲーム追加時は `screens/` と `features/` を増やすだけ

---

次工程：

* `screenManager.js` の雛形コード作成
* 各Screenの最小実装（空enter/exit）生成

## 5. 今後の拡張（v1.1以降）

* スマホ用テンキーUI
* コンボ・連続正解表示
* 難易度自動調整（正答率ベース）
* CSV出力（教師用記録）
* 学年別プリセット

---

## 6. 開発方針まとめ

* **まず完成させる**（UIは最小）
* 教育現場で回して観察する
* データを増やさず、指標を絞る

---

次のステップ：

* この仕様をベースに `v1.0 完成コード` を生成
* もしくは「教師用観察指標」を先に設計する
