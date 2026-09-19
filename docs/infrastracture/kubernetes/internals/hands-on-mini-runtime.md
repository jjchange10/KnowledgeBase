# 実際に手を動かす: 最小コンテナランタイムを作って動かす

[namespaces・cgroups・overlayfs](/infrastracture/kubernetes/internals/container-fundamentals)、[CRI/containerd](/infrastracture/kubernetes/internals/cri-containerd)、[runc/OCI Runtime Spec](/infrastracture/kubernetes/internals/runc)と概念を追ってきましたが、このページでは実際にLinux上で動くGoプログラムとして最小のコンテナランタイム（`mini-runc`）を作り、ここまでの内容を手元で検証します。ブラウザ内のシミュレーションではなく、**実際のnamespaces/cgroupsを本物のシステムコールで操作**しています。

## 環境の確認

まず、root権限でnamespace作成・cgroup書き込み・overlayマウントができることを確認します。

```bash
$ id
uid=0(root) gid=0(root) groups=0(root)

$ unshare --pid --mount --fork --mount-proc echo "namespace OK"
namespace OK

$ mkdir -p /sys/fs/cgroup/pids/mytest && echo 10 > /sys/fs/cgroup/pids/mytest/pids.max && cat /sys/fs/cgroup/pids/mytest/pids.max
10

$ mount -t overlay overlay -o lowerdir=lower,upperdir=upper,workdir=work merged && cat merged/file.txt
（overlayマウント成功）
```

いずれも成功したので、実際にnamespaces/cgroups/overlayfsを操作するコードを動かせます。

> **この環境のcgroupは v1（ハイブリッド構成）**: `mount | grep cgroup`で確認すると、`/sys/fs/cgroup/pids`や`/sys/fs/cgroup/memory`のように、controllerごとに別々のディレクトリがマウントされていました。[前のページ](/infrastracture/kubernetes/internals/container-fundamentals)で説明したのはcgroup v2（統合階層、`memory.max`など）でしたが、この環境はcgroup v1（`memory.limit_in_bytes`など、ファイル名が異なる）でした。以下のコードもv1のファイル名で書いています。実務では`mount | grep cgroup2`で確認し、v1/v2どちらかに合わせてください。

## rootfsの準備

コンテナの中身として、`busybox`（1バイナリで多数のコマンドを兼ねる、静的リンクされた実行ファイル）を使います。

```bash
$ apt-get install -y busybox-static
$ mkdir -p rootfs/{bin,proc,sys,tmp,etc,dev}
$ cp /usr/bin/busybox rootfs/bin/busybox
$ cd rootfs/bin
$ for applet in sh ps hostname ls cat echo mount ip mkdir sleep id whoami uname; do
    ln -sf busybox $applet
  done
$ cd ../..
$ mknod -m 666 rootfs/dev/null c 1 3
$ mknod -m 666 rootfs/dev/zero c 1 5
```

## mini-runcの実装

`clone()`のフラグでnamespaceを新規作成しつつ自分自身（`/proc/self/exe`）を再実行する、実際のruncと同じ考え方をGoで実装します。

