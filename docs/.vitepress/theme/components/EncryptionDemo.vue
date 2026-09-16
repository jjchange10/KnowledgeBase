<script setup lang="ts">
import { ref, watch, computed } from 'vue'

// ==== AES-GCM（共通鍵暗号） ====
const plaintext = ref('これは秘密のメッセージです')
const passphrase = ref('correct-horse-battery')
const decryptPassphrase = ref('correct-horse-battery')
const ivB64 = ref('')
const cipherB64 = ref('')
const decryptResult = ref<{ ok: boolean; text: string } | null>(null)
const encrypting = ref(false)
const decrypting = ref(false)

function toBase64(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}

function fromBase64(b64: string) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

async function deriveKey(pass: string) {
  const passBytes = new TextEncoder().encode(pass)
  const hash = await crypto.subtle.digest('SHA-256', passBytes)
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function encrypt() {
  encrypting.value = true
  decryptResult.value = null
  try {
    const key = await deriveKey(passphrase.value)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(plaintext.value)
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
    ivB64.value = toBase64(iv.buffer)
    cipherB64.value = toBase64(cipher)
  } finally {
    encrypting.value = false
  }
}

async function decrypt() {
  if (!cipherB64.value) return
  decrypting.value = true
  try {
    const key = await deriveKey(decryptPassphrase.value)
    const iv = fromBase64(ivB64.value)
    const cipher = fromBase64(cipherB64.value)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
    decryptResult.value = { ok: true, text: new TextDecoder().decode(plain) }
  } catch {
    decryptResult.value = { ok: false, text: '復号に失敗しました（鍵が違う、または暗号文が改ざんされています）' }
  } finally {
    decrypting.value = false
  }
}

function useWrongKey() {
  decryptPassphrase.value = 'this-is-not-the-key'
  decrypt()
}

function useCorrectKey() {
  decryptPassphrase.value = passphrase.value
  decrypt()
}

// ==== SHA-256（ハッシュ関数） ====
const hashInput = ref('password123')
const currentHash = ref('')
const previousHash = ref('')

async function sha256Hex(text: string) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function diffCount(a: string, b: string) {
  const len = Math.max(a.length, b.length)
  let diff = 0
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) diff++
  }
  return diff
}

watch(
  hashInput,
  async (val) => {
    const hash = await sha256Hex(val)
    if (hash !== currentHash.value) {
      previousHash.value = currentHash.value
      currentHash.value = hash
    }
  },
  { immediate: true }
)

// ==== ソルトの効果 ====
const saltPassword = ref('password123')
const saltA = ref('')
const saltB = ref('')
const saltedHashA = ref('')
const saltedHashB = ref('')

function randomSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function regenerateSaltedHashes() {
  saltA.value = randomSalt()
  saltB.value = randomSalt()
  saltedHashA.value = await sha256Hex(saltA.value + saltPassword.value)
  saltedHashB.value = await sha256Hex(saltB.value + saltPassword.value)
}

regenerateSaltedHashes()

const mode = ref<'aes' | 'hash' | 'xor'>('aes')

// ==== XOR暗号（バイト単位の計算過程を可視化する簡易版） ====
const xorPlain = ref('HELLO')
const xorKey = ref('KEY')

function toHex(n: number) {
  return n.toString(16).padStart(2, '0').toUpperCase()
}

function toBits(n: number) {
  return n.toString(2).padStart(8, '0')
}

function printable(byte: number) {
  return byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '·'
}

const xorRows = computed(() => {
  const plainBytes = new TextEncoder().encode(xorPlain.value)
  const keyBytes = new TextEncoder().encode(xorKey.value || ' ')
  return Array.from(plainBytes).map((pByte, i) => {
    const kByte = keyBytes[i % keyBytes.length]
    const cByte = pByte ^ kByte
    return { i, pByte, kByte, cByte }
  })
})

const xorCipherHex = computed(() => xorRows.value.map((r) => toHex(r.cByte)).join(' '))

const xorDecryptedRows = computed(() => {
  const keyBytes = new TextEncoder().encode(xorKey.value || ' ')
  return xorRows.value.map((r, i) => {
    const kByte = keyBytes[i % keyBytes.length]
    const dByte = r.cByte ^ kByte
    return { ...r, dByte }
  })
})

const xorDecryptedText = computed(() => {
  const bytes = new Uint8Array(xorDecryptedRows.value.map((r) => r.dByte))
  return new TextDecoder().decode(bytes)
})
</script>

