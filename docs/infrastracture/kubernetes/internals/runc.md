# runcとOCI Runtime Spec

[前のページ](/infrastracture/kubernetes/internals/cri-containerd)で、containerdのshimが最終的にruncを呼び出すところまで見ました。このページでは、コンテナ起動の一番下にある**runc**と、それが実装している**OCI Runtime Specification**を見ていきます。

## runcとは

runcは、**OCI Runtime Specificationの参照実装**であるCLIツールです。実体は`libcontainer`というGoパッケージ（元々Dockerが実装し、Open Container Initiativeに寄贈したもの）の薄いラッパーで、実際のnamespaces/cgroups操作のロジックはほとんどlibcontainer側にあります。

## OCI Bundle: runcが受け取る入力

runcは「バンドル」と呼ばれるディレクトリを受け取ります。中身は2つだけです。

- **`rootfs/`**: コンテナのルートファイルシステム（[前のページ](/infrastracture/kubernetes/internals/container-fundamentals)で見たoverlayfsの`merged`結果）
- **`config.json`**: そのコンテナの設定全部

`config.json`の主なトップレベルフィールドです。

| フィールド | 内容 |
|---|---|
| `ociVersion` | 準拠するOCI Runtime Specのバージョン |
| `root` | `rootfs`へのパス、読み取り専用かどうか |
| `process` | 実行するコマンド・環境変数・作業ディレクトリ・実行ユーザーなど |
| `mounts` | コンテナ内に追加でマウントするパスの一覧（記載順にマウントされる） |
| `linux` | `namespaces`（種別一覧）、`resources`（cgroupの制限値）、`uidMappings`/`gidMappings`、`seccomp`、`maskedPaths`/`readonlyPaths`などLinux固有の設定 |
| `hooks` | ライフサイクルの特定タイミングで外部コマンドを実行する仕組み |
| `annotations` | 任意の文字列メタデータ |

containerdは、CRIから受け取ったPodSpec/ContainerSpecの情報を基に、この`config.json`を生成してruncに渡しています。

## ライフサイクルの状態機械

OCI Runtime Specは、コンテナが辿る状態を厳密に定義しています。

```
creating → created → running → stopped
```

対応するruncのサブコマンドは`runc create` / `runc start` / `runc kill` / `runc delete`です。

## なぜ`create`と`start`が分かれているのか

runcには`runc run`（create+startを1発でやる）もありますが、containerdのようなオーケストレータは**必ず`create`と`start`を分けて呼びます**。

- `runc create`は、namespaces作成・cgroup登録・rootfsのマウント（`pivot_root`）まで全部やった上で、**実際のユーザープロセスを`execve()`する直前で処理を止めます**。この時点でコンテナは「created」状態（環境はできているが、中のプロセスはまだ動いていない）
- `runc start`を呼んで初めて、止まっていた続きが実行され、`execve()`でユーザーのコマンドに置き換わる

この「createdで止まっている間」に、**CNIプラグインを呼んでPodのネットワークをセットアップします**。namespaceは`create`の時点で既に存在しているので、CNIプラグインはユーザープロセスが動き出す前に、安全にvethの接続やIPの割り当てを終えられます。OCIの`hooks`（`createRuntime`/`prestart`）も同じタイミングに処理を差し込む仕組みです。

### 実際の同期メカニズム: exec fifo

この「途中で止めて、後から続きを再開する」を実現しているのは、**名前付きパイプ**（FIFO）です。

1. `runc create`は`/proc/self/exe init`という初期化専用の子プロセスをforkし、その子がnamespaces/cgroups/mountのセットアップを全部行う
2. セットアップが終わると、その子プロセスは`execve()`する直前で、**exec fifoを読み取りモードで`open()`し、ブロックする**（他のプロセスが書き込みモードでこのfifoを開くまで、`open()`自体が返ってこない）
3. `runc start`が呼ばれると、runcはそのexec fifoを**書き込みモードで`open()`**する。これで①の`open()`のブロックが解除され、子プロセスは目的のコマンドを`execve()`する

「2段階に分ける」という設計を、カーネルの`open()`のブロッキング特性だけで実装している、というのがruncの巧妙なところです。

### 実際に試してみる: create/startの分離とネットワーク設定のタイミング