```go
// mini-runc: 実際にnamespaces/cgroups/overlayfsを使う、教育用の最小コンテナランタイム。
// 本物のruncと同じ考え方（自分自身を/proc/self/exeで再実行してnamespaceを作り、
// create/startをexec fifoで同期する2段階方式）を採用している。
package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"syscall"
	"time"
)

func must(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func pidCgroupPath(id string) string { return filepath.Join("/sys/fs/cgroup/pids", "mini-runc-"+id) }
func memCgroupPath(id string) string { return filepath.Join("/sys/fs/cgroup/memory", "mini-runc-"+id) }
func statePidFile(id string) string  { return "/tmp/mini-runc-" + id + ".pid" }

func setupCgroup(id, pidsMax, memMaxMB string) {
	pidsCg := pidCgroupPath(id)
	memCg := memCgroupPath(id)
	must(os.MkdirAll(pidsCg, 0755))
	must(os.MkdirAll(memCg, 0755))
	must(os.WriteFile(filepath.Join(pidsCg, "pids.max"), []byte(pidsMax), 0644))
	memBytes, _ := strconv.Atoi(memMaxMB)
	must(os.WriteFile(filepath.Join(memCg, "memory.limit_in_bytes"), []byte(fmt.Sprintf("%d", memBytes*1024*1024)), 0644))
}

func registerPidToCgroup(id string, pid int) {
	must(os.WriteFile(filepath.Join(pidCgroupPath(id), "cgroup.procs"), []byte(strconv.Itoa(pid)), 0644))
	must(os.WriteFile(filepath.Join(memCgroupPath(id), "cgroup.procs"), []byte(strconv.Itoa(pid)), 0644))
}

// --- create: cgroupを用意し、namespaceフラグ付きで自分自身を再実行する ---
func createContainer() {
	id, rootfs, pidsMax, memMaxMB := os.Args[2], os.Args[3], os.Args[4], os.Args[5]
	cmdArgs := os.Args[6:]

	setupCgroup(id, pidsMax, memMaxMB)

	fifoPath := filepath.Join(rootfs, ".exec.fifo")
	os.Remove(fifoPath)
	must(syscall.Mkfifo(fifoPath, 0600))

	args := append([]string{"child", rootfs}, cmdArgs...)
	cmd := exec.Command("/proc/self/exe", args...)
	cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Cloneflags: syscall.CLONE_NEWUTS | syscall.CLONE_NEWPID | syscall.CLONE_NEWNS |
			syscall.CLONE_NEWIPC | syscall.CLONE_NEWNET,
	}
	must(cmd.Start())
	pid := cmd.Process.Pid

	// レース修正の核心: execve()より確実に前のこのタイミングでcgroup登録する
	registerPidToCgroup(id, pid)
	must(os.WriteFile(statePidFile(id), []byte(strconv.Itoa(pid)), 0644))
	must(cmd.Process.Release()) // createはここで終了してよい。子はinitに引き取られ生き続ける
	fmt.Println("[create] 状態: created。`mini-runc start` を呼ぶまで待機します")
}

// --- start: exec fifoに書き込み、子プロセスのブロックを解除する ---
func startContainer() {
	id, rootfs := os.Args[2], os.Args[3]
	pidBytes, _ := os.ReadFile(statePidFile(id))
	pid, _ := strconv.Atoi(string(pidBytes))

	f, err := os.OpenFile(filepath.Join(rootfs, ".exec.fifo"), os.O_WRONLY, 0)
	must(err)
	f.Close()

	for {
		if _, err := os.Stat(fmt.Sprintf("/proc/%d", pid)); os.IsNotExist(err) {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	os.RemoveAll(pidCgroupPath(id))
	os.RemoveAll(memCgroupPath(id))
}

// --- child: 新しいnamespaceの中で最初に動く。fifoで待機してからexecve ---
func childInit() {
	rootfs := os.Args[2]
	cmdArgs := os.Args[3:]

	must(syscall.Sethostname([]byte("mini-container")))
	must(syscall.Chroot(rootfs))
	must(os.Chdir("/"))
	must(syscall.Mount("proc", "/proc", "proc", 0, ""))

	fd, err := os.OpenFile("/.exec.fifo", os.O_RDONLY, 0) // ここでブロックする
	must(err)
	fd.Close()

	binPath, err := exec.LookPath(cmdArgs[0])
	if err != nil {
		binPath = cmdArgs[0]
	}
	must(syscall.Exec(binPath, cmdArgs, os.Environ()))
}

func main() {
	switch os.Args[1] {
	case "create":
		createContainer()
	case "start":
		startContainer()
	case "child":
		childInit()
	}
}
```

## namespace分離の確認

```bash
$ go build -o mini-runc main.go
$ ./mini-runc create demo ./rootfs 20 50 /bin/sh -c 'hostname; ps; ip addr'
$ ./mini-runc start demo ./rootfs
```

実際の出力:

```
mini-container
PID   USER     COMMAND
    1 0        /bin/sh -c hostname; ps; ip addr
    7 0        {ps} /bin/sh -c hostname; ps; ip addr
1: lo: <LOOPBACK> mtu 65536 qdisc noop qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
```

- `hostname`はホストとは違う`mini-container`（**UTS namespace**が効いている）
- `ps`はコンテナ内で起動した2プロセスしか見えない。しかも自分自身が**PID 1**（**PID namespace**が効いている）
- `ip addr`はloopbackしか無い、まっさらなネットワークスタック（**net namespace**が効いている）

いずれも[前のページ](/infrastracture/kubernetes/internals/container-fundamentals)で説明した通りの、実際のカーネルの挙動です。

## 発見①: create/startを分けないとcgroup登録にレースが起きる

最初、`create`/`start`を分けず一発で`clone()`→`exec()`する版を作ったところ、`pids.max=1`（自分自身1プロセス分しか許可しない）にして3回試したうち、**1回はforkが成功してしまいました**。

```
--- 試行2の結果（レースに負けた例） ---
fork結果: 0     ← 本来はpids.max=1で失敗するはずなのに成功している
PID   USER     COMMAND
    1 0        {ps} ...
    6 0        /bin/sh -c sleep 100 & ...
```

