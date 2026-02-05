# spec/test-results 正本ルール

## 正本の位置づけ
- **判定の正本**: [`adr-acceptance-latest.md`](./adr-acceptance-latest.md)
- **生成/更新主体**: `tools/adr-e2e` または `tools/adr_manual_runner.mjs`

## 証跡の扱い
- `.log` は **補助証跡**（参考ログ）として扱う。
- 手書き `.md` は **notes** として扱う（正本ではない）。
- 矛盾がある場合は **latest を優先**し、他は「当時のメモ」として参照する。

## 既存証跡の配置
- notes: [`archive/adr-002-003-e2e.md`](./archive/adr-002-003-e2e.md)
- logs: [`logs/adr-002-003-e2e.log`](./logs/adr-002-003-e2e.log)
