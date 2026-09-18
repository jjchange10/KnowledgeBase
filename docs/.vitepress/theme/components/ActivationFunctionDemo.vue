<script setup lang="ts">
import { ref, computed } from 'vue'

type Mode = 'compare' | 'perceptron-vs-nn'
const mode = ref<Mode>('compare')

// ==== 活性化関数（本の式そのまま） ====
function stepFunction(x: number) {
  return x > 0 ? 1 : 0
}
function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x))
}
function relu(x: number) {
  return Math.max(0, x)
}

// ==== モード1: 3つの活性化関数を比較する ====
const x = ref(2.0)

const stepY = computed(() => stepFunction(x.value))
const sigmoidY = computed(() => sigmoid(x.value))
const reluY = computed(() => relu(x.value))

const XMIN = -5
const XMAX = 5
const SVG_W = 280
const SVG_H = 160

function toSvgX(px: number) {
  return ((px - XMIN) / (XMAX - XMIN)) * SVG_W
}
function toSvgY(py: number, yMin: number, yMax: number) {
  return SVG_H - ((py - yMin) / (yMax - yMin)) * SVG_H
}

function buildPath(fn: (v: number) => number, yMin: number, yMax: number) {
  const points: string[] = []
  for (let px = XMIN; px <= XMAX + 1e-9; px += 0.1) {
    const py = Math.min(Math.max(fn(px), yMin), yMax)
    points.push(`${toSvgX(px).toFixed(1)},${toSvgY(py, yMin, yMax).toFixed(1)}`)
  }
  return points.join(' ')
}

const stepPath = computed(() => buildPath(stepFunction, -0.2, 1.2))
const sigmoidPath = computed(() => buildPath(sigmoid, -0.2, 1.2))
const reluPath = computed(() => buildPath(relu, -1, 5))

function marker(fn: (v: number) => number, yMin: number, yMax: number) {
  const py = Math.min(Math.max(fn(x.value), yMin), yMax)
  return { cx: toSvgX(x.value), cy: toSvgY(py, yMin, yMax) }
}
const stepMarker = computed(() => marker(stepFunction, -0.2, 1.2))
const sigmoidMarker = computed(() => marker(sigmoid, -0.2, 1.2))
const reluMarker = computed(() => marker(relu, -1, 5))

function setX(v: number) {
  x.value = v
}

// ==== モード2: パーセプトロン vs ニューラルネットワーク ====
// 「2章のANDゲート」と同じ重み・バイアスをデフォルトにする
const w1 = ref(0.5)
const w2 = ref(0.5)
const b = ref(-0.7)
const px1 = ref(1)
const px2 = ref(1)

const a = computed(() => b.value + w1.value * px1.value + w2.value * px2.value)
const yPerceptron = computed(() => stepFunction(a.value))
const yNeuralNet = computed(() => sigmoid(a.value))

function setGate(preset: 'and' | 'or' | 'nand') {
  if (preset === 'and') {
    w1.value = 0.5
    w2.value = 0.5
    b.value = -0.7
  } else if (preset === 'or') {
    w1.value = 0.5
    w2.value = 0.5
    b.value = -0.2
  } else {
    w1.value = -0.5
    w2.value = -0.5
    b.value = 0.7
  }
}
</script>

