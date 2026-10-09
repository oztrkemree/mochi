export type Mood =
  | 'idle'
  | 'wave'
  | 'listening'
  | 'thinking'
  | 'talking'
  | 'reading'
  | 'searching'
  | 'writing'
  | 'running'
  | 'waiting'
  | 'web'
  | 'agent'
  | 'asking'
  | 'success'
  | 'proud'
  | 'party'
  | 'error'
  | 'dizzy'
  | 'scared'
  | 'denied'
  | 'shocked'
  | 'nervous'
  | 'pleased'
  | 'tired'
  | 'sleepy'
  | 'sleeping'
  | 'squeezed'

export type Face = {
  mood: Mood
  /** Short status text: what is happening, never a joke. */
  line: string
  /** Epoch ms when the reaction ends and the mascot falls back; 0 = stays. */
  until: number
  /** Epoch ms the shown activity started; 0 = no running clock. */
  since: number
  /** The terminal frame the mood changed on: that frame blinks, so a change never cuts. */
  frameAt: number
}

/** The desktop rig's numbers on screen at one moment (see hooks/rig.ts). */
export type Params = {
  lift: number
  shift: number
  tilt: number
  sx: number
  sy: number
  armL: number
  armR: number
  eyeL: number[]
  eyeR: number[]
  eyeDx: number
  eyeDy: number
  catchlight: number
  x: number
  star: number
  spiral: number
  mouth: number[]
  blush: number
  tint: [number, number, number]
  tintOp: number
}

/** Something Mochi can wear or have beside it (see hooks/level.ts). */
export type Item =
  | 'hardhat' | 'crown' | 'partyhat' | 'witchhat' | 'santahat' | 'nightcap' | 'headphones' | 'gradcap' | 'cowboy' | 'pirate' | 'chefhat' | 'viking' | 'wizard' | 'fez' | 'propeller' | 'beanie'
  | 'sunglasses' | 'glasses' | 'mustache' | 'monocle'
  | 'bowtie' | 'medal' | 'scarf' | 'necktie' | 'evileye'
  | 'mug' | 'tea' | 'simit' | 'pencil' | 'wrench' | 'balloon'
  | 'pumpkin' | 'duck' | 'cactus' | 'cat' | 'gift'

/** What is on Mochi right now, slot by slot. */
export type Outfit = { head: Item | null; face: Item | null; neck: Item | null; held: Item | null; ground: Item | null }

export type Scene = { context: number; agents: number; outfit?: Outfit }

/** What the desktop drawing shows: a mood and scene, eased into from what was on screen. */
export type Shot = {
  mood: Mood
  scene: Scene
  /** Epoch ms this shot took over the screen. */
  at: number
  from: { params: Params; mood: Mood; scene: Scene } | null
}

/** What the mascot knows about the session beyond the current face. */
export type Env = {
  /** Context window use in percent, -1 until measured. */
  context: number
  /** Subagents running now. */
  agents: number
  /** Tool calls in the current turn. */
  turnTools: number
  /** Context tokens in use and the window they count against. */
  tokens: number
  window: number
  /** The context's categories in use, from the last breakdown. */
  slices: Slice[]
  /** The usage windows the last response reported. */
  limits: Limit[]
  /** The session's cost so far, in US dollars. */
  cost: number
  /** The last tool calls of the main loop, oldest first. */
  recent: Recent[]
  /** The last finished turn, in a few words: "1m 12s · 8 tools". */
  last: string
  /** The token count where auto-compaction runs; 0 when it is off or unknown. */
  compactAt: number
  /** The context's categories including free space and the buffer, for the detail pane. */
  allSlices: (Slice & { kind: string })[]
  git: Git | null
  turns: TurnRec[]
  files: FileRec[]
  /** Tool calls by family this session. */
  kinds: Record<string, number>
  /** Epoch ms the session began. */
  startedAt: number
  /** Usage readings over time, for the limit forecast. */
  samples: Sample[]
  /** The other chats running Mochi on this machine. */
  peers: Peer[]
  /** Every chat's days added up; null until read. */
  history: History | null
  /** The machine's offset from UTC, in minutes. */
  tz: number
  lastEdit: Hunk | null
}

