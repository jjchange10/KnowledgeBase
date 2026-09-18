<script setup lang="ts">
import { ref, computed, watch } from 'vue'

type Preset = {
  group: string
  version: string
  resource: string
  kind: string
  namespaced: boolean
  label: string
}

const namespacedPresets: Preset[] = [
  { group: '', version: 'v1', resource: 'pods', kind: 'Pod', namespaced: true, label: 'Pod（コアグループ）' },
  { group: 'apps', version: 'v1', resource: 'deployments', kind: 'Deployment', namespaced: true, label: 'Deployment（apps グループ・GA）' },
  { group: 'extensions', version: 'v1beta1', resource: 'deployments', kind: 'Deployment', namespaced: true, label: 'Deployment（extensions グループ・旧バージョン／cohabitation）' },
  { group: 'batch', version: 'v1', resource: 'jobs', kind: 'Job', namespaced: true, label: 'Job（batch グループ・v1）' },
  { group: 'batch', version: 'v1beta1', resource: 'cronjobs', kind: 'CronJob', namespaced: true, label: 'CronJob（batch グループ・v1beta1、まだGAでない）' },
]

const clusterPresets: Preset[] = [
  { group: '', version: 'v1', resource: 'nodes', kind: 'Node', namespaced: false, label: 'Node（コアグループ・クラスタスコープ）' },
  { group: '', version: 'v1', resource: 'namespaces', kind: 'Namespace', namespaced: false, label: 'Namespace（コアグループ・クラスタスコープ）' },
  { group: 'storage.k8s.io', version: 'v1', resource: 'storageclasses', kind: 'StorageClass', namespaced: false, label: 'StorageClass（storage.k8s.io グループ・クラスタスコープ）' },
]

type Verb = 'list' | 'get' | 'create' | 'update' | 'patch' | 'delete' | 'watch'

const verbs: { key: Verb; method: string; label: string; needsName: boolean }[] = [
  { key: 'list', method: 'GET', label: '一覧取得（コレクション）', needsName: false },
  { key: 'get', method: 'GET', label: '単一取得', needsName: true },
  { key: 'create', method: 'POST', label: '新規作成', needsName: false },
  { key: 'update', method: 'PUT', label: '全体更新', needsName: true },
  { key: 'patch', method: 'PATCH', label: '部分更新', needsName: true },
  { key: 'delete', method: 'DELETE', label: '削除', needsName: true },
  { key: 'watch', method: 'GET', label: '変更をwatch（ストリーミング）', needsName: false },
]

const scopeMode = ref<'namespaced' | 'cluster'>('namespaced')
const presets = computed(() => (scopeMode.value === 'namespaced' ? namespacedPresets : clusterPresets))
const presetIndex = ref(0)
const preset = computed(() => presets.value[presetIndex.value])

watch(scopeMode, () => {
  presetIndex.value = 0
})

const namespace = ref('default')
const name = ref('example')
const verbKey = ref<Verb>('list')
const verb = computed(() => verbs.find((v) => v.key === verbKey.value)!)

const groupVersionResource = computed(() => `${preset.value.group || 'core'}/${preset.value.version}, resource=${preset.value.resource}`)
const groupVersionKind = computed(() => `${preset.value.group || 'core'}/${preset.value.version}, kind=${preset.value.kind}`)

const basePath = computed(() =>
  preset.value.group === '' ? `/api/${preset.value.version}` : `/apis/${preset.value.group}/${preset.value.version}`
)

const collectionPath = computed(() => {
  const p = preset.value
  const nsSegment = p.namespaced ? `/namespaces/${namespace.value}` : ''
  return `${basePath.value}${nsSegment}/${p.resource}`
})

const itemPath = computed(() => `${collectionPath.value}/${name.value}`)

const requestPath = computed(() => {
  const usesName = verb.value.needsName
  const path = usesName ? itemPath.value : collectionPath.value
  return verbKey.value === 'watch' ? `${path}?watch=true` : path
})

const responseKind = computed(() => {
  if (verbKey.value === 'list' || verbKey.value === 'watch') return `${preset.value.kind}List`
  if (verbKey.value === 'delete') return 'Status'
  return preset.value.kind
})

const kubectlEquivalent = computed(() => {
  const p = preset.value
  const nsFlag = p.namespaced ? ` -n ${namespace.value}` : ''
  const verbMap: Record<Verb, string> = {
    list: `kubectl get ${p.resource}${nsFlag}`,
    get: `kubectl get ${p.resource} ${name.value}${nsFlag}`,
    create: `kubectl create -f xxx.yaml${nsFlag}`,
    update: `kubectl replace -f xxx.yaml${nsFlag}`,
    patch: `kubectl patch ${p.resource} ${name.value} --type=merge -p '...'${nsFlag}`,
    delete: `kubectl delete ${p.resource} ${name.value}${nsFlag}`,
    watch: `kubectl get ${p.resource} --watch${nsFlag}`,
  }
  return verbMap[verbKey.value]
})
</script>

<template>
  <div class="demo-panel">
    <div class="demo-mode-switch">
      <button :class="{ active: scopeMode === 'namespaced' }" @click="scopeMode = 'namespaced'">
        名前空間スコープのリソース
      </button>
      <button :class="{ active: scopeMode === 'cluster' }" @click="scopeMode = 'cluster'">
        クラスタスコープのリソース
      </button>
    </div>

    <div class="demo-form-row">
      <label style="flex-basis: 100%">
        リソース
        <select v-model.number="presetIndex" style="margin-top: 0.25rem; padding: 0.5rem 0.6rem; border-radius: 6px; border: 1px solid var(--vp-c-border); background-color: var(--vp-c-bg); color: var(--vp-c-text-1);">
          <option v-for="(p, i) in presets" :key="i" :value="i">{{ p.label }}</option>
        </select>
      </label>
    </div>

    <div class="demo-form-row">
      <label v-if="preset.namespaced">
        namespace
        <input v-model="namespace" type="text" />
      </label>
      <label v-if="verb.needsName">
        name
        <input v-model="name" type="text" />
      </label>
      <label>
        操作（HTTP verb）
        <select v-model="verbKey" style="margin-top: 0.25rem; padding: 0.5rem 0.6rem; border-radius: 6px; border: 1px solid var(--vp-c-border); background-color: var(--vp-c-bg); color: var(--vp-c-text-1);">
          <option v-for="v in verbs" :key="v.key" :value="v.key">{{ v.method }} - {{ v.label }}</option>
        </select>
      </label>
    </div>

    <div class="demo-box">
      <div class="demo-box-label">GroupVersionResource（GVR） / GroupVersionKind（GVK）</div>
      <table>
        <tbody>
          <tr><td>GVR</td><td><code>{{ groupVersionResource }}</code></td></tr>
          <tr><td>GVK</td><td><code>{{ groupVersionKind }}</code></td></tr>
          <tr><td>namespaced</td><td>{{ preset.namespaced ? 'true' : 'false' }}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="demo-result-box safe">
      <div class="demo-result-message">{{ verb.method }} {{ requestPath }}</div>
      <div>レスポンスの kind: <strong>{{ responseKind }}</strong></div>
      <table style="margin-top: 0.6rem;">
        <tbody>
          <tr><td>curl 相当</td><td><code>curl http://127.0.0.1:8080{{ requestPath }}</code>（別途 <code>kubectl proxy</code> が必要）</td></tr>
          <tr><td>kubectl 相当</td><td><code>{{ kubectlEquivalent }}</code></td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
