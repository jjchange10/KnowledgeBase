<script setup lang="ts">
import { ref, computed } from 'vue'

type Pod = {
  id: number
  name: string
  shimId: number
  sandboxNsId: number
  containers: string[]
}

const pods = ref<Pod[]>([])
const nextPodId = ref(1)
const nextShimId = ref(1)
const nextNsId = ref(1)
const containerCount = ref(2)
const log = ref<string[]>([])

function addLog(message: string) {
  log.value.unshift(message)
}

function createPod() {
  const podName = `Pod-${String.fromCharCode(64 + nextPodId.value)}`
  const shimId = nextShimId.value++
  const nsId = nextNsId.value++
  addLog(`--- kubectl apply: ${podName}（コンテナ${containerCount.value}個）---`)
  addLog(`kubelet → CRI RuntimeService.RunPodSandbox() [gRPC, kubelet⇔containerd]`)
  addLog(`containerd（CRI plugin, in-process）→ containerd-shim-runc-v2 #${shimId} を起動`)
  addLog(`shim #${shimId} → runc create/start（sandboxコンテナ） → clone(CLONE_NEW*) で NS-${nsId} 一式を新規作成`)

  const containers: string[] = []
  for (let i = 1; i <= containerCount.value; i++) {
    const cname = `container-${i}`
    containers.push(cname)
    addLog(`kubelet → CRI ImageService.PullImage()（未取得の場合のみ）`)
    addLog(`kubelet → CRI RuntimeService.CreateContainer(sandbox=${podName}, ${cname})`)
    addLog(`containerd → 同じshim #${shimId} が担当（同じPodなのでグルーピングされる）`)
    addLog(`shim #${shimId} → runc create（${cname}） → net/ipc/utsはsetns()でNS-${nsId}に合流、pid/mntは新規clone`)
    addLog(`kubelet → CRI RuntimeService.StartContainer(${cname})`)
  }

  pods.value.push({ id: nextPodId.value++, name: podName, shimId, sandboxNsId: nsId, containers })
}

function reset() {
  pods.value = []
  log.value = []
  nextPodId.value = 1
  nextShimId.value = 1
  nextNsId.value = 1
}
</script>

<template>
  <div class="demo-panel">
    <div class="demo-form-row">
      <label>
        Pod内のコンテナ数
        <input v-model.number="containerCount" type="number" min="1" max="4" />
      </label>
    </div>

    <button class="demo-run-btn" @click="createPod">新しいPodを作成</button>
    <button class="demo-link-btn" @click="reset">リセット</button>

    <div class="demo-box">
      <div class="demo-box-label">作成済みPodと、割り当てられたshim・namespace</div>
      <table>
        <thead>
          <tr><th>Pod</th><th>担当shim</th><th>共有namespace ID</th><th>コンテナ</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in pods" :key="p.id">
            <td>{{ p.name }}</td>
            <td>containerd-shim-runc-v2 #{{ p.shimId }}</td>
            <td>NS-{{ p.sandboxNsId }}</td>
            <td>{{ p.containers.join(', ') }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="pods.length >= 2" class="demo-warning" style="color: var(--vp-c-brand); font-weight: 600;">
        ✓ Podが違えばshimもnamespace IDも完全に別々（Pod間でリソースは共有されない）
      </div>
    </div>

    <div class="demo-result-box safe">
      <div class="demo-result-message">CRI呼び出しログ（新しい順）</div>
      <div class="demo-log">
        <div v-for="(l, i) in log" :key="i">{{ l }}</div>
      </div>
    </div>
  </div>
</template>