/** One reading of a usage window. */
export type Sample = { kind: string; at: number; p: number }

/** Another chat, as its own Mochi last wrote it. */
export type Peer = { id: string; label: string; state: 'busy' | 'asking' | 'idle' | 'error'; line: string; since: number; at: number }

/** One day of work, in one chat or all of them. */
export type DayRec = { turns: number; tools: number; edits: number; errors: number; commits: number; cost: number; secs: number; night: number }

export type History = {
  /** Local days ("2026-10-09"), the last 126 at most. */
  days: Record<string, DayRec>
  total: DayRec
  activeDays: number
  /** Days in a row with work, up to today or yesterday. */
  streak: number
  /** The longest such run ever. */
  bestStreak: number
}

export type Prefs = {
  isCompact: boolean
  isHidden: boolean
  hasSound: boolean
  /** Ask before a command that cannot be undone. */
  hasShield: boolean
  /** A system notification when a long turn ends or waits on the person. */
  hasAlert: boolean
  /** The person's choice per slot: an item, or null for nothing; a slot left out dresses itself (level, season, hour). */
  pick: Partial<Outfit>
  /** Which of the detail pane's folding sections are open. */
  open: { level: boolean; wardrobe: boolean }
  /** `auto` follows Claude Code's language setting and the system; otherwise a language code (en, tr, de…). */
  lang: string
}

/** One slice of the context window, coloured as /context colours it. */
export type Slice = { name: string; tokens: number; color: string }

/** One recent tool call, as the panel's strip draws it. */
export type Recent = { id: number; kind: 'read' | 'search' | 'edit' | 'bash' | 'web' | 'agent' | 'ask' | 'other'; state: 'run' | 'ok' | 'fail' }

/** The repository the session works in, as `git status` saw it last. */
export type Git = {
  branch: string
  ahead: number
  behind: number
  /** Changed and untracked paths, with git's two-letter status ("M ", "??") and the lines added and removed against HEAD (absent for a binary file). */
  files: { code: string; path: string; add?: number; del?: number }[]
  changed: number
  /** The repository's top folder, absolute. */
  root?: string
  /** Epoch ms of the last commit; 0 when there is none. */
  lastCommit: number
}

/** One finished turn, for the detail pane's chart. */
export type TurnRec = { at: number; seconds: number; tools: number; edits: number; errors: number; cost: number }

/** How often a file was read and changed this session, and the lines its edits added and removed. */
export type FileRec = { path: string; reads: number; edits: number; at: number; add?: number; del?: number }

/** The last edit, as the detail pane shows it: the changed lines with one line of context before them. */
export type Hunk = { path: string; at: number; ctx: string; old: string[]; new: string[]; add: number; del: number }

/** A usage window: the 5-hour session or the 7-day week. */
export type Limit = { kind: string; percent: number; resetsAt: number }

/** What the desktop panel shows beside the mascot. */
export type Info = {
  label: string
  detail: string
  context: { percent: number; tokens: number; window: number; slices: Slice[] }
  limits: Limit[]
  cost: number
  agents: number
  tools: number
  isBusy: boolean
  recent: Recent[]
  last: string
  /** Where auto-compaction runs, in percent of the window; 0 when unknown. */
  compactPct: number
  /** 0 calm, 1 near the compaction point, 2 close, 3 about to compact. */
  warn: number
  git: { branch: string; changed: number; ahead: number; behind: number; lastCommit: number } | null
  /** When each usage window runs out at the present pace (epoch ms), where it would before its reset. */
  forecast?: Record<string, number>
  tz?: number
  peers?: Peer[]
}

/** The desktop band: one drawing of the mascot and the panel, redrawn together. */
export type Panel = {
  shot: Shot
  info: Info
  /** What the panel's meters showed before, so they glide to the new values. */
  infoFrom: Info | null
  infoAt: number
}

declare module 'claude-code' {
  interface PluginState {
    mochi: {
      face: Face
      shot: Shot
      panel: Panel
      /** The detail pane's figures, refreshed every few seconds at most. */
      detail: Env
      frame: number
      sec: number
      env: Env
      prefs: Prefs
    }
  }
}
