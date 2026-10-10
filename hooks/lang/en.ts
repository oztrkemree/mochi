// English: the source every other language follows, key for key. Status
// lines are short, lower case and plain; " · " separates a verb from what it
// acts on (the panel colours the two parts apart).

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const en = {
  /** The language's own name. */
  name: 'English',
  /** Thousands separator: 1,234. */
  thousands: ',',
  /** A span of time in one unit: 5s, 12m, 2h, 3d. */
  unit: (n: number, u: 's' | 'm' | 'h' | 'd') => `${n}${u}`,
  justNow: 'just now',
  ago: (span: string) => `${span} ago`,
  /** Short weekday names, Sunday first. */
  days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

  /** What the drawing shows, in a few words, for each mood. */
  mood: {
    idle: 'idle', wave: 'waving', listening: 'listening to you', thinking: 'thinking', talking: 'writing a reply',
    reading: 'reading', searching: 'searching', writing: 'writing code', running: 'running a command', waiting: 'waiting',
    web: 'on the web', agent: 'running an agent', asking: 'waiting for you', success: 'done', proud: 'done', party: 'celebrating',
    error: 'hit an error', dizzy: 'errors in a row', scared: 'dangerous command', denied: 'denied', shocked: 'startled',
    nervous: 'tense', pleased: 'pleased', tired: 'tired', sleepy: 'sleepy', sleeping: 'asleep', squeezed: 'compacting',
  },

  /** Status lines: what is happening now. */
  st: {
    ready: 'ready',
    idle: (span: string) => `idle · ${span}`,
    listening: 'listening',
    thinking: 'thinking',
    talking: 'writing a reply',
    reading: 'reading',
    searching: 'searching',
    editing: 'editing',
    creating: 'creating',
    running: 'running',
    test: 'test',
    opening: 'opening',
    agent: 'agent',
    careful: 'careful',
    waitingAnswer: 'waiting for your answer',
    waitingPlan: 'waiting for plan approval',
    planning: 'planning',
    todo: 'to-do list',
    publishing: 'publishing a page',
    browsing: 'in the browser',
    denied: 'denied',
    error: 'error',
    errorsInRow: (n: number) => `error ${n} in a row`,
    testsFailed: 'tests failed',
    testsPassed: 'tests passed',
    committed: 'committed',
    pushed: 'pushed',
    wokeUp: 'woke up',
    stopped: 'stopped',
    apiError: 'API error',
    refused: 'refused',
    done: 'done',
    tools: (n: number) => plural(n, 'tool', 'tools'),
    agents: (n: number) => plural(n, 'agent', 'agents'),
    edits: (n: number) => plural(n, 'edit', 'edits'),
    awaitingApproval: 'awaiting approval',
    approved: 'approved',
    halted: 'stopped',
    loop: 'loop',
    compacting: 'compacting context',
    compacted: 'context compacted',
    commitNudge: (n: number, last: string) => `${plural(n, 'file', 'files')} waiting for a commit · ${last}`,
    lastCommit: (ago: string) => `last commit ${ago}`,
    noCommits: 'no commits yet',
    level: (n: number) => `level ${n}`,
    newItems: (names: string) => `new: ${names}`,
  },

  /** Fallback words. */
  word: { file: 'file', agent: 'agent', chat: 'chat' },

  /** Usage windows. */
  limit: {
    short: { five_hour: 'session', seven_day: 'week', spend_limit: 'spend' } as Record<string, string>,
    long: { five_hour: 'session limit', seven_day: 'weekly limit' } as Record<string, string>,
    pace: (name: string, at: string, reset: string) => `${name} will run out at this pace · around ${at} · resets ${reset}`,
  },

  /** The context window. */
  ctx: {
    compactSoon: 'compaction very close',
    percent: (p: number) => `context ${p}%`,
    biggest: (name: string, p: number) => `largest: ${name} ${p}%`,
    hint: '/compact would help',
    /** /context's categories, by their English name in lower case. */
    category: {
      'system prompt': 'system prompt', 'system tools': 'system tools', 'mcp tools': 'MCP tools', 'custom agents': 'agents',
      'memory files': 'memory files', skills: 'skills', messages: 'messages', 'free space': 'free space',
      'autocompact buffer': 'compaction buffer', 'slash commands': 'commands',
    } as Record<string, string>,
  },

  /** The band above the prompt. */
  panel: {
    context: 'context',
    fullAt: (time: string) => `full ${time}`,
    lastTurn: (s: string) => `last turn · ${s}`,
    changes: (n: number) => plural(n, 'change', 'changes'),
    clean: 'clean',
    contextUnknown: 'unknown',
  },

  /** The other chats. */
  peer: {
    state: { busy: 'working', asking: 'waiting for you', idle: 'idle', error: 'error' },
    waiting: (label: string) => `‘${label}’ is waiting for you`,
    done: (label: string, span: string) => `‘${label}’ finished · ${span}`,
    failed: (label: string) => `‘${label}’ hit an error`,
    asking: (label: string, more: number) => `${label} is waiting for you${more > 0 ? ` +${more}` : ''}`,
    error: (label: string) => `${label} hit an error`,
    busyOne: (label: string) => `${label} is working`,
    busyMany: (n: number) => `${n} chats working`,
  },

  /** What a command that cannot be undone would do. */
  danger: {
    forkBomb: 'locks up the system',
    rm: 'deletes files and folders for good',
    findDelete: 'deletes the files it finds',
    forcePush: 'overwrites the remote branch’s history',
    resetHard: 'throws away uncommitted changes',
    clean: 'deletes untracked files',
    checkoutDot: 'reverts uncommitted changes',
    branchDelete: 'deletes the branch even if unmerged',
    stashDrop: 'deletes stashed changes',
    dropTable: 'deletes a database table',
    deleteAll: 'deletes every row of the table',
    disk: 'writes straight to a disk',
    chmod: 'changes permissions wholesale',
    infra: 'deletes infrastructure',
    repoDelete: 'deletes the repository',
    publish: 'publishes the package to everyone',
    sudo: 'runs as administrator',
  },

  /** The loop watch. */
  loopAlarm: {
    sameFail: (n: number) => `same command failed ${n} times in a row`,
    sameError: (n: number) => `same error ${n} times`,
    sameResult: (n: number) => `doing the same thing ${n} times, no change`,
  },

  /** Things to wear. */
  item: {
    name: {
      hardhat: 'hard hat', crown: 'crown', partyhat: 'party hat', witchhat: 'witch hat', santahat: 'Santa hat', nightcap: 'nightcap', headphones: 'headphones', gradcap: 'graduation cap',
      cowboy: 'cowboy hat', pirate: 'pirate hat', chefhat: 'chef’s hat', viking: 'viking helmet', wizard: 'wizard hat', fez: 'fez', propeller: 'propeller cap', beanie: 'beanie',
      sunglasses: 'sunglasses', glasses: 'glasses', mustache: 'mustache', monocle: 'monocle',
      bowtie: 'bow tie', medal: 'medal', scarf: 'scarf', necktie: 'necktie', evileye: 'evil eye bead',
      mug: 'coffee mug', tea: 'tea glass', simit: 'simit', pencil: 'pencil', wrench: 'wrench', balloon: 'balloon',
      pumpkin: 'pumpkin', duck: 'rubber duck', cactus: 'cactus', cat: 'cat', gift: 'gift box',
    },
    short: {
      hardhat: 'hard hat', crown: 'crown', partyhat: 'party', witchhat: 'witch', santahat: 'Santa', nightcap: 'nightcap', headphones: 'headphones', gradcap: 'grad cap',
      cowboy: 'cowboy', pirate: 'pirate', chefhat: 'chef', viking: 'viking', wizard: 'wizard', fez: 'fez', propeller: 'propeller', beanie: 'beanie',
      sunglasses: 'shades', glasses: 'glasses', mustache: 'mustache', monocle: 'monocle',
      bowtie: 'bow tie', medal: 'medal', scarf: 'scarf', necktie: 'tie', evileye: 'evil eye',
      mug: 'coffee', tea: 'tea', simit: 'simit', pencil: 'pencil', wrench: 'wrench', balloon: 'balloon',
      pumpkin: 'pumpkin', duck: 'duck', cactus: 'cactus', cat: 'cat', gift: 'gift',
    },
    slot: { head: 'Head', face: 'Face', neck: 'Neck', held: 'Hand', ground: 'Beside' },
    hint: {
      start: 'unlocked from the start',
      level: (n: number) => `level ${n}`,
      turns: (n: number) => `${n} turns`,
      days: (n: number) => `${n} days`,
      streak: (n: number) => `${n}-day streak`,
      commits: (n: number) => `${n} commits`,
      edits: (n: number) => `${n} edits`,
      night: (n: number) => `${n} turns at night`,
      halloween: 'Oct 24 – Nov 1',
      xmas: 'Dec 18 – 30',
    },
  },

  /** The detail pane. */
  detail: {
    title: 'Mochi · details',
    context: 'context',
    session5h: 'session · 5 hours',
    week7d: 'week · 7 days',
    resetsIn: (span: string) => `resets in ${span}`,
    paceFull: (time: string) => `full by ${time} at this pace`,
    stats: { time: 'time', turns: 'turns', tools: 'tools', edits: 'edits', errors: 'errors', cost: 'cost' },
    thisSession: 'THIS SESSION',
    otherChats: 'OTHER CHATS',
    open: (n: number) => `${n} open`,
    contextTitle: 'CONTEXT',
    compactsAt: (tokens: string) => `compacts at ${tokens}`,
    contextWarn: ['Context is filling up', 'Nearing compaction', 'Compaction very close'],
    recentTurns: 'RECENT TURNS',
    average: (span: string) => `average ${span}`,
    legend: { read: 'reading', edit: 'editing', error: 'error' },
    countIsTools: 'number: tools',
    history: 'HISTORY',
    allChats: 'all chats',
    today: 'turns today',
    last7: 'turns, last 7 days',
    streak: 'day streak',
    total: (days: number) => `turns · ${plural(days, 'day', 'days')}`,
    less: 'less',
    more: 'more',
    toolsTitle: 'TOOLS',
    kind: { read: 'read', search: 'search', edit: 'edit', bash: 'command', web: 'web', agent: 'agent', ask: 'question', other: 'other' },
    changes: 'CHANGES',
    files: (n: number) => plural(n, 'file', 'files'),
    clean: 'clean',
    notRepo: 'not a git repository · files edited in this chat',
    cleanTree: 'working tree clean: nothing changed since the last commit',
    newFile: 'new',
    binary: 'binary',
    moreFiles: (n: number) => `+${n} more ${n === 1 ? 'file' : 'files'}`,
    byClaude: 'changed by Claude in this chat · latest first',
    lastEdit: 'LAST EDIT',
    moreLines: (n: number) => `… ${n} more ${n === 1 ? 'line' : 'lines'}`,
    levelN: (n: number) => `Level ${n}`,
    toNext: (xp: string) => `${xp} XP to the next level`,
    totals: (turns: string, edits: string, commits: number) => `${turns} turns · ${edits} edits · ${commits} commits`,
    wardrobeCount: (n: number) => `wardrobe: ${n} items unlocked`,
    next: (name: string, hint: string) => `next: ${name} (${hint})`,
    summary: (level: number, pct: number) => `Level ${level} · ${pct}%`,
    // Terminal lines.
    lineSession: (turns: number, tools: number) => `Session: ${plural(turns, 'turn', 'turns')} · ${plural(tools, 'tool', 'tools')}`,
    lineContext: 'Context',
    lineGit: (branch: string, files: number) => `Git: ${branch} · ${plural(files, 'file', 'files')}`,
    lineLastEdit: (file: string, ago: string) => `Last edit: ${file} · ${ago}`,
  },

  /** The wardrobe and level sections. */
  ui: {
    levelTitle: 'LEVEL',
    wardrobeTitle: 'WARDROBE',
    open: 'Open',
    close: 'Close',
    auto: 'Automatic',
    takeAllOff: 'Take all off',
    unlockedOf: (a: number, b: number) => `${a}/${b} unlocked`,
    wearing: (list: string) => `wearing: ${list}`,
    nothing: 'nothing',
    empty: 'empty',
    autoMark: ' (auto)',
    wardrobe: 'Wardrobe',
  },

  /** What Mochi keeps (export, reset, feedback) and the reactions other plugins ask for. */
  data: {
    exported: (path: string) => `Everything Mochi keeps is in one file: ${path}`,
    exportFailed: (reason: string) => `The export could not be written: ${reason}`,
    resetHow: 'Clear what? /mochi reset level · history · all',
    /** The confirmation before a reset; each ends in a question. */
    resetAsk: {
      level: 'The level is counted from the history; this clears only what Mochi remembers of it (level.json). Clear it?',
      history: 'This clears the history of every chat, and the level starts over with it. Clear it?',
      all: 'This clears everything Mochi keeps: history, level, usage readings and settings (exports stay). Clear it?',
    },
    clear: 'Clear',
    keep: 'Keep',
    kept: 'Nothing was cleared.',
    cleared: {
      level: 'Level memory cleared. The level is counted from the history: /mochi reset history starts it over.',
      history: 'History cleared in every chat; the level starts over.',
      all: 'Everything Mochi kept is cleared, and its settings are back to their defaults.',
    },
    notCleared: (files: string) => `These files could not be removed: ${files}`,
    feedback: (url: string) => `To report a bug, open this link. The form carries only the versions, the system, the surface and the language:\n${url}`,
    pluginsOn: 'Reactions from other plugins on.',
    pluginsOff: 'Reactions from other plugins off.',
    /** Words this language accepts for these commands and reset's scopes, besides the English ones. */
    words: { export: [] as string[], reset: [] as string[], feedback: [] as string[], plugins: [] as string[], history: [] as string[], all: [] as string[] },
  },

  /** The shield's question. */
  shield: {
    question: (what: string, cmd: string) => `This command ${what}:\n\n${cmd}\n\nRun it?`,
    run: 'Run',
    stop: 'Stop',
  },

  /** Toasts and notifications. */
  note: {
    loop: (alarm: string, about: string) => `${alarm} (${about}). Press Esc to stop.`,
    detailFailed: (reason: string) => `The details pane could not open: ${reason}`,
    clickFailed: (reason: string) => `clicking for details does not work here (${reason}); type /mochi details`,
    seeWardrobe: ' · /mochi wear',
  },

  /** /mochi and its answers. */
  cmd: {
    description: 'Mochi: show/hide, details, level, wear, shield, alerts, sound, language',
    hint: '[details | level | wear [item] | shield | alerts | sound | lang [code] | hide | show | small | big | status]',
    small: 'Mochi on one line.',
    big: 'Mochi full size.',
    detailOpened: 'Details pane opened.',
    shieldOn: 'Shield on: commands that cannot be undone will ask before they run.',
    shieldOff: 'Shield off.',
    alertsOn: (minutes: number) => `Alerts on: you will hear when work longer than ${minutes} minutes finishes, and when a long job waits for your approval.`,
    alertsOff: 'Alerts off.',
    levelLine: (level: number, xp: number, toNext: number) => `Level ${level} · ${xp} XP · ${toNext} XP to the next level`,
    statsLine: (turns: number, edits: number, commits: number, days: number, streak: number) =>
      `${turns} turns · ${edits} edits · ${commits} commits · ${plural(days, 'day', 'days')} · ${streak}-day streak`,
    unlocked: (list: string) => `Unlocked: ${list}`,
    locked: (list: string) => `Locked: ${list}`,
    none: 'none',
    noneYet: 'none yet',
    wearList: (a: number, b: number, list: string) => `Unlocked: ${a}/${b} · ${list}`,
    wearHow: 'Pick from the Wardrobe in the details pane, or: /mochi wear <item> · auto · none',
    wearAuto: 'Accessories are automatic: by level, season and hour.',
    wearNone: 'All accessories taken off.',
    noSuchItem: (want: string) => `No such accessory: ${want}`,
    itemLocked: (name: string, hint: string) => `${name} is locked (${hint}).`,
    itemOn: (name: string) => `${name} put on.`,
    soundOn: 'Sound on.',
    soundOff: 'Sound off.',
    hidden: 'Mochi hidden. To bring it back: /mochi',
    shown: 'Mochi is on.',
    statusLine: (label: string, line: string) => `Status: ${label} · ${line}`,
    contextLine: (ctx: string, agents: number, tools: number) => `Context: ${ctx} · agents running: ${agents} · tools this turn: ${tools}`,
    prefsLine: (sound: boolean, shield: boolean, alerts: boolean, compact: boolean) =>
      `Sound: ${sound ? 'on' : 'off'} · Shield: ${shield ? 'on' : 'off'} · Alerts: ${alerts ? 'on' : 'off'} · Size: ${compact ? 'small' : 'big'}`,
    peersLine: (level: number, peers: string) => `Level ${level} · other chats: ${peers}`,
    commands: 'Commands: /mochi (show/hide) | details | level | wear | shield | alerts | sound | lang | small | big | status',
    langNow: (name: string, list: string) => `Language: ${name}. Available: ${list} · /mochi lang <code> or auto`,
    langSet: (name: string) => `Language: ${name}.`,
    langAuto: (name: string) => `Language follows Claude Code and the system: ${name}.`,
    langUnknown: (code: string, list: string) => `Unknown language: ${code}. Available: ${list}`,
    /** Words this language accepts for each command, besides the English ones. */
    words: {
      hide: [] as string[], show: [] as string[], small: [] as string[], big: [] as string[], sound: [] as string[],
      status: [] as string[], details: [] as string[], level: [] as string[], wear: [] as string[], shield: [] as string[],
      alerts: [] as string[], lang: [] as string[], auto: [] as string[], none: [] as string[],
    },
  },
}
