<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const presets = [
  { p: 7n, q: 11n, label: 'p=7, q=11（最小サイズ）' },
  { p: 17n, q: 23n, label: 'p=17, q=23' },
  { p: 61n, q: 53n, label: 'p=61, q=53（教科書でよく使われるサイズ）' },
]

const presetIndex = ref(2)
const preset = computed(() => presets[presetIndex.value])
const p = computed(() => preset.value.p)
const q = computed(() => preset.value.q)
const n = computed(() => p.value * q.value)
const phi = computed(() => (p.value - 1n) * (q.value - 1n))

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    ;[a, b] = [b, a % b]
  }
  return a
}

function modInverse(a: bigint, m: bigint): bigint {
  let [oldR, r] = [a, m]
  let [oldS, s] = [1n, 0n]
  while (r !== 0n) {
    const qq = oldR / r
    ;[oldR, r] = [r, oldR - qq * r]
    ;[oldS, s] = [s, oldS - qq * s]
  }
  return ((oldS % m) + m) % m
}

const e = computed(() => {
  let candidate = 3n
  while (gcd(candidate, phi.value) !== 1n) {
    candidate += 2n
  }
  return candidate
})

const d = computed(() => modInverse(e.value, phi.value))

type Step = { bit: number; afterSquare: bigint; afterMultiply: bigint }

function modPowTrace(base: bigint, exp: bigint, mod: bigint) {
  const bits = exp.toString(2)
  let result = 1n
  const b = base % mod
  const steps: Step[] = []
  for (const ch of bits) {
    result = (result * result) % mod
    const afterSquare = result
    if (ch === '1') {
      result = (result * b) % mod
    }
    steps.push({ bit: ch === '1' ? 1 : 0, afterSquare, afterMultiply: result })
  }
  return { result, steps, bits }
}

const message = ref(65)
watch(n, (newN) => {
  if (BigInt(message.value) >= newN || message.value < 0) {
    message.value = Number(newN / 2n)
  }
})

const messageBig = computed(() => BigInt(Math.max(0, Math.floor(message.value || 0))))
const messageValid = computed(() => messageBig.value >= 0n && messageBig.value < n.value)

const encryptTrace = computed(() => (messageValid.value ? modPowTrace(messageBig.value, e.value, n.value) : null))
const cipher = computed(() => encryptTrace.value?.result ?? 0n)

const decryptTrace = computed(() => (messageValid.value ? modPowTrace(cipher.value, d.value, n.value) : null))
const decrypted = computed(() => decryptTrace.value?.result ?? 0n)

const showEncryptTrace = ref(false)
const showDecryptTrace = ref(false)
</script>

<template>
  <div class="demo-panel">
    <div class="demo-form-row">
      <label style="flex-basis: 100%">
        鍵のサイズ（学習用に非常に小さい素数を使っています。実際のRSAは数百桁の素数を使います）
        <select v-model.number="presetIndex" style="padding: 0.5rem 0.6rem; border-radius: 6px; border: 1px solid var(--vp-c-border); background-color: var(--vp-c-bg); color: var(--vp-c-text-1);">
          <option v-for="(pr, i) in presets" :key="i" :value="i">{{ pr.label }}</option>
        </select>
      </label>
    </div>

    <div class="demo-box">
      <div class="demo-box-label">鍵の生成</div>
      <table>
        <tbody>
          <tr><td>素数 p, q</td><td>{{ p }}, {{ q }}</td></tr>
          <tr><td>n = p × q</td><td>{{ n }}</td></tr>
          <tr><td>φ(n) = (p−1)(q−1)</td><td>{{ phi }}</td></tr>
          <tr><td>公開鍵 e（φ(n)と互いに素な最小の奇数）</td><td>{{ e }}</td></tr>
          <tr><td>秘密鍵 d（e × d ≡ 1 mod φ(n) を満たす数）</td><td>{{ d }}</td></tr>
        </tbody>
      </table>
      <div class="demo-box-label" style="margin-top: 0.5rem;">
        公開鍵 (e, n) = ({{ e }}, {{ n }}) は誰にでも公開できます。秘密鍵 d は自分だけが持ちます。
      </div>
    </div>

    <div class="demo-form-row">
      <label>
        平文（0 〜 {{ n - 1n }} の整数）
        <input v-model.number="message" type="number" min="0" :max="Number(n - 1n)" />
      </label>
    </div>
    <div v-if="!messageValid" class="demo-warning">⚠️ n未満の整数を入力してください</div>

    <template v-if="messageValid">
      <div class="demo-box">
        <div class="demo-box-label">暗号化: c = m^e mod n</div>
        <div>c = {{ message }}^{{ e }} mod {{ n }} = <strong>{{ cipher }}</strong></div>
        <button class="demo-link-btn" style="margin-top: 0.5rem;" @click="showEncryptTrace = !showEncryptTrace">
          {{ showEncryptTrace ? '計算過程を隠す' : '計算過程を見る（繰り返し二乗法）' }}
        </button>
        <table v-if="showEncryptTrace" style="margin-top: 0.5rem;">
          <thead>
            <tr><th>指数eのビット</th><th>2乗後</th><th>ビットが1なら×m</th></tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in encryptTrace?.steps" :key="i">
              <td>{{ s.bit }}</td>
              <td>{{ s.afterSquare }}</td>
              <td>{{ s.afterMultiply }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="demo-result-box safe">
        <div class="demo-result-message">復号: m' = c^d mod n</div>
        <div>m' = {{ cipher }}^{{ d }} mod {{ n }} = <strong>{{ decrypted }}</strong>
          {{ decrypted === messageBig ? '✓ 元の平文と一致' : '' }}
        </div>
        <button class="demo-link-btn" style="margin-top: 0.5rem;" @click="showDecryptTrace = !showDecryptTrace">
          {{ showDecryptTrace ? '計算過程を隠す' : '計算過程を見る（繰り返し二乗法）' }}
        </button>
        <table v-if="showDecryptTrace" style="margin-top: 0.5rem;">
          <thead>
            <tr><th>指数dのビット</th><th>2乗後</th><th>ビットが1なら×c</th></tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in decryptTrace?.steps" :key="i">
              <td>{{ s.bit }}</td>
              <td>{{ s.afterSquare }}</td>
              <td>{{ s.afterMultiply }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
