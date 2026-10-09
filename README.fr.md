<div align="center">

<img src="docs/hero.webp" width="240" alt="Mochi, une petite mascotte d’argile, qui fait coucou, réfléchit, lit, tape, fait la fête puis s’endort">

# Mochi

**Un petit compagnon d’argile pour Claude Code.**<br>
Il se tient juste au-dessus de votre prompt, réagit à tout ce que fait Claude,<br>
et garde sous vos yeux les chiffres que vous vérifiez sans arrêt.

[![Licence : MIT](https://img.shields.io/badge/licence-MIT-E08A6A?style=flat-square)](LICENSE)
[![Plugin Claude Code](https://img.shields.io/badge/Claude_Code-plugin-D97757?style=flat-square)](#-installation)
[![10 langues](https://img.shields.io/badge/langues-10-7AA2F7?style=flat-square)](#-langues)
[![36 accessoires](https://img.shields.io/badge/garde--robe-36_accessoires-B794F6?style=flat-square)](#-une-garde-robe-qui-grandit-avec-vous)
[![PR bienvenues](https://img.shields.io/badge/PR-bienvenues-4CC38A?style=flat-square)](CONTRIBUTING.md)

[English](README.md) · [Türkçe](README.tr.md) · [Español](README.es.md) · [Deutsch](README.de.md) · **Français** · [Português](README.pt.md) · [Русский](README.ru.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/band-fr-dark.png">
  <img src="docs/band-fr-light.png" alt="Le bandeau de Mochi au-dessus du prompt : modification de checkout.tsx, les derniers appels d’outils, la branche, une autre conversation qui attend, et les anneaux du contexte, de la session de 5 heures et de la semaine">
</picture>

<p align="center"><sub>Tout d’un coup d’œil : ce que fait Claude en ce moment, les derniers appels d’outils, votre branche, une autre conversation qui vous attend, et le remplissage de votre contexte, de votre session et de votre semaine.</sub></p>

## ✨ Installation

```
/plugin install mochi --marketplace oztrkemree/mochi
```

Tapez cette commande dans n’importe quelle conversation Claude Code, répondez `y` pour ajouter la marketplace et choisissez la portée **user**. Mochi apparaît aussitôt, puis dans chaque conversation que vous ouvrirez ensuite.

> [!NOTE]
> Mochi repose sur les modules de hooks de Claude Code (des hooks sous forme de fonctions) : il lui faut donc une version de Claude Code qui les prend en charge.

## 🧡 Ce que Mochi remarque

<table>
<tr>
<td width="50%" valign="top">

**🎭 27 humeurs, sans à-coups**<br>
Il réfléchit, lit, tape, lance une commande, vous attend, fête des tests enfin au vert, a le tournis après trois erreurs d’affilée, s’endort quand vous vous absentez. Chaque pose s’enchaîne en douceur avec la précédente.

</td>
<td width="50%" valign="top">

**📊 Vos limites, avec une prévision**<br>
Des anneaux pour la fenêtre de contexte, la session de 5 heures et la semaine. Si vous consommez une limite plus vite qu’elle ne se réinitialise, Mochi vous dit *quand* vous arriverez au bout.

</td>
</tr>
<tr>
<td valign="top">

**🛡️ Un bouclier contre les commandes qui font peur**<br>
`rm -rf`, `git push --force`, `git reset --hard`, `DROP TABLE`, `npm publish`, `sudo`… elles s’arrêtent et demandent d’abord, en expliquant clairement ce qu’elles détruiraient.

</td>
<td valign="top">

**🔁 Une sentinelle anti-boucle**<br>
La même commande qui échoue trois fois, la même erreur qui revient, le même appel qui renvoie toujours la même chose : Mochi le repère avant que votre limite n’y passe.

</td>
</tr>
<tr>
<td valign="top">

**🔔 Des alertes pour les longues tâches**<br>
Une notification système (macOS, Windows ou Linux) quand un tour de plus de deux minutes se termine, ou quand une longue tâche s’arrête pour attendre votre approbation. Allez donc vous servir un café.

</td>
<td valign="top">

**💬 Vos autres conversations**<br>
Chaque conversation de votre machine où tourne Mochi indique où elle en est : celle-ci peut donc vous prévenir qu’une autre vous attend ou qu’elle a terminé.

</td>
</tr>
</table>

## 🔍 Le panneau de détails

Cliquez sur les anneaux et tout se déplie : cette session d’un coup d’œil, vos autres conversations et **chaque fichier modifié, avec ses lignes ajoutées et supprimées**, ceux que Claude a touchés dans cette conversation en tête de liste, et la dernière modification elle-même, en rouge et vert.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/details-fr-dark.png">
  <img src="docs/details-fr-light.png" width="720" alt="Le panneau de détails : les anneaux du contexte et des limites avec leur prévision, les chiffres de cette session, les autres conversations, et la liste des fichiers modifiés avec leurs nombres de lignes et la dernière modification">
</picture>

Plus bas : le contexte par catégorie, vos derniers tours, et un calendrier des journées de toutes vos conversations.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/history-fr-dark.png">
  <img src="docs/history-fr-light.png" width="720" alt="Un calendrier des derniers mois de travail, avec les tours du jour, les sept derniers jours et votre série">
</picture>

## 👒 Une garde-robe qui grandit avec vous

Chaque tour, chaque modification, chaque commit et chaque journée de travail rapporte de l’expérience. Les niveaux débloquent de quoi s’habiller : **36 accessoires** pour la tête, le visage, le cou, la main et la place juste à côté de Mochi. Certains arrivent avec la saison (un chapeau de sorcière fin octobre, un bonnet de Noël en décembre), d’autres avec l’heure (un café le matin, un bonnet de nuit après minuit).

<p align="center">
  <img src="docs/wardrobe.png" width="840" alt="Douze Mochi dans des tenues différentes : un bonnet avec un café, un cow-boy moustachu, un magicien, un chapeau de fête, une couronne avec un monocle et un chat, un bonnet de nuit avec une écharpe, et bien d’autres">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/level-fr-dark.png">
  <img src="docs/level-fr-light.png" width="640" alt="Le niveau de Mochi : un anneau d’expérience, l’XP restante avant le niveau suivant et le prochain accessoire à débloquer">
</picture>

Choisissez sa tenue dans la section **Garde-robe** du panneau de détails, ou avec `/mochi porter lunettes`.

## ⌨️ Commandes

| Commande | Ce qu’elle fait |
| --- | --- |
| `/mochi` | Masque ou affiche le bandeau |
| `/mochi détails` | Ouvre le panneau de détails |
| `/mochi niveau` | Votre niveau, votre expérience et ce qui reste à débloquer |
| `/mochi porter [nom \| automatique \| aucun]` | Fait porter un accessoire, laisse Mochi choisir sa tenue, ou enlève tout |
| `/mochi bouclier` | Active ou désactive le bouclier |
| `/mochi alertes` | Active ou désactive les alertes des longues tâches |
| `/mochi son` | Active ou désactive les sons |
| `/mochi langue [code \| automatique]` | Affiche ou change la langue |
| `/mochi petit` · `/mochi grand` | Sur une seule ligne ou en grand |
| `/mochi statut` | Ce que Mochi sait en ce moment |

Les commandes en anglais fonctionnent toujours (`/mochi details`, `/mochi wear`, `/mochi lang`…).

## 🌍 Langues

English · Türkçe · Español · Deutsch · Français · Português · Русский · 中文 · 日本語 · 한국어

Mochi parle la langue définie par le réglage `language` de Claude Code quand c’est l’une de celles-ci ; sinon la langue préférée de votre système, puis `LANG` ; à défaut, l’anglais. `/mochi langue fr` vous laisse choisir vous-même, `/mochi langue automatique` revient au mode automatique.

## 🔒 Ce à quoi Mochi touche

Tout reste sur votre machine. Mochi n’effectue **aucune requête réseau**.

- Il lit `git status`, `git log` et `git diff --numstat` dans le dossier de la conversation.
- Pour les notifications, il lance l’outil du système : `osascript` sur macOS, PowerShell sur Windows, `notify-send` sur Linux. Pour la langue, `defaults read -g AppleLanguages` sur macOS et PowerShell sur Windows ; `uname` distingue macOS de Linux.
- Il écrit de petits fichiers JSON dans `~/.claude/mochi/` : l’état de chaque conversation ouverte, les compteurs du jour, votre niveau et les relevés d’utilisation qui nourrissent la prévision.

## 🤝 Contribuer

Rapports de bugs, idées, traductions, illustrations, pull requests : tout est le bienvenu. [Ouvrez une issue](https://github.com/oztrkemree/mochi/issues/new/choose), ou lisez [CONTRIBUTING.md](CONTRIBUTING.md) pour vous lancer dans le code : deux commandes vérifient tout (`claude plugin validate .` et `claude plugin test .`), et une nouvelle langue tient en un seul fichier.

## 📄 Licence

[MIT](LICENSE). Utilisez-le, modifiez-le, partagez-le.

<p align="center"><sub>Fait avec soin par <a href="https://github.com/oztrkemree">Emre Öztürk</a> et Claude.</sub></p>
