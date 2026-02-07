---
name: DashRun_runLayer_reuse
overview: 通常モードで動作済みの`run-layer`（背景スクロール + 棒人間ランナーCSSアニメ）をDash Runモードへ“DOM移動で共有”し、Dash側の既存ロジック（速度/敵接近）に紐づけて軽量なUIレイヤー演出だけを追加します。新アセット追加・UI全面改修・通常モード置換は行いません。
todos:
  - id: locate_and_wrap_run_layer
    content: "`index.html`にDash用`run-host`を追加し、`run-layer`を1個だけ共有できる構造にする（ID重複回避）。"
    status: pending
  - id: dash_enter_exit_dom_move
    content: "`dashGameScreen.enter()/exit()`で`run-layer`をDashへDOM移動/復帰する（元親・元位置を保存）。"
    status: pending
  - id: dash_background_runner_visuals
    content: "`dashGameScreen.updateFrame()`末尾で背景スクロール+runner tier+speed-linesを通常モード式で更新し、Dashの`playerSpeed`に接続する。"
    status: pending
  - id: enemy_chase_css_cues
    content: "`updateHud()`の`proximityState`を`screen.dataset.enemyState`へ同期し、CSSでdanger/caution時の圧迫・揺れ・スピード線強調を付与する（新アセットなし）。"
    status: pending
  - id: dash_layering_safety
    content: Dash時のみ`run-layer`を背面固定・`pointer-events:none`・z-index整理し、入力UIの可読性/操作性を維持する。
    status: pending
isProject: false
---

## 前提（現状把握）

- **通常モードは`run-layer`が既に完成**
  - `gameScreen.update()`で背景オフセット更新（px変換・ループ）を実施しています（例: `bgFactor=42`,`loopWidthPx=1200`）。

```540:570:c:\calculation-sprint\src\screens\gameScreen.js
  update(dtMs) {
    if (isReviewModeActive(gameState)) {
      return;
    }
    const dtSec = dtMs / 1000;
    // ...
    gameState.distanceM += gameState.speedMps * dtSec;
    const bgFactor = 42;
    const loopWidthPx = 1200;
    const isBgFrozen = domRefs.game.runWorld?.classList.contains('stumble-freeze');
    if (!isBgFrozen) {
      const boostRatio = Math.max(0, this.bgBoostRemainingMs / BG_BOOST_DURATION_MS);
      const easedBoost = boostRatio * (2 - boostRatio);
      const farBoost = BG_FAR_SPEED_FACTOR + BG_BOOST_FAR_DELTA * easedBoost;
      const nearBoost = BG_NEAR_SPEED_FACTOR + BG_BOOST_NEAR_DELTA * easedBoost;
      const baseOffset = gameState.speedMps * dtSec * bgFactor;
      this.bgOffsetFarPx -= baseOffset * farBoost;
      this.bgOffsetNearPx -= baseOffset * nearBoost;
      if (this.bgOffsetFarPx <= -loopWidthPx) {
        this.bgOffsetFarPx += loopWidthPx;
      }
      if (this.bgOffsetNearPx <= -loopWidthPx) {
        this.bgOffsetNearPx += loopWidthPx;
      }
    }
```

- `gameScreen.render()`で`backgroundPositionX`とランナー速度tierクラス切替を実施しています。

```608:688:c:\calculation-sprint\src\screens\gameScreen.js
    if (domRefs.game.runBgFar) {
      const bgOffset = isReviewModeActive(gameState) ? 0 : this.bgOffsetFarPx;
      const parallaxFar = this.worldParallax?.far ?? 1;
      domRefs.game.runBgFar.style.backgroundPositionX = `${(bgOffset * parallaxFar).toFixed(2)}px`;
    }
    if (domRefs.game.runBgNear) {
      const bgOffset = isReviewModeActive(gameState) ? 0 : this.bgOffsetNearPx;
      const parallaxNear = this.worldParallax?.near ?? 1;
      domRefs.game.runBgNear.style.backgroundPositionX = `${(bgOffset * parallaxNear).toFixed(2)}px`;
    }
    // ... speed-lines / is-fast / is-rapid / speed-glow ...
    if (domRefs.game.runner) {
      const speedValue = gameState.speedMps;
      let nextTier = 'runner-speed-high';
      if (speedValue < 3.0) {
        nextTier = 'runner-speed-low';
      } else if (speedValue < 6.0) {
        nextTier = 'runner-speed-mid';
      }
      if (this.runnerSpeedTier !== nextTier) {
        domRefs.game.runner.classList.remove('runner-speed-low','runner-speed-mid','runner-speed-high');
        domRefs.game.runner.classList.add(nextTier);
        this.runnerSpeedTier = nextTier;
      }
    }
    if (domRefs.game.runnerWrap) {
      const translateX = isReviewModeActive(gameState) ? 0 : this.runnerX;
      domRefs.game.runnerWrap.style.transform = `translateX(${translateX.toFixed(2)}px)`;
    }
```

