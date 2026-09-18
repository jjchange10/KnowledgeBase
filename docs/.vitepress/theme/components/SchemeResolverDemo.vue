<script setup lang="ts">
import { ref, computed, watch } from 'vue'

type Preset = {
  goType: string
  group: string
  version: string
  kind: string
  resource: string
  namespaced: boolean
  clientAccessor: string
  label: string
}

const namespacedPresets: Preset[] = [
  { goType: '*corev1.Pod', group: '', version: 'v1', kind: 'Pod', resource: 'pods', namespaced: true, clientAccessor: 'clientset.CoreV1().Pods', label: '*corev1.Pod（コアグループ）' },
  { goType: '*appsv1.Deployment', group: 'apps', version: 'v1', kind: 'Deployment', resource: 'deployments', namespaced: true, clientAccessor: 'clientset.AppsV1().Deployments', label: '*appsv1.Deployment（apps グループ）' },
  { goType: '*batchv1.Job', group: 'batch', version: 'v1', kind: 'Job', resource: 'jobs', namespaced: true, clientAccessor: 'clientset.BatchV1().Jobs', label: '*batchv1.Job（batch グループ）' },
  { goType: '*networkingv1.Ingress', group: 'networking.k8s.io', version: 'v1', kind: 'Ingress', resource: 'ingresses', namespaced: true, clientAccessor: 'clientset.NetworkingV1().Ingresses', label: '*networkingv1.Ingress（不規則な複数形の例: Ingress→ingresses）' },
]

const clusterPresets: Preset[] = [
  { goType: '*corev1.Node', group: '', version: 'v1', kind: 'Node', resource: 'nodes', namespaced: false, clientAccessor: 'clientset.CoreV1().Nodes', label: '*corev1.Node（コアグループ・クラスタスコープ）' },
  { goType: '*rbacv1.ClusterRole', group: 'rbac.authorization.k8s.io', version: 'v1', kind: 'ClusterRole', resource: 'clusterroles', namespaced: false, clientAccessor: 'clientset.RbacV1().ClusterRoles', label: '*rbacv1.ClusterRole（rbac.authorization.k8s.io グループ・クラスタスコープ）' },
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

const gvk = computed(() => `{Group: "${preset.value.group}", Version: "${preset.value.version}", Kind: "${preset.value.kind}"}`)
const gvr = computed(() => `{Group: "${preset.value.group}", Version: "${preset.value.version}", Resource: "${preset.value.resource}"}`)

const basePath = computed(() =>
  preset.value.group === '' ? `/api/${preset.value.version}` : `/apis/${preset.value.group}/${preset.value.version}`
)
const httpPath = computed(() => {
  const p = preset.value
  const nsSegment = p.namespaced ? `/namespaces/${namespace.value}` : ''
  return `${basePath.value}${nsSegment}/${p.resource}/${name.value}`
})

const clientCall = computed(() => {
  const p = preset.value
  const accessor = p.namespaced ? `${p.clientAccessor}("${namespace.value}")` : `${p.clientAccessor}()`
  return `${accessor}.Get("${name.value}", metav1.GetOptions{})`
})
</script>

<template>
  <div class="demo-panel">
    <div class="demo-mode-switch">
      <button :class="{ active: scopeMode === 'namespaced' }" @click="scopeMode = 'namespaced'">
        namespaced な型
      </button>
      <button :class="{ active: scopeMode === 'cluster' }" @click="scopeMode = 'cluster'">
        cluster-scoped な型
      </button>
    </div>

    <div class="demo-form-row">
      <label style="flex-basis: 100%">
        Golangの型
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
      <label>
        name
        <input v-model="name" type="text" />
      </label>
    </div>

    <div class="demo-box">
      <div class="demo-box-label">1. Golang type</div>
      <div><code>{{ preset.goType }}</code></div>
    </div>
    <div class="demo-box-label" style="text-align: center; margin: -0.25rem 0 0.5rem;">↓ <strong>Scheme</strong>（reflect.Typeから登録済みのGVKを引く）</div>

    <div class="demo-box">
      <div class="demo-box-label">2. GroupVersionKind（GVK）</div>
      <div><code>{{ gvk }}</code></div>
    </div>
    <div class="demo-box-label" style="text-align: center; margin: -0.25rem 0 0.5rem;">↓ <strong>RESTMapper</strong>（GVKに対応するGVRを引く = REST mapping）</div>

    <div class="demo-box">
      <div class="demo-box-label">3. GroupVersionResource（GVR）</div>
      <div><code>{{ gvr }}</code></div>
    </div>
    <div class="demo-box-label" style="text-align: center; margin: -0.25rem 0 0.5rem;">↓ <strong>client</strong>（GVR + namespace/nameからHTTPパスを組み立てる）</div>

    <div class="demo-result-box safe">
      <div class="demo-result-message">4. HTTP path</div>
      <div><code>GET {{ httpPath }}</code></div>
      <div class="demo-box-label" style="margin-top: 0.6rem;">Goコードでは、この4段階すべてを意識せずこう書くだけで済む</div>
      <div><code>{{ clientCall }}</code></div>
    </div>
  </div>
</template>
