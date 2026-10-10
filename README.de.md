<div align="center">

<img src="docs/hero.webp" width="240" alt="Mochi, ein kleines Maskottchen aus Knete, winkt, denkt nach, liest, tippt, feiert und schläft ein">

# Mochi

**Ein kleiner Freund aus Knete für Claude Code.**<br>
Er sitzt direkt über deinem Prompt, reagiert auf alles, was Claude tut,<br>
und behält die Zahlen, nach denen du ständig schaust, für dich im Blick.

[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-E08A6A?style=flat-square)](LICENSE)
[![Claude-Code-Plugin](https://img.shields.io/badge/Claude_Code-Plugin-D97757?style=flat-square)](#-installation)
[![16 Sprachen](https://img.shields.io/badge/Sprachen-16-7AA2F7?style=flat-square)](#-sprachen)
[![134 Accessoires](https://img.shields.io/badge/Kleiderschrank-134_Teile-B684F6?style=flat-square)](#-ein-kleiderschrank-der-mit-dir-wächst)
[![PRs willkommen](https://img.shields.io/badge/PRs-willkommen-4CC38A?style=flat-square)](CONTRIBUTING.md)

[English](README.md) · [Türkçe](README.tr.md) · [Español](README.es.md) · **Deutsch** · [Français](README.fr.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

<br>

<p align="center">
  <img src="docs/demo.svg" width="744" alt="Mochis Leiste geht ihre Stimmungen und Outfits durch: winkt, liest, bearbeitet, führt einen Befehl aus, ist stolz, wartet auf dich, feiert und schläft">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/band-de-dark.png">
  <img src="docs/band-de-light.png" alt="Mochis Leiste über dem Prompt: bearbeitet checkout.tsx, die letzten Tool-Aufrufe, der Branch, ein anderer wartender Chat und Ringe für Kontext, die 5-Stunden-Sitzung und die Woche">
</picture>

<p align="center"><sub>Alles auf einen Blick: was Claude gerade tut, die letzten Tool-Aufrufe, dein Branch, ein anderer Chat, der auf dich wartet, und wie voll Kontext, Sitzung und Woche schon sind.</sub></p>

## ✨ Installation

```
/plugin install mochi --marketplace oztrkemree/mochi
```

Tipp das in einen beliebigen Claude-Code-Chat, antworte mit `y`, um den Marketplace hinzuzufügen, und wähle den Scope **user**. Mochi ist sofort da und ab dann in jedem Chat dabei, den du öffnest.

> [!NOTE]
> Mochi baut auf den Hooks-Modulen (Function Hooks) von Claude Code auf und braucht **Claude Code 2.1.293 oder neuer** (`claude --version` zeigt dir deine Version). Ältere Builds wie 2.1.286 laden das Modul gar nicht, und Mochi taucht nie auf.

## 🧡 Was Mochi alles mitbekommt

<table>
<tr>
<td width="50%" valign="top">

**🎭 30 Stimmungen, keine harten Schnitte**<br>
Mochi denkt nach, liest, tippt, führt Befehle aus, wartet auf dich, feiert einen grünen Testlauf, ist nach drei Fehlern in Folge ganz schwindelig und schläft, wenn du weg bist. Jede Pose geht fließend in die nächste über.

</td>
<td width="50%" valign="top">

**📊 Deine Limits, mit Prognose**<br>
Ringe für das Kontextfenster, die 5‑Stunden-Sitzung und die Woche. Verbrauchst du ein Limit schneller, als es zurückgesetzt wird, sagt dir Mochi, *wann* es voll ist. Und wenn ein Limit, das du fast aufgebraucht hattest, zurückgesetzt wird, sagt er dir auch das.

</td>
</tr>
<tr>
<td valign="top">

**🛡️ Ein Schild für die gefährlichen Befehle**<br>
`rm -rf`, `Remove-Item -Recurse`, ein Force-Push auf `main`, `git reset --hard`, `DROP TABLE`, ein Skript direkt aus dem Internet in die Shell… halten erst einmal an und fragen nach, mit klaren Worten dazu, was sie zerstören würden. Genauso ein Schlüssel oder Token, der gleich geschrieben oder committet werden soll.

</td>
<td valign="top">

**🔁 Ein Auge auf Schleifen**<br>
Derselbe Befehl schlägt dreimal fehl, derselbe Fehler taucht immer wieder auf, derselbe Aufruf liefert immer dasselbe: Mochi merkt es, bevor dein Limit es merkt.

</td>
</tr>
<tr>
<td valign="top">

**🔔 Hinweise, während du weg bist**<br>
Eine Systembenachrichtigung (macOS, Windows oder Linux), wenn eine Runde von über zwei Minuten endet, wenn ein langer Job anhält und auf dich wartet, wenn dein Limit zurückgesetzt wird oder wenn die CI fehlschlägt. Mach dir ruhig einen Tee.

</td>
<td valign="top">

**💬 Alle Chats in einer Übersicht**<br>
Jeder Chat auf deinem Rechner, dieser hier zuerst und gleich danach die, die auf dich warten, jeweils mit Branch (Worktrees markiert), was er gerade tut und wie lange schon. Wartet ein Chat seit fünf Minuten auf dich, kommt noch eine Benachrichtigung.

</td>
</tr>
<tr>
<td valign="top">

**🚦 CI nach dem Push**<br>
Mochi verfolgt die GitHub-Actions-Läufe über dein eigenes `gh`: `CI läuft · 2/5` in der Leiste, eine kleine Feier, wenn alles grün ist, und der Name des fehlgeschlagenen Workflows, wenn nicht. Zwischen den Läufen zeigt die Leiste den Pull Request deines Branches, sein Review und seine Checks; die Detailansicht zeigt ihn vollständig.

</td>
<td valign="top">

**💡 Tipps, die gerade passen**<br>
Ab und zu, während Mochi Pause hat, ein kurzer Claude-Code-Tipp zu dem, was gerade passiert ist: Esc Esc nach einer abgebrochenen Runde, `/compact`, wenn der Kontext voll wird. Gibst du dieselbe Anweisung zum dritten Mal, bietet Mochi an, sie in die `CLAUDE.md` aufzunehmen; geschrieben wird nur, wenn du auf Aufnehmen klickst.

</td>
</tr>
<tr>
<td valign="top">

**🏅 Abzeichen für echte Arbeit**<br>
Zwölf Stück, jedes wird genau einmal gefeiert: der erste grüne Testlauf, ein Comeback in einer einzigen Runde, ein Aufräumtag, an dem mehr wegfällt als dazukommt, Nachteule, Frühaufsteher, Polyglott, eine Marathon-Runde, hundert Commits…

</td>
<td valign="top">

**🎉 Besondere Tage, kleine Überraschungen**<br>
Zuckerfest und Opferfest, Mondneujahr, Nouruz, Diwali, Chuseok, die Kirschblütenzeit, Hacktoberfest, Halloween, Weihnachten und dein Geburtstag bringen jeweils etwas zum Anziehen mit. Sag Mochi gute Nacht oder bedank dich bei ihm. Nach zwei Stunden ohne Pause schlägt er vor, dich kurz zu strecken.

</td>
</tr>
</table>

## 🛡️ Der Schild

Der Schild liest jeden Befehl, den Claude über Bash oder PowerShell ausführt, und jede Änderung, die Claude an Dateien macht. Vor allem, was sich nicht rückgängig machen lässt, hält er an und fragt nach: Dateien und Ordner endgültig löschen (`rm -rf`, `Remove-Item -Recurse`, `del /s`), ein Laufwerk plattmachen, die Historie eines Branches überschreiben, nicht committete Änderungen verwerfen, eine Datenbank löschen, Infrastruktur oder einen Cloud-Bucket abreißen, `npm unpublish`, `docker system prune -a`, ein Skript direkt aus dem Internet in die Shell, `sudo`.

- **Force-Pushes werden nach Branch beurteilt.** Auf `main`, `master`, `trunk` oder `develop` fragt er nach und nennt den Branch. Auf deinen eigenen Branch fragt er mit einem nervösen Blick statt mit Alarm und nennt ihn; ein `--force-with-lease` dorthin bekommt nur den Blick.
- **Geheimnisse bleiben aus deiner Historie draußen.** Bevor Claude etwas schreibt, per `git add` hinzufügt oder committet, das wie ein echter Schlüssel oder Token aussieht (AWS, GitHub, Anthropic, OpenAI, Slack, Stripe, ein privater Schlüssel, ein Passwort), oder eine Datei wie `.env` oder `id_rsa`, fragt Mochi nach und zeigt den Wert maskiert: `AKIA••••••LE`. Platzhalter und offensichtliche Testwerte gehen durch.
- **Hier immer erlauben.** Die Frage bietet **Ausführen** (oder **Schreiben**), **Abbrechen** und **Hier immer erlauben**; Letzteres merkt sich diese Art von Befehl für dieses Repository. Das gilt für alles, was darin bleibt: Ein Befehl oder eine Änderung, die darüber hinausgreift (`rm -rf ~`, eine Datei in deinem Home-Ordner), fragt wieder. `/mochi schild` zeigt, ob der Schild an ist und was wo erlaubt ist; `/mochi schild zurücksetzen` vergisst alles wieder.

Deine eigenen Regeln kommen in `~/.claude/mochi/shield.json`:

```json
{
  "add": [{ "match": "terraform\\s+apply", "says": "ändert die Live-Infrastruktur" }],
  "off": ["publish", "sudo"]
}
```

- `match` ist ein regulärer Ausdruck, der auf jeden Bash- und PowerShell-Befehl angewendet wird, ohne auf Groß- und Kleinschreibung zu achten. `says` beschreibt, was so ein Befehl tun würde, und steht in der Frage; fehlt es, sagt die Frage, dass der Befehl zu einer deiner Regeln passt.
- `off` listet die eingebauten Arten auf, bei denen Mochi nicht mehr nachfragen soll: jeder Schlüssel von `danger` in [`hooks/lang/de.ts`](hooks/lang/de.ts) (`rm`, `forcePush`, `publish`, `sudo`…), `secret` oder eine Art davon (`secret:aws`, `secret:github`, `secret:apiKey`, `secret:slack`, `secret:stripe`, `secret:privateKey`, `secret:generic`), `secretFile` und `secretEdit`.
- Mochi liest die Datei neu ein, sobald sie sich ändert, und sagt es in einer Meldung. Was er nicht verwenden kann, wird übersprungen und genannt; ist die Datei kein gültiges JSON, gilt keine deiner Regeln, bis sie es wieder ist. Bevor Claude selbst die Datei ändert, fragt der Schild.

## 🔍 Die Detailansicht

Klick auf die Ringe und alles klappt auf: diese Sitzung auf einen Blick, alle Chats auf deinem Rechner, deine CI und dein Pull Request und **jede geänderte Datei mit hinzugefügten und entfernten Zeilen**, die von Claude in diesem Chat bearbeiteten zuerst, dazu die letzte Bearbeitung selbst, in Rot und Grün.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/details-de-dark.png">
  <img src="docs/details-de-light.png" width="720" alt="Die Detailansicht: Ringe für Kontext und Limits mit Prognose, die Zahlen dieser Sitzung, andere Chats und eine Liste geänderter Dateien mit Zeilenzahlen samt der letzten Bearbeitung">
</picture>

Weiter unten: der Kontext nach Kategorien, deine letzten Runden, ein Kalender mit den Tagen all deiner Chats sowie dein Level, dein Kleiderschrank und deine Abzeichen.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/history-de-dark.png">
  <img src="docs/history-de-light.png" width="720" alt="Ein Kalender der letzten Monate Arbeit mit den Runden von heute, den letzten sieben Tagen und deinen Tagen in Folge">
</picture>

## 👒 Ein Kleiderschrank, der mit dir wächst

Jede Runde, jede Bearbeitung, jeder Commit und jeder Arbeitstag bringt Erfahrung. Mit jedem Level schaltest du etwas zum Anziehen frei: **134 Teile** für Kopf, Gesicht, Hals, Hand und den Platz neben Mochi. Manche kommen mit dem Tag (ein Hexenhut Ende Oktober, ein roter Umschlag zum Mondneujahr, eine Diya-Lampe zu Diwali, ein Partyhut und ein Kuchen an deinem Geburtstag), manche mit der Uhrzeit (Kaffee am Morgen, eine Schlafmütze nach Mitternacht).

<p align="center">
  <img src="docs/wardrobe.png" width="840" alt="Zwölf Mochis in verschiedenen Outfits: Strickmütze mit Kaffee, Cowboy mit Schnurrbart, Zauberer, Partyhut, Krone mit Monokel und Katze, Schlafmütze mit Schal und mehr">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/level-de-dark.png">
  <img src="docs/level-de-light.png" width="640" alt="Mochis Level: ein Ring aus Erfahrungspunkten, die XP bis zum nächsten Level und das nächste Teil, das freigeschaltet wird">
</picture>

Was Mochi trägt, suchst du im Bereich **Kleiderschrank** der Detailansicht aus, oder mit `/mochi tragen brille`. Deinen Geburtstag verrätst du Mochi mit `/mochi geburtstag 04-23`; er bleibt auf deinem Rechner. Du hast eine Idee für ein neues Teil? [docs/OUTFITS.md](docs/OUTFITS.md) zeigt, wie du es hinzufügst.

## 📸 Zum Teilen

- **`/mochi karte`** zeichnet eine Karte: Mochi im heutigen Outfit, dein Level, deine Erfahrung und deine Serien.
- **`/mochi rückblick`** fasst deinen Monat über alle Chats hinweg in einem Bild zusammen: Stunden, Runden, Commits, dein aktivster Tag, deine längste Serie und der Ordner, in dem du die meiste Zeit verbracht hast. `/mochi rückblick jahr` macht das fürs ganze Jahr. In der ersten Woche eines Monats sagt Mochi dir einmal, dass der Rückblick auf den letzten Monat fertig ist.
- **`/mochi foto`** speichert die Leiste und die Detailansicht so, wie sie gerade sind. Schau es dir an, bevor du es postest: Es zeigt, was die Leiste zeigt, deinen Branch eingeschlossen. Deine anderen Chats und die Zeilen deiner letzten Änderung bleiben draußen.

Das sind SVG-Dateien unter `~/.claude/mochi/share/`, gemacht für helle und dunkle Seiten, und sie brauchen nichts von außen. X und Reddit nehmen nur PNG: Ist `rsvg-convert` oder ImageMagick installiert, speichert `/mochi foto` von jeder auch ein PNG.

So kommt die Karte in dein GitHub-Profil:

1. Klone dein Profil-Repository, das so heißt wie dein Benutzername (`dein-name/dein-name`).
2. Führe `/mochi karte ~/code/dein-name` mit dem Pfad zu diesem Ordner aus; die Karte landet dort als `mochi-card.svg`.
3. Füge die Zeile, die Mochi dir gibt, in die `README.md` des Repositorys ein, dann committen und pushen:

   ```md
   [![Mochi für Claude Code](mochi-card.svg)](https://github.com/oztrkemree/mochi)
   ```

Die Karte ist eine Momentaufnahme: Nach einem Level-up führst du `/mochi karte` einfach noch einmal aus und pushst die neue.

## ⌨️ Befehle

| Befehl | Was er macht |
| --- | --- |
| `/mochi` | Leiste aus- oder einblenden (gezielt mit `/mochi verstecken` · `/mochi zeigen`) |
| `/mochi details` | Detailansicht öffnen |
| `/mochi level` | Dein Level, deine Erfahrung und was noch gesperrt ist |
| `/mochi tragen [Teil \| automatisch \| nichts]` | Etwas anziehen, Mochi sich selbst einkleiden lassen oder alles ablegen |
| `/mochi abzeichen` | Deine Abzeichen, und wie du die übrigen bekommst |
| `/mochi chats` | Alle Chats auf diesem Rechner, die wartenden zuerst |
| `/mochi schild [an \| aus]` | Sehen, ob der Schild an ist und was wo immer erlaubt ist; `an` oder `aus` schaltet ihn so |
| `/mochi schild zurücksetzen` | Alles vergessen, was sich „Hier immer erlauben“ gemerkt hat |
| `/mochi hinweise` | Benachrichtigungen an- oder ausschalten (samt der Nachricht, dass dein Rückblick fertig ist) |
| `/mochi ci` | CI-Beobachtung an- oder ausschalten |
| `/mochi tipps` | Tipps, `CLAUDE.md`-Vorschläge und den Hinweis auf Neuigkeiten an- oder ausschalten |
| `/mochi pausen` | Den Vorschlag, dich zu strecken, an- oder ausschalten |
| `/mochi ton` | Töne an- oder ausschalten |
| `/mochi erweiterungen` | Reaktionen anderer Plugins an- oder ausschalten |
| `/mochi karte [Pfad]` | Eine Karte für dein GitHub-Profil speichern |
| `/mochi rückblick [jahr]` | Deinen Monat oder dein Jahr in einem Bild speichern |
| `/mochi foto` | Leiste und Detailansicht als Bilder speichern |
| `/mochi rundgang` | Den Rundgang vom ersten Start noch einmal ansehen |
| `/mochi neuigkeiten` | Was diese Version Neues bringt |
| `/mochi geburtstag [MM-TT \| nichts]` | Mochi deinen Geburtstag verraten, ihn anzeigen oder vergessen lassen |
| `/mochi sprache [Code \| automatisch]` | Sprache anzeigen oder ändern |
| `/mochi klein` · `/mochi groß` | Eine Zeile oder volle Größe |
| `/mochi exportieren` | Alles, was Mochi speichert, in einer JSON-Datei sichern |
| `/mochi zurücksetzen [level \| verlauf \| alles]` | Den Level-Speicher, den Verlauf oder alles löschen, Einstellungen eingeschlossen; Mochi fragt vorher nach, und Exporte und deine `shield.json` bleiben erhalten |
| `/mochi rückmeldung` | Ein Link zu einem Bugreport, schon ausgefüllt mit den Versionen, deinem System, der Oberfläche und der Sprache |
| `/mochi status` | Was Mochi gerade weiß |

Die englischen Befehlswörter funktionieren immer (`/mochi wear`, `/mochi badges`, `/mochi lang`…), und jede Sprache bringt ihre eigenen mit. Ein Befehl, der etwas an- oder ausschaltet, schaltet es jedes Mal um; mit `an` oder `aus` stellst du es fest ein: `/mochi tipps aus`.

## 🌍 Sprachen

English · Türkçe · Español · Deutsch · Français · Português · Русский · 中文 · 日本語 · 한국어 · Italiano · Polski · Українська · हिन्दी · Bahasa Indonesia · العربية

Mochi spricht die Sprache aus der `language`-Einstellung von Claude Code, wenn sie eine davon ist; sonst die bevorzugte Sprache deines Systems, dann `LANG`; und wenn nichts davon passt, Englisch. Mit `/mochi sprache de` legst du sie selbst fest, `/mochi sprache automatisch` schaltet zurück auf automatisch.

## 🔒 Worauf Mochi zugreift

Alles bleibt auf deinem Rechner. Mochi selbst stellt **keinerlei Netzwerkanfragen**; das Einzige, was mit dem Internet spricht, ist dein eigenes `gh`, für die CI-Beobachtung.

- **git**, im Ordner des Chats und nur lesend: `git status`, `git log`, `git diff --numstat` und `git rev-parse` für die Leiste und die Detailansicht. Wenn der Schild genauer hinsehen muss, fragt er den Branch und den Standard-Branch ab, die Dateien, die ein `git add` hinzufügen würde (`git ls-files`), und was ein `git commit` committen würde (`git diff`).
- **gh**, nur solange die CI-Beobachtung an ist, mit deinem eigenen Login (Mochi sieht dein Token nie): `gh pr view`, wenn ein Chat startet, wenn du die Detailansicht öffnest und rund um einen Push; `gh run list` nur nach einem Push in diesem Chat, alle 30 Sekunden, bis die Läufe fertig sind, höchstens eine halbe Stunde lang. `/mochi ci` schaltet beides aus.
- **Die Werkzeuge des Systems**: Benachrichtigungen über `osascript` unter macOS, PowerShell unter Windows und `notify-send` unter Linux. Für die Sprache `defaults read -g AppleLanguages` unter macOS und `reg query` unter Windows; `uname` unterscheidet macOS von Linux. Für die PNGs von `/mochi foto` `rsvg-convert` oder `magick` von ImageMagick, falls installiert. Dateien geschlossener Chats und das, was `/mochi zurücksetzen` löscht, werden einzeln beim Namen mit `rm` gelöscht, unter Windows mit `del` aus `cmd`, und nur innerhalb von `~/.claude/mochi/`.
- **Dateien unter `~/.claude/mochi/`**: der Stand jedes offenen Chats, Tageszählungen, dein Level und deine Abzeichen, Verbrauchswerte für die Prognose, wie oft jeder Tipp gezeigt wurde und die kurzen Anweisungen, die du wiederholst (nie ganze Prompts), die Markierungen, mit denen nur ein Chat ein zurückgesetztes Limit meldet, deine `shield.json`, falls du eine schreibst, und was `/mochi karte`, `rückblick`, `foto` und `exportieren` speichern. Einstellungen, was immer erlaubt ist, und dein Geburtstag liegen im Plugin-Speicher von Claude Code.
- **Dein Projekt**: Mochi liest die `CLAUDE.md`, bevor er eine Anweisung vorschlägt, und hängt erst dann eine Zeile an, wenn du **Aufnehmen** wählst. Die Karte schreibt er nur dorthin, wenn du `/mochi karte` einen Pfad dorthin gibst. Um Zeilen zu zählen und Geheimnisse zu erkennen, liest er eine Datei, die Claude gleich überschreiben will, und bei einem Befehl, der in einem Rutsch hinzufügt und committet, die neuen Dateien, die dabei hinzukämen (bis zu 20, jeweils unter 1 MB). Nichts davon wird gespeichert.
- **Andere Plugins** können über Mochi eine Stimmung und eine kurze Zeile zeigen, mit ihrem Namen unterschrieben, jedes höchstens einmal alle 10 Sekunden; `/mochi erweiterungen` schaltet das aus. `/mochi rückmeldung` gibt nur einen Link aus: Gesendet wird nichts.

## 🧩 Für Plugin-Autoren

Dein Plugin kann Mochi reagieren lassen: jubeln, wenn ein Deploy fertig ist, besorgt schauen, wenn ein Check fehlschlägt. Trag `mochi` unter `dependencies` ein und ruf `$.mochi.react({ mood, line })` oder `$.mochi.celebrate({ line })` auf. In [docs/API.md](docs/API.md) findest du die Aufrufe, die Grenzen und ein komplettes Beispiel-Plugin.

## 🤝 Mitmachen

Bugreports, Ideen, Übersetzungen, Artwork und Pull Requests sind herzlich willkommen. [Eröffne ein Issue](https://github.com/oztrkemree/mochi/issues/new/choose) (`/mochi rückmeldung` gibt dir einen schon ausgefüllten Bugreport) oder lies [CONTRIBUTING.md](CONTRIBUTING.md), um mit dem Code loszulegen: Zwei Befehle prüfen alles (`claude plugin validate .` und `claude plugin test .`), und eine neue Sprache braucht ein Wörterbuch und ein paar Zeilen. Was sich in welcher Version geändert hat, steht in [CHANGELOG.md](CHANGELOG.md).

## 📄 Lizenz

[MIT](LICENSE). Benutz es, bau es um, teil es.

<p align="center"><sub>Mit viel Liebe gemacht von <a href="https://github.com/oztrkemree">Emre Öztürk</a> und Claude.</sub></p>
