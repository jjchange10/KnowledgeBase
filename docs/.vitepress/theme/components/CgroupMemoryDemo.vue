<script setup lang="ts">
import { ref, computed } from 'vue'

type Proc = { id: number; name: string; usageMb: number; killed: boolean }

type Cgroup = {
  name: string
  memoryMaxMb: number
  procs: Proc[]
}

const cgroupA = ref<Cgroup>({ name: '/kubepods/.../podA/containerA', memoryMaxMb: 200, procs: [] })
const cgroupB = ref<Cgroup>({ name: '/kubepods/.../podB/containerB', memoryMaxMb: 200, procs: [] })
const nextId = ref(1)
const log = ref<string[]>([])

function addLog(message: string) {
  log.value.unshift(message)
  if (log.value.length > 10) log.value.pop()
}

function usageOf(cg: Cgroup) {
  return cg.procs.filter((p) => !p.killed).reduce((sum, p) => sum + p.usageMb, 0)
}

function allocate(cg: Cgroup, amountMb: number) {
  const proc: Proc = { id: nextId.value++, name: `proc-${nextId.value}`, usageMb: amountMb, killed: false }
  const currentUsage = usageOf(cg)
  const newTotal = currentUsage + amountMb

  addLog(`${cg.name}: ${proc.name} が ${amountMb}MB を確保しようとする（現在の合計: ${currentUsage}MB → ${newTotal}MB）`)

  if (newTotal > cg.memoryMaxMb) {
    // memory.max を超えた → このcgroup内で最もメモリを使っているプロセスをOOM killする
    const candidates = [...cg.procs.filter((p) => !p.killed), proc]
    const victim = candidates.reduce((max, p) => (p.usageMb > max.usageMb ? p : max))
    if (victim.id !== proc.id) {
      cg.procs.push(proc)
    }
    victim.killed = true
    addLog(`⚠️ ${cg.name}: memory.max(${cg.memoryMaxMb}MB)を超過 → cgroup内でOOM killer発動 → ${victim.name}(${victim.usageMb}MB)をkill`)
  } else {
    cg.procs.push(proc)
    addLog(`✅ ${cg.name}: 確保成功`)
  }
}

function reset() {
  cgroupA.value.procs = []
  cgroupB.value.procs = []
  log.value = []
}
</script>

<template>
  <div class="demo-panel">
    <div class="demo-form-row">
      <label>
        cgroup A の memory.max (MB)
        <input v-model.number="cgroupA.memoryMaxMb" type="number" min="50" step="10" />
      </label>
      <label>
        cgroup B の memory.max (MB)
        <input v-model.number="cgroupB.memoryMaxMb" type="number" min="50" step="10" />
      </label>
    </div>

    <button class="demo-run-btn" @click="allocate(cgroupA, 80)">cgroup Aで80MB確保</button>
    <button class="demo-run-btn" @click="allocate(cgroupB, 80)">cgroup Bで80MB確保</button>
    <button class="demo-link-btn" @click="reset">リセット</button>

    <div class="demo-form-row">
      <div class="demo-box" style="flex: 1;">
        <div class="demo-box-label">{{ cgroupA.name }}（memory.max = {{ cgroupA.memoryMaxMb }}MB）</div>
        <div>現在の使用量: <strong>{{ usageOf(cgroupA) }}MB</strong> / {{ cgroupA.memoryMaxMb }}MB</div>
        <table style="margin-top: 0.5rem;">
          <tbody>
            <tr v-for="p in cgroupA.procs" :key="p.id" :style="{ opacity: p.killed ? 0.4 : 1 }">
              <td>{{ p.name }}</td>
              <td>{{ p.usageMb }}MB</td>
              <td>{{ p.killed ? '💀 OOM killed' : '🟢 running' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="demo-box" style="flex: 1;">
        <div class="demo-box-label">{{ cgroupB.name }}（memory.max = {{ cgroupB.memoryMaxMb }}MB）</div>
        <div>現在の使用量: <strong>{{ usageOf(cgroupB) }}MB</strong> / {{ cgroupB.memoryMaxMb }}MB</div>
        <table style="margin-top: 0.5rem;">
          <tbody>
            <tr v-for="p in cgroupB.procs" :key="p.id" :style="{ opacity: p.killed ? 0.4 : 1 }">
              <td>{{ p.name }}</td>
              <td>{{ p.usageMb }}MB</td>
              <td>{{ p.killed ? '💀 OOM killed' : '🟢 running' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="demo-result-box safe">
      <div class="demo-result-message">ログ</div>
      <div class="demo-log">
        <div v-for="(l, i) in log" :key="i">{{ l }}</div>
      </div>
    </div>
  </div>
</template>
