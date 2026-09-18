# CLAUDE.md

このリポジトリは VitePress 製の個人ナレッジサイト（`jjchange10/KnowledgeBase`、GitHub Pagesで公開）。`docs/` 配下がコンテンツ、`docs/.vitepress/` が設定・テーマ。

## コマンド

```bash
npm run docs:dev     # ローカル確認 (http://localhost:5173/KnowledgeBase/)
npm run docs:build    # ビルド確認（コミット前に必ず実行する）
python3 scripts/check-bold-markdown.py   # 太字崩れチェック（後述）
```

## 「実演デモ付き学習ページ」の作り方

`docs/security/`（SQLi, XSS, CSRF, IDOR）と `docs/web-basics/`（セッション, Cookie, OAuth/OIDC, 暗号化）は、文章だけでなく「その場で試して理解できる」インタラクティブなデモを埋め込む形で統一している。新しいトピックを追加するときはこの型に従う。

### 方針

- **可能な限り本物の計算・本物のAPIを使う。**見せかけのシミュレーションより説得力があり、正確でもある。
  - 暗号化デモは `crypto.subtle`（Web Crypto API）で本物のAES-GCM/SHA-256を計算している
  - RSAデモは実際に `n = p*q`, `φ(n)`, 拡張ユークリッド互除法で `d` を計算し、BigIntで `m^e mod n` を計算している（見た目の数字を並べているだけではない）
  - セキュリティ系デモ（SQLi/XSS/CSRF/IDOR）だけは例外的に「疑似データに対する擬似的な脆弱/安全ロジック」を使っている（実際に脆弱なサーバーを立てるわけにはいかないため）。この場合も、実際の脆弱性のロジック（文字列連結でクエリが壊れる条件など）を忠実に再現すること。
- 脆弱/安全、成功/失敗のように**対比できる2パターン以上を必ず用意**し、切り替えて試せるようにする（タブ切り替えボタン）。
- サーバーには一切送信しない。すべてブラウザ内のJavaScriptで完結させる（安全に公開できるようにするため）。

### 手順

1. **Vueコンポーネントを作る**: `docs/.vitepress/theme/components/XxxDemo.vue`
   - 共通CSSクラス（`docs/.vitepress/theme/custom.css` の「脆弱性デモ 共通スタイル」セクション）を使う。新しく `<style scoped>` を書く必要はほぼ無い。
     - `demo-panel`: デモ全体を囲む枠
     - `demo-mode-switch` / 中の `button`（`:class="{ active: ... }"`）: モード切り替えタブ
     - `demo-form-row` / `label` / `input`: 入力フォーム
     - `demo-examples` / `demo-link-btn`: 「通常の入力例」「攻撃ペイロード例」のようなワンクリック例
     - `demo-run-btn`: 実行ボタン
     - `demo-box` / `demo-box-label`: 途中経過（組み立てられるクエリ、鍵生成結果など）の表示
     - `demo-result-box`（`.danger` / `.safe` 修飾クラス）/ `demo-result-message`: 実行結果
     - `demo-log`: ログを複数行積み上げて表示したいとき
   - Composition API + `<script setup lang="ts">` で書く
2. **テーマに登録**: `docs/.vitepress/theme/index.ts` の `enhanceApp` で `app.component('XxxDemo', XxxDemo)`
3. **Markdownページを書く**: `docs/security/xxx.md` または `docs/web-basics/xxx.md`。次の型に沿う。
   ```
   # タイトル

   概要（1〜2段落）

   ## 発生する条件 / 仕組み
   箇条書きや疑似コードで説明

   ## 実際に発生させてみる / 実際に試してみる
   デモの使い方を一言説明 → <XxxDemo />

   ### 何が起きたか / 計算の流れ
   デモの結果が何を意味するかを解説

   ## 対策 / まとめ
   ```
4. **ナビ・サイドバーに追加**: `docs/.vitepress/config.mts` の `themeConfig.sidebar['/security/']` または `['/web-basics/']` の `items` に追記
5. **セクションのindexにカードを追加**: `docs/security/index.md` または `docs/web-basics/index.md`（`simple-card` パターン、`custom.css` 側で定義済み）
6. **ビルド確認**: `npm run docs:build` が通ることを確認
7. **ブラウザで実際に動かして確認**: `npm run docs:dev` → claude-in-chrome 等で該当ページを開き、**両方のモード（脆弱/安全、成功/失敗）を実際にクリックして**結果が正しいことを目で見て確認する。ビルドが通ることと、ロジックが正しいことは別物。
8. **太字崩れチェック**: `python3 scripts/check-bold-markdown.py` を実行し、0件になっていることを確認してからコミットする

### 既知の落とし穴: Markdownの太字が日本語で崩れる

`**太字**` の直後に句読点なしで日本語（ひらがな・漢字など）が続くと、CommonMarkの punctuation-flanking rule により太字として閉じられず、`**` がそのまま文字列として表示されることがある。

例: `**OIDC（OpenID Connect）は「認証」**のためのプロトコル` → 閉じの `**` の直前が `」`（句読点）、直後が `の`（非句読点）なので right-flanking にならず壊れる。

**対策**: 太字で囲む範囲を、直後の助詞まで含めて句読点や文末で終わるように調整する（例: `**「認証」のためのプロトコル**`）。新規・変更したMarkdownは必ず `python3 scripts/check-bold-markdown.py` でチェックしてからコミットする。

## 書籍の図（Figureなど）を伴う説明の書き方

`docs/infrastracture/kubernetes/api/` のように、書籍の図をそのままページに埋め込むケースでは、**図の箱の数・名前・順番と、本文の説明を必ず1対1で対応させる**こと。

背景: 最初にKubernetes APIのリクエスト処理パイプラインを書いたとき、本文は「フィルタチェーン→admission（mutating→validating）+validation→etcd」のように3〜4個にまとめて説明していたが、実際の図（Figure 2-5）は「API HTTP handler / authn & authz / Mutating admission / Object schema validation / Validating admission / Persisting to etcd」という**6つの独立した箱**だった。本文が図をぼかして要約してしまうと、読者は「図のこの箱は結局何をしているのか」が分からなくなる。この反省から、以後は次の型を徹底する。

1. 図を貼ったら、その直後に **箱の数と同じ行数の表** を置く（列は「# / 図の英語ラベルそのまま / やっていること」）
2. 表の各行は、要約したり複数の箱をまとめたりせず、**図に描かれている箱の名前をそのまま**日本語の説明に対応させる
3. 同じ流れを再現するインタラクティブデモがある場合、**デモのステージ数・順番・ラベルも図と完全に一致させる**（デモだけ簡略化して段階数が減っている、といった不一致を作らない）
4. ページ末尾の「まとめ」に書く要約文も、この表の段階数・順番と矛盾しないようにする（まとめだけ古い粒度のまま、ということが起きやすいので要注意）

これは「実演デモ付き学習ページ」の型（前セクション）に対する追加ルールであり、書籍の図を扱うページ全般に適用する。

## Git運用の注意

- `docs/.vitepress/config.mts` と `docs/index.md` は更新頻度が高いファイル。pushする前に `git pull --rebase origin main` でリモートの変更を取り込み、コンフリクトがあれば両方の変更を残す形で解消すること。
- `.DS_Store` は `.gitignore` 済み。万一 `git status` に出てきたら `git rm --cached` で追跡から外す（ローカルファイルは消さない）。
- 無関係な未コミットファイル（作業中の別トピックなど）を見つけても、指示されない限り一緒にコミットしない。