<template>
  <div class="demo-panel">
    <div class="demo-mode-switch">
      <button :class="{ active: mode === 'compare' }" @click="mode = 'compare'">① 3つの活性化関数を比較</button>
      <button :class="{ active: mode === 'perceptron-vs-nn' }" @click="mode = 'perceptron-vs-nn'">
        ② パーセプトロンとの違いを見る
      </button>
    </div>

    <template v-if="mode === 'compare'">
      <p style="font-size: 0.85rem; color: var(--vp-c-text-2); margin-top: 0;">
        入力 <code>x</code> をひとつ決めると、ステップ関数・シグモイド関数・ReLUのそれぞれで
        <code>h(x)</code> を実際に計算してグラフ上にプロットします（<code>Math.exp</code> などを使った本物の計算です）。
      </p>

      <div class="demo-examples">
        <button class="demo-link-btn" @click="setX(-3)">x = -3</button>
        <button class="demo-link-btn" @click="setX(0.01)">x ≈ 0</button>
        <button class="demo-link-btn" @click="setX(2)">x = 2</button>
      </div>

      <div class="demo-form-row">
        <label>x
          <input v-model.number="x" type="range" min="-5" max="5" step="0.1" />
        </label>
      </div>
      <p style="font-size: 0.85rem; margin-top: -0.5rem;">x = <strong>{{ x.toFixed(2) }}</strong></p>

      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <div class="demo-box" style="flex: 1; min-width: 220px;">
          <div class="demo-box-label">ステップ関数: h({{ x.toFixed(2) }}) = {{ stepY }}</div>
          <svg :viewBox="`0 0 ${SVG_W} ${SVG_H}`" style="width: 100%; height: auto; background: var(--vp-c-bg-soft);">
            <line :x1="toSvgX(0)" y1="0" :x2="toSvgX(0)" :y2="SVG_H" stroke="var(--vp-c-border)" />
            <polyline :points="stepPath" fill="none" stroke="var(--vp-c-brand)" stroke-width="2" />
            <circle :cx="stepMarker.cx" :cy="stepMarker.cy" r="4" fill="#d1453b" />
          </svg>
        </div>
        <div class="demo-box" style="flex: 1; min-width: 220px;">
          <div class="demo-box-label">シグモイド関数: h({{ x.toFixed(2) }}) = {{ sigmoidY.toFixed(4) }}</div>
          <svg :viewBox="`0 0 ${SVG_W} ${SVG_H}`" style="width: 100%; height: auto; background: var(--vp-c-bg-soft);">
            <line :x1="toSvgX(0)" y1="0" :x2="toSvgX(0)" :y2="SVG_H" stroke="var(--vp-c-border)" />
            <polyline :points="sigmoidPath" fill="none" stroke="var(--vp-c-brand)" stroke-width="2" />
            <circle :cx="sigmoidMarker.cx" :cy="sigmoidMarker.cy" r="4" fill="#d1453b" />
          </svg>
        </div>
        <div class="demo-box" style="flex: 1; min-width: 220px;">
          <div class="demo-box-label">ReLU: h({{ x.toFixed(2) }}) = {{ reluY.toFixed(4) }}</div>
          <svg :viewBox="`0 0 ${SVG_W} ${SVG_H}`" style="width: 100%; height: auto; background: var(--vp-c-bg-soft);">
            <line :x1="toSvgX(0)" y1="0" :x2="toSvgX(0)" :y2="SVG_H" stroke="var(--vp-c-border)" />
            <polyline :points="reluPath" fill="none" stroke="var(--vp-c-brand)" stroke-width="2" />
            <circle :cx="reluMarker.cx" :cy="reluMarker.cy" r="4" fill="#d1453b" />
          </svg>
        </div>
      </div>
    </template>

    <template v-else>
      <p style="font-size: 0.85rem; color: var(--vp-c-text-2); margin-top: 0;">
        パーセプトロンとニューラルネットワークの構造は同じです。違うのは
        <strong>「重み付き和 <code>a = b + w1*x1 + w2*x2</code> をどの活性化関数に通すか」</strong>だけ、ということを
        実際の数値で確認します。
      </p>

      <div class="demo-examples">
        <button class="demo-link-btn" @click="setGate('and')">ANDゲートの重み</button>
        <button class="demo-link-btn" @click="setGate('or')">ORゲートの重み</button>
        <button class="demo-link-btn" @click="setGate('nand')">NANDゲートの重み</button>
      </div>

      <div class="demo-form-row">
        <label>w1<input v-model.number="w1" type="number" step="0.1" /></label>
        <label>w2<input v-model.number="w2" type="number" step="0.1" /></label>
        <label>b（バイアス）<input v-model.number="b" type="number" step="0.1" /></label>
      </div>
      <div class="demo-form-row">
        <label>x1<input v-model.number="px1" type="number" step="1" /></label>
        <label>x2<input v-model.number="px2" type="number" step="1" /></label>
      </div>

      <div class="demo-box">
        <div class="demo-box-label">重み付き和 a = b + w1×x1 + w2×x2</div>
        <pre>a = {{ b }} + {{ w1 }}×{{ px1 }} + {{ w2 }}×{{ px2 }} = {{ a.toFixed(3) }}</pre>
      </div>

      <div class="demo-result-box" :class="yPerceptron === Math.round(yNeuralNet) ? 'safe' : 'safe'">
        <table>
          <thead>
            <tr><th></th><th>活性化関数</th><th>出力</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>パーセプトロン（2章）</td>
              <td>ステップ関数</td>
              <td><strong>{{ yPerceptron }}</strong>（0か1のどちらか）</td>
            </tr>
            <tr>
              <td>ニューラルネットワーク（3章）</td>
              <td>シグモイド関数</td>
              <td><strong>{{ yNeuralNet.toFixed(4) }}</strong>（0〜1の連続値）</td>
            </tr>
          </tbody>
        </table>
        <p style="font-size: 0.8rem; color: var(--vp-c-text-2); margin: 0.6rem 0 0;">
          同じ <code>a = {{ a.toFixed(3) }}</code> でも、ステップ関数は0か1で急に切り替わるのに対して、
          シグモイド関数は0〜1の間を滑らかな実数値で表現します。この「滑らかさ」が、次章の勾配降下法による学習で重要になります。
        </p>
      </div>
    </template>
  </div>
</template>