- **Dash Runはロジックはあるがビジュアル層が欠けている**
  - `dashGameScreen.updateFrame()`は距離/速度/敵接近を更新し`updateHud()`で接近UIを更新（敵接近率は既に算出済み）しています。

```150:173:c:\calculation-sprint\src\screens\dashGameScreen.js
    const maxGap = Math.max(0.001, collisionThreshold * 2);
    const clampedGap = Math.max(0, Math.min(this.enemyGapM, maxGap));
    const proximityRatio = 1 - clampedGap / maxGap;
    const proximityPercent = Math.round(proximityRatio * 100);
    let proximityState = 'safe';
    let proximityLabel = '安全';
    if (proximityRatio >= 0.7) {
      proximityState = 'danger';
      proximityLabel = '危険';
    } else if (proximityRatio >= 0.4) {
      proximityState = 'caution';
      proximityLabel = '注意';
    }
    if (domRefs.dashGame.enemyWrap) {
      domRefs.dashGame.enemyWrap.dataset.state = proximityState;
    }
```

- ただし`dashGameScreen.render()`は空で、`#dash-game-screen`には`run-layer`自体が存在しません（`index.html`の`run-layer`は`#game-screen`内のみ）。

```161:246:c:\calculation-sprint\index.html
      <section id="dash-game-screen" class="screen screen-dash" hidden>
        <header class="screen-header dash-header">
          <!-- ... Dash UI ... -->
        </header>
        <div class="screen-main stage-card">
          <!-- ... question / input ... -->
        </div>
        <footer class="screen-footer dash-footer">
          <!-- ... streak / enemy proximity ... -->
        </footer>
      </section>
```

```384:402:c:\calculation-sprint\index.html
        <div class="run-layer" aria-hidden="true">
          <div class="run-world">
            <div class="run-bg run-bg--far"></div>
            <div class="run-bg run-bg--near"></div>
            <div class="run-ground"></div>
            <div class="speed-lines"></div>
            <div class="runner-wrap">
              <span class="runner-shadow"></span>
              <img id="runner-sprite" class="runner-bob" src="assets/runner/runner.png" alt="runner" />
            </div>
          </div>
        </div>
```

## 1) そのまま再利用する（置換しない）

- **背景スクロールの考え方（px変換・ループ）**: `bgFactor=42` / `loopWidthPx=1200`、`BG_FAR_SPEED_FACTOR`/`BG_NEAR_SPEED_FACTOR`の二層パララックス。
- **ランナー演出（CSS）**: `#runner-sprite.runner-bob`のボブ、`runner-speed-*`で周期変更、`speed-lines`の視覚加速。

```294:300:c:\calculation-sprint\styles\style.scoped.css
}.calc-sprint .run-layer {
  padding: 0 16px 18px;
  height: min(48vh, 420px);
  overflow: hidden;
  position: relative;
  z-index: 1;
  transform: translateY(-12px);
}
```

```1112:1180:c:\calculation-sprint\styles\style.scoped.css
}.calc-sprint .run-bg {
  position: absolute;
  inset: 0;
  background-repeat: repeat-x;
  background-position: center bottom;
  background-size: auto 100%;
  will-change: background-position;
}
}.calc-sprint .run-bg--far { z-index: 1; opacity: 0.78; }
}.calc-sprint .run-bg--near { z-index: 2; }
```

