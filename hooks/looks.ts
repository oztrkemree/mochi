import type { Mood } from '../types'
import { t } from './i18n'

/** What the drawing shows, in a few words, for a reader that cannot see it. */
export const moodLabel = (mood: Mood): string => t().mood[mood]

export type Look = {
  /** Terminal color: a theme key or hex. */
  color: string
  /** Terminal frames, each 3 chars: left eye, gap, right eye. */
  eyes: string[]
  /** 3 chars under the eyes. */
  mouth: string[]
  /** 5 chars above the head. */
  hat: string[]
  /** 4 chars per frame: upper-left, upper-right, lower-left, lower-right. */
  arms: string[]
  /** The bottom row; frames make the feet move. */
  legs?: string[]
  isShaking?: boolean
}

const FEET = ' ╰┬───┬╯ '

export const LOOKS: Record<Mood, Look> = {
  idle: {
    color: 'claude',
    eyes: ['• •', '• •', '• •', '• •', '- -', '• •', '• •', '• •'], mouth: [' ‿ '], hat: ['     '], arms: ['    '],
  },
  wave: {
    color: 'claude',
    eyes: ['^ ^'], mouth: [' ▽ '], hat: ['     '], arms: [' /  ', ' ─  '],
  },
  listening: {
    color: 'claude',
    eyes: ['. .', '. .', '. .', '- -'], mouth: [' ‿ '], hat: ['     '], arms: ['    '],
  },
  thinking: {
    color: 'suggestion',
    eyes: ['° °', '° °', '¬ ¬'], mouth: [' ~ '], hat: [' .   ', ' ..  ', ' ... '], arms: ['   ╯'],
  },
  talking: {
    color: 'claude',
    eyes: ['• •', '• •', '• •', '- -'], mouth: [' o ', ' ‿ ', ' O ', ' ‿ '], hat: ['     '], arms: ['   /', '   ─'],
  },
  reading: {
    color: 'ide',
    eyes: ['o o', 'o o', 'o o', '- -'], mouth: [' - '], hat: ['     '], arms: ['  []'],
  },
  searching: {
    color: 'ide',
    eyes: ['O o', 'o O'], mouth: [' o '], hat: ['     '], arms: ['   o'],
  },
  writing: {
    color: 'autoAccept',
    eyes: ['• •', '¬ ¬'], mouth: [' ▿ '], hat: ['     '], arms: ['  _ ', '   _'],
  },
  running: {
    color: 'bashBorder',
    eyes: ['ò ó'], mouth: [' ─ '], hat: [' >_  ', ' >   '], arms: ['  ──', '  ─ '],
  },
  waiting: {
    color: 'bashBorder',
    eyes: ['• •', '• •', '° °', '• •'], mouth: [' ─ '], hat: ['     '], arms: ['    '],
    legs: [FEET, ' ╰┬───╯╯ '],
  },
  web: {
    color: 'ide',
    eyes: ['o o'], mouth: [' ▽ '], hat: ['  ~  ', ' ~ ~ ', '~ ~ ~'], arms: ['\\/  '],
  },
  agent: {
    color: 'merged',
    eyes: ['• •'], mouth: [' ▽ '], hat: ['     '], arms: [' /  ', '\\/  '],
  },
  asking: {
    color: 'permission',
    eyes: ['• •', '• •', '• •', '- -'], mouth: [' o '], hat: ['  ?  ', '     '], arms: [' /  ', ' ─  '],
  },
  success: {
    color: 'success',
    eyes: ['^ ^'], mouth: [' ▽ '], hat: ['  ✓  ', '     '], arms: ['\\/  ', '    '],
  },
  proud: {
    color: 'success',
    eyes: ['^ ^'], mouth: ['╰─╯'], hat: ['  ✓  ', '   ✓ '], arms: ['    ', '\\/  '],
  },
  party: {
    color: 'warning',
    eyes: ['* *', '^ ^'], mouth: ['╰─╯'], hat: [' * * ', '* * *'], arms: ['\\/  ', '  /\\'],
  },
  error: {
    color: 'error',
    eyes: ['x x'], mouth: ['╭─╮'], hat: ['  !  ', '     '], arms: ['    '], isShaking: true,
  },
  dizzy: {
    color: 'error',
    eyes: ['@ @'], mouth: [' ~ '], hat: [' ~*~ ', ' *~* '], arms: ['    '], isShaking: true,
  },
  scared: {
    color: 'warning',
    eyes: ['O O'], mouth: [' □ '], hat: ['  !! ', ' !!  '], arms: ['\\/  '], isShaking: true,
  },
  denied: {
    color: 'inactive',
    eyes: ['- -'], mouth: [' ─ '], hat: ['     '], arms: ['    '],
  },
  shocked: {
    color: 'warning',
    eyes: ['O O'], mouth: [' o '], hat: ['  !  '], arms: ['\\/  '],
  },
  nervous: {
    color: 'warning',
    eyes: ['° °'], mouth: [' ~ '], hat: ['    ;', '   ; '], arms: ['    '],
  },
  pleased: {
    color: 'claude',
    eyes: ['^ ^'], mouth: [' ‿ '], hat: ['     '], arms: ['    '],
  },
  tired: {
    color: 'inactive',
    eyes: ['- -', '_ _'], mouth: [' o '], hat: ['     '], arms: ['    '],
  },
  sleepy: {
    color: 'inactive',
    eyes: ['- -', '- -', '_ _'], mouth: [' o ', ' O ', ' o '], hat: ['     '], arms: ['    '],
  },
  sleeping: {
    color: 'inactive',
    eyes: ['- -'], mouth: [' . '], hat: ['   z ', '  zZ ', ' zZz '], arms: ['    '],
  },
  squeezed: {
    color: 'planMode',
    eyes: ['> <'], mouth: [' ε '], hat: ['>   <', ' > < '], arms: ['    '], isShaking: true,
  },
}

const pick = <T>(list: readonly T[], frame: number): T => list[frame % list.length] as T

/** The five rows the terminal draws, each 9 cells wide; `isChanging` blinks the eyes for the frame a mood changes on. */
export function asciiRows(mood: Mood, frame: number, isChanging = false): string[] {
  const look = LOOKS[mood]
  const eyes = isChanging ? '- -' : pick(look.eyes, frame)
  const mouth = pick(look.mouth, frame)
  const hat = pick(look.hat, frame)
  const arms = pick(look.arms, frame)
  const legs = pick(look.legs ?? [FEET], frame)
  const [ul = ' ', ur = ' ', ll = ' ', lr = ' '] = [...arms]
  const rows = [
    `  ${hat}  `,
    ' ╭─────╮ ',
    `${ul}│ ${eyes} │${ur}`,
    `${ll}│ ${mouth} │${lr}`,
    legs,
  ]
  if (!look.isShaking) return rows
  return frame % 2 === 0 ? rows.map(r => ` ${r}`) : rows.map(r => `${r} `)
}

/** One-line face for the compact band and the status line. */
export function kaomoji(mood: Mood, frame: number): string {
  const look = LOOKS[mood]
  const eyes = pick(look.eyes, frame)
  const mouth = pick(look.mouth, frame).trim()
  const m = mouth.length === 1 ? mouth : mouth[0] === '╰' ? '▽' : mouth[0] === '╭' ? '_' : '‿'
  return `(${eyes[0]}${m}${eyes[2]})`
}
