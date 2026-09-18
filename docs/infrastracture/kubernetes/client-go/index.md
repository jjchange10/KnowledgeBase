# client-go基礎（Programming Kubernetes 第3章）

前のセクションでは、Kubernetes APIが「HTTPでやり取りするRESTfulなAPI」であることを見てきました。このセクションでは、そのAPIをGo言語のプログラムから扱うための標準ライブラリ **client-go** の基礎を、書籍『Programming Kubernetes』第3章「Basics of client-go」をベースに学びます。

<div class="horizontal-cards">

<a class="simple-card" href="/KnowledgeBase/infrastracture/kubernetes/client-go/getting-started">
  <div class="card-title">クライアントの作り方</div>
  <div class="card-desc">client-go・api・apimachinery3つのリポジトリの役割と、kubeconfigからクライアントを作るまで。</div>
</a>

<a class="simple-card" href="/KnowledgeBase/infrastracture/kubernetes/client-go/objects-and-clientsets">
  <div class="card-title">Goの中のKubernetesオブジェクトとClient Set</div>
  <div class="card-desc">TypeMeta・ObjectMeta・spec/statusという共通構造と、リソースごとのクライアントインターフェース。</div>
</a>

<a class="simple-card" href="/KnowledgeBase/infrastracture/kubernetes/client-go/informers-workqueue">
  <div class="card-title">InformerとWork Queue</div>
  <div class="card-desc">watchを直接使わずインメモリキャッシュで効率化するInformerの仕組みと、コントローラのキュー実装。</div>
</a>

<a class="simple-card" href="/KnowledgeBase/infrastracture/kubernetes/client-go/api-machinery">
  <div class="card-title">API Machinery（Kind・GVK・GVR・Scheme）</div>
  <div class="card-desc">Golangの型からHTTPパスまでを結びつけるScheme・RESTMapperの仕組みを、実際に手を動かして辿る。</div>
</a>

</div>

## このセクションのスコープ

- 対象は『Programming Kubernetes』第3章の内容（client-goでの標準リソースへのアクセス）
- ユーザー定義のリソース（Custom Resource）を自作する話は次章（第4章）以降で扱うため、ここでは触れません
- クラスタ構築やHelmなどの運用寄りの内容は [はじめに](/infrastracture/kubernetes/quickstart) を参照してください
