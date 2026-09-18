<script setup lang="ts">
import { ref } from 'vue'

type Mode = 'run' | 'speed'
const mode = ref<Mode>('run')

// ==== 実際のWASMバイナリ（手書きのバイナリ命令列。シミュレーションではない） ====

// add(a: i32, b: i32) -> i32
// wat相当: (func (param i32 i32) (result i32) local.get 0 local.get 1 i32.add)
const addWasmBytes = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x07, 0x01, 0x60, 0x02, 0x7f, 0x7f, 0x01, 0x7f,
  0x03, 0x02, 0x01, 0x00,
  0x07, 0x07, 0x01, 0x03, 0x61, 0x64, 0x64, 0x00, 0x00,
  0x0a, 0x09, 0x01, 0x07, 0x00, 0x20, 0x00, 0x20, 0x01, 0x6a, 0x0b,
])

// sumTo(n: i32) -> i32  … 1からnまでの合計をループで計算する（32bit整数の折り返しあり）
const sumWasmBytes = new Uint8Array([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
  0x01, 0x06, 0x01, 0x60, 0x01, 0x7f, 0x01, 0x7f,
  0x03, 0x02, 0x01, 0x00,
  0x07, 0x09, 0x01, 0x05, 0x73, 0x75, 0x6d, 0x54, 0x6f, 0x00, 0x00,
  0x0a, 0x2d, 0x01, 0x2b, 0x01, 0x02, 0x7f,
  0x41, 0x01, 0x21, 0x01, 0x41, 0x00, 0x21, 0x02,
  0x02, 0x40, 0x03, 0x40,
  0x20, 0x01, 0x20, 0x00, 0x4a, 0x0d, 0x01,
  0x20, 0x02, 0x20, 0x01, 0x6a, 0x21, 0x02,
  0x20, 0x01, 0x41, 0x01, 0x6a, 0x21, 0x01,
  0x0c, 0x00,
  0x0b, 0x0b,
  0x20, 0x02, 0x0b,
])

function toHexRows(bytes: Uint8Array, perRow = 8) {
  const rows: string[] = []
  for (let i = 0; i < bytes.length; i += perRow) {
    const chunk = Array.from(bytes.slice(i, i + perRow))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')
    rows.push(chunk)
  }
  return rows.join('\n')
}

// ==== モード1: 実際にバイナリを動かす ====
const a = ref(3)
const b = ref(4)
const runResult = ref<{ sum: number; compileMs: number; instantiateMs: number; callMs: number } | null>(null)
const running = ref(false)
const runError = ref('')

async function runAdd() {
  running.value = true
  runError.value = ''
  runResult.value = null
  try {
    const t0 = performance.now()
    const module = await WebAssembly.compile(addWasmBytes)
    const t1 = performance.now()
    const instance = await WebAssembly.instantiate(module)
    const t2 = performance.now()
    const sum = (instance.exports.add as (x: number, y: number) => number)(a.value, b.value)
    const t3 = performance.now()
    runResult.value = {
      sum,
      compileMs: t1 - t0,
      instantiateMs: t2 - t1,
      callMs: t3 - t2,
    }
  } catch (e) {
    runError.value = e instanceof Error ? e.message : String(e)
  } finally {
    running.value = false
  }
}

// ==== モード2: JS実装との速度比較 ====
const n = ref(100_000_000)
const speedRunning = ref(false)
const speedResult = ref<{ jsMs: number; wasmMs: number; jsResult: number; wasmResult: number } | null>(null)

function jsSumTo(limit: number) {
  let i = 1
  let acc = 0
  while (i <= limit) {
    acc = (acc + i) | 0
    i = (i + 1) | 0
  }
  return acc
}

async function runSpeedCompare() {
  speedRunning.value = true
  speedResult.value = null
  // UIの描画を挟んでから計測を始める（ボタン押下直後の描画ブロックの影響を減らす）
  await new Promise((resolve) => setTimeout(resolve, 30))
  try {
    const module = await WebAssembly.compile(sumWasmBytes)
    const instance = await WebAssembly.instantiate(module)
    const sumTo = instance.exports.sumTo as (limit: number) => number

    const t0 = performance.now()
    const jsResult = jsSumTo(n.value)
    const t1 = performance.now()
    const wasmResult = sumTo(n.value)
    const t2 = performance.now()

    speedResult.value = {
      jsMs: t1 - t0,
      wasmMs: t2 - t1,
      jsResult,
      wasmResult,
    }
  } finally {
    speedRunning.value = false
  }
}

