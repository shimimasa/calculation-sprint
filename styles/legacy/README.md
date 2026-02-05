# legacy styles（参照禁止）

このディレクトリのCSSは **互換/退避用** です。

- `styles/legacy/style.css` は **ポータル統合（ADR-004）の CSS非侵食ルールに違反**します（`body` / `:root` / `*` 等のグローバル侵食があるため）。
- `index.html` から参照してはいけません。

正本は `styles/style.scoped.css` です（`.calc-sprint` ルート配下に完全スコープ）。

