import type { Act, Mood, Scene } from '../../types'
import { paramsAt, svgFor } from '../../hooks/rig'
import { ACT_MS } from './acts'

/**
 * Every moment Mochi plays, one after another, each eased in from rest and
 * back to it: for looking at them while working on them. The app never loads this.
 */

type Step = { mood: Act | Mood; name: string; when: string; ms?: number }

const STEPS: Step[] = [
  { mood: 'perk', name: 'Fark etme', when: 'İmleç üstüne gelince (en çok 25 saniyede bir)' },
  { mood: 'giggle', name: 'Kıkırdama', when: 'Üç kez hızlı tıklayınca' },
  { mood: 'dizzy', name: 'Baş dönmesi', when: 'Altı kez hızlı tıklayınca' },
  { mood: 'love', name: 'Sevgi', when: 'Okşayınca (çift tık)' },
  { mood: 'shy', name: 'Utanma', when: 'Okşayınca, bazen' },
  { mood: 'spin', name: 'Fırıldak', when: 'Okşayınca, bazen; boşken de kendi kendine' },
  { mood: 'whee', name: 'Vuu!', when: 'Pencereyi sürüklerken', ms: 2600 },
  { mood: 'land', name: 'Yere konma', when: 'Bırakınca' },
  { mood: 'ready', name: 'Hazırım', when: 'Bir sohbet işe başlayınca' },
  { mood: 'cheer', name: 'Sevinç', when: 'Bir sohbetin turu bitince' },
  { mood: 'phew', name: 'Oh be', when: 'Beş dakikadan uzun bir tur bitince' },
  { mood: 'oops', name: 'Hoppala', when: 'Bir tur yarıda kesilince' },
  { mood: 'fistpump', name: 'Yumruk', when: 'Planın bir adımı bitince' },
  { mood: 'party', name: 'Parti', when: 'Planın hepsi bitince' },
  { mood: 'wave', name: 'El sallama', when: 'Bir yardımcı ajan işe girince' },
  { mood: 'juggle', name: 'Jonglör', when: 'Claude ve Codex aynı anda çalışırken (turuncu Claude, mavi Codex)', ms: 4800 },
  { mood: 'hum', name: 'Mırıldanma', when: 'Boşken, kendi kendine' },
  { mood: 'curious', name: 'Merak', when: 'Boşken, kendi kendine' },
  { mood: 'hop', name: 'Hoplama', when: 'Boşken, kendi kendine' },
  { mood: 'dance', name: 'Dans', when: 'Boşken, kendi kendine' },
  { mood: 'stretch', name: 'Gerinme', when: 'Boşken; uyurken imleç gelince de uyanırken' },
  { mood: 'sneeze', name: 'Hapşırma', when: 'Boşken, nadiren' },
  { mood: 'dream', name: 'Rüya', when: 'Uyurken, arada bir' },
]

const scene: Scene = { context: -1, agents: 0 }
const REST = paramsAt(null, 'idle', 5000)
/** The pause at rest between two moments. */
const BETWEEN_MS = 900

const stage = document.getElementById('stage')!
const nameEl = document.getElementById('name')!
const whenEl = document.getElementById('when')!
const dots = document.getElementById('dots')!
const pauseButton = document.getElementById('pause')!

let at = 0
let timer = 0
let isPaused = false
const seen = new Set<number>()

const dotButtons = STEPS.map((s, i) => {
  const b = document.createElement('button')
  b.type = 'button'
  b.title = s.name
  b.addEventListener('click', () => play(i))
  dots.append(b)
  return b
})

function draw(svg: string) {
  stage.innerHTML = svg
}

/** Plays one moment from rest, holds it for as long as the app would, eases back to rest, and goes on to the next. */
function play(i: number) {
  clearTimeout(timer)
  at = (i + STEPS.length) % STEPS.length
  const step = STEPS[at]!
  seen.add(at)
  dotButtons.forEach((b, k) => {
    b.classList.toggle('on', k === at)
    b.classList.toggle('seen', seen.has(k) && k !== at)
  })
  nameEl.textContent = `${at + 1}/${STEPS.length} · ${step.name}`
  whenEl.textContent = step.when
  const ms = step.ms ?? ACT_MS[step.mood] ?? 2400
  draw(svgFor({ mood: step.mood, scene, from: { params: REST, mood: 'idle', scene } }))
  timer = window.setTimeout(() => {
    draw(svgFor({ mood: 'idle', scene, from: { params: paramsAt(REST, step.mood, ms), mood: step.mood, scene } }))
    if (!isPaused) timer = window.setTimeout(() => play(at + 1), BETWEEN_MS)
  }, ms)
}

document.getElementById('prev')!.addEventListener('click', () => play(at - 1))
document.getElementById('next')!.addEventListener('click', () => play(at + 1))
pauseButton.addEventListener('click', () => {
  isPaused = !isPaused
  pauseButton.textContent = isPaused ? '▶ Oynat' : '❚❚ Durdur'
  // Paused, the moment on screen plays again; played on, the show goes on from it.
  play(at)
})
addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') play(at + 1)
  if (e.key === 'ArrowLeft') play(at - 1)
})

play(0)
