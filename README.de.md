<div align="center">

<img src="docs/hero.webp" width="240" alt="Mochi, ein kleines Maskottchen aus Knete, winkt, denkt nach, liest, tippt, feiert und schläft ein">

# Mochi

**Ein kleiner Freund aus Knete für Claude Code.**<br>
Er sitzt direkt über deinem Prompt, reagiert auf alles, was Claude tut,<br>
und behält die Zahlen, nach denen du ständig schaust, für dich im Blick.

[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-E08A6A?style=flat-square)](LICENSE)
[![Claude-Code-Plugin](https://img.shields.io/badge/Claude_Code-Plugin-D97757?style=flat-square)](#-installation)
[![10 Sprachen](https://img.shields.io/badge/Sprachen-10-7AA2F7?style=flat-square)](#-sprachen)
[![36 Accessoires](https://img.shields.io/badge/Kleiderschrank-36_Teile-B794F6?style=flat-square)](#-ein-kleiderschrank-der-mit-dir-wächst)
[![PRs willkommen](https://img.shields.io/badge/PRs-willkommen-4CC38A?style=flat-square)](CONTRIBUTING.md)

[English](README.md) · [Türkçe](README.tr.md) · [Español](README.es.md) · **Deutsch** · [Français](README.fr.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

<br>

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
> Mochi baut auf den Hooks-Modulen (Function Hooks) von Claude Code auf und braucht deshalb eine Claude-Code-Version, die sie unterstützt.

## 🧡 Was Mochi alles mitbekommt

<table>
<tr>
<td width="50%" valign="top">

**🎭 27 Stimmungen, keine harten Schnitte**<br>
Mochi denkt nach, liest, tippt, führt Befehle aus, wartet auf dich, feiert einen grünen Testlauf, ist nach drei Fehlern in Folge ganz schwindelig und schläft, wenn du weg bist. Jede Pose geht fließend in die nächste über.

</td>
<td width="50%" valign="top">

**📊 Deine Limits, mit Prognose**<br>
Ringe für das Kontextfenster, die 5-Stunden-Sitzung und die Woche. Verbrauchst du ein Limit schneller, als es zurückgesetzt wird, sagt dir Mochi, *wann* es voll ist.

</td>
</tr>
<tr>
<td valign="top">

**🛡️ Ein Schild für die gefährlichen Befehle**<br>
`rm -rf`, `git push --force`, `git reset --hard`, `DROP TABLE`, `npm publish`, `sudo`… halten erst einmal an und fragen nach, und zwar mit klaren Worten dazu, was sie zerstören würden.

</td>
<td valign="top">

**🔁 Ein Auge auf Schleifen**<br>
Derselbe Befehl schlägt dreimal fehl, derselbe Fehler taucht immer wieder auf, derselbe Aufruf liefert immer dasselbe: Mochi merkt es, bevor dein Limit es merkt.

</td>
</tr>
<tr>
<td valign="top">

**🔔 Hinweise bei langen Jobs**<br>
Eine macOS-Benachrichtigung, sobald eine Runde von über zwei Minuten fertig ist oder ein langer Job auf deine Freigabe wartet. Hol dir ruhig einen Kaffee.

</td>
<td valign="top">

**💬 Deine anderen Chats**<br>
Jeder Chat auf deinem Rechner, in dem Mochi läuft, teilt seinen Stand. So kann dir dieser hier sagen, dass ein anderer auf dich wartet oder fertig ist.

</td>
</tr>
</table>

## 🔍 Die Detailansicht

Klick auf die Ringe und alles klappt auf: diese Sitzung auf einen Blick, deine anderen Chats und **jede geänderte Datei mit hinzugefügten und entfernten Zeilen**, die von Claude in diesem Chat bearbeiteten zuerst, dazu die letzte Bearbeitung selbst, in Rot und Grün.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/details-de-dark.png">
  <img src="docs/details-de-light.png" width="720" alt="Die Detailansicht: Ringe für Kontext und Limits mit Prognose, die Zahlen dieser Sitzung, andere Chats und eine Liste geänderter Dateien mit Zeilenzahlen samt der letzten Bearbeitung">
</picture>

Weiter unten: der Kontext nach Kategorien, deine letzten Runden und ein Kalender mit den Tagen all deiner Chats.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/history-de-dark.png">
  <img src="docs/history-de-light.png" width="720" alt="Ein Kalender der letzten Monate Arbeit mit den Runden von heute, den letzten sieben Tagen und deinen Tagen in Folge">
</picture>

## 👒 Ein Kleiderschrank, der mit dir wächst

Jede Runde, jede Bearbeitung, jeder Commit und jeder Arbeitstag bringt Erfahrung. Mit jedem Level schaltest du etwas zum Anziehen frei: **36 Teile** für Kopf, Gesicht, Hals, Hand und den Platz neben Mochi. Manche kommen mit der Jahreszeit (ein Hexenhut Ende Oktober, eine Weihnachtsmütze im Dezember), manche mit der Uhrzeit (Kaffee am Morgen, eine Schlafmütze nach Mitternacht).

<p align="center">
  <img src="docs/wardrobe.png" width="840" alt="Zwölf Mochis in verschiedenen Outfits: Strickmütze mit Kaffee, Cowboy mit Schnurrbart, Zauberer, Partyhut, Krone mit Monokel und Katze, Schlafmütze mit Schal und mehr">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/level-de-dark.png">
  <img src="docs/level-de-light.png" width="640" alt="Mochis Level: ein Ring aus Erfahrungspunkten, die XP bis zum nächsten Level und das nächste Teil, das freigeschaltet wird">
</picture>

Was Mochi trägt, suchst du im Bereich **Kleiderschrank** der Detailansicht aus, oder mit `/mochi tragen brille`.

## ⌨️ Befehle

| Befehl | Was er macht |
| --- | --- |
| `/mochi` | Leiste aus- oder einblenden |
| `/mochi details` | Detailansicht öffnen |
| `/mochi level` | Dein Level, deine Erfahrung und was noch gesperrt ist |
| `/mochi tragen [Teil \| automatisch \| nichts]` | Etwas anziehen, Mochi sich selbst einkleiden lassen oder alles ablegen |
| `/mochi schild` | Schild an- oder ausschalten |
| `/mochi hinweise` | Hinweise bei langen Jobs an- oder ausschalten |
| `/mochi ton` | Töne an- oder ausschalten |
| `/mochi sprache [Code \| automatisch]` | Sprache anzeigen oder ändern |
| `/mochi klein` · `/mochi groß` | Eine Zeile oder volle Größe |
| `/mochi status` | Was Mochi gerade weiß |

Die englischen Befehlswörter funktionieren immer (`/mochi wear`, `/mochi alerts`, `/mochi lang`…).

## 🌍 Sprachen

English · Türkçe · Español · Deutsch · Français · Português · Русский · 中文 · 日本語 · 한국어

Mochi spricht die Sprache aus der `language`-Einstellung von Claude Code, wenn sie eine davon ist; sonst die bevorzugte Sprache deines Systems, dann `LANG`; und wenn nichts davon passt, Englisch. Mit `/mochi sprache de` legst du sie selbst fest, `/mochi sprache automatisch` schaltet zurück auf automatisch.

## 🔒 Worauf Mochi zugreift

Alles bleibt auf deinem Rechner. Mochi stellt **keinerlei Netzwerkanfragen**.

- Mochi liest `git status`, `git log` und `git diff --numstat` im Ordner des Chats.
- Unter macOS führt Mochi `osascript` für Benachrichtigungen und `defaults read -g AppleLanguages` für die Sprache aus; überall außerdem `date +%z` für die Ortszeit.
- Mochi schreibt kleine JSON-Dateien nach `~/.claude/mochi/`: den Stand jedes offenen Chats, Tageszählungen, dein Level und Verbrauchswerte für die Prognose.

## 🤝 Mitmachen

Bugreports, Ideen, Übersetzungen, Artwork und Pull Requests sind herzlich willkommen. [Eröffne ein Issue](https://github.com/oztrkemree/mochi/issues/new/choose) oder lies [CONTRIBUTING.md](CONTRIBUTING.md), um mit dem Code loszulegen: Zwei Befehle prüfen alles (`claude plugin validate .` und `claude plugin test .`), und eine neue Sprache ist genau eine Datei.

## 📄 Lizenz

[MIT](LICENSE). Benutz es, bau es um, teil es.

<p align="center"><sub>Mit viel Liebe gemacht von <a href="https://github.com/oztrkemree">Emre Öztürk</a> und Claude.</sub></p>
