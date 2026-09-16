<script setup lang="ts">
import { ref } from 'vue'

const mode = ref<'vulnerable' | 'safe'>('vulnerable')
const comment = ref('<img src="x" onerror="document.title = \'🚨 XSS実行: タイトルが書き換えられました\'">')
const posted = ref<string | null>(null)
const originalTitle = document.title

function post() {
  posted.value = comment.value
}

function loadNormalExample() {
  comment.value = 'このページ役に立ちました、ありがとうございます！'
  posted.value = null
  document.title = originalTitle
}

function loadPayloadExample() {
  comment.value = '<img src="x" onerror="document.title = \'🚨 XSS実行: タイトルが書き換えられました\'">'
  posted.value = null
  document.title = originalTitle
}
</script>

<template>
  <div class="demo-panel">
    <div class="demo-mode-switch">
      <button :class="{ active: mode === 'vulnerable' }" @click="mode = 'vulnerable'; posted = null">
        脆弱な実装（v-html でそのまま描画）
      </button>
      <button :class="{ active: mode === 'safe' }" @click="mode = 'safe'; posted = null">
        安全な実装（テキストとしてエスケープ）
      </button>
    </div>

    <div class="demo-form-row">
      <label style="flex-basis: 100%">
        コメント
        <textarea v-model="comment" rows="2" style="font-family: 'Fira Code', monospace; padding: 0.5rem 0.6rem; border-radius: 6px; border: 1px solid var(--vp-c-border); background-color: var(--vp-c-bg); color: var(--vp-c-text-1); font-size: 0.85rem;" />
      </label>
    </div>

    <div class="demo-examples">
      <button class="demo-link-btn" @click="loadNormalExample">通常の入力例</button>
      <button class="demo-link-btn" @click="loadPayloadExample">攻撃ペイロード例</button>
    </div>

    <button class="demo-run-btn" @click="post">投稿する</button>

    <div v-if="posted !== null" class="demo-box">
      <div class="demo-box-label">画面に描画されたコメント（他のユーザーがこのページを見た状態）</div>
      <div class="demo-render-box">
        <div v-if="mode === 'vulnerable'" v-html="posted"></div>
        <div v-else>{{ posted }}</div>
      </div>
      <div v-if="mode === 'vulnerable'" class="demo-warning">
        ⚠️ 入力された HTML/JavaScript がそのまま実行されています（ブラウザのタブタイトルを確認してください）
      </div>
    </div>
  </div>
</template>
