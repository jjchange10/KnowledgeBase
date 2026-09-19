# コンテナの正体: namespaces・cgroups・overlayfs

コンテナは仮想マシン（VM）ではありません。別のカーネルを持たない、**普通のLinuxプロセス**です。ただし、Linuxカーネルが持つ3つの機能を組み合わせることで、「1台のマシンを丸ごと使っているように見える」状態を作り出しています。

| 機能 | やっていること |
|---|---|
| **namespaces** | プロセスから見える「世界」（プロセス一覧、ネットワーク、ファイルシステムなど）を制限する |
| **cgroups** | CPU・メモリなどの使用量に上限をかける |
| **overlayfs** | イメージの複数レイヤーを、1つのファイルシステムに見えるように合成する |

kubeletはこれらを直接操作せず、CRI経由でコンテナランタイム（containerd等）に依頼し、実際にこれらのカーネル機能を操作するのはさらにその先の低レベルランタイム（runc等）です。このページでは、その一番下にある3つの機能そのものを見ていきます。

## namespaces — 見える世界を制限する

Linuxカーネルは通常、プロセスID一覧・ネットワークインターフェース一覧・マウント済みファイルシステム一覧・ホスト名などを、システム全体で1つだけ持っています。**namespaceは、この「システム全体で1つのリスト」をプロセス（正確にはスレッドグループ）ごとに独立したインスタンスにする機能**です。

種類は8つあります。

| namespace | 分離されるもの |
|---|---|
| PID | プロセスID番号空間 |
| net | ネットワークデバイス・ルーティングテーブル・iptablesルール・ソケット一覧 |
| mnt | マウントポイントの一覧 |
| UTS | ホスト名・ドメイン名 |
| IPC | System V IPC識別子・POSIXメッセージキュー |
| user | UID/GIDの数値マッピング |
| cgroup | 自分から見えるcgroup階層上の位置 |
| time | 一部のシステムクロックのオフセット |

### 生成・操作は3つのシステムコールだけ

namespaceを新規作成する手段は、カーネルAPIとして**`clone(2)`と`unshare(2)`の2つだけ**です。「namespaceを作る」専用のシステムコールは存在せず、どちらも「タスク（プロセス／スレッド）を作る・操作する」システムコールにフラグを付けて使います。

| システムコール | やること |
|---|---|
| `clone(2)` にCLONE_NEW\*フラグ | 新しいプロセスを生成すると同時に、新しいnamespaceを作ってそこに所属させる |
| `unshare(2)` にCLONE_NEW\*フラグ | 呼び出し元プロセス自身を、新しく作ったnamespaceに移す（新規プロセスは作らない） |
| `setns(2)` | **新規作成をせず**、既に存在するnamespaceに呼び出し元を参加させる |

`ip netns add`や`unshare`コマンドのような、一見「namespaceを作るツール」に見えるものも、内部では必ずこの2つ（`clone`/`unshare`）のどちらかを呼んでいるだけです。

`/proc/<pid>/ns/net`のようなエントリは、通常のファイルへのリンクではなく、**namespaceというカーネルオブジェクト自体を指す特殊なリンク**です。`readlink`すると`net:[4026531840]`のような文字列が返り、`[]`内の数字はそのnamespaceの実体（`nsfs`という疑似ファイルシステム上のinode）の番号です。2つのプロセスが同じnamespaceに属するかどうかは、この番号が一致するかどうかで判定できます。このリンクを`open()`して得られるファイルディスクリプタは、そのnamespaceを参照し続ける限りnamespaceを生存させ続けます（`ip netns`が名前付きnamespaceを永続化できるのはこの性質を利用したbind mountです）。

### ネストの仕方は種類によって違う

PID namespaceとuser namespaceは**厳密な階層構造**を持ちます。あるプロセスは、自分が所属する階層の数だけ複数のPIDを同時に持ち（内側から外側まで`/proc/<pid>/status`の`NSpid:`に列挙される）、user namespaceのcapabilitiesは自分と子孫のnamespaceにしか及びません。ネストできる深さはどちらも最大32階層です。それ以外の種類（net, mnt, ipc, uts, cgroup, time）は、階層的な可視性を持たない**独立したインスタンス**です。

### namespaceは「プロセス」ではない

重要な整理として、**namespaceはプロセスではありません**。「あるnamespaceの中で複数の子プロセスが動く」という入れ子構造ではなく、**namespaceは個々のプロセスに貼られたラベル**（タグ）なのです。同じnamespaceに属する2つのプロセスは、親子関係である必要は一切なく、`setns()`を使えば全く無関係な、別のタイミングで起動されたプロセス同士でも同じnamespaceに合流できます。

