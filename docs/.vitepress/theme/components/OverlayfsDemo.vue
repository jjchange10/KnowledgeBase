<script setup lang="ts">
import { ref, computed } from 'vue'

type LowerFile = { name: string; content: string }

const lowerdir = ref<LowerFile[]>([
  { name: 'bin/sh', content: '(バイナリ・イメージレイヤー由来)' },
  { name: 'etc/os-release', content: 'NAME="Debian GNU/Linux"' },
  { name: 'app/config.yml', content: 'log_level: info' },
])

type UpperEntry = { name: string; content: string | null; whiteout: boolean }
const upperdir = ref<UpperEntry[]>([])
const log = ref<string[]>([])

function addLog(message: string) {
  log.value.unshift(message)
  if (log.value.length > 10) log.value.pop()
}

function upperEntryOf(name: string) {
  return upperdir.value.find((u) => u.name === name)
}

function editFile(name: string, newContent: string) {
  const existing = upperEntryOf(name)
  if (existing && !existing.whiteout) {
    existing.content = newContent
    addLog(`write(${name}): 既にupperdirにあるので、そのまま上書き（copy-upは発生しない）`)
    return
  }
  // copy-up: lowerdir から中身を丸ごとコピーしてから、書き込みを適用する
  const lower = lowerdir.value.find((l) => l.name === name)
  addLog(`write(${name}): upperdirに無いので copy-up 発生 → lowerdirの内容をupperdirへ全文コピー`)
  upperdir.value.push({ name, content: newContent, whiteout: false })
  void lower
}

function deleteFile(name: string) {
  const existing = upperEntryOf(name)
  if (existing) {
    existing.whiteout = true
    existing.content = null
    addLog(`unlink(${name}): 既にupperdirにあるファイルをwhiteoutに置き換え`)
  } else {
    upperdir.value.push({ name, content: null, whiteout: true })
    addLog(`unlink(${name}): lowerdirにしか無いので、upperdirにwhiteout（char device 0/0）を新規作成`)
  }
}

// merged view の計算: upperdir優先、whiteoutは非表示、それ以外はlowerdirを表示
const merged = computed(() => {
  const names = new Set<string>([...lowerdir.value.map((l) => l.name), ...upperdir.value.map((u) => u.name)])
  const result: { name: string; content: string; source: 'upperdir' | 'lowerdir' }[] = []
  for (const name of names) {
    const upper = upperEntryOf(name)
    if (upper) {
      if (upper.whiteout) continue // whiteoutがあれば merged からは見えない
      result.push({ name, content: upper.content ?? '', source: 'upperdir' })
    } else {
      const lower = lowerdir.value.find((l) => l.name === name)
      if (lower) result.push({ name, content: lower.content, source: 'lowerdir' })
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name))
})

function reset() {
  upperdir.value = []
  log.value = []
}
</script>

<template>
  <div class="demo-panel">
    <div class="demo-form-row">
      <div class="demo-box" style="flex: 1;">
        <div class="demo-box-label">lowerdir（読み取り専用・イメージレイヤー）</div>
        <div class="demo-log">
          <div v-for="f in lowerdir" :key="f.name">
            <code>{{ f.name }}</code>
            <button class="demo-link-btn" style="margin-left: 0.5rem;" @click="editFile(f.name, f.content + ' (edited)')">編集する</button>
            <button class="demo-link-btn" @click="deleteFile(f.name)">削除する</button>
          </div>
        </div>
      </div>
      <div class="demo-box" style="flex: 1;">
        <div class="demo-box-label">upperdir（このコンテナだけの書き込み層）</div>
        <div class="demo-log">
          <div v-if="upperdir.length === 0" style="color: var(--vp-c-text-2);">まだ何も書き込まれていません</div>
          <div v-for="u in upperdir" :key="u.name">
            <code>{{ u.name }}</code> — {{ u.whiteout ? '💀 whiteout（削除マーカー）' : `"${u.content}"` }}
          </div>
        </div>
      </div>
    </div>

    <button class="demo-link-btn" @click="reset">upperdirをリセット（コンテナを作り直す）</button>

    <div class="demo-result-box safe">
      <div class="demo-result-message">merged（コンテナから実際に見えるビュー）</div>
      <table>
        <thead>
          <tr><th>path</th><th>内容</th><th>どこから来たか</th></tr>
        </thead>
        <tbody>
          <tr v-for="m in merged" :key="m.name">
            <td><code>{{ m.name }}</code></td>
            <td>{{ m.content }}</td>
            <td>{{ m.source }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="demo-box">
      <div class="demo-box-label">システムコールログ</div>
      <div class="demo-log">
        <div v-for="(l, i) in log" :key="i">{{ l }}</div>
      </div>
    </div>
  </div>
</template>
