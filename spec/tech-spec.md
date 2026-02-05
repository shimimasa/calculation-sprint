# 技術仕様（起動/配信/ルーティング）

SSoT（正本）として、以後の参照は本ファイルを優先する（ADR-005）。

## 1. 配布とルーティングの前提

- 配布物はリポジトリ直下の `index.html` を起点とする静的ファイル一式。
- JS は `src/`、CSS は `styles/`、画像は `assets/` に配置されており、`index.html` から相対パスで参照する。
- 画面遷移はアプリ内状態で完結しており、クライアントルーティングのパスは増えないため **SPA の rewrite は不要**。
- サブパス配信（例: `/calculation-sprint/`）は相対パス参照により対応する（ADR-004 を遵守）。

## 2. 起動（正本）

起動は `tools/serve` のみを正本とする（直下/サブパスの両方を再現可能）。

```bash
./tools/serve
```

- 直下配信: `http://localhost:8000/`
- サブパス配信: `./tools/serve --subpath` → `http://localhost:8000/calculation-sprint/`

## 3. CSSスコープ（統合耐性）

- `index.html` は **必ず** `styles/style.scoped.css` を参照する（ADR-004）。
- `styles/style.scoped.css` は `.calc-sprint` ルート配下へ閉じる。
- **グローバルCSS（body/html/:root/*）は禁止**。ポータル統合で衝突するため、`styles/style.css` のようなグローバル侵食CSSは採用しない。
- **@keyframes/@property は `calc-sprint-` プレフィックスで命名**し、アニメーションやカスタムプロパティの衝突を避ける（ADR-006）。

## 4. storage（名前空間 / プロファイル分離 / 移行）

- 名前空間（prefix）: `portal.calcSprint`（`src/core/storageKeys.js`）
- キー形式（例）:
  - `portal.calcSprint.daily.v1.p:A`
  - `portal.calcSprint.rank.distance.today.v1.p:B`
  - `portal.calcSprint.stageProgress.v1.p:C`
- 旧キー（legacy）からの移行は **default プロファイルのみ**、かつ **コピー移行（非破壊）** とする（`src/core/*Store.js`）。

## 5. 入力I/F（Action層）

Action層は `src/core/inputActions.js` を正とし、画面は Action を購読して動く（ADR-003/006）。

- `submit`: 回答確定（Enterはショートカット扱い）
- `back`: 1文字削除（テンキーの⌫等）
- `next`: 「次へ」の抽象アクション（画面ごとに意味を割当）
- `toggle_keypad`: オンスクリーンテンキーの表示切替

### 5.1 Action Contract 表

| Action | 意味 | 代表的な発火元 | 対象画面 | 無効条件（例） |
| --- | --- | --- | --- | --- |
| `submit` | 回答確定（前進アクション） | Enter / NumpadEnter / 確定ボタン | gameScreen | ロック中・時間切れ・未出題時 |
| `back` | 1文字削除 | テンキーの⌫ / Backspace / Delete | gameScreen | ロック中・時間切れ |
| `next` | 画面の「次へ」を示す抽象アクション（gameScreenでは`submit`相当） | Space / ArrowRight | gameScreen | ロック中・時間切れ・未出題時 |
| `toggle_keypad` | オンスクリーンテンキーの表示切替 | テンキー切替ボタン | gameScreen | 画面非表示時 |

## 6. Debug / Test（実装と一致する名称のみ）

### 6.1 テストフラグ（手動/E2E向け）

URLクエリで `test=1` を有効化する（`src/core/testFlags.js`）。

- 例: `http://localhost:8000/?test=1&timeLimit=5`
- `timeLimit` を省略した場合は 5 秒に短縮される。
- 有効化時は `window.__testConfig` に解決済み設定が格納される。

### 6.2 画面表示ショートカット（開発用）

`src/main.js` が `window.__debug` を提供する（最小限）。

- `window.__debug.showStageSelect()`
- `window.__debug.showResultStageSample()`

## 7. 受け入れ試験（ADR-003 入力テスト含む）

受け入れ試験の正本は `spec/test-results/adr-acceptance-latest.md` とする。
実行方法は `tools/adr-e2e`（自動）または `tools/adr_manual_runner.mjs`（手動）を用いる。

1. 上記の起動手順でサーバー起動。
2. 直下配信なら `http://localhost:8000/`、サブパス配信なら `http://localhost:8000/calculation-sprint/` を開く。
3. `adr-acceptance-latest.md` の T1〜T6 を定義どおり実施する。
4. ADR-003 入力テストは以下を確認する。
   - 画面上の「確定」操作で回答確定できる（Enter 依存ではない）。
   - オンスクリーンテンキー/ボタン操作で回答確定まで完結できる。
   - 「戻る」「次へ」などのアクション操作が入力デバイス差に依存しない。
