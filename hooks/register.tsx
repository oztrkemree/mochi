import type { EngineInterface, Register } from 'claude-code'

// Mochi is now Mochi Buddy (`mochi-buddy`). Someone on the old `mochi` who
// updates gets this last version of it: a line above the prompt that says so,
// and a button (or /mochi move) that installs Mochi Buddy and removes this
// one. Mochi Buddy copies the old plugin's settings on its first start; the
// level, history and wardrobe in ~/.claude/mochi are the same files. Once
// Mochi Buddy is on, this plugin draws nothing and answers nothing.

type Dollar = EngineInterface

type Words = { line: string; move: string; done: string; byHand: string }

const WORDS: Record<string, Words> = {
  en: { line: 'Mochi is now Mochi Buddy. Move over to keep your settings, level and wardrobe.', move: 'Move', done: 'Mochi Buddy is installed and the old Mochi removed. Restart Claude Code to meet it.', byHand: 'Run these in a terminal, then restart Claude Code:' },
  tr: { line: 'Mochi artık Mochi Buddy. Ayarların, seviyen ve gardırobunla birlikte geçebilirsin.', move: 'Geç', done: 'Mochi Buddy kuruldu, eski Mochi kaldırıldı. Onu görmek için Claude Code\'u yeniden başlat.', byHand: 'Bunları bir terminalde çalıştır, sonra Claude Code\'u yeniden başlat:' },
  de: { line: 'Mochi heißt jetzt Mochi Buddy. Wechsle, und deine Einstellungen, dein Level und deine Garderobe kommen mit.', move: 'Wechseln', done: 'Mochi Buddy ist installiert, das alte Mochi entfernt. Starte Claude Code neu, um es zu sehen.', byHand: 'Führe das im Terminal aus und starte Claude Code dann neu:' },
  es: { line: 'Mochi ahora es Mochi Buddy. Cámbiate y conserva tus ajustes, tu nivel y tu armario.', move: 'Cambiar', done: 'Mochi Buddy está instalado y el Mochi anterior, eliminado. Reinicia Claude Code para verlo.', byHand: 'Ejecuta esto en una terminal y luego reinicia Claude Code:' },
  fr: { line: 'Mochi s’appelle maintenant Mochi Buddy. Passez-y en gardant vos réglages, votre niveau et votre garde-robe.', move: 'Passer', done: 'Mochi Buddy est installé et l’ancien Mochi retiré. Redémarrez Claude Code pour le voir.', byHand: 'Lancez ceci dans un terminal, puis redémarrez Claude Code :' },
  pt: { line: 'O Mochi agora é Mochi Buddy. Mude e mantenha suas configurações, seu nível e seu guarda-roupa.', move: 'Mudar', done: 'O Mochi Buddy foi instalado e o Mochi antigo removido. Reinicie o Claude Code para vê-lo.', byHand: 'Rode isto em um terminal e depois reinicie o Claude Code:' },
  it: { line: 'Mochi ora si chiama Mochi Buddy. Passa a lui e tieni impostazioni, livello e guardaroba.', move: 'Passa', done: 'Mochi Buddy è installato e il vecchio Mochi rimosso. Riavvia Claude Code per vederlo.', byHand: 'Esegui questi comandi in un terminale, poi riavvia Claude Code:' },
  pl: { line: 'Mochi to teraz Mochi Buddy. Przejdź, a ustawienia, poziom i szafa zostaną z tobą.', move: 'Przejdź', done: 'Mochi Buddy jest zainstalowany, a stary Mochi usunięty. Uruchom ponownie Claude Code, żeby go zobaczyć.', byHand: 'Uruchom to w terminalu, potem uruchom ponownie Claude Code:' },
  ru: { line: 'Mochi теперь Mochi Buddy. Переходи, и настройки, уровень и гардероб останутся с тобой.', move: 'Перейти', done: 'Mochi Buddy установлен, старый Mochi удалён. Перезапусти Claude Code, чтобы его увидеть.', byHand: 'Выполни это в терминале, затем перезапусти Claude Code:' },
  uk: { line: 'Mochi тепер Mochi Buddy. Переходь, і налаштування, рівень та гардероб залишаться з тобою.', move: 'Перейти', done: 'Mochi Buddy встановлено, старий Mochi видалено. Перезапусти Claude Code, щоб його побачити.', byHand: 'Виконай це в терміналі, потім перезапусти Claude Code:' },
  ja: { line: 'Mochi は Mochi Buddy になったよ。移ると設定もレベルもワードローブもそのまま。', move: '移る', done: 'Mochi Buddy を入れて、古い Mochi を外したよ。Claude Code を再起動すると会える。', byHand: 'ターミナルでこれを実行して、Claude Code を再起動して：' },
  ko: { line: 'Mochi가 이제 Mochi Buddy입니다. 옮기면 설정, 레벨, 옷장이 그대로 유지됩니다.', move: '옮기기', done: 'Mochi Buddy를 설치하고 예전 Mochi를 제거했습니다. Claude Code를 다시 시작하면 만날 수 있습니다.', byHand: '터미널에서 다음을 실행한 뒤 Claude Code를 다시 시작하세요:' },
  zh: { line: 'Mochi 现在叫 Mochi Buddy。搬过去，设置、等级和衣橱都会保留。', move: '搬过去', done: 'Mochi Buddy 已安装，旧的 Mochi 已移除。重启 Claude Code 就能见到它。', byHand: '请在终端运行这些命令，然后重启 Claude Code：' },
  ar: { line: 'أصبح Mochi الآن Mochi Buddy. انتقل إليه واحتفظ بإعداداتك ومستواك وخزانة ملابسك.', move: 'انتقال', done: 'تم تثبيت Mochi Buddy وإزالة Mochi القديم. أعد تشغيل Claude Code لتراه.', byHand: 'شغّل هذه الأوامر في الطرفية، ثم أعد تشغيل Claude Code:' },
  hi: { line: 'Mochi अब Mochi Buddy है। बदलिए, आपकी सेटिंग्स, लेवल और वॉर्डरोब साथ रहेंगे।', move: 'बदलें', done: 'Mochi Buddy इंस्टॉल हो गया और पुराना Mochi हटा दिया गया। उसे देखने के लिए Claude Code फिर से शुरू करें।', byHand: 'इन्हें टर्मिनल में चलाएँ, फिर Claude Code फिर से शुरू करें:' },
  id: { line: 'Mochi sekarang menjadi Mochi Buddy. Pindah, dan pengaturan, level, serta lemarimu tetap ikut.', move: 'Pindah', done: 'Mochi Buddy terpasang dan Mochi lama dihapus. Mulai ulang Claude Code untuk melihatnya.', byHand: 'Jalankan ini di terminal, lalu mulai ulang Claude Code:' },
}

