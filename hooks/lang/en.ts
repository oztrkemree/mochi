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

  /** What each version brought: the headline its first start shows once, and the notes /mochi news prints. */
  news: {
    '0.3.0': {
      headline: 'tips, a first-run tour and CLAUDE.md suggestions',
      notes: [
        'Tips: now and then, while Mochi is idle, one short tip about Claude Code. /mochi tips turns them off.',
        'CLAUDE.md: give the same instruction a third time and Mochi offers to add it to the project’s CLAUDE.md.',
        'A short tour on the very first start; /mochi tour shows it again.',
        'What’s new after each update: /mochi news.',
      ],
    },
  },

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

  /** The coach: tips while Mochi is idle, the first-run tour, CLAUDE.md suggestions. */
  coach: {
    tip: 'tip',
    off: '/mochi tips turns these off',
    tips: {
      rewind: { line: 'Esc Esc · rewind', text: 'Went the wrong way? Press Esc twice, or type /rewind, to go back to an earlier message and try a different prompt.' },
      permissions: { line: '/permissions · allow for good', text: (what: string) => `Claude keeps asking before it uses ${what}. /permissions can allow it for good.` },
      compact: { line: '/compact what to keep', text: 'Context is filling up. /compact with a few words on what matters, like “/compact keep the API decisions”, keeps that gist.' },
      mcp: { line: '/mcp · unused servers', text: 'MCP tools take the most room in your context. /mcp lists the servers; turning off the ones you do not use frees it.' },
      plan: { line: 'Shift+Tab · plan first', text: 'For a big task, press Shift+Tab until plan mode is on: Claude plans first and changes nothing until you agree.' },
      commit: { line: 'ask Claude to commit', text: (n: number) => `${plural(n, 'file', 'files')} changed since the last commit. Ask Claude to commit them: it writes the message too.` },
      rings: { line: 'click the rings · details', text: 'Click Mochi’s rings, or type /mochi details, for the context, your limits, the changes and your history.' },
      wear: { line: '/mochi wear', text: 'You have things to wear. /mochi wear lists them; the Wardrobe in the details pane puts them on Mochi.' },
    },
    tour: [
      { line: 'hi, I’m Mochi', text: 'Hi, I’m Mochi. I live above your prompt and show what Claude Code is doing: reading, running, waiting for you.' },
      { line: 'click the rings · details', text: 'The rings show the context and your usage limits. Click them, or type /mochi details, for the whole picture.' },
      { line: '/mochi wear · the shield', text: 'Level up and dress me with /mochi wear. The shield asks before a command that cannot be undone; /mochi shield turns it off.' },
    ],
    rule: {
      question: (rule: string) => `Add “${rule}” to CLAUDE.md?`,
      add: 'Add',
      later: 'Not now',
      never: 'Never for this',
      added: 'added to CLAUDE.md',
    },
    tipsOn: 'Tips on: now and then, while Mochi is idle, a short tip; and an offer to add an instruction you keep giving to CLAUDE.md.',
    tipsOff: 'Tips off.',
    tourStarts: 'The tour starts in a moment: watch Mochi.',
    newsToast: (version: string, headline: string) => `Mochi ${version}: ${headline} · /mochi news`,
    noNews: (version: string) => `No notes for Mochi ${version}.`,
  },

  /** Usage windows. */
  limit: {
    short: { five_hour: 'session', seven_day: 'week', spend_limit: 'spend' } as Record<string, string>,
    long: { five_hour: 'session limit', seven_day: 'weekly limit' } as Record<string, string>,
    pace: (name: string, at: string, reset: string) => `${name} will run out at this pace · around ${at} · resets ${reset}`,
    back: (name: string) => `${name} reset · you can carry on`,
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

  /** CI after a push, as the person's own gh reports it. */
  ci: {
    title: 'CI',
    waiting: 'ci waiting for runs',
    running: (done: number, total: number) => `ci running · ${done}/${total}`,
    passed: (n: number, span: string) => `ci passed · ${plural(n, 'check', 'checks')} · ${span}`,
    failed: (name: string) => `ci failed · ${name}`,
    cancelled: 'ci cancelled',
    pr: (n: number, title: string) => `PR #${n} · ${title}`,
    review: { approved: 'approved', changes: 'changes requested', required: 'review required' },
    checks: (passed: number, total: number) => `checks ${passed}/${total}`,
    failing: (n: number) => `${n} failing`,
    status: (isOn: boolean, why: string) => `CI: ${isOn ? 'on' : 'off'}${why === '' ? '' : ` · ${why}`}`,
    missing: 'gh is not installed',
    auth: 'gh is not signed in (gh auth login)',
    notGithub: 'this folder is not a GitHub repository',
    on: 'CI watch on: after a push, Mochi follows its GitHub Actions runs through gh.',
    off: 'CI watch off.',
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

  /** The board of every chat on the machine. */
  chats: {
    title: 'CHATS',
    heading: (n: number) => `Chats: ${n} open`,
    here: 'this chat',
    worktree: (branch: string) => `${branch} (worktree)`,
    waiting: (n: number) => `${n} waiting for you`,
    waitingLong: (label: string, span: string) => `${label} has been waiting ${span}`,
    /** Words this language accepts for /mochi chats besides the English ones, separated by spaces. */
    words: '',
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

  /** What Mochi draws to be shown elsewhere: the card, the wrapped and the snapshot. */
  share: {
    tagline: 'Mochi for Claude Code',
    wrapped: 'MOCHI WRAPPED',
    commits: 'commits',
    activeDays: 'active days',
    hours: 'hours',
    longest: 'longest streak',
    /** Month names in full, January first. */
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    /** A month and its year: "September 2026". */
    month: (month: string, year: number) => `${month} ${year}`,
    year: (year: number) => `${year}`,
    /** A day, with the month's short name: "Sep 14". */
    date: (month: string, day: number) => `${month} ${day}`,
    busiest: (date: string, turns: number) => `busiest day · ${date} · ${plural(turns, 'turn', 'turns')}`,
    most: (label: string) => `most time in ${label}`,
    quiet: 'a quiet one: no turns yet',
    cardSaved: (path: string) => `Card saved: ${path}`,
    cardHow: 'For your GitHub profile, put it beside README.md in your profile repository and paste:',
    wrappedSaved: (title: string, path: string) => `${title} wrapped: ${path}`,
    snapSaved: (band: string, details: string) => `Band: ${band}\nDetails pane: ${details}`,
    failed: (reason: string) => `Could not save: ${reason}`,
    ready: (month: string) => `your ${month} wrapped is ready · /mochi wrapped`,
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
      card: [] as string[], wrapped: [] as string[], snap: [] as string[], year: [] as string[],
      tips: [] as string[], tour: [] as string[], news: [] as string[],
    },
  },
}
