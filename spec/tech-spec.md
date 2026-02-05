# 技術仕様（起動/配信/ルーティング）

## 1. 配布とルーティングの前提

- 配布物はリポジトリ直下の `index.html` を起点とする静的ファイル一式。
- JS は `src/`、CSS は `styles/`、画像は `assets/` に配置されており、`index.html` から相対パスで参照する。
- 画面遷移はアプリ内状態で完結しており、クライアントルーティングのパスは増えないため **SPA の rewrite は不要**。
- サブパス配信（例: `/calculation-sprint/`）は相対パス参照により対応する（ADR-004 を遵守）。

SSoT（正本）として、以後の参照は本ファイルを優先する（ADR-005）。

## 2. Not Found の根本原因

`index.html` がリポジトリ直下にあるため、静的サーバーの **ドキュメントルートがリポジトリ直下以外** だと
`/` または `/index.html` が 404 になる。つまり、`python -m http.server` を別ディレクトリで実行すると Not Found が再現する。

## 3. 推奨ローカル起動手順（直下配信）

### 3.1 1コマンド起動（推奨）

```bash
./tools/serve
```

- URL: `http://localhost:8000/`
- 必要に応じて `--port 8001` などで変更可能。

### 3.2 直接コマンド（手動）

```bash
cd /path/to/calculation-sprint
python -m http.server 8000
```

- URL: `http://localhost:8000/` または `http://localhost:8000/index.html`

## 4. サブパス配信の簡易再現

### 4.1 1コマンド起動（推奨）

```bash
./tools/serve --subpath
```

- URL: `http://localhost:8000/calculation-sprint/`
  - リポジトリ名をそのままサブパスにする。

### 4.2 直接コマンド（手動）

```bash
cd /path/to
python -m http.server 8000
```

- URL: `http://localhost:8000/calculation-sprint/`
  - `/path/to` は `calculation-sprint` が入っている親ディレクトリ。

## 5. CSSスコープ（統合耐性）

- `index.html` は **必ず** `styles/style.scoped.css` を参照する（ADR-004）。
- `styles/style.scoped.css` は `.calc-sprint` ルート配下へ閉じる。
- `styles/style.css` のような **グローバル侵食CSS（body/html/:root/*）は使用禁止**（ポータル統合で衝突するため）。

## 6. storage（名前空間 / プロファイル分離 / 移行）

- 名前空間（prefix）: `portal.calcSprint`（`src/core/storageKeys.js`）
- キー形式（例）:
  - `portal.calcSprint.daily.v1.p:A`
  - `portal.calcSprint.rank.distance.today.v1.p:B`
  - `portal.calcSprint.stageProgress.v1.p:C`
- 旧キー（legacy）からの移行は **default プロファイルのみ**、かつ **コピー移行（非破壊）** とする（`src/core/*Store.js`）。

## 7. 入力I/F（Action層）

Action層は `src/core/inputActions.js` を正とし、画面は Action を購読して動く（ADR-003）。

- `submit`: 回答確定（Enterはショートカット扱い）
- `back`: 1文字削除（テンキーの⌫等）
- `next`: 「次へ」の抽象アクション（画面ごとに意味を割当）
- `toggle_keypad`: オンスクリーンテンキーの表示切替

## 8. Debug / Test フラグ（手動検証）

### 8.1 タイムリミット短縮（手動/E2E向け）

URLクエリで `test` を有効化する（`src/core/testFlags.js`）。

- 例: `http://localhost:8000/?test=1&timeLimit=5`

### 8.2 画面表示ショートカット（開発用）

`src/main.js` が `window.__debug` を提供する（最小限）。

- `window.__debug.showStageSelect()`\n+- `window.__debug.showResultStageSample()`

## 9. UI受け入れ試験（T1〜T6 / ADR-003 入力テスト）実施手順

1. 上記のどちらかでサーバー起動。
2. 直下配信なら `http://localhost:8000/`、サブパス配信なら `http://localhost:8000/calculation-sprint/` を開く。
3. UI 受け入れ試験 T1〜T6 を手元のテストケース定義に沿って実施する。
4. ADR-003 入力テストは以下を確認する。
   - 画面上の「確定」操作で回答確定できる（Enter 依存ではない）。
   - オンスクリーンテンキー/ボタン操作で回答確定まで完結できる。
   - 「戻る」「次へ」などのアクション操作が入力デバイス差に依存しない。

