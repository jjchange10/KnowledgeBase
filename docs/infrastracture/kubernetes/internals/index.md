# Kubernetesの内部構造

[Kubernetes API](/infrastracture/kubernetes/api/)や[client-go](/infrastracture/kubernetes/client-go/)のセクションは「Kubernetesをどう拡張・操作するか」というプログラミング寄りの内容でした。このセクションは方向性を変えて、**Kubernetesを実際に動かしている低レイヤーの技術（コンテナランタイム、Linuxカーネルの機能、ネットワーキングなど）を、公式ドキュメント・仕様書ベースで深掘り**します。

特定の書籍1冊をベースにするのではなく、Kubernetes公式ドキュメント・Linuxカーネルのドキュメント（man7, kernel.org）・OCI/CRI仕様など、一次情報を都度参照しながらまとめています。

<div class="horizontal-cards">

<a class="simple-card" href="/KnowledgeBase/infrastracture/kubernetes/internals/container-fundamentals">
  <div class="card-title">コンテナの正体: namespaces・cgroups・overlayfs</div>
  <div class="card-desc">「コンテナ」はVMではなく普通のLinuxプロセス。それを成立させているカーネルの3つの機能を、実際のアルゴリズムを再現したデモ付きで学ぶ。</div>
</a>

<a class="simple-card" href="/KnowledgeBase/infrastracture/kubernetes/internals/cri-containerd">
  <div class="card-title">CRIとcontainerdの実際のアーキテクチャ</div>
  <div class="card-desc">kubeletがnamespaces/cgroupsをどう組み立てているか。CRI・containerd・shim・runcのレイヤー構造と、実際のCRI呼び出し順序をデモで確認。</div>
</a>

<a class="simple-card" href="/KnowledgeBase/infrastracture/kubernetes/internals/runc">
  <div class="card-title">runcとOCI Runtime Spec</div>
  <div class="card-desc">config.json・create/startの2段階分離・exec fifoによる同期の仕組み。RustによるOCI実装youkiとの違いも整理。</div>
</a>

</div>

## このセクションのスコープ

- コンテナランタイム（CRI/containerd/runc）、kubeletの内部動作、ネットワーキング（kube-proxy/CNI）、スケジューラの内部動作を、実際に手を動かしながら順に深掘りしていく予定です
- ユーザー定義のリソース拡張（Custom Resource、Operatorなど）は[client-go基礎](/infrastracture/kubernetes/client-go/)を参照してください
