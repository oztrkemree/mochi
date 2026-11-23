import type { Words } from '../words'

/** A noun's forms after a number: one, two, 3–10, 11–99, and 100, 101… */
type Noun = readonly [one: string, two: string, few: string, many: string, other: string]

/** Number plus its noun, the Arabic way (1 and 2 by the noun alone); a formatted number ("1,234") is read by its digits. */
const count = (v: string, [one, two, few, many, other]: Noun) => {
  const n = Number(v.replace(/\D/g, '')) || 0
  if (n === 1) return one
  if (n === 2) return two
  const r = n % 100
  return `${v} ${n === 0 || (r >= 3 && r <= 10) ? few : r >= 11 ? many : other}`
}

const TURN: Noun = ['طلب واحد', 'طلبان', 'طلبات', 'طلبًا', 'طلب']
const DAY: Noun = ['يوم واحد', 'يومان', 'أيام', 'يومًا', 'يوم']

const AR: Words = {
  agents: 'الوكلاء',
  noAgents: 'لا يعمل أي وكيل',
  openHint: 'اضغط لفتحه في Claude',
  where: { codex: 'Codex', terminal: 'الطرفية' },
  notHere: (where: string) => `يعمل في ${where}: افتحه هناك`,
  hideIdle: 'إخفاء المحادثات الساكنة بعد',
  leaveIdle: 'مغادرة الشاشة عند الخمول بعد',
  minutes: (n: number) => (n === 0 ? 'أبدًا' : n >= 60 ? `${n / 60} س` : `${n} د`),
  settings: 'إعدادات Mochi',
  look: 'المظهر',
  size: 'الحجم',
  sizes: { small: 'صغير', medium: 'متوسط', large: 'كبير', huge: 'ضخم' },
  onTop: 'البقاء فوق النوافذ الأخرى',
  showAgents: 'عدد المحادثات بجانب Mochi',
  talking: 'ما يتحدث عنه Mochi',
  talkAsking: 'محادثة تنتظرك',
  talkDone: 'محادثة أنهت دورة طويلة',
  talkFailed: 'محادثة واجهت خطأ',
  talkLimit: 'حد استخدام يوشك أن ينفد، أو عاد',
  limits: 'حدود الاستخدام',
  talkSeconds: 'مدة بقاء الفقاعة',
  sound: 'صوت خافت مع كلام Mochi',
  approve: 'الرد على طلبات الإذن من الفقاعة',
  approveHint: 'لـ Claude Code فقط. تُعرض «نعم» للأمر الذي يمكنك قراءته كاملًا؛ والباقي يمكنك رفضه أو فتحه.',
  approveAsk: 'هل أجلب طلبات الإذن إلى هنا، لترد دون أن تبدّل النوافذ؟',
  yes: 'نعم',
  notNow: 'ليس الآن',
  allow: 'اسمح',
  deny: 'ارفض',
  wantsTo: (tool: string) => `طلب لاستخدام ${tool}`,
  seconds: (n: number) => `${n} ث`,
  language: 'اللغة',
  sameAsSystem: 'مثل النظام',
  startup: 'البدء',
  atLogin: 'افتح Mochi عند تسجيل دخولي',
  agentsFrom: 'الوكلاء',
  agentName: { claude: 'Claude Code', codex: 'Codex' },
  agentOn: {
    claude: 'متصل. المحادثات التي تفتحها من الآن تخبر Mochi بما تفعله.',
    codex: 'متصل. في Codex، شغّل /hooks مرة واحدة للموافقة.',
  },
  agentOff: 'غير متصل.',
  line: 'الحدود بدون الإضافة',
  lineOn: 'متصل، كسطر الحالة في Claude Code. سطر حالتك الخاص ما زال يظهر.',
  lineOff: 'غير متصل. تأتي الحدود حينها من محادثات الإضافة فقط.',
  noWork: 'لم يُحسب أي عمل بعد. يبدأ مع أول دورة لك.',
  tooLong: 'أمر أطول من أن يقرأه Mochi كاملًا',
  newer: (v: string) => `صدر Mochi ${v}.`,
  get: 'احصل عليه',
  tour: {
    hello: 'مرحبًا، أنا Mochi. أجلس هنا وأخبرك حين تنتهي محادثة في Claude Code أو Codex، أو تنتظرك، أو تواجه خطأ.',
    claude: 'هل أستمع إلى Claude Code؟ أضيف خطافاتي إلى إعداداته، وأحتفظ بنسخة منها كما كانت.',
    codex: 'Codex هنا أيضًا. هل أستمع إليه؟ بعدها شغّل /hooks مرة واحدة في Codex للموافقة.',
    pocket: 'اضغط عليّ لتفتح جيبي: محادثاتك ويومك ومستواك. النقر بالزر الأيمن يفتح غرفتي، وفيها خزانتي وإنجازاتي وإعداداتي.',
    next: 'فهمت',
  },
  tips: {
    rightClick: 'النقر عليّ بالزر الأيمن يفتح غرفتي: الخزانة والإنجازات والإعدادات.',
    drag: 'اسحبني إلى أي مكان؛ أبقى حيث تتركني.',
    edge: 'ادفعني خارج أسفل الشاشة فلا يطل إلا رأسي.',
    room: 'في غرفتي خزانتي وأوسمتي ومدينة أسابيعك. افتحها من جيبي.',
    wardrobe: 'ألبسني في غرفتي: ضع المؤشر فوق قطعة وسأجرّبها. Mochi في الإضافة يرتديها أيضًا.',
    pat: 'ضغطتان سريعتان عليّ تعنيان ربتة.',
    shield: 'قبل أمر لا يمكن التراجع عنه، أجعل Claude Code يسألك أولًا. يمكن إيقاف الدرع من إعداداتي.',
    line: 'اجعلني سطر الحالة في Claude Code من إعداداتي، فأعرض حدود استخدامك بدون الإضافة.',
  },
  room: 'غرفة Mochi',
  colour: 'اللون',
  levelN: (n: number) => `المستوى ${n}`,
  skins: { clay: 'طين', peach: 'خوخ', cream: 'كريمي', rose: 'ورد', coral: 'مرجان', lemon: 'ليمون', mint: 'نعناع', sky: 'سماء', lavender: 'خزامى', sage: 'مريمية', teal: 'فيروزي', plum: 'برقوق', cocoa: 'كاكاو', charcoal: 'فحم', snow: 'ثلج', cherry: 'كرز', ocean: 'محيط', forest: 'غابة', sunset: 'غروب', bubblegum: 'علكة', gold: 'ذهب', chrome: 'كروم', zombie: 'زومبي', ghost: 'شبح', lava: 'حمم', ice: 'جليد', galaxy: 'مجرة', neon: 'نيون', rainbow: 'قوس قزح', hologram: 'هولوغرام' },
  feats: {
    title: 'الإنجازات',
    done: (a: number, b: number) => `أُنجز ${a} من ${b}`,
    cats: { talk: 'الحديث', code: 'الكود', ship: 'الإطلاق', time: 'الساعات', steady: 'المواظبة', mochi: 'Mochi' },
    tiers: { easy: 'سهل', medium: 'متوسط', hard: 'صعب', impossible: 'مستحيل' },
    metric: {
      turns: (n: string) => count(n, TURN), dayTurns: (n: string) => `${count(n, TURN)} في يوم واحد`, edits: (n: string) => count(n, ['تعديل واحد', 'تعديلان', 'تعديلات', 'تعديلًا', 'تعديل']), tools: (n: string) => `استخدام الأدوات ${count(n, ['مرة واحدة', 'مرتين', 'مرات', 'مرة', 'مرة'])}`,
      added: (n: string) => `إضافة ${count(n, ['سطر واحد', 'سطرين', 'أسطر', 'سطرًا', 'سطر'])}`, removed: (n: string) => `حذف ${count(n, ['سطر واحد', 'سطرين', 'أسطر', 'سطرًا', 'سطر'])}`, langs: (n: string) => `تعديل ${count(n, ['لغة واحدة', 'لغتين', 'لغات', 'لغةً', 'لغة'])}`, commits: (n: string) => count(n, ['إيداع واحد', 'إيداعان', 'إيداعات', 'إيداعًا', 'إيداع']),
      dayCommits: (n: string) => `${count(n, ['إيداع واحد', 'إيداعان', 'إيداعات', 'إيداعًا', 'إيداع'])} في يوم واحد`, hours: (n: string) => `${count(n, ['ساعة واحدة', 'ساعتان', 'ساعات', 'ساعةً', 'ساعة'])} من العمل`, night: (n: string) => `${count(n, TURN)} بعد منتصف الليل`, early: (n: string) => `${count(n, TURN)} قبل 7:00`,
      days: (n: string) => `${count(n, DAY)} من العمل`, streak: (n: string) => `${count(n, DAY)} على التوالي`, level: (n: string) => `المستوى ${n}`, items: (n: string) => `${count(n, ['قطعة واحدة', 'قطعتان', 'قطع', 'قطعةً', 'قطعة'])} للارتداء`,
      badges: (n: string) => `جميع الشارات الـ${n}`,
    },
    name: {
      hello: 'أهلًا وسهلًا', firstEdit: 'اللمسة الأولى', firstCommit: 'ختم وتوقيع', handy: 'يد ماهرة', again: 'عودة حميدة', chatty: 'ثرثرة', firstHour: 'بداية الدوام', lateOne: 'وجبة منتصف الليل', earlyOne: 'بركة البكور', levelTwo: 'نموّ',
      talker: 'حديث شيّق', storyteller: 'حكواتي', editor: 'تحرير', shipper: 'ساعي البريد', toolbox: 'صندوق العدّة', tenHours: 'نادي العشر ساعات', dayAndNight: 'ليل نهار', tenDays: 'عشرة أيام', monthOfDays: 'شهر من الأيام', threeInRow: 'ثلاثة متتالية',
      fortnight: 'أسبوعان', tenThousand: 'عشرة آلاف سطر', pruner: 'المقصّ', nightShift: 'المناوبة الليلية', dawnPatrol: 'دورية الفجر', levelTen: 'خانتان', dresser: 'أناقة', bigDay: 'يوم حافل', shippingDay: 'يوم الإطلاق', trilingual: 'ثلاثي اللغات',
      orator: 'فن الخطابة', tenThousandTurns: 'عشرة آلاف طلب', sculptor: 'نحت', architect: 'هندسة معمارية', fleet: 'أسطول', workshop: 'ورشة', hundredHours: 'مئة ساعة', marathoner: 'نفَس طويل', seasons: 'خبرة عريقة', twoHundred: 'مئتا يوم',
      unbroken: 'بلا انقطاع', twoMonths: 'شهران بثبات', novelist: 'رواية كاملة', minimalist: 'بساطة', nocturne: 'لحن الليل', levelQuarter: 'ربع قرن', levelForty: 'الأربعون', collector: 'هواية الجمع', wildDay: 'يوم جنوني', polymath: 'موسوعية',
      legend: 'أسطورة', million: 'زحزحة الجبال', armada: 'أرمادا', thousandHours: 'ألف ساعة', yearRound: 'طوال العام', hundredInRow: 'مئة متتالية', library: 'مكتبة أكواد', levelSeventyFive: 'خمسة وسبعون', everything: 'بكامل الزينة', allBadges: 'العلامة الكاملة',
    },
    won: (name: string) => `إنجاز: ${name}`,
  },
  card: 'بطاقة للمشاركة',
  cardCopied: 'تم نسخ السطر الخاص بملفك على GitHub.',
  shield: 'الدرع: السؤال قبل أمر لا يمكن التراجع عنه',
  shieldHint: 'محادثات Claude Code بدون الإضافة. يسألك Claude Code أولًا، مع ما سيفعله الأمر.',
  careful: (what: string) => `انتبه: ${what}`,
  agentBroken: 'لا يمكن قراءة ملف إعداداته، لذا تُرك كما هو.',
  connect: 'اتصال',
  disconnect: 'قطع الاتصال',
  place: 'المكان',
  resetPlace: 'العودة إلى الزاوية',
  version: (v: string) => `Mochi Buddy ${v}`,
}
export default AR