```1233:1285:c:\calculation-sprint\styles\style.scoped.css
}.calc-sprint .runner-wrap { position: absolute; left: 64px; bottom: 24px; width: 64px; height: 64px; z-index: 4; }
}.calc-sprint .run-layer #runner-sprite.runner-bob {
  animation: calc-sprint-runner-bob var(--runner-bob-duration, 0.32s) ease-in-out infinite;
}
}.calc-sprint #runner-sprite.runner-speed-low { --runner-bob-duration: 0.42s; }
}.calc-sprint #runner-sprite.runner-speed-mid { --runner-bob-duration: 0.34s; }
}.calc-sprint #runner-sprite.runner-speed-high { --runner-bob-duration: 0.26s; }
```

- **通常モードの`gameScreen**`: 既存動作を壊さないため、原則ロジックは触らない（Dash統合はDash側で完結）。

## 2) 軽微に適応する（最小の差分で繋ぐ）

### 2.1 `run-layer`の共有（ID重複を回避）

- **狙い**: `#runner-sprite`や`.run-bg--far`等は`domRefs`がグローバルに拾う設計（`byId`/`qs`）なので、**DOM上に`run-layer`は1つだけ**にする。
- **採用方式（ユーザー選択A）**: 画面切替時に既存の`run-layer`を**DOM移動**してDash画面に挿入し、終了時に元へ戻す。
  - 変更箇所
    - `[c:\calculation-sprint\index.html](c:\calculation-sprint\index.html)`: `#dash-game-screen`内に`<div class="run-host" aria-hidden="true"></div>`を追加（UIの見た目は変えず、背面レイヤーの“差し込み口”だけ作る）。
    - `[c:\calculation-sprint\src\screens\dashGameScreen.js](c:\calculation-sprint\src\screens\dashGameScreen.js)`: `enter()`で`run-layer`を`run-host`にappend、`exit()`で元の親へ戻す（元位置はenter時に保存）。

### 2.2 Dash側の“走ってる感”を出す最小レンダー

- **背景スクロール**: `gameScreen.update()`の式をDashに“ほぼそのまま”適用。
  - 置換点: `gameState.speedMps` → `dashGameScreen.playerSpeed`（既にm/s）
  - Boost/stumble等の特殊効果はDashには持ち込まず、まずは2層スクロールだけでOK（差分最小）。
- **ランナー速度tier**: `gameScreen.render()`のtier切替ロジックをDashに移植。
  - 置換点: `gameState.speedMps` → `playerSpeed`
- **speed-lines**: Dashの`playerSpeed`から速度比を作り、通常モード同様にopacity + `is-fast/is-rapid`のクラスを更新。

### 2.3 Dash側の“追われてる感”（UIレイヤーだけ）

Dashは既に`proximityState`（safe/caution/danger）を出しているので（`updateHud()`）、**その状態をDash画面コンテナのdatasetにもコピー**してCSS側で演出を分岐します。

- **データ連携（最小）**
  - Dash画面に `data-enemy-state="safe|caution|danger"` を持たせる（`updateHud()`のタイミングで同期）
- **CSS演出（軽量・新アセットなし）**
  - **危険時の視界圧迫**: `screen-dash[data-enemy-state="danger"] .run-world::after` のopacityを上げる（既存`::after`を“敵プレッシャー”に再利用）。
  - **カメラ微振動**: `danger`時だけ `.run-world` に短い`@keyframes`（1〜2px程度のtranslate）を当てる。
  - **スピード感ブースト**: `caution/danger`で`.speed-lines`のopacity上限を少し上げる（認知上「追われてる=速い」錯覚）。
  - **UIの邪魔をしない**: `run-layer`は`pointer-events:none`、Dashの入力UIは常に上（z-index）。

### 2.4 視覚的連続性（既存テーマhookを流用）

- Dashは距離で`data-area`を更新しています（`updateArea()`）。
- ここに合わせて`run-world[data-bg-theme]`を既存テーマ（`default/theme1/bg_add/bg_sub/bg_mul/bg_div/bg_mix`）へ割当てるだけで、**新アセットなしで背景トーンを同期**できます（見た目がDash背景グラデとズレる場合は`default`固定でも可）。