### 実際に試してみる: Podでのnamespace共有

Kubernetesの1つのPodで複数コンテナが同じIPアドレスを共有し、`localhost`で通信できるのは、この仕組みそのものです。

1. kubeletがまず「pause（infra）コンテナ」の作成を依頼する → `clone(CLONE_NEWNET | CLONE_NEWIPC | CLONE_NEWUTS | CLONE_NEWPID | CLONE_NEWNS)`で、このPod専用の5つのnamespaceが**新規作成**される
2. Pod内の実際のアプリコンテナを追加するたびに、net/ipc/utsは`setns()`で①のnamespaceに**合流**させ、pid/mntは基本的に`clone(CLONE_NEW*)`で**独立**させる（`shareProcessNamespace: true`を指定した場合はpidも共有する）

下のデモで、コンテナを追加していくとnamespace IDがどう割り当てられるかを確認できます。`shareProcessNamespace`を切り替えて、PID namespaceの扱いの違いも比べてみてください。

<NamespaceShareDemo />

## cgroups — 使える資源の量を制限する

namespaceが「何が見えるか」を制限するのに対し、cgroupsは「どれだけ資源を使えるか」**を制限します**。この2つは完全に独立した、別々のカーネル機能です。あるプロセスがどのnamespaceに属していようが、cgroupは一切気にしません。cgroupが見ているのは「そのプロセス（を含むグループ）が今どれだけCPU・メモリを使っているか」だけです。

cgroups（現行はv2、統合階層）は特別なAPIではなく、**仮想ファイルシステム**として実装されています。通常`/sys/fs/cgroup`にマウントされ、ディレクトリを1つ作る＝cgroupを1つ作ることになります。

- 各cgroupディレクトリには、有効化されているcontroller（`cpu`, `memory`, `pids`など）ごとのインターフェースファイル（`memory.max`, `cpu.max`など）が自動生成される
- プロセスをそのcgroupに所属させるには、PIDを`cgroup.procs`に書き込む（v2では1プロセスは同時に1つのcgroupにしか所属できない）
- あるcontrollerを子孫のcgroupで使うには、**親**の`cgroup.subtree_control`にそのcontroller名を書き込んで「配る」必要がある
- **no internal process constraint**: あるcgroupは「自分に直接プロセスを所属させること」と「`subtree_control`でcontrollerを子に配ること」を同時にはできない（ルートを除く）。これにより、実際のプロセスは必ず末端（リーフ）のcgroupにしか置けなくなる

### 主なインターフェースファイル

| ファイル | 意味 |
|---|---|
| `cpu.max` | `"QUOTA PERIOD"`形式。例: `50000 100000`は100msごとに50msまでCPUを使える（＝CPU 0.5個分） |
| `cpu.weight` | 複数cgroup間でCPUを取り合うときの比例配分の重み |
| `memory.max` | ハードリミット。超えると**そのcgroup内だけ**でOOM killerが発動する |
| `memory.low` / `memory.min` | メモリ**保護**の下限。ホスト全体が逼迫したとき、この値までは優先的に確保される |
| `pids.max` | このcgroup内で同時に存在できるプロセス数の上限 |

### Kubernetesでの実際のマッピング

kubeletは、Podの`resources.requests`/`resources.limits`を、これらのファイルへの書き込みとして実装しています。

```
/sys/fs/cgroup/kubepods.slice/
├── kubepods-guaranteed.slice/pod<UID>.slice/container.scope/
├── kubepods-burstable.slice/pod<UID>.slice/container.scope/
└── kubepods-besteffort.slice/pod<UID>.slice/container.scope/
```

トップレベルがQoSクラス（Guaranteed/Burstable/BestEffort）ごとに分かれ、その下にPod・コンテナごとのディレクトリが続きます。`limits.memory`は`memory.max`に、`limits.cpu`は`cpu.max`に、`requests.cpu`は`cpu.weight`に反映され、`requests.memory`はQoSクラスに応じて`memory.min`（Guaranteed）や`memory.low`（Burstable）に反映されます。

### 実際に試してみる: cgroupのメモリ会計とOOM kill

下のデモでは、2つの独立したcgroup（それぞれ別のコンテナに見立てています）に対してメモリ確保を試み、`memory.max`を超えたときに**そのcgroup内だけ**でOOM killerが発動する様子を確認できます。片方のcgroupが上限を超えても、もう片方には一切影響しません。

<CgroupMemoryDemo />

## overlayfs — レイヤーを1つのファイルシステムに見せる

