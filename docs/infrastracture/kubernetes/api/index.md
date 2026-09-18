# Kubernetes API（Programming Kubernetes）

`kubectl` や各種コントローラは、すべて1つの窓口——**Kubernetes APIサーバー**——を通してクラスタとやり取りしています。このセクションでは、書籍『Programming Kubernetes』の第2章「Kubernetes API Basics」をベースに、APIサーバーが何をしているのか、どういう語彙（Kind・Resource・GVR/GVKなど）で設計されているのか、リクエストが来たときに内部で何が起きているのかを、実際にブラウザで動かせるデモを交えて学びます。

<div class="horizontal-cards">

<a class="simple-card" href="/KnowledgeBase/infrastracture/kubernetes/api/basics">
  <div class="card-title">API基礎（Kind・Resource・GVR/GVK）</div>
  <div class="card-desc">Kind・APIGroup・Version・Resourceの違いと、HTTPパスを決めるGVR/GVKの組み立て方。</div>
</a>

<a class="simple-card" href="/KnowledgeBase/infrastracture/kubernetes/api/request-lifecycle">
  <div class="card-title">リクエスト処理と宣言的な状態管理</div>
  <div class="card-desc">認証・認可・admission・validationの処理チェーンと、spec/statusによる宣言的管理の仕組み。</div>
</a>

</div>

## このセクションのスコープ

- 対象は『Programming Kubernetes』第2章の内容（APIサーバーのHTTPインターフェース、API用語、内部処理の流れ）
- 実際にクラスタを構築しなくても、ブラウザ内の擬似的な計算・シミュレーションで挙動を体験できるようにしています
- クラスタ構築やHelmなどの運用寄りの内容は [はじめに](/infrastracture/kubernetes/quickstart) や [Helm](/infrastracture/kubernetes/helm/) を参照してください
