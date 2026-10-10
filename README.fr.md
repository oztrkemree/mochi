<div align="center">

<img src="docs/hero.webp" width="240" alt="Mochi, une petite mascotte d’argile, qui fait coucou, réfléchit, lit, tape, fait la fête puis s’endort">

# Mochi

**Un petit compagnon d’argile pour Claude Code.**<br>
Il se tient juste au-dessus de votre prompt, réagit à tout ce que fait Claude,<br>
et garde sous vos yeux les chiffres que vous vérifiez sans arrêt.

[![Licence : MIT](https://img.shields.io/badge/licence-MIT-E08A6A?style=flat-square)](LICENSE)
[![Plugin Claude Code](https://img.shields.io/badge/Claude_Code-plugin-D97757?style=flat-square)](#-installation)
[![16 langues](https://img.shields.io/badge/langues-16-7AA2F7?style=flat-square)](#-langues)
[![46 accessoires](https://img.shields.io/badge/garde--robe-46_accessoires-B794F6?style=flat-square)](#-une-garde-robe-qui-grandit-avec-vous)
[![PR bienvenues](https://img.shields.io/badge/PR-bienvenues-4CC38A?style=flat-square)](CONTRIBUTING.md)

[English](README.md) · [Türkçe](README.tr.md) · [Español](README.es.md) · [Deutsch](README.de.md) · **Français** · [Português](README.pt.md) · [Русский](README.ru.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

<br>

<p align="center">
  <img src="docs/demo.svg" width="744" alt="Le bandeau de Mochi qui passe d’une humeur et d’une tenue à l’autre : il fait coucou, lit, modifie, lance une commande, est fier, vous attend, fait la fête et s’endort">
</p>

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
> Mochi repose sur les modules de hooks de Claude Code (des hooks sous forme de fonctions) et demande **Claude Code 2.1.293 ou plus récent** (`claude --version` vous indique le vôtre). Les versions plus anciennes, comme la 2.1.286, ne chargent pas du tout le module : Mochi n’apparaît jamais.

## 🧡 Ce que Mochi remarque

<table>
<tr>
<td width="50%" valign="top">

**🎭 30 humeurs, sans à-coups**<br>
Il réfléchit, lit, tape, lance une commande, vous attend, fête des tests enfin au vert, a le tournis après trois erreurs d’affilée, s’endort quand vous vous absentez. Chaque pose s’enchaîne en douceur avec la précédente.

</td>
<td width="50%" valign="top">

**📊 Vos limites, avec une prévision**<br>
Des anneaux pour la fenêtre de contexte, la session de 5 heures et la semaine. Si vous consommez une limite plus vite qu’elle ne se réinitialise, Mochi vous dit *quand* vous arriverez au bout. Et quand une limite presque épuisée se réinitialise, il vous le dit aussi.

</td>
</tr>
<tr>
<td valign="top">

**🛡️ Un bouclier contre les commandes qui font peur**<br>
`rm -rf`, `Remove-Item -Recurse`, un force push sur `main`, `git reset --hard`, `DROP TABLE`, un script d’internet envoyé tout droit au shell… elles s’arrêtent et demandent d’abord, en expliquant clairement ce qu’elles détruiraient. Pareil pour une clé ou un jeton sur le point d’être écrit ou commité.

</td>
<td valign="top">

**🔁 Une sentinelle anti-boucle**<br>
La même commande qui échoue trois fois, la même erreur qui revient, le même appel qui renvoie toujours la même chose : Mochi le repère avant que votre limite n’y passe.

</td>
</tr>
<tr>
<td valign="top">

**🔔 Des alertes pendant votre absence**<br>
Une notification système (macOS, Windows ou Linux) quand un tour de plus de deux minutes se termine, quand une longue tâche s’arrête pour vous attendre, quand votre limite se réinitialise ou quand la CI échoue. Allez donc vous faire un thé.

</td>
<td valign="top">

**💬 Toutes les conversations sur un même tableau**<br>
Toutes les conversations de votre machine, celle-ci d’abord, puis celles qui vous attendent, chacune avec sa branche (worktrees signalés), ce qu’elle fait et depuis combien de temps. Une conversation qui vous attend depuis cinq minutes envoie une notification de plus.

</td>
</tr>
<tr>
<td valign="top">

**🚦 La CI après un push**<br>
Mochi suit les exécutions GitHub Actions via votre propre `gh` : `ci en cours · 2/5` dans le bandeau, la fête quand elles passent, le nom du workflow en échec sinon. Le panneau de détails montre la pull request de votre branche, sa revue et ses vérifications.

</td>
<td valign="top">

**💡 Des astuces au bon moment**<br>
De temps en temps, quand Mochi est au repos, une courte astuce Claude Code en lien avec ce qui vient de se passer : Esc Esc après un tour interrompu, `/compact` quand le contexte se remplit. Donnez la même consigne une troisième fois et Mochi propose de l’ajouter à `CLAUDE.md` ; il n’écrit que si vous choisissez **Ajouter**.

</td>
</tr>
<tr>
<td valign="top">

**🏅 Des badges pour le vrai travail**<br>
Douze en tout, chacun fêté une seule fois : des tests au vert pour la première fois, un retour gagnant en un seul tour, une journée de ménage qui supprime plus qu’elle n’ajoute, oiseau de nuit, lève-tôt, polyglotte, un tour marathon, cent commits…

</td>
<td valign="top">

**🎉 Jours spéciaux, petites surprises**<br>
L’Aïd, le Nouvel An lunaire, Norouz, Diwali, Chuseok, la saison des cerisiers en fleurs, Hacktoberfest, Halloween, Noël et votre anniversaire apportent chacun de quoi s’habiller. Souhaitez bonne nuit à Mochi, ou remerciez-le. Après deux heures sans pause, il vous propose de vous étirer.

</td>
</tr>
</table>

## 🛡️ Le bouclier

Le bouclier lit chaque commande que Claude exécute, via Bash ou PowerShell, et chaque modification qu’il fait. Avant tout ce qui ne peut pas être annulé, il s’arrête et demande : supprimer pour de bon des fichiers et des dossiers (`rm -rf`, `Remove-Item -Recurse`, `del /s`), effacer un disque, écraser l’historique d’une branche, jeter des modifications non commitées, supprimer une base de données, détruire de l’infrastructure ou un bucket cloud, `npm unpublish`, `docker system prune -a`, un script d’internet envoyé tout droit au shell, `sudo`.

- **Les force push sont jugés selon la branche.** Sur `main`, `master`, `trunk` ou `develop`, il demande et nomme la branche. Un `--force-with-lease` sur votre propre branche n’a droit qu’à un regard inquiet.
- **Les secrets restent hors de votre historique.** Avant que Claude n’écrive, n’ajoute avec `git add` ou ne commite ce qui ressemble à une vraie clé ou un vrai jeton (AWS, GitHub, Anthropic, OpenAI, Slack, Stripe, une clé privée, un mot de passe), ou un fichier comme `.env` ou `id_rsa`, Mochi demande et montre la valeur masquée : `AKIA••••••LE`. Les valeurs factices et les valeurs de test évidentes passent.
- **Toujours autoriser ici.** La question propose **Exécuter** (ou **Écrire**), **Arrêter** et **Toujours autoriser ici**, qui retient ce type de commande pour ce dépôt. `/mochi bouclier` liste ce qui est autorisé et où ; `/mochi bouclier réinitialiser` oublie tout.

Vos propres règles vont dans `~/.claude/mochi/shield.json` :

```json
{
  "add": [{ "match": "terraform\\s+apply", "says": "modifie l’infrastructure en production" }],
  "off": ["publish", "sudo"]
}
```

- `match` est une expression régulière testée sur chaque commande Bash et PowerShell, sans tenir compte de la casse. `says` dit ce que ferait une telle commande et s’affiche dans la question ; sans lui, la question indique que la commande correspond à l’une de vos règles.
- `off` liste les types intégrés pour lesquels ne plus demander : n’importe quelle clé de `danger` dans [`hooks/lang/fr.ts`](hooks/lang/fr.ts) (`rm`, `forcePush`, `publish`, `sudo`…), `secret` ou l’un de ses types (`secret:aws`, `secret:github`, `secret:apiKey`, `secret:slack`, `secret:stripe`, `secret:privateKey`, `secret:generic`), `secretFile` et `secretEdit`.
- Mochi relit le fichier dès qu’il change. Ce qu’il ne peut pas utiliser est ignoré et signalé dans un toast ; si le fichier n’est pas un JSON valide, aucune de vos règles ne s’applique tant qu’il ne l’est pas.

## 🔍 Le panneau de détails

Cliquez sur les anneaux et tout se déplie : cette session d’un coup d’œil, toutes les conversations de votre machine, votre CI et votre pull request, et **chaque fichier modifié, avec ses lignes ajoutées et supprimées**, ceux que Claude a touchés dans cette conversation en tête de liste, et la dernière modification elle-même, en rouge et vert.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/details-fr-dark.png">
  <img src="docs/details-fr-light.png" width="720" alt="Le panneau de détails : les anneaux du contexte et des limites avec leur prévision, les chiffres de cette session, les autres conversations, et la liste des fichiers modifiés avec leurs nombres de lignes et la dernière modification">
</picture>

Plus bas : le contexte par catégorie, vos derniers tours, un calendrier des journées de toutes vos conversations, puis votre niveau, votre garde-robe et vos badges.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/history-fr-dark.png">
  <img src="docs/history-fr-light.png" width="720" alt="Un calendrier des derniers mois de travail, avec les tours du jour, les sept derniers jours et votre série">
</picture>

## 👒 Une garde-robe qui grandit avec vous

Chaque tour, chaque modification, chaque commit et chaque journée de travail rapporte de l’expérience. Les niveaux débloquent de quoi s’habiller : **46 accessoires** pour la tête, le visage, le cou, la main et la place juste à côté de Mochi. Certains arrivent avec le jour (un chapeau de sorcière fin octobre, une enveloppe rouge au Nouvel An lunaire, une lampe diya à Diwali, un chapeau de fête et un gâteau le jour de votre anniversaire), d’autres avec l’heure (un café le matin, un bonnet de nuit après minuit).

<p align="center">
  <img src="docs/wardrobe.png" width="840" alt="Douze Mochi dans des tenues différentes : un bonnet avec un café, un cow-boy moustachu, un magicien, un chapeau de fête, une couronne avec un monocle et un chat, un bonnet de nuit avec une écharpe, et bien d’autres">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/level-fr-dark.png">
  <img src="docs/level-fr-light.png" width="640" alt="Le niveau de Mochi : un anneau d’expérience, l’XP restante avant le niveau suivant et le prochain accessoire à débloquer">
</picture>

Choisissez sa tenue dans la section **Garde-robe** du panneau de détails, ou avec `/mochi porter lunettes`. Donnez votre date d’anniversaire à Mochi avec `/mochi anniversaire 04-23` ; elle reste sur votre machine. Une idée d’accessoire ? [docs/OUTFITS.md](docs/OUTFITS.md) explique comment l’ajouter.

## 📸 Partagez-le

- **`/mochi carte`** dessine une carte : Mochi dans sa tenue du jour, votre niveau, votre expérience et vos séries.
- **`/mochi bilan`** résume votre mois, toutes conversations confondues, en une seule image : heures, tours, commits, votre jour le plus actif, votre plus longue série et le dossier où vous avez passé le plus de temps. `/mochi bilan année` fait de même pour l’année. Pendant la première semaine du mois, Mochi vous prévient une fois que celui du mois précédent est prêt.
- **`/mochi capture`** enregistre le bandeau et le panneau de détails tels qu’ils sont à cet instant. Jetez-y un œil avant de la publier : elle montre ce que montre le bandeau, votre branche et vos autres conversations comprises.

Ce sont des fichiers SVG rangés dans `~/.claude/mochi/share/`, lisibles sur une page claire comme sombre, et qui se suffisent à eux-mêmes.

Pour mettre la carte sur votre profil GitHub :

1. Clonez le dépôt de votre profil, celui qui porte le nom de votre compte (`pseudo/pseudo`).
2. Lancez `/mochi carte ~/code/pseudo` avec le chemin de ce dossier ; la carte y arrive sous le nom `mochi-card.svg`.
3. Collez la ligne que Mochi vous donne dans le `README.md` du dépôt, puis faites un commit et un push :

   ```md
   [![Mochi pour Claude Code](mochi-card.svg)](https://github.com/oztrkemree/mochi)
   ```

La carte est un instantané : relancez `/mochi carte` après une montée de niveau et poussez la nouvelle.

## ⌨️ Commandes

| Commande | Ce qu’elle fait |
| --- | --- |
| `/mochi` | Masque ou affiche le bandeau (`/mochi cacher` · `/mochi afficher` pour choisir) |
| `/mochi détails` | Ouvre le panneau de détails |
| `/mochi niveau` | Votre niveau, votre expérience et ce qui reste à débloquer |
| `/mochi porter [nom \| automatique \| aucun]` | Fait porter un accessoire, laisse Mochi choisir sa tenue, ou enlève tout |
| `/mochi insignes` | Les badges que vous avez obtenus, et comment obtenir les autres |
| `/mochi conversations` | Toutes les conversations de cette machine, celles qui vous attendent en premier |
| `/mochi bouclier` | Active ou désactive le bouclier, et montre ce qui est toujours autorisé et où |
| `/mochi bouclier réinitialiser` | Oublie tout ce que « Toujours autoriser ici » a retenu |
| `/mochi alertes` | Active ou désactive les notifications (et le message qui annonce que votre bilan est prêt) |
| `/mochi ci` | Active ou désactive le suivi de la CI |
| `/mochi astuces` | Active ou désactive les astuces, les suggestions pour `CLAUDE.md` et l’annonce des nouveautés |
| `/mochi pauses` | Active ou désactive la proposition de s’étirer |
| `/mochi son` | Active ou désactive les sons |
| `/mochi extensions` | Active ou désactive les réactions venues d’autres plugins |
| `/mochi carte [chemin]` | Enregistre une carte pour votre profil GitHub |
| `/mochi bilan [année]` | Enregistre votre mois, ou votre année, en une seule image |
| `/mochi capture` | Enregistre le bandeau et le panneau de détails en images |
| `/mochi visite` | Relance la visite du premier démarrage |
| `/mochi nouveautés` | Ce qu’apporte cette version |
| `/mochi anniversaire [MM-JJ \| aucun]` | Donne votre anniversaire à Mochi, l’affiche ou le fait oublier |
| `/mochi langue [code \| automatique]` | Affiche ou change la langue |
| `/mochi petit` · `/mochi grand` | Sur une seule ligne ou en grand |
| `/mochi exporter` | Enregistre tout ce que Mochi conserve dans un seul fichier JSON |
| `/mochi réinitialiser [niveau \| historique \| tout]` | Efface la mémoire du niveau, l’historique, ou tout, réglages et `shield.json` compris ; il demande d’abord, et les exports restent |
| `/mochi avis` | Un lien vers un rapport de bug, prérempli avec les versions, votre système, l’interface et la langue |
| `/mochi statut` | Ce que Mochi sait en ce moment |

Les mots anglais fonctionnent toujours (`/mochi details`, `/mochi wear`, `/mochi lang`…), et chaque langue ajoute les siens (`/mochi aksesuar`, `/mochi idioma`, `/mochi sprache`…).

## 🌍 Langues

English · Türkçe · Español · Deutsch · Français · Português · Русский · 中文 · 日本語 · 한국어 · Italiano · Polski · Українська · हिन्दी · Bahasa Indonesia · العربية

Mochi parle la langue définie par le réglage `language` de Claude Code quand c’est l’une de celles-ci ; sinon la langue préférée de votre système, puis `LANG` ; à défaut, l’anglais. `/mochi langue fr` vous laisse choisir vous-même, `/mochi langue automatique` revient au mode automatique.

## 🔒 Ce à quoi Mochi touche

Tout reste sur votre machine. Mochi lui-même n’effectue **aucune requête réseau** ; la seule chose qui parle à internet, c’est votre propre `gh`, pour le suivi de la CI.

- **git**, dans le dossier de la conversation, en lecture seule : `git status`, `git log`, `git diff --numstat` et `git rev-parse` pour le bandeau et le panneau de détails. Quand le bouclier doit y regarder de plus près, il demande la branche et la branche par défaut, les fichiers qu’ajouterait un `git add` (`git ls-files`) et ce que committerait un `git commit` (`git diff`).
- **gh**, seulement quand le suivi de la CI est activé, avec votre propre connexion (Mochi ne voit jamais votre jeton) : `gh pr view` au démarrage d’une conversation, à l’ouverture du panneau de détails et autour d’un push ; `gh run list` uniquement après un push dans cette conversation, toutes les 30 secondes jusqu’à la fin des exécutions, une demi-heure au plus. `/mochi ci` coupe les deux.
- **Les outils du système** : les notifications passent par `osascript` sur macOS, PowerShell sur Windows et `notify-send` sur Linux. Pour la langue, `defaults read -g AppleLanguages` sur macOS et PowerShell sur Windows ; `uname` distingue macOS de Linux. Les fichiers des conversations fermées, et ce qu’efface `/mochi réinitialiser`, sont supprimés par leur nom avec `rm`, ou le `del` de `cmd` sous Windows, uniquement dans `~/.claude/mochi/`.
- **Des fichiers dans `~/.claude/mochi/`** : l’état de chaque conversation ouverte, les compteurs du jour, votre niveau et vos badges, les relevés d’utilisation pour la prévision, combien de fois chaque astuce a été montrée et les courtes consignes que vous répétez (jamais des prompts entiers), les marqueurs qui désignent la conversation chargée d’annoncer qu’une limite s’est réinitialisée, votre `shield.json` si vous en écrivez un, et ce qu’enregistrent `/mochi carte`, `bilan`, `capture` et `exporter`. Les réglages, ce qui est toujours autorisé et votre anniversaire sont rangés dans l’espace de stockage que Claude Code réserve aux plugins.
- **Votre projet** : Mochi lit `CLAUDE.md` avant de suggérer une consigne et n’y ajoute une ligne qu’après que vous avez choisi **Ajouter**. Il n’y écrit la carte que si vous donnez à `/mochi carte` un chemin qui s’y trouve. Pour compter les lignes et repérer les secrets, il lit un fichier que Claude s’apprête à écraser et, pour une commande qui ajoute et commite d’un coup, les nouveaux fichiers qu’elle ajouterait (20 au plus, de moins de 1 Mo chacun). Rien de ce qu’il lit n’est conservé.
- **Les autres plugins** peuvent afficher une humeur et une courte phrase via Mochi, signées de leur nom, chacun une fois toutes les 10 secondes au plus ; `/mochi extensions` désactive cela. `/mochi avis` se contente d’afficher un lien : rien n’est envoyé.

## 🧩 Pour les auteurs de plugins

Votre plugin peut faire réagir Mochi : le faire applaudir quand un déploiement se termine, lui donner l’air inquiet quand une vérification échoue. Ajoutez `mochi` à vos `dependencies` et appelez `$.mochi.react({ mood, line })` ou `$.mochi.celebrate({ line })`. [docs/API.md](docs/API.md) présente les appels, les limites et un plugin d’exemple complet.

## 🤝 Contribuer

Rapports de bugs, idées, traductions, illustrations, pull requests : tout est le bienvenu. [Ouvrez une issue](https://github.com/oztrkemree/mochi/issues/new/choose) (`/mochi avis` vous donne un rapport de bug déjà rempli), ou lisez [CONTRIBUTING.md](CONTRIBUTING.md) pour vous lancer dans le code : deux commandes vérifient tout (`claude plugin validate .` et `claude plugin test .`), et une nouvelle langue tient en un seul fichier. Les changements de chaque version sont dans [CHANGELOG.md](CHANGELOG.md).

## 📄 Licence

[MIT](LICENSE). Utilisez-le, modifiez-le, partagez-le.

<p align="center"><sub>Fait avec soin par <a href="https://github.com/oztrkemree">Emre Öztürk</a> et Claude.</sub></p>
