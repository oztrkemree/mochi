import type { SoundName } from './react'

// Tiny chiptune blips, synthesized here as 8-bit WAV so the mod ships no audio files.

const RATE = 16000

type Note = [freq: number, ms: number]

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1] ?? 0
    const c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? B64[n & 63]! : '='
  }
  return out
}

function wav(notes: readonly Note[], wave: 'square' | 'sine' | 'triangle', volume = 0.25): string {
  const total = notes.reduce((sum, [, ms]) => sum + Math.round((RATE * ms) / 1000), 0)
  const bytes = new Uint8Array(44 + total)
  const view = new DataView(bytes.buffer)
  const text = (at: number, s: string) => [...s].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + total, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, RATE, true)
  view.setUint32(28, RATE, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  text(36, 'data')
  view.setUint32(40, total, true)
  let at = 44
  for (const [freq, ms] of notes) {
    const len = Math.round((RATE * ms) / 1000)
    for (let i = 0; i < len; i++) {
      const env = Math.min(1, i / 80, (len - i) / 200)
      const phase = (i * freq) / RATE
      const p = phase - Math.floor(phase)
      const s = freq === 0 ? 0
        : wave === 'square' ? (p < 0.5 ? 1 : -1)
        : wave === 'triangle' ? 4 * Math.abs(p - 0.5) - 1
        : Math.sin(2 * Math.PI * phase)
      bytes[at++] = Math.max(0, Math.min(255, Math.round(128 + 127 * volume * env * s)))
    }
  }
  return base64(bytes)
}

const C5 = 523, E5 = 659, G5 = 784, C6 = 1047, A4 = 440, F4 = 349, D4 = 294

const CLIPS: Record<SoundName, () => string> = {
  ding: () => wav([[E5, 80], [C6, 160]], 'triangle', 0.4),
  oops: () => wav([[A4, 110], [F4, 110], [D4, 220]], 'square', 0.16),
  party: () => wav([[C5, 70], [E5, 70], [G5, 70], [C6, 180]], 'square', 0.15),
  alarm: () => wav([[880, 90], [660, 90], [880, 90], [660, 90]], 'square', 0.14),
}

const cache = new Map<SoundName, string>()

/** The clip's WAV bytes as base64, made once. */
export function clip(name: SoundName): string {
  let data = cache.get(name)
  if (data === undefined) {
    data = CLIPS[name]()
    cache.set(name, data)
  }
  return data
}
