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
