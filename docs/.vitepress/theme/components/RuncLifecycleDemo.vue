<script setup lang="ts">
import { ref } from 'vue'

type Mode = 'two-phase' | 'run'
const mode = ref<Mode>('two-phase')

type State = 'none' | 'creating' | 'created' | 'running' | 'stopped'
const state = ref<State>('none')
const networkConfigured = ref(false)
const log = ref<string[]>([])

function addLog(message: string) {
  log.value.push(message)
}

function reset() {
  state.value = 'none'
  networkConfigured.value = false
  log.value = []
}

function create() {
  reset()
  state.value = 'creating'
  addLog('runc create: /proc/self/exe init をfork')
  addLog('init: clone(CLONE_NEW*) でnamespaces作成、cgroupへ登録、pivot_rootでrootfsを切り替え')
  addLog('init: execve()直前で exec fifo を読み取りモードでopen() → ブロック')
  state.value = 'created'
  addLog('=== 状態: created（namespacesは存在するが、中のプロセスはまだ動いていない） ===')
}

function configureNetwork() {
  if (state.value !== 'created') {
    addLog('⚠️ createdの間でないとCNIセットアップはできない')
    return
  }
  networkConfigured.value = true
  addLog('CNIプラグイン: 既に存在するnetwork namespaceにvethを挿してIPを割り当て（ユーザープロセスはまだ動いていないので、通信の取りこぼしが起きない）')
}

function start() {
  if (state.value !== 'created') {
    addLog('⚠️ createdの状態でないとstartできない')
    return
  }
  addLog('runc start: exec fifo を書き込みモードでopen() → initのブロック解除')
  addLog(`init: execve() でユーザープロセス（例: nginx）に置き換わる${networkConfigured.value ? '（ネットワークは設定済み）' : '（⚠️ネットワーク未設定のまま起動！）'}`)
  state.value = 'running'
}

function runOneShot() {
  reset()
  state.value = 'creating'
  addLog('runc run: create+startを1コマンドで実行')
  addLog('init: namespaces作成・cgroup登録・pivot_root')
  addLog('init: そのまま連続して execve() を実行（"created"で止まる猶予が無い）')
  addLog('⚠️ CNIプラグインを挟むタイミングが存在しない → ネットワーク未設定のままユーザープロセスが動き出す')
  state.value = 'running'
}
</script>

<template>
  <div class="demo-panel">
    <div class="demo-mode-switch">
      <button :class="{ active: mode === 'two-phase' }" @click="mode = 'two-phase'; reset()">
        create → start（2段階、実際のcontainerdの使い方）
      </button>
      <button :class="{ active: mode === 'run' }" @click="mode = 'run'; reset()">
        run（1コマンドで一気に実行）
      </button>
    </div>

    <template v-if="mode === 'two-phase'">
      <button class="demo-run-btn" @click="create">① runc create</button>
      <button class="demo-run-btn" :disabled="state !== 'created'" @click="configureNetwork">② CNIでネットワーク設定（createdの間だけ可能）</button>
      <button class="demo-run-btn" :disabled="state !== 'created'" @click="start">③ runc start</button>
    </template>
    <template v-else>
      <button class="demo-run-btn" @click="runOneShot">runc run（一発実行）</button>
    </template>
    <button class="demo-link-btn" @click="reset">リセット</button>

    <div class="demo-box">
      <div class="demo-box-label">現在の状態: {{ state }}（ネットワーク設定済み: {{ networkConfigured ? 'はい' : 'いいえ' }}）</div>
      <div class="demo-log">
        <div v-for="(l, i) in log" :key="i">{{ l }}</div>
      </div>
    </div>

    <div v-if="state === 'running'" class="demo-result-box" :class="networkConfigured || mode === 'run' ? (networkConfigured ? 'safe' : 'danger') : 'safe'">
      <div class="demo-result-message">
        {{ networkConfigured ? '✓ ネットワークが設定された状態でユーザープロセスが起動した' : '⚠️ ネットワーク未設定のままユーザープロセスが起動した（runモードではこの猶予がない）' }}
      </div>
    </div>
  </div>
</template>
