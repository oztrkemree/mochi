import { de } from './lang/de'
import { en } from './lang/en'
import { es } from './lang/es'
import { fr } from './lang/fr'
import { ja } from './lang/ja'
import { ko } from './lang/ko'
import { pt } from './lang/pt'
import { ru } from './lang/ru'
import { tr } from './lang/tr'
import { zh } from './lang/zh'

// Every word Mochi shows comes from one dictionary per language, each
// shaped exactly like the English one. The language in use is set once a
// session starts (and by /mochi lang); drawing code asks `t()` for it.

export type Dict = typeof en
export type Lang = 'en' | 'tr' | 'es' | 'de' | 'fr' | 'pt' | 'ru' | 'zh' | 'ja' | 'ko'

export const DICTS: Record<Lang, Dict> = { en, tr, es, de, fr, pt, ru, zh, ja, ko }
export const LANGS = Object.keys(DICTS) as Lang[]

let current: Lang = 'en'

export function setLang(l: Lang) {
  current = l
}

export const lang = (): Lang => current
export const t = (): Dict => DICTS[current]

/** Names Claude Code's `language` setting may hold, in English and in the language itself. */
const NAMES: Record<string, Lang> = {
  english: 'en', turkish: 'tr', türkçe: 'tr', turkce: 'tr', spanish: 'es', español: 'es', espanol: 'es', german: 'de', deutsch: 'de',
  french: 'fr', français: 'fr', francais: 'fr', portuguese: 'pt', português: 'pt', portugues: 'pt', russian: 'ru', русский: 'ru',
  chinese: 'zh', 中文: 'zh', 简体中文: 'zh', 繁體中文: 'zh', japanese: 'ja', 日本語: 'ja', korean: 'ko', 한국어: 'ko',
}

/** A supported language from a code or a name: "tr", "tr-TR", "zh_CN.UTF-8", "japanese"; null when none fits. */
export function pickLang(value: string | undefined | null): Lang | null {
  if (!value) return null
  const v = value.trim().toLowerCase()
  if (v === '') return null
  const named = NAMES[v]
  if (named) return named
  const code = v.split(/[-_.@]/)[0] ?? ''
  return (LANGS as string[]).includes(code) ? (code as Lang) : null
}
