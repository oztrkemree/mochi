import type { SoundName } from './react'

// Soft little chimes, synthesized here as 16-bit WAV so the mod ships no audio
// files: round sine tones that ring out and fade, never a hard edge.

const RATE = 22050

/** A tone: its pitch, when it starts and how long it rings (ms), how loud, and the pitch it slides to. */
type Note = { f: number; at: number; ms: number; gain?: number; to?: number }

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

function wav(notes: readonly Note[], volume: number): string {
  const total = Math.round((RATE * Math.max(...notes.map(n => n.at + n.ms))) / 1000)
  const mix = new Float32Array(total)
  for (const n of notes) {
    const from = Math.round((RATE * n.at) / 1000)
    const len = Math.round((RATE * n.ms) / 1000)
    let phase = 0
    for (let i = 0; i < len && from + i < total; i++) {
      const x = i / len
      phase += (n.to === undefined ? n.f : n.f * (n.to / n.f) ** x) / RATE
      // A soft start (no click), a bell's ring-out, and a last fade to silence.
      const env = Math.min(1, i / (RATE * 0.008)) * Math.exp(-x * 4) * Math.min(1, (len - i) / (RATE * 0.03))
      const p = 2 * Math.PI * phase
      mix[from + i]! += (Math.sin(p) + 0.16 * Math.sin(2 * p) + 0.03 * Math.sin(3 * p)) * env * (n.gain ?? 1)
    }
  }
  const bytes = new Uint8Array(44 + total * 2)
  const view = new DataView(bytes.buffer)
  const text = (at: number, s: string) => [...s].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + total * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, RATE, true)
  view.setUint32(28, RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, total * 2, true)
  for (let i = 0; i < total; i++) view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, mix[i]! * volume)) * 32767), true)
  return base64(bytes)
}

const G4 = 392, C5 = 523, E5 = 659, G5 = 784, A5 = 880, C6 = 1047, E6 = 1319

const CLIPS: Record<SoundName, () => string> = {
  // Two notes rising, like a small bell.
  ding: () => wav([{ f: G5, at: 0, ms: 520 }, { f: C6, at: 95, ms: 700 }], 0.2),
  // A gentle "aww": two notes leaning down.
  oops: () => wav([{ f: C5, at: 0, ms: 300, to: 494 }, { f: G4, at: 160, ms: 480, to: 370, gain: 0.9 }], 0.2),
  // A quick arpeggio up, and a sparkle on top.
  party: () => wav([
    { f: C5, at: 0, ms: 480 }, { f: E5, at: 75, ms: 480 }, { f: G5, at: 150, ms: 520 }, { f: C6, at: 225, ms: 700 },
    { f: E6, at: 330, ms: 600, gain: 0.45 },
  ], 0.15),
  // Asks for a look, not a siren: a soft ding-dong, twice.
  alarm: () => wav([{ f: A5, at: 0, ms: 340 }, { f: E5, at: 170, ms: 380 }, { f: A5, at: 360, ms: 340 }, { f: E5, at: 530, ms: 520 }], 0.17),
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