overlayfsはLinuxカーネルに組み込まれたファイルシステムの一種ですが、`ext4`や`xfs`と違い**自分自身では実際のディスク領域を管理しません**。既に別のファイルシステム上に存在する複数のディレクトリを受け取り、それらをVFS層で1つに合成して見せる「union filesystem（合成ファイルシステム）」です。

コンテナに限らず使われる汎用的なLinuxの機能で、「共有している読み取り専用のベースは変更せず、そこへの変更だけを別の場所に吸収したい」という場面全般に使えます。

### マウントパラメータ

`mount -t overlay -o lowerdir=L1:L2,upperdir=U,workdir=W merged`

- `lowerdir`: 読み取り専用ディレクトリ（複数可、前に書いたものほど上位）
- `upperdir`: 唯一の書き込み可能ディレクトリ
- `workdir`: 内部処理専用の作業ディレクトリ
- `merged`: 実際にプロセスから見えるビュー

### 読み取りと書き込みの挙動

読み取りは`upperdir`→`lowerdir`の順に最初に見つかったものを採用するだけで、コピーは発生しません。**書き込みは違います**。`lowerdir`にしかないファイルに書き込もうとした瞬間、そのファイルの中身が丸ごと`upperdir`にコピーされてから（**copy-up**）、書き込みが適用されます。以後そのパスへのアクセスは`upperdir`側だけになります。

`lowerdir`のファイルを「削除した」ことにするには、実際には下のレイヤーを消せないので、`upperdir`に**whiteout**（デバイス番号0/0のキャラクタデバイス）というマーカーを置きます。overlayfsはこのマーカーを見つけると、`lowerdir`に同名のファイルがあっても`merged`ビューには一切出しません。

`workdir`が`upperdir`と同じファイルシステム上に必要な理由は、`rename(2)`が**同一ファイルシステム内でのみアトミック**だからです。copy-upなどの操作を`workdir`でステージングしてから1回の`rename`で「公開」することで、途中でクラッシュしてもファイルシステムが壊れないようにしています。

### コンテナイメージのレイヤーとの対応

containerdは、イメージの各レイヤー（展開済みのtar）をそれぞれ読み取り専用ディレクトリとして保持し、これを下から順に`lowerdir`として並べます。コンテナを1つ起動するたびに空の`upperdir`・`workdir`を新規作成してマウントし、その`merged`結果を（`pivot_root`で）コンテナのルートファイルシステムにします。同じイメージを使う複数コンテナは`lowerdir`のディスク実体を完全に共有し、コンテナごとに増えるのは実際に書き込んだ分だけの薄い`upperdir`だけです。

### 実際に試してみる: copy-upとwhiteout

下のデモでは、`lowerdir`にあるファイルを編集・削除する操作を通じて、copy-upとwhiteoutが実際に発生する様子と、その結果`merged`ビューがどう見えるかを確認できます。

<OverlayfsDemo />

## まとめ

- コンテナはVMではなく、namespaces（分離）・cgroups（計量・制限）・overlayfs（レイヤーの合成）というLinuxカーネルの3つの機能を組み合わせた、普通のプロセスである
- namespaceの新規作成は`clone()`/`unshare()`のみで、`setns()`は既存のnamespaceに参加するだけ。namespace自体はプロセスではなく、個々のプロセスに貼られたラベルである
- cgroupはnamespaceと完全に独立した仕組みで、「見える世界」ではなく「使える資源の量」だけを制御する。`/sys/fs/cgroup`配下のファイルへの読み書きとして実装されている
- overlayfsは、読み取り専用の複数レイヤー（`lowerdir`）と書き込み用の1層（`upperdir`）を合成する。書き込みは初回だけcopy-upが発生し、削除はwhiteoutというマーカーで表現される
- Kubernetesのkubelet・containerd・runcは、これらのカーネル機能を直接操作するのではなく、CRIというインターフェースを介して段階的に組み合わせているだけである

## 参考

- [namespaces(7) - Linux manual page](https://man7.org/linux/man-pages/man7/namespaces.7.html)
- [pid_namespaces(7) - Linux manual page](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html)
- [user_namespaces(7) - Linux manual page](https://man7.org/linux/man-pages/man7/user_namespaces.7.html)
- [Control Group v2 — The Linux Kernel documentation](https://docs.kernel.org/admin-guide/cgroup-v2.html)
- [Overlay Filesystem — The Linux Kernel documentation](https://docs.kernel.org/filesystems/overlayfs.html)
- [Cgroups - Deep Dive into Resource Management in Kubernetes](https://martinheinz.dev/blog/91)
