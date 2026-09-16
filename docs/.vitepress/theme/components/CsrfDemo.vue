<script setup lang="ts">
import { ref } from 'vue'

const mode = ref<'vulnerable' | 'safe'>('vulnerable')
const balance = ref(10000)
const amount = ref(1000)
const log = ref<{ text: string; danger: boolean }[]>([])

// 正規サイトだけが知っているCSRFトークン。攻撃者のページには埋め込めない想定。
const legitToken = 'server-issued-csrf-token'

function transferFromLegitForm() {
  balance.value -= amount.value
  log.value.unshift({
    text: `✅ 本人の操作で ${amount.value.toLocaleString()}円を送金しました`,
    danger: false,
  })
}

function triggerForgedRequest() {
  if (mode.value === 'vulnerable') {
    // サーバーはログイン中のセッションCookieだけを見てリクエストを受理してしまう
    balance.value -= 5000
    log.value.unshift({
      text: '🚨 攻撃者ページ経由で身に覚えのない5,000円の送金が実行されました（ブラウザが自動でセッションCookieを送信したため、正規のリクエストとして処理された）',
      danger: true,
    })
  } else {
    log.value.unshift({
      text: '🛡️ 攻撃者ページからのリクエストは拒否されました（CSRFトークンが一致しないため）',
      danger: false,
    })
  }
}

function reset() {
  balance.value = 10000
  log.value = []
}
</script>

<template>
  <div class="demo-panel">
    <div class="demo-mode-switch">
      <button :class="{ active: mode === 'vulnerable' }" @click="mode = 'vulnerable'; reset()">
        脆弱な実装（トークン検証なし）
      </button>
      <button :class="{ active: mode === 'safe' }" @click="mode = 'safe'; reset()">
        安全な実装（CSRFトークン検証あり）
      </button>
    </div>

    <div class="demo-box">
      <div class="demo-box-label">銀行サイト（正規）にログイン中 / 残高</div>
      <div style="font-size: 1.4rem; font-weight: 700;">¥{{ balance.toLocaleString() }}</div>
    </div>

    <div class="demo-form-row">
      <label>
        送金額
        <input v-model.number="amount" type="number" />
      </label>
    </div>
    <button class="demo-run-btn" @click="transferFromLegitForm">正規フォームから送金する</button>

    <div class="demo-box">
      <div class="demo-box-label">攻撃者が用意した別サイトのページ（あなたが開いてしまったとする）</div>
      <pre><code>&lt;form action="/transfer" method="POST"&gt;
  &lt;input type="hidden" name="to" value="attacker" /&gt;
  &lt;input type="hidden" name="amount" value="5000" /&gt;
&lt;/form&gt;
&lt;script&gt;document.forms[0].submit()&lt;/script&gt;</code></pre>
      <div class="demo-box-label" style="margin-top: 0.5rem;">
        このページを開くだけで、フォームが自動送信されます（ユーザーは何も操作していません）。
      </div>
    </div>
    <button class="demo-run-btn" @click="triggerForgedRequest">この攻撃者ページを開いてみる（シミュレーション）</button>

    <div v-if="log.length > 0" class="demo-result-box" :class="{ danger: log[0].danger, safe: !log[0].danger && mode === 'safe' }">
      <div class="demo-log">
        <div v-for="(entry, i) in log" :key="i">{{ entry.text }}</div>
      </div>
    </div>
  </div>
</template>
