import type { Lang } from '../../../hooks/i18n'
import type { Words } from '../words'
import AR from './ar'
import DE from './de'
import ES from './es'
import FR from './fr'
import HI from './hi'
import ID from './id'
import IT from './it'
import JA from './ja'
import KO from './ko'
import PL from './pl'
import PT from './pt'
import RU from './ru'
import UK from './uk'
import ZH from './zh'

/**
 * The app's words in the mod's other languages. A language not here yet speaks English; each file is checked against the
 * English one by its type, so a word missing or of another shape does not build.
 */
export const MORE: Partial<Record<Exclude<Lang, 'en' | 'tr'>, Words>> = {
  es: ES, de: DE, fr: FR, pt: PT, ru: RU, zh: ZH, ja: JA, ko: KO, it: IT, pl: PL, uk: UK, hi: HI, id: ID, ar: AR,
}
