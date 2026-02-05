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
