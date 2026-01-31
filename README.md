# 計算スプリント v1

## 起動手順（ローカル）

> **注意**: `file://` 直開きだと ES Modules が動かない場合があります。必ずローカルサーバー経由で起動してください。

### 方法1（推奨）: Python の簡易サーバー

```bash
python -m http.server 8000
```

ブラウザで `http://localhost:8000/` を開きます。

### 方法2: npx serve

```bash
npx serve .
```

表示された URL をブラウザで開きます。

## 検証手順（動作確認チェックリスト）

- 画面遷移一式（タイトル → ルール → ゲーム → 結果 → タイトル）が一通り行える。
- フィードバック（正誤表示）中に問題が切り替わらない。
- `timeLeft=1` の状態で次の tick を待つと time-up 画面へ遷移する。
  - 例: ブラウザ開発者ツールのコンソールで `window.app?.debug?.setTimeLeft?.(1)` を実行し、1秒待って time-up に遷移することを確認する。
- `carry=false` の 2桁加算で `a+b<100` を満たす。
  - 例: `node -e "for(let i=0;i<1000;i++){const a=10+Math.floor(Math.random()*90);const b=10+Math.floor(Math.random()*90);const ones=(a%10)+(b%10);if(ones<10 && a+b>=100){console.log('NG',a,b);process.exit(1)}}console.log('OK')"`
