# 学習ループ実装メモ(コンサルレポート優先施策1〜6)

実装日: 2026-07-16
根拠: `spec/consulting-review-2026-07-16.md` の優先施策1〜6

## 実装内容

### 施策1: 誤答時の正答表示+一時停止
- `dashGameScreen.js` `submitAnswer()` 誤答分岐で `× こたえ: N` を表示(あまりのある除算は `N あまり R`)
- 表示中 `WRONG_ANSWER_REVIEW_MS = 1400` ms は `updateFrame()` が全停止(タイマー減算・敵の追走・距離・衝突すべて停止)し、入力も `canAcceptInput()` で無効化
- 次の問題はポーズ明けに `pendingQuestionAfterReview` 経由でロード
- 全モード共通。scoreAttack60 では「正答を読む時間が60秒を消費しない」という好ましい副作用がある

### 施策2: リベンジ再出題
- 誤答した問題を `revengeQueue` に積み、`REVENGE_REAPPEAR_AFTER_QUESTIONS = 2` 問はさんで再出題
- 再出題時に「リベンジ チャンス！」、再挑戦で正解すると「リベンジ せいこう！」キュー+SE
- 時間ボーナスは付与しない(timePolicy契約を変更しないため)
- 成功数は `gameState.dash.revengeSuccessCount` → 結果・統計履歴に保存

### 施策3: 重複出題防止
- `questionGenerator.js` に直近 `RECENT_QUESTION_MEMORY = 5` 問の記憶を追加。重複時は最大8回再抽選
- 併せて**バグ修正**: あまりのある除算(divide Lv5)で `answer = a/b` が非整数になり正解入力が不可能だった問題を修正(答え=商、`meta.remainder` にあまりを保持)

### 施策4: 苦手記録+ふりかえりカード
- 新モジュール `src/features/dashReflection.js`(レガシー `reviewSummary.js` の練習提案文言をDash文体で移植。**リファクタリング計画 Phase 1 で reviewSummary.js を削除する際の移植先**)
- 誤答を演算別に記録(`gameState.dash.wrongByMode`)し、`dashStatsStore` の履歴エントリに `wrongByMode` / `revengeSuccessCount` / `levelId` を追加保存(スキーマv2のまま追加フィールドのみ、後方互換)
- リザルト画面に「きょうのふりかえり」カード: 当日の複数ランを集計した苦手演算+練習提案+リベンジ成功数

### 施策5: 次レベル推薦
- ふりかえりカード内「つぎのおすすめ」: 正答率95%以上&ヒット1以下→次レベル推薦 / 60%未満→1つ下の提案 / それ以外→同レベル再挑戦。**自動でレベルは変えない**(子どもの自己決定を守る)

### 施策6: じっくりモード(practice)
- `src/game/dash/modes/practiceMode.js`: 時間制限なし(内部的には99分)・全timePolicy 0(ミスもぶつかりも時間が減らない)
- 終了条件は「**10問せいかい**」(誤答は完走条件に含めない=間違えても損しない)。達成で goal 扱い+「よくがんばった！」演出
- HUDバーは時間ではなく「せいかい n / 10」の進捗表示。リザルトの残り時間は「ー」
- モード選択に「じっくり(じかんせいげんなし)」ボタンを追加(`index.html`)

## 変更ファイル
- `src/features/questionGenerator.js`(重複防止・あまり除算修正)
- `src/features/dashReflection.js`(新規)
- `src/game/dash/modes/practiceMode.js`(新規)・`modeTypes.js`・`dashModes.js`
- `src/screens/dashGameScreen.js`(ポーズ・リベンジ・苦手記録・practiceバー)
- `src/screens/dashResultScreen.js`(ふりかえりカード・practiceサマリー)
- `src/screens/dashStageSelectScreen.js`(モード注記・バッジ)
- `src/core/gameState.js`・`src/core/dashStatsStore.js`(フィールド追加)
- `index.html`(practiceボタン)・`styles/style.scoped.css`(ふりかえりカード)

## 検証
- `npm run lint` / `npm run gate-ci` 通過
- questionGenerator ユニット検証: 全ステージ×全レベル×1000問で答えが常に整数、直近5問窓の重複ゼロ、小プール(multi Lv1)でも停止なし
- Playwright E2E(Edgeチャネル): 施策1〜6の受け入れシナリオ全PASS+既存3モード(infinite/goalRun/scoreAttack60)の回帰スモーク全PASS
- E2Eスクリプトはセッションのscratchpadに作成(リポジトリ未収載)。Phase 0 でPlaywright正式導入時に `scripts/` へ移植推奨

## 未実施(今後の判断事項)
- リベンジ再出題の再失敗時は再度キューに戻る(上限なし)。頻発するようなら上限導入を検討
- あまりのある除算は「商のみ入力で正解」仕様にした。出題時のヒント表示(「あまりは かかない」等)は要検討
- じっくりモードでも敵は出現する(ペナルティなし)。支援現場向けに「敵なし」設定は将来検討
