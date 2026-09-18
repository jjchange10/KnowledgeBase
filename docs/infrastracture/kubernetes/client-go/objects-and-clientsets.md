# Goの中のKubernetesオブジェクトとClient Set

前ページでPodを取得するコードを見ました。ここでは、取得した結果（`pod`変数）がGoの世界でどんな形をしているのか、そしてリソースの種類ごとに用意されている `clientset.CoreV1()` のようなクライアントインターフェースの中身を見ていきます。

## Kubernetesオブジェクトの正体: `runtime.Object`

あるKindのインスタンスであるKubernetesリソース（オブジェクト）は、Goでは構造体（struct）として表現されます。フィールドはKindごとに違いますが、すべてのオブジェクトは`k8s.io/apimachinery/pkg/runtime`パッケージの`runtime.Object`という、たった2つのメソッドを持つシンプルなインターフェースを満たします。

| メソッド | 役割 |
|---|---|
| `GetObjectKind() schema.ObjectKind` | このオブジェクトのGVK（GroupVersionKind）を取得・設定するためのアクセサを返す |
| `DeepCopyObject() Object` | 元のオブジェクトとメモリを一切共有しないクローン（ディープコピー）を作る |

つまり、「Kubernetesオブジェクトである」とは、**自分の型情報を返せて、複製できる**というだけのことです。ディープコピーは、元のオブジェクトを書き換えずに済ませたいときに使われます（後述の「Informerから受け取ったオブジェクトを直接書き換えてはいけない」というルールもこれが理由です）。

## TypeMeta: KindとVersionを保持する部分

`k8s.io/api`のオブジェクトは、`metav1.TypeMeta`という構造体を埋め込むことで`schema.ObjectKind`インターフェースを実装しています。

```go
type TypeMeta struct {
    Kind string `json:"kind,omitempty"`
    APIVersion string `json:"apiVersion,omitempty"`
}
```

実際のPodの定義はこうなっています。

```go
type Pod struct {
    metav1.TypeMeta   `json:",inline"`
    metav1.ObjectMeta `json:"metadata,omitempty"`
    Spec   PodSpec   `json:"spec,omitempty"`
    Status PodStatus `json:"status,omitempty"`
}
```

これはYAMLで見慣れた次の形とちょうど対応します。

```yaml
apiVersion: v1
kind: Pod
metadata:
  namespace: default
  name: example
spec:
  containers:
  - name: hello
    image: debian:latest
```

> **コアグループだけ特別な理由（歴史的経緯）**: Podのようにごく初期からあるKindは、空文字列で表される**コアグループ（レガシーグループ）に属する**ため、`apiVersion`は単に`"v1"`です。後からAPI groupの概念が追加されたとき、グループ名をスラッシュ区切りで前に付ける方式（例: `apps/v1`）になりました。つまり`apiVersion`というフィールド名は実は正確ではなく、実際にはAPI groupとversionの両方を格納しています。これは`apiVersion`が定義された当時、コアグループしか存在しなかったことによる歴史的な名残です。

もう1つ意外な点として、`clientset.CoreV1().Pods("book").Get(...)`で取得したPodオブジェクトは、メモリ上では`Kind`と`APIVersion`が**空のまま**です。これらのフィールドは、JSONやprotobufとして実際に送受信される瞬間にだけ、クライアント（正確にはversioning serializer）によって自動的に埋められます。

### では、KindとGroupはどうやって決まるのか

一見、Kindは単にGoの型名（リフレクションで取れる）、Groupは単にGoのパッケージ名に見えます。実際ほとんど（本文いわく99%）はその通りですが、例外があります。

- コアグループはグループ名が空文字列なので、パッケージ名とは一致しない
- `rbac.authorization.k8s.io`グループの型は`k8s.io/api/rbac.authorization.k8s.io`ではなく`k8s.io/api/rbac`パッケージにある

この対応関係を正確に管理しているのが**scheme**という仕組みです。次のページ（API Machinery）で詳しく扱います。

## ObjectMeta: 名前・namespace・ラベルなどの共通メタデータ

ほとんどのトップレベルオブジェクトは、`TypeMeta`に加えて`metav1.ObjectMeta`も持っています。

```go
type ObjectMeta struct {
    Name string
    Namespace string
    UID types.UID
    ResourceVersion string
    CreationTimestamp Time
    DeletionTimestamp *Time
    Labels map[string]string
    Annotations map[string]string
    ...
}
```

JSON/YAMLでは`metadata`の下に対応します。この中の`resourceVersion`は、[前のページで扱った「Optimistic Concurrency」](/infrastracture/kubernetes/api/request-lifecycle)と同じもので、client-goのコードから直接読み書きすることはほとんどありませんが、システム全体を成立させている重要なフィールドの1つです。`ObjectMeta`を埋め込むすべてのオブジェクトは、etcd内の1つのキーに対応しており、`resourceVersion`はそのキーの更新履歴に由来します。

## specとstatus

[前のページ](/infrastracture/kubernetes/api/request-lifecycle)で見た通り、ほぼすべてのトップレベルオブジェクトは`spec`（ユーザーの望み）と`status`（その望みの結果、通常はコントローラが埋める）という2つのセクションを持ちます。ただし例外もあり、コアグループの`Endpoints`や、RBACの`ClusterRole`のようなオブジェクトには`spec`/`status`の区別がありません。

## Client Set: リソースごとのクライアント一式

`kubernetes.NewForConfig(config)`で得られる`clientset`は、複数のAPI groupやリソースに対するクライアントをまとめて提供する**クライアントセット**です。`k8s.io/api`にある、ほぼすべてのリソース（`APIServices`やカスタムリソース定義など一部の例外を除く）にアクセスできます。

