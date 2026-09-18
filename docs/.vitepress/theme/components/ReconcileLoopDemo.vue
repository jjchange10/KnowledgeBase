<script setup lang="ts">
import { ref, computed } from 'vue'

type PodState = 'running' | 'creating' | 'terminating'
type Pod = { id: number; state: PodState }

const desiredReplicas = ref(3)
const chaosMode = ref<'stable' | 'chaos'>('stable')
const pods = ref<Pod[]>([])
const nextId = ref(1)
const log = ref<string[]>([])
const tick = ref(0)

function reset() {
  pods.value = []
  nextId.value = 1
  log.value = []
  tick.value = 0
}

function addLog(message: string) {
  log.value.unshift(`tick ${tick.value}: ${message}`)
  if (log.value.length > 8) log.value.pop()
}

// 実際のコントローラのreconcileループを単純化したもの:
// 「観測された状態(status)」と「望ましい状態(spec)」を比較し、差分だけ手を打つ。
function reconcile() {
  tick.value += 1

  if (chaosMode.value === 'chaos' && pods.value.length > 0 && Math.random() < 0.4) {
    const victim = pods.value[Math.floor(Math.random() * pods.value.length)]
    pods.value = pods.value.filter((p) => p.id !== victim.id)
    addLog(`💥 Pod #${victim.id} がクラッシュ（observed=${pods.value.length}）`)
    return
  }

  const observed = pods.value.length
  const desired = desiredReplicas.value

  if (observed < desired) {
    const pod: Pod = { id: nextId.value++, state: 'running' }
    pods.value.push(pod)
    addLog(`spec.replicas=${desired} > status.replicas=${observed} → Pod #${pod.id} を作成`)
  } else if (observed > desired) {
    const victim = pods.value[pods.value.length - 1]
    pods.value = pods.value.filter((p) => p.id !== victim.id)
    addLog(`spec.replicas=${desired} < status.replicas=${observed} → Pod #${victim.id} を削除`)
  } else {
    addLog(`spec.replicas=${desired} == status.replicas=${observed} → 差分なし、何もしない`)
  }
}

const inSync = computed(() => pods.value.length === desiredReplicas.value)

reset()
</script>

<template>
  <div class="demo-panel">
    <div class="demo-mode-switch">
      <button :class="{ active: chaosMode === 'stable' }" @click="chaosMode = 'stable'; reset()">
        安定したクラスタ（クラッシュなし）
      </button>
      <button :class="{ active: chaosMode === 'chaos' }" @click="chaosMode = 'chaos'; reset()">
        不安定なクラスタ（ランダムにPodがクラッシュ）
      </button>
    </div>

    <div class="demo-form-row">
      <label>
        spec.replicas（望ましい状態）
        <input v-model.number="desiredReplicas" type="number" min="0" max="8" />
      </label>
    </div>

    <button class="demo-run-btn" @click="reconcile">次のreconcileを1回実行</button>
    <button class="demo-link-btn" @click="reset">リセット</button>

    <div class="demo-box">
      <div class="demo-box-label">status.replicas（観測された状態） = {{ pods.length }}</div>
      <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; font-size: 1.3rem;">
        <span v-if="pods.length === 0" style="font-size: 0.85rem; color: var(--vp-c-text-2);">Podがありません</span>
        <span v-for="p in pods" :key="p.id" title="running pod">🟢</span>
      </div>
    </div>

    <div class="demo-result-box" :class="inSync ? 'safe' : 'danger'">
      <div class="demo-result-message">
        {{ inSync ? '✓ spec と status が一致（収束済み）' : '✗ spec と status に差分あり（reconcile中）' }}
      </div>
      <div class="demo-log">
        <div v-for="(l, i) in log" :key="i">{{ l }}</div>
      </div>
    </div>
  </div>
</template>