function setN(value: number) {
  n.value = value
}
</script>

<template>
  <div class="demo-panel">
    <div class="demo-mode-switch">
      <button :class="{ active: mode === 'run' }" @click="mode = 'run'">① バイナリを実行する</button>
      <button :class="{ active: mode === 'speed' }" @click="mode = 'speed'">② JS実装との速度比較</button>
    </div>

    <template v-if="mode === 'run'">
      <p style="font-size: 0.85rem; color: var(--vp-c-text-2); margin-top: 0;">
        以下は本物のWASMバイナリ（<code>add(a, b)</code> を計算する関数1つだけを含む、41バイトの実行可能モジュール）です。
        「実行」を押すと、この画面内で実際に <code>WebAssembly.compile</code> → <code>WebAssembly.instantiate</code> →
        関数呼び出し、まで行います。
      </p>

      <div class="demo-box">
        <div class="demo-box-label">WASMバイナリ（16進数ダンプ、全{{ addWasmBytes.length }}バイト）</div>
        <pre>{{ toHexRows(addWasmBytes) }}</pre>
      </div>

      <div class="demo-form-row">
        <label>a<input v-model.number="a" type="number" /></label>
        <label>b<input v-model.number="b" type="number" /></label>
      </div>

      <button class="demo-run-btn" :disabled="running" @click="runAdd">
        {{ running ? '実行中...' : '実行する' }}
      </button>

      <div v-if="runResult" class="demo-result-box safe">
        <div class="demo-result-message">add({{ a }}, {{ b }}) = {{ runResult.sum }}</div>
        <table>
          <tbody>
            <tr><td>コンパイル時間</td><td>{{ runResult.compileMs.toFixed(3) }} ms</td></tr>
            <tr><td>インスタンス化時間</td><td>{{ runResult.instantiateMs.toFixed(3) }} ms</td></tr>
            <tr><td>関数呼び出し時間</td><td>{{ runResult.callMs.toFixed(3) }} ms</td></tr>
          </tbody>
        </table>
      </div>
      <div v-if="runError" class="demo-result-box danger">
        <div class="demo-result-message">エラー: {{ runError }}</div>
      </div>
    </template>

    <template v-else>
      <p style="font-size: 0.85rem; color: var(--vp-c-text-2); margin-top: 0;">
        もう1つのWASMバイナリは、<code>1からnまでの合計をループで計算する</code> 関数 <code>sumTo(n)</code> です。
        同じ処理をJavaScriptでも実装し、<strong>同じ入力で本当に実行時間を計測</strong>して比較します
        （どちらも32bit整数の折り返し演算をするので、大きなnでも結果は完全に一致します）。
      </p>

      <div class="demo-examples">
        <button class="demo-link-btn" @click="setN(1_000_000)">n = 1,000,000</button>
        <button class="demo-link-btn" @click="setN(100_000_000)">n = 100,000,000</button>
        <button class="demo-link-btn" @click="setN(500_000_000)">n = 500,000,000</button>
      </div>

      <div class="demo-form-row">
        <label>n（ループ回数）<input v-model.number="n" type="number" /></label>
      </div>

      <button class="demo-run-btn" :disabled="speedRunning" @click="runSpeedCompare">
        {{ speedRunning ? '計測中...' : '両方を実行して計測する' }}
      </button>

      <div v-if="speedResult" class="demo-result-box safe">
        <div class="demo-result-message">
          結果は一致: {{ speedResult.jsResult === speedResult.wasmResult ? `はい (${speedResult.jsResult})` : 'いいえ（バグ）' }}
        </div>
        <table>
          <thead>
            <tr><th>実装</th><th>実行時間</th></tr>
          </thead>
          <tbody>
            <tr><td>JavaScript</td><td>{{ speedResult.jsMs.toFixed(2) }} ms</td></tr>
            <tr><td>WebAssembly</td><td>{{ speedResult.wasmMs.toFixed(2) }} ms</td></tr>
          </tbody>
        </table>
        <p style="font-size: 0.8rem; color: var(--vp-c-text-2); margin: 0.6rem 0 0;">
          差はブラウザ・マシン・nの大きさによって変わります。単純なループはJavaScriptエンジンもJITで高速化するため、
          差が小さいこともあります。何度か実行したり、nを変えたりして試してみてください。
        </p>
      </div>
    </template>
  </div>
</template>