## 3) 触らない（リスク最小化のため明確に禁止）

- **既存アセット**: `assets/bg/*`, `assets/runner/runner.png` は追加・変更しない。
- **通常モードの挙動**: `[c:\calculation-sprint\src\screens\gameScreen.js](c:\calculation-sprint\src\screens\gameScreen.js)` の既存速度/背景/ランナー演出は原則変更しない（Dash統合のための“共通化リファクタ”はしない）。
- **Dash UIレイアウト**: `#dash-game-screen`内のヘッダ/問題/入力/フッタ構造は維持（run-host追加と背面レイヤーの重ね順のみ調整）。

## 4) 実装手順（人間がそのまま追える手順書）

- **Step 0: 参照ポイント確認**
  - 背景更新式/描画: `[src/screens/gameScreen.js](src/screens/gameScreen.js)` の `update()` / `render()`（上記抜粋）。
  - Dashロジック更新点: `[src/screens/dashGameScreen.js](src/screens/dashGameScreen.js)` の `updateFrame()` と `updateHud()`。
- **Step 1: Dash画面に`run-host`を追加（DOM移動の受け皿）**
  - `[c:\calculation-sprint\index.html](c:\calculation-sprint\index.html)` の `#dash-game-screen`直下（推奨: section先頭）に `run-host`を追加。
  - 目的は“差し込み口”のみ。Dash UIそのものは動かさない。
- **Step 2: Dashのenter/exitで`run-layer`を移動して共有**
  - `[c:\calculation-sprint\src\screens\dashGameScreen.js](c:\calculation-sprint\src\screens\dashGameScreen.js)`
    - `enter()`
      - `domRefs.game.runLayer`（既存の`.run-layer`）の**元親/元位置**を保存
      - `#dash-game-screen .run-host`へappend
      - `runner-bob`と初期tier（例: `runner-speed-mid`）を付与
    - `exit()`
      - 保存した親/位置に戻す（通常モードを壊さない）
- **Step 3: Dashの`updateFrame()`末尾に“ビジュアル更新”を追加**
  - 背景スクロールオフセットを`playerSpeed`から更新（`gameScreen.update()`式を移植）。
  - `backgroundPositionX`へ反映（`gameScreen.render()`式を移植）。
  - ランナーtier、speed-lines、`runWorld.is-fast/is-rapid`等のクラスをDash速度に応じて更新。
- **Step 4: “追われてる感”の状態をCSSへ渡す**
  - `updateHud()`で算出済みの`proximityState`を `domRefs.dashGame.screen.dataset.enemyState` にも書く。
  - CSSは `.screen-dash[data-enemy-state="danger"]` をトリガに、run-worldの揺れ/暗転/赤み/スピード線増強を行う。
- **Step 5: Dash専用の重ね順だけCSSで調整**
  - `[c:\calculation-sprint\styles\style.scoped.css](c:\calculation-sprint\styles\style.scoped.css)`
    - Dash時は `run-layer`を背面固定（例: `position:absolute; inset:0; z-index:0; pointer-events:none;`）
    - Dashの既存UI（header/main/footer）は`position:relative; z-index:1`で前面維持
    - `prefers-reduced-motion`の分岐も必須（既存方針に合わせる）
- **Step 6: 最低限の確認（リグレッション重点）**
  - Dash Run: 背景が動く／ランナーが走る（tier変化）／敵接近で圧迫演出が出る／入力が阻害されない。
  - 通常モード: 画面遷移後も`run-layer`が正しい位置に戻り、既存演出が崩れない。

## 5) リスクと回避策（最小化）

- **ID/selector競合**: `#runner-sprite`や`.run-bg--far`が複数あると`domRefs`が誤参照します。→ `run-layer`は1つをDOM移動で共有。
- **入力阻害**: 背面レイヤーがDash UIを覆う可能性。→ Dash時のみ`run-layer`に`pointer-events:none` + z-index整理。
- **二重ループ**: Dashは独自RAF（`startLoop()`）を持ち、`screenManager`のrenderが頼れません。→ `updateFrame()`内でビジュアル更新を完結させる（Dashだけで成立）。

