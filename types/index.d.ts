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
  | 'stretch'
  | 'love'
  | 'wink'

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
  | 'hardhat' | 'crown' | 'partyhat' | 'witchhat' | 'santahat' | 'nightcap' | 'gradcap' | 'cowboy' | 'pirate' | 'chefhat' | 'viking' | 'wizard' | 'fez' | 'propeller' | 'beanie'
  | 'sunglasses' | 'glasses' | 'mustache' | 'monocle'
  | 'bowtie' | 'medal' | 'scarf' | 'necktie' | 'evileye'
  | 'mug' | 'tea' | 'simit' | 'pencil' | 'wrench' | 'balloon'
  | 'pumpkin' | 'duck' | 'cactus' | 'cat' | 'gift'
  | 'sakura' | 'pin' | 'rosette' | 'candy' | 'lantern' | 'envelope' | 'diya' | 'songpyeon' | 'cake'
  | 'bandana' | 'sailorhat' | 'strawhat' | 'daisyhat' | 'leaf' | 'catears' | 'bunnyears' | 'flowercrown' | 'beret' | 'tophat' | 'jester' | 'nursecap' | 'sombrero' | 'antlers' | 'farmer' | 'sunflowercrown' | 'bee' | 'halo' | 'unicorn' | 'shortcake' | 'rainbow' | 'dragon' | 'astronaut'
  | 'bowler' | 'flatcap' | 'explorer' | 'baseballcap'
  | 'heartglasses' | 'eyepatch' | 'beard' | 'goggles' | 'starglasses' | 'cinema3d' | 'nerdglasses' | 'visor'
  | 'clownnose' | 'catwhiskers' | 'plaster' | 'freckles' | 'bushybrows' | 'eyelashes' | 'fangs' | 'teardrop'
  | 'spikedcollar' | 'pearls'  | 'bellcollar' | 'neckerchief' | 'lei'  | 'goldchain' | 'overalls'
  | 'flag' | 'whisk' | 'pinwheel' | 'compass'  | 'key' | 'icecream' | 'cupcake' | 'sunflower' | 'clover' | 'toadstool' | 'cactuspot' | 'wand' | 'potion' | 'paddle' | 'joystick' | 'bubblewand' | 'rollingpin' | 'harmonica' | 'tambourine'
  | 'mushroom' | 'frog' | 'robot' | 'ramen' | 'snail' | 'campfire' | 'bonsai' | 'penguin' | 'lavalamp' | 'taco' | 'tent' | 'hedgehog' | 'wateringcan' | 'macaron' | 'arcade' | 'snowman' | 'rocket' | 'watermelon' | 'chest' | 'axolotl' | 'horse' | 'sprout' | 'bunny'

/** Something earned once from real work (see hooks/badges.ts). */
export type Badge = 'green' | 'push' | 'steady' | 'comeback' | 'tidy' | 'team' | 'owl' | 'bird' | 'polyglot' | 'marathon' | 'week' | 'hundred' | 'month' | 'fivehundred' | 'regular' | 'craftsman' | 'bulldozer' | 'vampire'

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
  /** The changed file picked in the details pane, with its diff; absent or `path` '' when none is. */
  diff?: FileDiff
  /** This chat as the others see it, for the board of chats; absent until first written. */
  me?: Peer
  /** The last push's CI and the branch's open pull request, as gh last told them. */
  ci?: Ci | null
  pr?: Pr | null
  /** The badges earned on this machine, oldest first. */
  badges: Badge[]
}

/** A pushed commit's CI on GitHub: its workflow runs, as the person's own gh reports them. */
export type Ci = {
  sha: string
  /** Epoch ms of the push. */
  pushedAt: number
  /** `waiting` until the first run shows, `running` while one is queued or going, then how they ended. */
  state: 'waiting' | 'running' | 'passed' | 'failed' | 'cancelled'
  /** The commit's runs, and how many have finished. */
  total: number
  done: number
  /** The failed workflows' names. */
  failed: string[]
  /** Epoch ms the first run was created and, once all have ended, the last one ended; 0 otherwise. */
  startedAt: number
  endedAt: number
}

/** The branch's open pull request: its review decision and its checks by outcome. */
export type Pr = { number: number; title: string; review: 'approved' | 'changes' | 'required' | ''; passed: number; failed: number; pending: number }

/** One reading of a usage window. */
export type Sample = { kind: string; at: number; p: number }

/**
 * Another chat, as its own Mochi last wrote it: `since` is when its turn began,
 * `stateAt` when it came to its state. An older Mochi leaves out where it works
 * (folder, branch, worktree) and `stateAt`.
 */
