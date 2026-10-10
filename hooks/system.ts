// The commands Mochi runs on the machine, which differ by system. Each is an
// argument vector run with no shell, and the words it carries (a chat's name,
// a status line) stay out of its script, so none of them is ever read as code.

/** The system Mochi runs on. */
export type Platform = 'mac' | 'linux' | 'windows'

/** macOS: a JavaScript for Automation script that reads the words from its environment. */
const MAC_ALERT = [
  "ObjC.import('Foundation')",
  'const env = $.NSProcessInfo.processInfo.environment',
  "const word = k => ObjC.unwrap(env.objectForKey(k)) || ''",
  'const app = Application.currentApplication()',
  'app.includeStandardAdditions = true',
  "app.displayNotification(word('MOCHI_TEXT'), { withTitle: word('MOCHI_TITLE'), subtitle: word('MOCHI_SUBTITLE'), soundName: 'Glass' })",
].join('\n')

/** Windows: a toast under PowerShell's own app id, which every Windows has; it reads the words from its environment. */
const WINDOWS_ALERT = [
  '$null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]',
  '$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText04)',
  "$lines = $xml.GetElementsByTagName('text')",
  '$null = $lines.Item(0).AppendChild($xml.CreateTextNode($env:MOCHI_TITLE))',
  '$null = $lines.Item(1).AppendChild($xml.CreateTextNode($env:MOCHI_SUBTITLE))',
  '$null = $lines.Item(2).AppendChild($xml.CreateTextNode($env:MOCHI_TEXT))',
  "$id = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'",
  '[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($id).Show([Windows.UI.Notifications.ToastNotification]::new($xml))',
].join('; ')

/**
 * A system notification: the command, and the environment that carries its
 * words to the script. Linux's notify-send takes them as its arguments, after
 * `--`, so none reads as an option.
 */
export function alertCommand(platform: Platform, title: string, subtitle: string, text: string): { argv: string[]; env: Record<string, string> } {
  const env = { MOCHI_TITLE: title, MOCHI_SUBTITLE: subtitle, MOCHI_TEXT: text }
  if (platform === 'mac') return { argv: ['osascript', '-l', 'JavaScript', '-e', MAC_ALERT], env }
  if (platform === 'windows') return { argv: ['powershell', '-NoProfile', '-NonInteractive', '-Command', WINDOWS_ALERT], env }
  return { argv: ['notify-send', '--', subtitle === '' ? title : `${title} · ${subtitle}`, text], env }
}

/**
 * The command that deletes files by name in the folder it runs in; only plain
 * names (a chat's id), so none reads as a switch, or to cmd as an operator.
 * cmd skips its AutoRun, which could move it to another folder first.
 */
export function removeCommand(platform: Platform, names: readonly string[]): string[] | null {
  const plain = names.filter(n => /^[\w-]+\.json$/.test(n))
  if (plain.length === 0) return null
  return platform === 'windows' ? ['cmd', '/d', '/c', 'del', '/f', '/q', ...plain] : ['rm', '-f', '--', ...plain]
}

/**
 * The command that prints the system's languages: macOS's preferred list;
 * on Windows the display languages from the registry, the person's own choice
 * before the machine's (reg answers at once, where PowerShell takes seconds to
 * start). Linux has `LANG` alone.
 */
export function langCommand(platform: Platform): string[] | null {
  if (platform === 'mac') return ['defaults', 'read', '-g', 'AppleLanguages']
  return platform === 'windows' ? ['reg', 'query', 'HKCU\\Control Panel\\Desktop', '/s', '/f', 'PreferredUILanguages'] : null
}

/** The language codes a langCommand printed, in order: reg's values alone, not its keys' names. */
export function langCodes(out: string): string[] {
  const values = [...out.matchAll(/REG_\w*SZ[ \t]+(.*)/g)].map(m => m[1] ?? '')
  return (values.length > 0 ? values.join('\n') : out).match(/[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]+)*/g) ?? []
}

/** Commands that draw a PNG of an SVG at twice its size, the first the machine has wins: rsvg-convert, then ImageMagick. */
export const pngCommands = (svg: string, png: string): string[][] => [
  ['rsvg-convert', '--zoom=2', '-o', png, svg],
  ['magick', '-density', '192', '-background', 'none', svg, png],
]
