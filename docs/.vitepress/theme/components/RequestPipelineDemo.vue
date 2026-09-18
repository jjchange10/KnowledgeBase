<script setup lang="ts">
import { ref, computed } from 'vue'

type AuthnState = 'success' | 'fail'
type AuthzState = 'allow' | 'deny'
type ValidationState = 'pass' | 'fail'

const authn = ref<AuthnState>('success')
const authz = ref<AuthzState>('allow')
const validation = ref<ValidationState>('pass')

type Scenario = 'success' | 'authn-fail' | 'authz-fail' | 'validation-fail'
const scenario = ref<Scenario>('success')

function applyScenario(s: Scenario) {
  scenario.value = s
  trace.value = []
  if (s === 'success') {
    authn.value = 'success'
    authz.value = 'allow'
    validation.value = 'pass'
  } else if (s === 'authn-fail') {
    authn.value = 'fail'
  } else if (s === 'authz-fail') {
    authn.value = 'success'
    authz.value = 'deny'
  } else if (s === 'validation-fail') {
    authn.value = 'success'
    authz.value = 'allow'
    validation.value = 'fail'
  }
}

type Stage = {
  key: string
  label: string
  source: string
  detail: string
  check: () => boolean
  failStatus?: number
  failLabel?: string
}

const stages = computed<Stage[]>(() => [
  {
    key: 'authn',
    label: '1. 認証（Authentication）',
    source: 'WithAuthentication() — endpoints/filters/authentication.go',
    detail: 'リクエストを人間またはマシンユーザーとして認証し、成功すればユーザー情報をcontextに格納する。',
    check: () => authn.value === 'success',
    failStatus: 401,
    failLabel: '401 Unauthorized',
  },
  {
    key: 'authz',
    label: '2. 認可（Authorization / RBAC）',
    source: 'WithAuthorization() — endpoints/filters/authorization.go',
    detail: '認証済みユーザーがこの操作を行う権限を持つか、RBACなどの認可モジュールでチェックする。',
    check: () => authz.value === 'allow',
    failStatus: 403,
    failLabel: '403 Forbidden',
  },
  {
    key: 'mutating-admission',
    label: '3. Admission（Mutating）',
    source: 'admission chain（mutating phase）',
    detail: '例: imagePullPolicy が未指定なら Always / IfNotPresent を補完するなど、リクエスト内容を書き換える。',
    check: () => true,
  },
  {
    key: 'validating-admission',
    label: '4. Admission（Validating）/ Validation',
    source: 'admission chain（validating phase）+ 各オブジェクトのvalidationロジック',
    detail: '例: コンテナ名の重複、DNS互換文字のチェックなど、オブジェクトの内容を検証する。',
    check: () => validation.value === 'pass',
    failStatus: 422,
    failLabel: '422 Unprocessable Entity',
  },
  {
    key: 'etcd',
    label: '5. etcdへの書き込み（CRUD）',
    source: 'registry / etcd-backed CRUD logic',
    detail: 'オブジェクトがetcdに永続化される。更新の場合はOptimistic Concurrencyのチェックも行われる。',
    check: () => true,
  },
])

type TraceEntry = { stage: Stage; passed: boolean }
const trace = ref<TraceEntry[]>([])
const finished = ref(false)
const finalStatus = ref<{ code: number; label: string; danger: boolean } | null>(null)

function run() {
  trace.value = []
  finished.value = false
  finalStatus.value = null

  for (const stage of stages.value) {
    const passed = stage.check()
    trace.value.push({ stage, passed })
    if (!passed) {
      finalStatus.value = { code: stage.failStatus!, label: stage.failLabel!, danger: true }
      finished.value = true
      return
    }
  }
  finalStatus.value = { code: 201, label: '201 Created', danger: false }
  finished.value = true
}
</script>

<template>
  <div class="demo-panel">
    <div class="demo-mode-switch">
      <button :class="{ active: scenario === 'success' }" @click="applyScenario('success')">成功パターン</button>
      <button :class="{ active: scenario === 'authn-fail' }" @click="applyScenario('authn-fail')">認証失敗</button>
      <button :class="{ active: scenario === 'authz-fail' }" @click="applyScenario('authz-fail')">認可失敗</button>
      <button :class="{ active: scenario === 'validation-fail' }" @click="applyScenario('validation-fail')">バリデーション失敗</button>
    </div>

    <div class="demo-form-row">
      <label>
        認証（authn）
        <select v-model="authn" style="margin-top: 0.25rem; padding: 0.5rem 0.6rem; border-radius: 6px; border: 1px solid var(--vp-c-border); background-color: var(--vp-c-bg); color: var(--vp-c-text-1);">
          <option value="success">成功</option>
          <option value="fail">失敗（不正な認証情報）</option>
        </select>
      </label>
      <label>
        認可（RBAC）
        <select v-model="authz" style="margin-top: 0.25rem; padding: 0.5rem 0.6rem; border-radius: 6px; border: 1px solid var(--vp-c-border); background-color: var(--vp-c-bg); color: var(--vp-c-text-1);">
          <option value="allow">許可</option>
          <option value="deny">拒否（権限不足）</option>
        </select>
      </label>
      <label>
        バリデーション
        <select v-model="validation" style="margin-top: 0.25rem; padding: 0.5rem 0.6rem; border-radius: 6px; border: 1px solid var(--vp-c-border); background-color: var(--vp-c-bg); color: var(--vp-c-text-1);">
          <option value="pass">通過</option>
          <option value="fail">失敗（不正なオブジェクト内容）</option>
        </select>
      </label>
    </div>

    <button class="demo-run-btn" @click="run">POST でリクエストを送信</button>

    <div v-if="trace.length > 0" class="demo-box">
      <div class="demo-box-label">リクエスト処理チェーン（実行された順番）</div>
      <div class="demo-log">
        <div v-for="(t, i) in trace" :key="i">
          {{ t.passed ? '✅' : '❌' }} {{ t.stage.label }}
          <span style="color: var(--vp-c-text-2); font-size: 0.75rem;">（{{ t.stage.source }}）</span>
          <div style="color: var(--vp-c-text-2); font-size: 0.75rem; margin-left: 1.4rem;">{{ t.stage.detail }}</div>
        </div>
      </div>
    </div>

    <div v-if="finished && finalStatus" class="demo-result-box" :class="finalStatus.danger ? 'danger' : 'safe'">
      <div class="demo-result-message">{{ finalStatus.label }}</div>
      <div v-if="finalStatus.danger">
        リクエストは途中の段階で拒否され、それ以降のステージ（admissionやetcdへの書き込み）は一切実行されていません。
      </div>
      <div v-else>
        すべてのステージを通過し、オブジェクトがetcdに永続化されました。
      </div>
    </div>
  </div>
</template>
