# CRIとcontainerdの実際のアーキテクチャ

[前のページ](/infrastracture/kubernetes/internals/container-fundamentals)で、コンテナはnamespaces・cgroups・overlayfsというLinuxカーネルの機能でできていることを見ました。このページでは、kubeletがこれらのカーネル機能をどう組み合わせてコンテナを実際に起動しているのか——**CRI・containerd・shim・runc**というレイヤー構造を見ていきます。

## CRI（Container Runtime Interface）とは

CRIは、kubeletとコンテナランタイムの間の通信を標準化した、**protobuf定義のgRPC API**です。kubeletがクライアント、ランタイム側がサーバーで、通常はUnixドメインソケット（例: `/run/containerd/containerd.sock`）経由でやり取りします。2つのgRPCサービスから成ります。

| サービス | 主なRPC | 役割 |
|---|---|---|
| **RuntimeService** | `RunPodSandbox`, `CreateContainer`, `StartContainer`, `StopContainer`, `RemoveContainer`, `ExecSync`, `Exec`, `Attach`, `PortForward` など | Pod・コンテナのライフサイクル管理、コンテナへの対話的操作 |
| **ImageService** | `PullImage`, `ListImages`, `ImageStatus`, `RemoveImage` | イメージの取得・管理 |

## 歴史的なアーキテクチャ図

次の図は、2017年に作られた初期の`cri-containerd`プロジェクトのアーキテクチャです。

![cri-containerdの歴史的アーキテクチャ図。KubeletからCRIでcri-containerdのimage service/runtime serviceに接続し、cri-containerdはgRPCで別プロセスのcontainerdと通信する。containerdの下にcontainerd shimが複数あり、1つのshimがsandbox containerとcontainer AをまとめてPod A Namespaces・Pod A Cgroupsとして管理し、Pod Bは別のshim・別のnamespace/cgroupを持つ](../../../images/cri-containerd-2017-architecture.png)

*cri-containerdの初期アーキテクチャ（2017年頃）*

| 図の要素 | 意味 |
|---|---|
| Kubelet → CRI → cri-containerd | kubeletがCRI経由でcri-containerdのimage service / runtime serviceを呼ぶ |
| cri-containerd → gRPC → containerd | cri-containerdが、実際の処理をcontainerd本体にgRPCで委譲する |
| ocicni | 当時のcri-containerdが使っていたCNI呼び出し用ライブラリ（CRI-O由来） |
| containerd shim（複数） | containerdが起動する、コンテナの実行を仲介するプロセス |
| sandbox container + container A → 1つのshim | 同じPodに属するコンテナは、1つのshimがまとめて担当する |
| Pod A Namespaces / Pod A Cgroups | そのPod専用のnamespace・cgroup |
| Pod B（別の箱） | 別PodはPod Aとは完全に独立したshim・namespace・cgroupを持つ |

> **この図で今は古くなっている部分**: 2018年、containerd 1.1で**CRIサポートはcontainerd本体に組み込みプラグイン化**され、`cri-containerd`という別バイナリは無くなりました。図にある「cri-containerd⇔containerd間のgRPC」は、今は**同一プロセス内の直接的な関数呼び出し**に置き換わっています。`ocicni`ライブラリも、現在のcontainerdは使っておらず独自のCNI呼び出しロジックを持っています。それ以外の部分（image/runtime serviceの区分、shimがPod単位でグルーピングされる点、Pod間でnamespace/cgroupが完全に分離される点）は、現在も変わらず正しい構造です。

## 現在のアーキテクチャ

現在のcontainerdでは、CRI pluginはcontainerdプロセスに内蔵されており、gRPCのホップは**kubelet⇔containerdの1回だけ**です。

```
Kubelet
  │  CRI（gRPC, 1回だけ）
  ▼
containerd（単一プロセス）
  ├─ CRI plugin（image service / runtime service を実装）
  │     │ 直接の関数呼び出し（gRPCではない）
  │     ▼
  ├─ containerdコア機能
  │     ├─ content store（イメージのレイヤーblobを保存）
  │     ├─ snapshotter（overlayfsでのレイヤー合成。前ページ参照）
  │     └─ metadata store（boltdb）
  │
  ▼  ttRPC（gRPCの軽量版。HTTPスタックを省いてメモリ消費を減らしたプロトコル）
containerd-shim-runc-v2（Podごとに1つ、同じPodのコンテナはまとめて担当）
  │
  ▼
runc（OCI Runtime Specに従ってnamespaces/cgroupsを操作し、プロセスを起動）
```

shimが独立したプロセスとして存在することで、**containerdデーモン自体を再起動・アップグレードしても、動いているコンテナには影響しません**（shimがコンテナプロセスの親であり続けるため）。

## 実際に試してみる: Podを作ったときのCRI呼び出し順序

下のデモでは、「新しいPodを作成」を押すたびに、実際のCRI RPCの呼び出し順序（`RunPodSandbox` → 各コンテナの`PullImage`/`CreateContainer`/`StartContainer`）と、それに対応するnamespace・shimの割り当てを確認できます。複数回押して、Podが違えばshimもnamespaceも完全に独立することを比べてみてください。

<CriCallSequenceDemo />

## まとめ

- CRIは、kubeletとランタイムを標準化するprotobuf/gRPC API（RuntimeServiceとImageServiceの2サービス）
- containerdは元々汎用的なコンテナ管理デーモンで、CRI対応は**内蔵プラグイン**として実装されている。2018年（containerd 1.1）より前は`cri-containerd`という別バイナリが必要で、containerdとgRPCで通信していたが、現在は同一プロセス内の直接呼び出しになっている
- containerdとshim（`containerd-shim-runc-v2`）は**ttRPC**（gRPCの軽量版）で通信する
- shimは1つのPodに属するコンテナをまとめて担当し、containerdデーモンの再起動から独立して生き続ける
- 最終的にruncが、[前のページ](/infrastracture/kubernetes/internals/container-fundamentals)で見たnamespaces・cgroups・overlayfsを実際に操作してコンテナプロセスを起動する

## 参考

- [Introducing Container Runtime Interface (CRI) in Kubernetes](https://kubernetes.io/blog/2016/12/container-runtime-interface-cri-in-kubernetes/)
- [containerd docs – CRI Architecture](https://containerd.io/docs/2.1/cri/architecture/)
- [containerd docs – Runtime V2](https://containerd.io/docs/2.3/runtime-v2/)
- [containerd/cri: Moved to containerd/containerd (merge history)](https://github.com/containerd/cri)
