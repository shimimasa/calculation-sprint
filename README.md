# 計算スプリント v1

## 最短起動

```bash
./tools/serve
```

- 直下配信: `http://localhost:8000/`
- サブパス配信: `./tools/serve --subpath` → `http://localhost:8000/calculation-sprint/`

## 仕様（SSoT）

- [Product Spec](./spec/product-spec.md)
- [Tech Spec](./spec/tech-spec.md)

## 品質ゲート

- `npm run gate`：開発者向け。ローカル補助ツール（例: rg）を使った追加チェックを許可。
- `npm run gate-ci`：CI向け。Node.js標準のみで動作し、追加ツール依存を持たない。

## 受け入れ試験

- [adr-acceptance-latest.md](./spec/test-results/adr-acceptance-latest.md)

## リリース前チェック

- `./tools/gate`

## ADR

- [spec/adr](./spec/adr/)


## Dash撃破数の確認手順（手動）

1. タイトルから Dash Run を開始する。
2. 敵を3体倒す（正解で敵を倒す）。
3. プレイ中HUDの「たおした敵の数」が 1 → 2 → 3 と増えることを確認する。
4. Dash終了後、結果画面の「たおした敵の数」が HUD の最終値と一致することを確認する。

## Dash敵アセット命名ルール（Phase1.5）

Dash敵画像は次の順で探索されます（`stageKey`, `tier`, `state` を使用）。

1. 新形式（優先）  
   `assets/enemy/{stageKey}/{tier}/enemy_{stageKey}_{tier}_{state}.png`
2. 旧形式（互換フォールバック）  
   `assets/enemy/enemy_{stageKey}_{state}.png`
3. 最終フォールバック（安全値）  
   `assets/enemy/enemy_plus_walk.png`

- `tier`: `normal | big | boss`
- `state`: `walk | hit | dead`
- HPは tier 固定:
  - `normal=1`
  - `big=2`
  - `boss=3`
- Feature Flag: `dash.worldLevel.enabled`（既定値 `false`。ON時のみ Phase2 の World/Level/難易度 schema 経路を使用）。
- Phase2補助: Dashステージ選択画面の `World/Level（β）` トグルでON/OFFを切り替えできます（既定OFF）。
- 補足（開発者向け）: 必要なら `dash.worldLevel.enabled` を localStorage から直接操作しても同じ設定を切り替えられます。

## Dash World/Level 回帰チェック（PR2）

- フラグOFF: 既存どおり `stageId` ベースの出題（従来挙動）であること。
- フラグON + plus L1/L2: L1は繰り上がりなし、L2は繰り上がりありの問題が出ること。
- フラグON: 背景/BGM/敵の見た目・挙動は stage(world) 固定の既存経路から変わらないこと。
- フラグON + world=mix: 問題の演算（+, -, ×, ÷）に対応した敵stageKey（plus/minus/multi/divide）が出ること。
- フラグON: Dashステージ選択で World→Level の2段階選択UIが表示され、Startで選択が保存されること。
- フラグOFF: Dashステージ選択の見た目/遷移が従来と同じであること。