主なインターフェースは次のような構造です。

```go
type Interface interface {
    Discovery() discovery.DiscoveryInterface
    AppsV1() appsv1.AppsV1Interface
    AppsV1beta1() appsv1beta1.AppsV1beta1Interface
    AppsV1beta2() appsv1beta2.AppsV1beta2Interface
    AuthenticationV1() authenticationv1.AuthenticationV1Interface
    ...
}
```

以前は`Apps() appsv1.AppsV1Interface`のようなバージョンを省略したメソッドもありましたが、Kubernetes 1.14（client-go 11.0）で非推奨になりました。使うAPI groupのバージョンは明示的に指定するのが良い作法とされています。

> **昔あった「internal client」の話**: 過去のKubernetesには、APIのバージョンを抽象化するための「internal」という汎用の中間表現とその変換ロジックがありました。バージョン変更を1行で済ませたいという狙いでしたが、変換ロジックの複雑さに見合う効果がなく、結局は廃止されました。現在の`k8s.io/api`・`k8s.io/client-go`には、internalバージョンもinternal client も存在しません。

各`AppsV1beta1()`のようなGroupVersionメソッドの先には、リソースごとのインターフェースがあります。

```go
type AppsV1beta1Interface interface {
    RESTClient() rest.Interface
    ControllerRevisionsGetter
    DeploymentsGetter
    StatefulSetsGetter
}

type DeploymentsGetter interface {
    Deployments(namespace string) DeploymentInterface
}

type DeploymentInterface interface {
    Create(*v1beta1.Deployment) (*v1beta1.Deployment, error)
    Update(*v1beta1.Deployment) (*v1beta1.Deployment, error)
    UpdateStatus(*v1beta1.Deployment) (*v1beta1.Deployment, error)
    Delete(name string, options *v1.DeleteOptions) error
    DeleteCollection(options *v1.DeleteOptions, listOptions v1.ListOptions) error
    Get(name string, options v1.GetOptions) (*v1beta1.Deployment, error)
    List(opts v1.ListOptions) (*v1beta1.DeploymentList, error)
    Watch(opts v1.ListOptions) (watch.Interface, error)
    Patch(name string, pt types.PatchType, data []byte, subresources ...string) (result *v1beta1.Deployment, err error)
    DeploymentExpansion
}
```

リソースがnamespace scopedかcluster scopedかによって、`Deployments(namespace string)`のようにnamespace引数があるかどうかが変わります。

### ステータスサブリソース: `UpdateStatus`

Deploymentは`/status`サブリソースを持っています。つまり`/apis/apps/v1beta1/namespaces/ns/deployments/name`への更新は`spec`だけを変更でき、`/apis/apps/v1beta1/namespaces/ns/deployments/name/status`への更新は`status`だけを変更できます。これは「specの変更は人間が行い、statusの変更はコントローラが行う」というように、**用途ごとに別々の権限を設定できるようにするため**の分離です。

### 一覧削除と絞り込み

`DeleteCollection`はnamespace内の複数オブジェクトを一括削除できます。`ListOptions`の`LabelSelector`・`FieldSelector`で、削除・一覧対象を絞り込めます。

### Watch

`Watch`は、追加・削除・更新といった変更をイベントとして受け取るインターフェース（`watch.Interface`）を返します。

```go
type Interface interface {
    Stop()
    ResultChan() <-chan Event
}

type EventType string
const (
    Added    EventType = "ADDED"
    Modified EventType = "MODIFIED"
    Deleted  EventType = "DELETED"
    Error    EventType = "ERROR"
)

type Event struct {
    Type   EventType
    Object runtime.Object
}
```

ただし、このインターフェースを直接使うのは実践では避けるべきとされています。次のページで扱う**Informer**が、このWatchをより安全かつ効率的に使うための標準的な方法です。

### Client Expansion / Client Options

`DeploymentExpansion`は空のインターフェースで、独自のクライアントメソッドを追加するための拡張ポイントですが、現在ではほとんど使われていません（代わりにコード生成側の仕組みである`client-gen`のタグ機能が使われます）。

クライアントセットを作るときに設定できる主なオプションは次の通りです。

| オプション | 内容 |
|---|---|
| `AcceptContentTypes` / `ContentType` | JSONではなくprotobufをワイヤーフォーマットに使う（JSONより省スペース・低CPU負荷） |
| `UserAgent` | どのクライアントからのリクエストかをサーバー側のログ・メトリクスで区別するための識別子 |
| `QPS` / `Burst` | クライアント側のレート制限（デフォルトはQPS=5、Burst=10） |
| `Timeout` | リクエストのタイムアウト（未設定時、APIサーバー側は非long-runningリクエストを60秒でタイムアウトさせる） |

## まとめ

- Kubernetesオブジェクトは、GVKを返せて（`GetObjectKind`）複製できる（`DeepCopyObject`）という`runtime.Object`インターフェースを満たすGoの構造体
- `TypeMeta`（Kind・APIVersion）と`ObjectMeta`（名前・namespace・ラベルなど）が、ほぼすべてのオブジェクトに共通する型
- メモリ上のオブジェクトはKind/APIVersionが空で、ワイヤーに送信される瞬間にだけ埋められる。この対応関係を管理するのが「scheme」
- `clientset`は`AppsV1()`のようなAPI group・バージョンごとのインターフェースを経由して、リソースごとの`Create`/`Get`/`List`/`Update`/`UpdateStatus`/`Delete`/`Watch`/`Patch`を提供する
- `Watch`を直接使うのは推奨されず、次に見る**Informer**を使うのが標準的な方法