<template>
  <div class="demo-panel">
    <div class="demo-mode-switch">
      <button :class="{ active: mode === 'aes' }" @click="mode = 'aes'">
        共通鍵暗号（AES-GCM）
      </button>
      <button :class="{ active: mode === 'hash' }" @click="mode = 'hash'">
        ハッシュ関数（SHA-256）
      </button>
      <button :class="{ active: mode === 'xor' }" @click="mode = 'xor'">
        仕組みを見る（簡易XOR暗号）
      </button>
    </div>

    <template v-if="mode === 'aes'">
      <div class="demo-form-row">
        <label style="flex-basis: 100%">
          平文
          <textarea v-model="plaintext" rows="2" style="font-family: 'Fira Code', monospace; padding: 0.5rem 0.6rem; border-radius: 6px; border: 1px solid var(--vp-c-border); background-color: var(--vp-c-bg); color: var(--vp-c-text-1); font-size: 0.85rem;" />
        </label>
      </div>
      <div class="demo-form-row">
        <label>
          鍵（パスフレーズ）
          <input v-model="passphrase" type="text" />
        </label>
      </div>
      <button class="demo-run-btn" :disabled="encrypting" @click="encrypt">暗号化する</button>

      <div v-if="cipherB64" class="demo-box">
        <div class="demo-box-label">IV（毎回ランダムに生成）</div>
        <pre><code>{{ ivB64 }}</code></pre>
        <div class="demo-box-label" style="margin-top: 0.5rem;">暗号文（Base64）</div>
        <pre><code>{{ cipherB64 }}</code></pre>
      </div>

      <template v-if="cipherB64">
        <div class="demo-form-row">
          <label>
            復号に使う鍵（パスフレーズ）
            <input v-model="decryptPassphrase" type="text" />
          </label>
        </div>
        <div class="demo-examples">
          <button class="demo-link-btn" @click="useCorrectKey">正しい鍵で復号する</button>
          <button class="demo-link-btn" @click="useWrongKey">わざと違う鍵で復号してみる</button>
        </div>
        <button class="demo-run-btn" :disabled="decrypting" @click="decrypt">復号する</button>

        <div v-if="decryptResult" class="demo-result-box" :class="{ safe: decryptResult.ok, danger: !decryptResult.ok }">
          <div class="demo-result-message">{{ decryptResult.ok ? '復号成功' : '復号失敗' }}</div>
          <div>{{ decryptResult.text }}</div>
        </div>
      </template>
    </template>

    <template v-else-if="mode === 'hash'">
      <div class="demo-form-row">
        <label style="flex-basis: 100%">
          入力文字列
          <input v-model="hashInput" type="text" />
        </label>
      </div>

      <div class="demo-box">
        <div class="demo-box-label">SHA-256 ハッシュ値</div>
        <pre><code>{{ currentHash }}</code></pre>
      </div>

      <div v-if="previousHash" class="demo-result-box">
        <div class="demo-result-message">1文字変えただけで、ハッシュ値は別物になります</div>
        <div class="demo-box-label">直前のハッシュ値</div>
        <pre><code>{{ previousHash }}</code></pre>
        <div style="margin-top: 0.5rem;">
          64文字中 <strong>{{ diffCount(previousHash, currentHash) }}文字</strong> が変化しました
        </div>
      </div>

      <div class="demo-box" style="margin-top: 1.5rem;">
        <div class="demo-box-label">ソルトの効果（同じパスワードでも保存されるハッシュ値が変わる）</div>
        <div class="demo-form-row" style="margin-top: 0.5rem;">
          <label>
            パスワード
            <input v-model="saltPassword" type="text" @change="regenerateSaltedHashes" />
          </label>
        </div>
        <button class="demo-link-btn" style="margin-top: 0.5rem;" @click="regenerateSaltedHashes">ソルトを引き直す</button>
        <table style="margin-top: 0.75rem;">
          <thead>
            <tr><th>ユーザー</th><th>ソルト</th><th>保存されるハッシュ値（ソルト+パスワード）</th></tr>
          </thead>
          <tbody>
            <tr><td>ユーザーA</td><td>{{ saltA }}</td><td style="word-break: break-all;">{{ saltedHashA }}</td></tr>
            <tr><td>ユーザーB</td><td>{{ saltB }}</td><td style="word-break: break-all;">{{ saltedHashB }}</td></tr>
          </tbody>
        </table>
      </div>
    </template>

    <template v-else-if="mode === 'xor'">
      <div class="demo-box-label" style="margin-bottom: 0.75rem;">
        AESなど実際の共通鍵暗号はブロック単位で複雑な変換を何ラウンドも行いますが、
        「同じ鍵で暗号化と復号の両方ができる」という共通鍵暗号の基本原理は、
        1バイトずつの<strong>XOR（排他的論理和）</strong>という単純な計算で体験できます。
      </div>

      <div class="demo-form-row">
        <label>
          平文（半角英数字推奨）
          <input v-model="xorPlain" type="text" maxlength="12" />
        </label>
        <label>
          鍵
          <input v-model="xorKey" type="text" maxlength="12" />
        </label>
      </div>

      <div class="demo-box">
        <div class="demo-box-label">バイトごとのXOR計算（鍵は足りない分を繰り返し使用）</div>
        <table>
          <thead>
            <tr>
              <th>i</th>
              <th>平文文字</th>
              <th>平文 (2進数)</th>
              <th>鍵文字</th>
              <th>鍵 (2進数)</th>
              <th>XOR結果 (16進数)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in xorRows" :key="row.i">
              <td>{{ row.i }}</td>
              <td>{{ printable(row.pByte) }} ({{ toHex(row.pByte) }})</td>
              <td style="font-family: 'Fira Code', monospace;">{{ toBits(row.pByte) }}</td>
              <td>{{ printable(row.kByte) }} ({{ toHex(row.kByte) }})</td>
              <td style="font-family: 'Fira Code', monospace;">{{ toBits(row.kByte) }}</td>
              <td style="font-family: 'Fira Code', monospace;">{{ toHex(row.cByte) }}</td>
            </tr>
          </tbody>
        </table>
        <div class="demo-box-label" style="margin-top: 0.75rem;">暗号文（16進数のバイト列）</div>
        <pre><code>{{ xorCipherHex }}</code></pre>
      </div>

      <div class="demo-result-box safe">
        <div class="demo-result-message">同じ鍵で、もう一度XORすると元に戻る</div>
        <div>
          暗号文の各バイトに、同じ鍵バイトをもう一度XORすると平文に戻ります（<code>P ⊕ K ⊕ K = P</code>）。
        </div>
        <pre><code>復号結果: {{ xorDecryptedText }}</code></pre>
      </div>
    </template>
  </div>
</template>
