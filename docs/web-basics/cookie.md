# Cookie

Cookieは、サーバーの指示でブラウザに保存される小さなキー・バリュー形式のデータです。ブラウザは保存したCookieを、対応するドメインへのリクエストのたびに自動で付けて送信します。この「自動で送られる」という性質が、ログイン状態の維持にも、CSRFのような攻撃にも使われる理由です。

## やり取りの流れ

```
Server → Client:  Set-Cookie: sessionId=abc123; Path=/; HttpOnly; Secure; SameSite=Lax
Client → Server:  Cookie: sessionId=abc123
```

サーバーがレスポンスヘッダーで `Set-Cookie` を送ると、ブラウザはそれを保存し、以後同じサイトへのリクエストのヘッダーに自動で `Cookie: ...` を含めます。JavaScriptから明示的に送信する必要はありません。

## 主な属性

| 属性 | 意味 |
|---|---|
| `Expires` / `Max-Age` | 有効期限。指定しなければブラウザを閉じるまでの「セッションCookie」になる |
| `Domain` | Cookieを送る対象ドメイン |
| `Path` | Cookieを送る対象パス |
| `Secure` | HTTPS通信のときだけ送信する。盗聴によるCookie漏洩を防ぐ |
| `HttpOnly` | JavaScript（`document.cookie`）からアクセスできなくする。[XSS](/security/xss)が起きてもCookieを盗まれにくくする |
| `SameSite` | 他サイトを起点としたリクエストにCookieを送るかどうかを制御する。`Strict` / `Lax` / `None` があり、[CSRF](/security/csrf)対策として重要 |

## いつ使うか

- ログインセッションの維持（[セッション](/web-basics/session)を参照）
- 「ログインしたままにする」のような、ユーザーごとの設定の保持
- アクセス解析やトラッキング（サードパーティCookie。近年はブラウザ側の制限が強まっている）

## ファーストパーティ Cookie とサードパーティ Cookie

- **ファーストパーティCookie**: 今見ているサイト自身のドメインが発行するCookie。ログイン状態の維持など。
- **サードパーティCookie**: 今見ているサイトとは別のドメイン（広告配信サーバーなど）が発行するCookie。複数サイトをまたいだ行動追跡に使われてきましたが、プライバシー上の懸念から主要ブラウザで段階的に制限・廃止されています。

## セキュリティ上のポイント

- セッションIDのようなセンシティブな値を保持するCookieには、最低限 `HttpOnly` と `Secure` を付ける
- クロスサイトでの意図しない送信を防ぐため、可能な限り `SameSite=Lax` 以上を設定する
- Cookieの値自体を暗号化・署名して、クライアント側で改ざんできないようにする（フレームワークの標準機能を使うのが安全）
