# セキュリティ

Webアプリケーションの代表的な脆弱性について、「どういう時に発生するか」「実際に発生させるとどうなるか」「どう対策するか」を一つの型でまとめています。文章だけでなく、その場で動かせるデモを通して挙動を確認できます。

<div class="horizontal-cards">

<a class="simple-card" href="/KnowledgeBase/security/sql-injection">
  <div class="card-title">SQLインジェクション</div>
  <div class="card-desc">入力値をSQL文にそのまま連結した場合に、クエリの構造自体を書き換えられてしまう脆弱性。</div>
</a>

<a class="simple-card" href="/KnowledgeBase/security/xss">
  <div class="card-title">XSS</div>
  <div class="card-desc">入力値をエスケープせずに描画した場合に、任意のHTML/JavaScriptを実行されてしまう脆弱性。</div>
</a>

<a class="simple-card" href="/KnowledgeBase/security/csrf">
  <div class="card-title">CSRF</div>
  <div class="card-desc">ログイン中のユーザーに、本人の意図しないリクエストを別サイト経由で送信させられてしまう脆弱性。</div>
</a>

<a class="simple-card" href="/KnowledgeBase/security/broken-access-control">
  <div class="card-title">認可不備（IDOR）</div>
  <div class="card-desc">所有者チェックが抜けていることで、IDを変えるだけで他人のデータにアクセスできてしまう脆弱性。</div>
</a>

</div>

## 今後追加予定

- SSRF（サーバーサイドリクエストフォージェリ）
- 安全でないデシリアライゼーション
- オープンリダイレクト