export type Peer = {
  id: string; label: string; state: 'busy' | 'asking' | 'idle' | 'error'; line: string; since: number; at: number
  folder?: string; branch?: string; isWorktree?: boolean; stateAt?: number
  /** The chat's title in the app's list of chats (its custom title); '' or absent when it has none. */
  title?: string
}

/**
 * One day of work, in one chat or all of them: besides the counts, the lines
 * edits added and removed, turns between 5:00 and 7:00, and the languages
 * edited as bits (see hooks/badges.ts). A record older than a field reads it as 0.
 */
export type DayRec = { turns: number; tools: number; edits: number; errors: number; commits: number; cost: number; secs: number; night: number; add: number; del: number; early: number; langs: number }

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

/** The detail pane's folding sections, in the order drawn. */
export type Section = 'chats' | 'changes' | 'context' | 'activity' | 'level' | 'wardrobe' | 'badges' | 'settings' | 'more'
/** What the detail pane is made of, each moved and hidden by the person: the overview and the sections. */
export type Block = 'overview' | Section
/** The detail pane's tabs, each holding its own blocks. */
export type Tab = 'now' | 'past' | 'mochi' | 'settings'

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
  open: Record<Section, boolean>
  /** The detail pane's blocks in the person's order, every one of them; those hidden are left out of the pane. */
  order: Block[]
  hidden: Block[]
  /** The pane shows its blocks as a list to move and hide. */
  isArranging: boolean
  /** The detail pane's tab in view. */
  tab: Tab
  /** The wardrobe's category (slot) shown in the details pane. */
  shelf: keyof Outfit
  /** `auto` follows Claude Code's language setting and the system; otherwise a language code (en, tr, de…). */
  lang: string
  /** Follow the CI of a push made in this chat, and show the branch's pull request, through gh. */
  hasCi: boolean
  /** Tips while Mochi is idle, and the offer to add an instruction given again and again to CLAUDE.md. */
  hasTips: boolean
  /** Other plugins may make Mochi react, through `$.mochi`. */
  hasPlugins: boolean
  /** A stretch suggested after two hours of work without a break. */
  hasBreaks: boolean
  /** The person's birthday as "MM-DD", '' when not given. */
  birthday: string
  /** The first day Mochi ran on this machine ("2026-10-09"), for its anniversary; '' until recorded. */
  firstDay: string
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

/** A changed file's diff against the last commit as the pane shows it: its first lines marked, and how many more there are. */
export type FileDiff = { path: string; lines: { kind: 'ctx' | 'old' | 'new'; text: string }[]; more: number }

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
  ci?: Ci | null
  /** The branch's open pull request, shown in the band while no run goes. */
  pr?: Pr | null
}

/** The desktop band: one drawing of the mascot and the panel, redrawn together. */
export type Panel = {
  shot: Shot
  info: Info
  /** What the panel's meters showed before, so they glide to the new values. */
  infoFrom: Info | null
  infoAt: number
}

/** A mood another plugin may put on Mochi: none that says it waits on the person or that a command is dangerous. */
export type MochiMood = 'wave' | 'pleased' | 'success' | 'proud' | 'party' | 'nervous' | 'error' | 'shocked'

/** What another plugin asks Mochi to show (docs/API.md). */
export type MochiReaction = {
  mood: MochiMood
  /** What happened, in a few plain words; cut to 60 columns, the plugin's name shown after it. */
  line: string
  /** How long it stays, in ms: 1000 to 15000, 5000 when left out. */
  holdMs?: number
}

/** A celebration: the party mood and sound, with a line. */
export type MochiCheer = { line: string }

/**
 * Whether Mochi shows it; when not, why: the person turned reactions off, the
 * input is not one, the plugin's last reaction was under 10 s ago, or the face
 * holds something the person should not miss.
 */
export type MochiAnswer = { isShown: boolean; reason?: 'off' | 'invalid' | 'often' | 'busy' }

/** What Mochi adds to `$` for the plugins that list it under `dependencies`. */
export type Mochi = {
  react: (reaction: MochiReaction) => Promise<MochiAnswer>
  celebrate: (cheer: MochiCheer) => Promise<MochiAnswer>
}

declare module 'claude-code' {
  interface EngineInterface {
    mochi: Mochi
  }
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
      /** What the last of the details pane's actions answered, the part of it worth copying, and the file, folder or link it opens (absent from an older version). */
      said: { text: string; copy: string; open?: string }
      /** The changed file picked in the details pane's Changes, with its diff; `path` '' when none is. */
      diff: FileDiff
    }
  }
}
