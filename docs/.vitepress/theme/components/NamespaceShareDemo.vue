<script setup lang="ts">
import { ref, computed } from 'vue'

type NsType = 'pid' | 'net' | 'mnt' | 'ipc' | 'uts'
const nsTypes: NsType[] = ['pid', 'net', 'mnt', 'ipc', 'uts']

type Proc = {
  id: number
  name: string
  ns: Record<NsType, number>
}

const shareProcessNamespace = ref(false)
const nextNsId = ref(1)
const procs = ref<Proc[]>([])
const nextProcId = ref(1)
const log = ref<string[]>([])

function newNsId() {
  return nextNsId.value++
}

function addLog(message: string) {
  log.value.unshift(message)
  if (log.value.length > 10) log.value.pop()
}

function reset() {
  procs.value = []
  nextProcId.value = 1
  nextNsId.value = 1
  log.value = []
  createPause()
}

function createPause() {
  const ns: Record<NsType, number> = {
    pid: newNsId(),
    net: newNsId(),
    mnt: newNsId(),
    ipc: newNsId(),
    uts: newNsId(),
  }
  const p: Proc = { id: nextProcId.value++, name: 'pause（infra）', ns }
  procs.value.push(p)
  addLog(`clone(CLONE_NEWPID|CLONE_NEWNET|CLONE_NEWMNT|CLONE_NEWIPC|CLONE_NEWUTS) → ${p.name} が5つのnamespaceを新規作成`)
}

function addContainer() {
  const pause = procs.value[0]
  const name = `container-${procs.value.length}`
  const ns: Record<NsType, number> = {
    // net/ipc/uts は常にpauseのnamespaceにsetns()で合流する
    net: pause.ns.net,
    ipc: pause.ns.ipc,
    uts: pause.ns.uts,
    // pid/mnt は独立させるのが基本。shareProcessNamespace=true の場合だけ pid も共有
    pid: shareProcessNamespace.value ? pause.ns.pid : newNsId(),
    mnt: newNsId(),
  }
  const p: Proc = { id: nextProcId.value++, name, ns }
  procs.value.push(p)

  const joined = ['net', 'ipc', 'uts', ...(shareProcessNamespace.value ? ['pid'] : [])]
  const created = ['mnt', ...(shareProcessNamespace.value ? [] : ['pid'])]
  addLog(`${name}: setns()で${joined.join('/')}に合流、clone(CLONE_NEW*)で${created.join('/')}を新規作成`)
}

reset()

function sameNsColor(nsId: number): string {
  const palette = ['#4f46e5', '#0891b2', '#059669', '#ca8a04', '#dc2626', '#9333ea', '#0d9488', '#c2410c']
  return palette[nsId % palette.length]
}
</script>

<template>
  <div class="demo-panel">
    <div class="demo-mode-switch">
      <button :class="{ active: !shareProcessNamespace }" @click="shareProcessNamespace = false; reset()">
        shareProcessNamespace: false（デフォルト）
      </button>
      <button :class="{ active: shareProcessNamespace }" @click="shareProcessNamespace = true; reset()">
        shareProcessNamespace: true
      </button>
    </div>

    <button class="demo-run-btn" @click="addContainer">コンテナを追加（Podにコンテナを1つ増やす）</button>
    <button class="demo-link-btn" @click="reset">Podをリセット</button>

    <div class="demo-box">
      <div class="demo-box-label">各プロセスが持つnamespace ID（同じ色＝同じnamespaceを共有している）</div>
      <table>
        <thead>
          <tr>
            <th>プロセス</th>
            <th v-for="t in nsTypes" :key="t">{{ t }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in procs" :key="p.id">
            <td>{{ p.name }}</td>
            <td v-for="t in nsTypes" :key="t">
              <span :style="{ color: sameNsColor(p.ns[t]), fontWeight: 700 }">NS-{{ t }}-{{ p.ns[t] }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="demo-result-box safe">
      <div class="demo-result-message">clone / setns の呼び出しログ（新しい順）</div>
      <div class="demo-log">
        <div v-for="(l, i) in log" :key="i">{{ l }}</div>
      </div>
    </div>
  </div>
</template>