下のデモでは、`create → start`の2段階（実際のcontainerdの使い方）と、`run`の1発実行を切り替えて比べられます。2段階モードでは、`created`状態の間だけCNIのネットワーク設定ができ、そのままの状態で`start`するとネットワーク未設定のままユーザープロセスが動いてしまう様子も確認できます。

<RuncLifecycleDemo />

## youki: OCI Runtime Specの別実装（Rust製）

runcが唯一の実装というわけではありません。**youki**は、同じOCI Runtime Specを実装した、Rust製の別実装です。

```
containerd-shim-runc-v2
  │  呼び出す先を設定で差し替え可能
  ▼
runc  ←→  youki（どちらもOCI Runtime Specの実装）
  │
  ▼
namespaces / cgroups / overlayfs を実際に操作
```

containerd/CRI-Oから見ると「呼び出すバイナリがruncからyoukiに変わるだけ」で、上位のCRI・containerd・shimの層は一切変更する必要がありません。

| | runc | youki |
|---|---|---|
| 実装言語 | Go | Rust |
| ベース | libcontainer（元Docker） | 独自実装 |
| 主張されている利点 | デファクトスタンダード、実績豊富 | メモリ安全性、プロセス起動の軽さ |
| 準拠 | OCI Runtime Spec | 同じくOCI Runtime Spec準拠。OCI runtime testsとcontainerd testsに合格 |

### 「カーネル操作が速くなる」わけではない

ここは誤解しやすい点です。youkiが呼び出す**カーネルのシステムコール（`clone()`、cgroupファイルへの書き込み、`mount()`、`pivot_root()`、`execve()`）は、runcが呼んでいるものと完全に同一**です。システムコールの実行速度はカーネル側の処理なので、呼び出し元の言語がGoかRustかでは変わりません。

youkiが速いと主張しているのは、そのシステムコールを呼び出すまでの**「ランタイム側のオーバーヘッド」の話**です。

- **プロセス起動のオーバーヘッド**: Goのバイナリは起動時にGC（ガベージコレクタ）の初期化やgoroutineスケジューラの立ち上げなど、実行環境自体の初期化コストがある。RustはGCを持たずランタイムがほぼ存在しないため、runc/youkiというプロセス自体の起動が速く、メモリを食わない傾向がある
- **メモリ安全性**: これは速度ではなく正しさ・セキュリティの話。Rustの所有権システムは、バッファオーバーフローやuse-after-freeのようなメモリ破壊バグをコンパイル時に排除できる

つまり違いは「何をカーネルにさせるか」ではなく、「そのプロセス自身がどれだけ軽く速く立ち上がるか」**です**。コンテナ1個の起動時間のうち、namespace作成やcgroup設定自体にかかる時間はごくわずかで、実際のボトルネックはイメージのpullやCNIセットアップであることが多いため、ランタイムの差し替えだけでPod起動全体が劇的に速くなるとは限りません。

## まとめ

- runcはOCI Runtime Specの参照実装で、実体はlibcontainerの薄いラッパー
- コンテナは`config.json`（設定）と`rootfs`（[overlayfsの合成結果](/infrastracture/kubernetes/internals/container-fundamentals)）から成る「バンドル」として渡され、`creating → created → running → stopped`という状態機械を辿る
- `create`と`start`が分かれているのは、**`created`状態（環境はできているがプロセスはまだ動いていない）の間にCNIなどのネットワークセットアップを安全に行うため**。この同期は、exec fifoという名前付きパイプの`open()`のブロッキング特性で実装されている
- youkiはOCI Runtime Specの別実装（Rust製）で、runcと同じ場所（containerd-shimが呼び出す先）に位置する差し替え可能な実装。性能面の違いは「カーネル操作の速さ」ではなく「ランタイム自体の起動オーバーヘッドの軽さ」に由来する

## 参考

- [GitHub - opencontainers/runc](https://github.com/opencontainers/runc)
- [runtime-spec/config.md · opencontainers/runtime-spec](https://github.com/opencontainers/runtime-spec/blob/main/config.md)
- [OCI runtime: container creation flow | Antoine Cotten](https://acotten.com/2023/08/17/oci-runtime-create-flow/)
- [Digging Into Runtimes – runc - Quarkslab's blog](https://blog.quarkslab.com/digging-into-runtimes-runc.html)
- [Youki - Youki User and Developer Documentation](https://youki-dev.github.io/youki/)
