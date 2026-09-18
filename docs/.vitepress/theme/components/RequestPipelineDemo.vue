<script setup lang="ts">
import { ref, computed } from 'vue'

type AuthnState = 'success' | 'fail'
type AuthzState = 'allow' | 'deny'
type CheckState = 'pass' | 'fail'

const authn = ref<AuthnState>('success')
const authz = ref<AuthzState>('allow')
const schemaValid = ref<CheckState>('pass')
const policyValid = ref<CheckState>('pass')

type Scenario = 'success' | 'authn-fail' | 'authz-fail' | 'schema-fail' | 'policy-fail'
const scenario = ref<Scenario>('success')

function applyScenario(s: Scenario) {
  scenario.value = s
  trace.value = []
  authn.value = 'success'
  authz.value = 'allow'
  schemaValid.value = 'pass'
  policyValid.value = 'pass'
  if (s === 'authn-fail') {
    authn.value = 'fail'
  } else if (s === 'authz-fail') {
    authz.value = 'deny'
  } else if (s === 'schema-fail') {
    schemaValid.value = 'fail'
  } else if (s === 'policy-fail') {
    policyValid.value = 'fail'
  }
}

type Stage = {
  key: string
  label: string
  figureBox: string
  detail: string
  check: () => boolean
  failStatus?: number
  failLabel?: string
}

const stages = computed<Stage[]>(() => [
  {
    key: 'http-handler',
    label: '1. API HTTP handler',
    figureBox: 'API HTTP handler',
    detail: 'リクエストがAPIサーバーのHTTP処理層に到達する。',
    check: () => true,
  },
  {
    key: 'authn-authz',
    label: '2. authn & authz（認証・認可）',
    figureBox: 'authn & authz',
    detail: '「誰か」を確認（認証）→「その操作をしてよいか」を確認（認可）。',
    check: () => authn.value === 'success' && authz.value === 'allow',
    get failStatus() {
      return authn.value !== 'success' ? 401 : 403
    },
    get failLabel() {
      return authn.value !== 'success' ? '401 Unauthorized' : '403 Forbidden'
    },
  },
  {
    key: 'mutating-admission',
    label: '3. Mutating admission',
    figureBox: 'Mutating admission',
    detail: '例: imagePullPolicy が未指定なら Always / IfNotPresent を補完するなど、オブジェクトの内容を書き換える（Mutating webhooksで独自ロジックを追加可能）。',
    check: () => true,
  },
  {
    key: 'schema-validation',
    label: '4. Object schema validation',
    figureBox: 'Object schema validation',
    detail: '書き換え後のオブジェクトが型として正しいかを機械的にチェック（必須フィールド、DNS互換文字、コンテナ名の重複など）。',
    check: () => schemaValid.value === 'pass',
    failStatus: 422,
    failLabel: '422 Unprocessable Entity',
  },
  {
    key: 'validating-admission',
    label: '5. Validating admission',
    figureBox: 'Validating admission',
    detail: '型ではなく組織のポリシー的にOKかを追加チェック（Validating webhooksで独自ルールを追加可能）。',
    check: () => policyValid.value === 'pass',
    failStatus: 400,
    failLabel: '400 Bad Request（webhookがコードを指定しない場合のデフォルト）',
  },
  {
    key: 'etcd',
    label: '6. Persisting to etcd',
    figureBox: 'Persisting to etcd',
    detail: 'ここまで全段階を通過したオブジェクトが、ようやくetcdに永続化される。更新の場合はOptimistic Concurrencyのチェックも行われる。',
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
      <button :class="{ active: scenario === 'schema-fail' }" @click="applyScenario('schema-fail')">スキーマ検証失敗</button>
      <button :class="{ active: scenario === 'policy-fail' }" @click="applyScenario('policy-fail')">ポリシー違反</button>
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
        Object schema validation
        <select v-model="schemaValid" style="margin-top: 0.25rem; padding: 0.5rem 0.6rem; border-radius: 6px; border: 1px solid var(--vp-c-border); background-color: var(--vp-c-bg); color: var(--vp-c-text-1);">
          <option value="pass">通過（型として正しい）</option>
          <option value="fail">失敗（必須フィールド欠落など）</option>
        </select>
      </label>
      <label>
        Validating admission
        <select v-model="policyValid" style="margin-top: 0.25rem; padding: 0.5rem 0.6rem; border-radius: 6px; border: 1px solid var(--vp-c-border); background-color: var(--vp-c-bg); color: var(--vp-c-text-1);">
          <option value="pass">通過（ポリシーOK）</option>
          <option value="fail">失敗（社内ポリシー違反）</option>
        </select>
      </label>
    </div>

    <button class="demo-run-btn" @click="run">POST でリクエストを送信</button>

    <div v-if="trace.length > 0" class="demo-box">
      <div class="demo-box-label">リクエスト処理パイプライン（Figure 2-5の6段階を実行された順に表示）</div>
      <div class="demo-log">
        <div v-for="(t, i) in trace" :key="i">
          {{ t.passed ? '✅' : '❌' }} {{ t.stage.label }}
          <div style="color: var(--vp-c-text-2); font-size: 0.75rem; margin-left: 1.4rem;">{{ t.stage.detail }}</div>
        </div>
      </div>
    </div>

    <div v-if="finished && finalStatus" class="demo-result-box" :class="finalStatus.danger ? 'danger' : 'safe'">
      <div class="demo-result-message">{{ finalStatus.label }}</div>
      <div v-if="finalStatus.danger">
        リクエストは途中の段階で拒否され、それ以降のステージ（後続のadmissionやetcdへの書き込み）は一切実行されていません。
      </div>
      <div v-else>
        すべてのステージを通過し、オブジェクトがetcdに永続化されました。
      </div>
    </div>
  </div>
</template>