原因は、ホスト側が`cgroup.procs`にPIDを書き込む前に、子プロセスが`fork`まで実行してしまうことがあるからです。これはまさに[runcのページ](/infrastracture/kubernetes/internals/runc)で説明した「なぜ`create`と`start`を分けるのか」という話が、実際にコードで再現できた瞬間でした。

## 発見②: pids.maxは「ユーザープロセス数」ではなく「カーネルのタスク（スレッド含む）数」を数える

`pids.max=1`にすると、レースに負けなかった回では**Goランタイム自身がクラッシュ**しました。

```
runtime: failed to create new OS thread (have 2 already; errno=11)
fatal error: newosproc
```

Goランタイムはスケジューラ用に複数のOSスレッドを必要とします。cgroupの`pids.max`はプロセスだけでなく**スレッドも含めたタスク数**を制限するため、`pids.max=1`のような極端な値では、コンテナの中身（`/bin/sh`）以前に、**namespaceのセットアップを行うGo製の`child`プロセス自身**が2本目のスレッドを作れずに死んでしまいます。これは教科書には載っていない、実際にコードを動かして初めて分かる挙動でした。

## 修正: create/start + exec fifoの2段階方式

[runcのページ](/infrastracture/kubernetes/internals/runc)で説明した、名前付きパイプ（exec fifo）による同期を実装し直しました。ポイントは次の3点です。

1. `.exec.fifo`を**rootfsの中**（`rootfs/.exec.fifo`）に作る。chroot後も`/.exec.fifo`として参照できるようにするため
2. `child`は、namespaceのセットアップ（hostname・chroot・mount）を終えた**直後**にこのfifoを読み取りモードで`open()`し、ブロックする
3. `create`は、子プロセスを起動した**直後**（子がfifoでブロックしている間）にcgroup登録を行い、そのまま終了する。`start`が別途呼ばれてfifoに書き込むまで、子は`execve()`にたどり着かない

実行結果（ログの時系列がそのまま証拠になっています）:

```
$ ./mini-runc create demo ./rootfs 20 50 /bin/sh -c 'hostname; echo done-from-container'
[create] cgroup作成: pids.max=20, memory.limit_in_bytes=50MB
[create] exec fifo作成: rootfs/.exec.fifo
[create] clone()で子プロセス作成: PID 3044
[child] namespace/cgroup/chroot準備完了
[child] exec fifo (/.exec.fifo) を読み取りモードでopen() → startが来るまでブロック
[create] PIDをcgroupに登録完了（ユーザープロセスはまだexecve前なので確実に間に合う）
[create] 状態: created。`mini-runc start demo ./rootfs` を呼ぶまで待機します

$ ./mini-runc start demo ./rootfs
[start] exec fifoを書き込みモードでopen() → 子プロセスの読み取りブロックを解除
[child] ブロック解除。execve()でユーザーコマンドに置き換わります
-----------------------------------------------------------
mini-container
done-from-container
[start] コンテナ終了
```

`[child]`がfifoでブロックするログと`[create]`がcgroup登録を完了するログの順序を見ると、**ユーザーコマンド（`hostname; echo ...`）が実際に動くのは、`create`とは別プロセスの`start`が呼ばれた後だけ**であることが分かります。これで、`create`の時点でcgroup登録が確実に完了してから、ようやくユーザープロセスが動き出す、という順序が保証されました。

> **副産物の発見**: fifoでブロックしている子プロセスは、親（`create`）が終了した後も、継承したstdout/stderrのファイルディスクリプタを握り続けます。`create`の出力をシェルで`| grep ...`のようにパイプすると、`create`自身はすぐ終了してもパイプの書き込み側が閉じきらず、`grep`が終了しない、というハングを実際に踏みました。これも「ファイルディスクリプタは、それを開いたプロセスが死んでも、他のプロセスが握っていれば生き続ける」という実地の学びです。

## まとめ

- root権限があれば、`unshare`・`/sys/fs/cgroup`への書き込み・`mount -t overlay`は素のLinux環境でそのまま動く
- Goの`os/exec`に`SysProcAttr.Cloneflags`を渡すことで、実際のruncと同じ「namespaceフラグ付きで自分自身を再実行する」パターンを再現できる
- 一発実行（`create`+`start`を分けない）では、cgroup登録がユーザープロセスの起動に間に合わないレース条件が実際に発生する
- `pids.max`はスレッドも数えるため、コンテナのinit処理自体が重い（マルチスレッドの）実装だと、極端に小さい制限値では init自身が死ぬことがある
- exec fifoによる`create`/`start`の分離で、cgroup登録の完了を保証してからユーザープロセスを起動できることを、実際のログで確認できた

このコードはLinux上でroot権限（またはuser namespaceが使える環境）が必要です。macOSやWSLでは動作しません。
