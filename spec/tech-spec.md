# 技術仕様（起動/配信/ルーティング）

## 1. 配布とルーティングの前提

- 配布物はリポジトリ直下の `index.html` を起点とする静的ファイル一式。
- JS は `src/`、CSS は `styles/`、画像は `assets/` に配置されており、`index.html` から相対パスで参照する。
- 画面遷移はアプリ内状態で完結しており、クライアントルーティングのパスは増えないため **SPA の rewrite は不要**。
- サブパス配信（例: `/calculation-sprint/`）は相対パス参照により対応する（ADR-004 を遵守）。

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

## 5. UI受け入れ試験（T1〜T6 / ADR-003 入力テスト）実施手順

1. 上記のどちらかでサーバー起動。
2. 直下配信なら `http://localhost:8000/`、サブパス配信なら `http://localhost:8000/calculation-sprint/` を開く。
3. UI 受け入れ試験 T1〜T6 を手元のテストケース定義に沿って実施する。
4. ADR-003 入力テストは以下を確認する。
   - 画面上の「確定」操作で回答確定できる（Enter 依存ではない）。
   - オンスクリーンテンキー/ボタン操作で回答確定まで完結できる。
   - 「戻る」「次へ」などのアクション操作が入力デバイス差に依存しない。