/** The two commands that move over, as fixed text. */
const STEPS = ['claude plugin install mochi-buddy@mochi', 'claude plugin uninstall mochi@mochi']

let words: Words = WORDS.en as Words
let isBuddyOn = false
let isMoving = false

/** The language the old Mochi was set to, else the system's, else English. */
async function wordsFor($: Dollar): Promise<Words> {
  const prefs = (await $.store.get('prefs').catch(() => undefined)) as { lang?: unknown } | undefined
  const saved = typeof prefs?.lang === 'string' ? prefs.lang : 'auto'
  const system = ((await $.env.get('LANG').catch(() => undefined)) ?? '').slice(0, 2).toLowerCase()
  return WORDS[saved] ?? WORDS[system] ?? (WORDS.en as Words)
}

/** Installs Mochi Buddy, then removes this plugin; what to run by hand should either fail. */
async function move($: Dollar): Promise<string> {
  if (isMoving) return ''
  isMoving = true
  try {
    const installed = await $.process.run(['claude', 'plugin', 'install', 'mochi-buddy@mochi'], { timeoutMs: 120_000 })
    if (installed.exitCode !== 0) return [words.byHand, ...STEPS.map(s => `  ${s}`)].join('\n')
    const removed = await $.process.run(['claude', 'plugin', 'uninstall', 'mochi@mochi'], { timeoutMs: 60_000 })
    if (removed.exitCode !== 0) return [words.byHand, `  ${STEPS[1]}`].join('\n')
    return words.done
  } catch {
    return [words.byHand, ...STEPS.map(s => `  ${s}`)].join('\n')
  } finally {
    isMoving = false
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const settings = (await $.settings.read().catch(() => undefined)) as { enabledPlugins?: Record<string, unknown> } | undefined
    isBuddyOn = settings?.enabledPlugins?.['mochi-buddy@mochi'] === true
    words = await wordsFor($)
    if (!isBuddyOn) await $.command.register({ name: 'mochi', description: words.line, argumentHint: 'move' })
    return next(e)
  })

  // With Mochi Buddy on, /mochi is its own: passed on untouched.
  on('command.run', { command: 'mochi' }, async ($, e, next) => {
    if (isBuddyOn) return next(e)
    if (e.args.trim() === 'move') return { text: await move($) }
    return { text: [words.line, '/mochi move', '', words.byHand, ...STEPS.map(s => `  ${s}`)].join('\n') }
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (isBuddyOn || e.props.hasSurvey) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" gap={1}>
        <Text color="#D97757">●</Text>
        <Text>{words.line}</Text>
        <Button key="move" label={words.move} onPress={async () => $.ui.toast(await move($), { timeoutMs: 15_000 })} />
      </Box>
    )
  })
}
