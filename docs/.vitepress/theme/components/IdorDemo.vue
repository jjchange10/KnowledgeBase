<script setup lang="ts">
import { ref, computed } from 'vue'

type Order = {
  id: number
  owner: string
  detail: string
}

const orders: Order[] = [
  { id: 1, owner: 'alice', detail: '注文#1: ノートPC / 配送先: 東京都渋谷区...' },
  { id: 2, owner: 'bob', detail: '注文#2: クレジットカード明細 / 下4桁: 1234' },
  { id: 3, owner: 'admin', detail: '注文#3: 社内備品 / 承認者コメント含む' },
]

// 「ログイン中」のユーザー
const currentUser = 'alice'

const mode = ref<'vulnerable' | 'safe'>('vulnerable')
const orderId = ref(1)

type Result = { ok: boolean; message: string; order?: Order }

const result = ref<Result | null>(null)

function fetchOrder() {
  const order = orders.find((o) => o.id === orderId.value)
  if (!order) {
    result.value = { ok: false, message: '注文が見つかりません' }
    return
  }

  if (mode.value === 'vulnerable') {
    // IDが一致するかどうかだけを見ており、所有者を確認していない
    result.value = { ok: true, message: `注文ID ${order.id} の詳細を取得しました`, order }
  } else {
    if (order.owner !== currentUser) {
      result.value = { ok: false, message: `403 Forbidden: この注文（所有者: ${order.owner}）にアクセスする権限がありません` }
    } else {
      result.value = { ok: true, message: `注文ID ${order.id} の詳細を取得しました`, order }
    }
  }
}
</script>

<template>
  <div class="demo-panel">
    <div class="demo-mode-switch">
      <button :class="{ active: mode === 'vulnerable' }" @click="mode = 'vulnerable'; result = null">
        脆弱な実装（IDのみで判定）
      </button>
      <button :class="{ active: mode === 'safe' }" @click="mode = 'safe'; result = null">
        安全な実装（所有者チェックあり）
      </button>
    </div>

    <div class="demo-box">
      <div class="demo-box-label">ログイン中のユーザー</div>
      <div>{{ currentUser }}（自分の注文は id=1 のみ）</div>
    </div>

    <div class="demo-form-row">
      <label>
        リクエストURL: /api/orders/<input v-model.number="orderId" type="number" style="width: 4rem; display: inline-block;" />
      </label>
    </div>

    <button class="demo-run-btn" @click="fetchOrder">注文詳細を取得</button>

    <div v-if="result" class="demo-result-box" :class="{ danger: result.ok && result.order && result.order.owner !== currentUser, safe: !result.ok }">
      <div class="demo-result-message">{{ result.message }}</div>
      <pre v-if="result.order"><code>{{ result.order.detail }}</code></pre>
    </div>
  </div>
</template>
