<script setup lang="ts">
import { ref, computed } from 'vue'

type FakeUser = {
  id: number
  username: string
  password: string
  role: 'admin' | 'user'
}

// このコンポーネント内だけに存在する「見せかけの」データです。
// 実際のデータベースやサーバーには一切接続していません。
const fakeUsers: FakeUser[] = [
  { id: 1, username: 'alice', password: 'alice123', role: 'user' },
  { id: 2, username: 'bob', password: 'passw0rd', role: 'user' },
  { id: 3, username: 'admin', password: 'sup3rSecret!', role: 'admin' },
]

const mode = ref<'vulnerable' | 'safe'>('vulnerable')
const username = ref('')
const password = ref("' OR '1'='1")

// 典型的な「常にtrueになる/以降を無効化する」インジェクションパターンの簡易検出。
// 実際のSQLパーサではなく、あくまで挙動を疑似的に再現するための簡略ロジックです。
const injectionPattern = /'\s*(or|OR)\s*'?1'?\s*=\s*'?1|--|#/

const query = computed(() => {
  if (mode.value === 'safe') {
    return `SELECT * FROM users WHERE username = ? AND password = ?\n-- bind params: ["${username.value}", "${password.value}"]`
  }
  return `SELECT * FROM users WHERE username = '${username.value}' AND password = '${password.value}'`
})

const isInjected = computed(() => {
  if (mode.value !== 'vulnerable') return false
  return injectionPattern.test(username.value) || injectionPattern.test(password.value)
})

type LoginResult = {
  success: boolean
  leaked: FakeUser[]
  message: string
}

const result = ref<LoginResult | null>(null)

function run() {
  if (mode.value === 'vulnerable') {
    if (isInjected.value) {
      // 文字列連結によりWHERE句が常に真になった/コメントアウトされた状態を再現
      result.value = {
        success: true,
        leaked: fakeUsers,
        message: 'パスワードを検証せずログイン成立。全ユーザーの情報が返っています。',
      }
    } else {
      const matched = fakeUsers.filter(
        (u) => u.username === username.value && u.password === password.value
      )
      result.value = {
        success: matched.length > 0,
        leaked: matched,
        message: matched.length > 0 ? 'ログイン成功' : 'ユーザー名またはパスワードが違います',
      }
    }
  } else {
    // 安全な実装: 値は常に「データ」として扱われ、クエリ構造には影響しない
    const matched = fakeUsers.filter(
      (u) => u.username === username.value && u.password === password.value
    )
    result.value = {
      success: matched.length > 0,
      leaked: matched,
      message: matched.length > 0 ? 'ログイン成功' : 'ユーザー名またはパスワードが違います',
    }
  }
}

function loadPayloadExample() {
  username.value = 'alice'
  password.value = "' OR '1'='1"
  result.value = null
}

function loadNormalExample() {
  username.value = 'alice'
  password.value = 'alice123'
  result.value = null
}
</script>

<template>
  <div class="demo-panel">
    <div class="demo-mode-switch">
      <button :class="{ active: mode === 'vulnerable' }" @click="mode = 'vulnerable'; result = null">
        脆弱な実装（文字列連結）
      </button>
      <button :class="{ active: mode === 'safe' }" @click="mode = 'safe'; result = null">
        安全な実装（プレースホルダ）
      </button>
    </div>

    <div class="demo-form-row">
      <label>
        ユーザー名
        <input v-model="username" type="text" placeholder="username" />
      </label>
      <label>
        パスワード
        <input v-model="password" type="text" placeholder="password" />
      </label>
    </div>

    <div class="demo-examples">
      <button class="demo-link-btn" @click="loadNormalExample">通常の入力例</button>
      <button class="demo-link-btn" @click="loadPayloadExample">攻撃ペイロード例</button>
    </div>

    <button class="demo-run-btn" @click="run">ログイン実行</button>

    <div class="demo-box">
      <div class="demo-box-label">実際に組み立てられるクエリ</div>
      <pre><code>{{ query }}</code></pre>
      <div v-if="isInjected" class="demo-warning">
        ⚠️ 入力値がクエリの構造そのものを書き換えています（WHERE句が常に真、または以降が無効化）
      </div>
    </div>

    <div v-if="result" class="demo-result-box" :class="{ danger: result.success && result.leaked.length > 1 }">
      <div class="demo-result-message">{{ result.message }}</div>
      <table v-if="result.leaked.length > 0">
        <thead>
          <tr>
            <th>id</th>
            <th>username</th>
            <th>password</th>
            <th>role</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in result.leaked" :key="u.id">
            <td>{{ u.id }}</td>
            <td>{{ u.username }}</td>
            <td>{{ u.password }}</td>
            <td>{{ u.role }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
