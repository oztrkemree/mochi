<div align="center">

<img src="docs/hero.webp" width="240" alt="小さな粘土のマスコットMochiが、手を振ったり、考えたり、読んだり、タイピングしたり、お祝いしたり、うとうと眠ってしまったりするようす">

# Mochi

**Claude Codeのための、小さな粘土の相棒。**<br>
プロンプトのすぐ上にちょこんと座って、Claudeのすることすべてに反応し、<br>
つい何度も確かめてしまう数字を、いつでも見えるところに置いておいてくれます。

[![ライセンス: MIT](https://img.shields.io/badge/ライセンス-MIT-E08A6A?style=flat-square)](LICENSE)
[![Claude Codeプラグイン](https://img.shields.io/badge/Claude_Code-プラグイン-D97757?style=flat-square)](#-インストール)
[![10言語](https://img.shields.io/badge/対応言語-10-7AA2F7?style=flat-square)](#-対応言語)
[![36個のアクセサリー](https://img.shields.io/badge/着せ替え-36個-B794F6?style=flat-square)](#-使うほど増える着せ替え)
[![PR歓迎](https://img.shields.io/badge/PR-歓迎-4CC38A?style=flat-square)](CONTRIBUTING.md)

[English](README.md) · [Türkçe](README.tr.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [中文](README.zh.md) · **日本語** · [한국어](README.ko.md)

</div>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/band-ja-dark.png">
  <img src="docs/band-ja-light.png" alt="プロンプトの上に表示されるMochiのバー。checkout.tsxを編集中、直近のツール呼び出し、ブランチ、返事待ちの別のチャット、そしてコンテキスト・5時間のセッション・週間のリング">
</picture>

<p align="center"><sub>ひと目ですべてがわかります。Claudeがいま何をしているか、直近のツール呼び出し、今のブランチ、あなたを待っている別のチャット、そしてコンテキスト・セッション・週間の枠がどれだけ埋まっているか。</sub></p>

## ✨ インストール

```
/plugin install mochi --marketplace oztrkemree/mochi
```

どのClaude Codeのチャットでもいいので、これを入力してください。マーケットプレイスを追加するか聞かれたら`y`と答え、スコープは**user**を選びます。Mochiはすぐに現れて、それ以降に開くすべてのチャットにも顔を出します。

> [!NOTE]
> MochiはClaude Codeのhooksモジュール（function hooks）の上に作られています。そのため、これに対応したClaude Codeのビルドが必要です。

## 🧡 Mochiが気づくこと

<table>
<tr>
<td width="50%" valign="top">

**🎭 27種類の表情、切り替えはなめらか**<br>
考え中、読んでる、コードを書いてる、コマンド実行中、あなたの返事待ち。テストがオールグリーンならお祝いし、3回連続でエラーが出れば目を回し、あなたが席を外せばすやすや眠ります。どのポーズも、前のポーズから自然につながります。

</td>
<td width="50%" valign="top">

**📊 使用量の上限を、予測つきで**<br>
コンテキストウィンドウ、5時間のセッション、1週間の枠をそれぞれリングで表示。リセットよりも速いペースで使っていると、*いつ*上限に達するのかをMochiが教えてくれます。

</td>
</tr>
<tr>
<td valign="top">

**🛡️ 危ないコマンドにはシールドを**<br>
`rm -rf`、`git push --force`、`git reset --hard`、`DROP TABLE`、`npm publish`、`sudo`…。実行する前にいったん止まって確認します。何が消えてしまうのかも、わかりやすい言葉で伝えてくれます。

</td>
<td valign="top">

**🔁 ループの見張り番**<br>
同じコマンドが3回失敗する、同じエラーが何度も戻ってくる、同じ呼び出しが同じ結果ばかり返す。そんな堂々めぐりに、上限に達するより先にMochiが気づきます。

</td>
</tr>
<tr>
<td valign="top">

**🔔 長い作業の通知**<br>
2分以上かかったターンが終わったとき、または長い作業があなたの承認待ちで止まったときに、システムの通知（macOS・Windows・Linux）でお知らせします。その間に、お茶でも淹れてきてください。

</td>
<td valign="top">

**💬 他のチャットのことも**<br>
このマシンでMochiが動いているチャットは、それぞれの状況を共有しています。だから、別のチャットがあなたの返事を待っていることや作業を終えたことを、いまのチャットから教えてもらえます。

</td>
</tr>
</table>

## 🔍 詳細パネル

リングをクリックすると、すべてが広がります。このセッションの概要、他のチャット、そして**変更されたすべてのファイルと、追加・削除された行数**。このチャットでClaudeが触ったファイルが先頭に並び、最後の編集そのものも赤と緑で表示されます。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/details-ja-dark.png">
  <img src="docs/details-ja-light.png" width="720" alt="詳細パネル。予測つきのコンテキストと上限のリング、このセッションの数値、他のチャット、行数つきの変更ファイル一覧と最後の編集">
</picture>

さらに下には、カテゴリ別のコンテキスト、最近のターン、そしてすべてのチャットの活動日を並べたカレンダーがあります。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/history-ja-dark.png">
  <img src="docs/history-ja-light.png" width="720" alt="ここ数か月の作業カレンダー。今日のターン、直近7日のターン、連続日数">
</picture>

## 👒 使うほど増える着せ替え

ターン、編集、コミット、そして作業した日のひとつひとつが経験値になります。レベルが上がるごとに着られるものが増え、頭、顔、首、手、そしてMochiの足元に、全部で**36アイテム**。季節限定のもの（10月末には魔女の帽子、12月にはサンタ帽）や、時間帯限定のもの（朝はコーヒー、深夜0時を過ぎたらナイトキャップ）もあります。

<p align="center">
  <img src="docs/wardrobe.png" width="840" alt="いろいろな着せ替えをした12体のMochi。ニット帽にコーヒー、口ひげのカウボーイ、魔法使い、パーティー帽、モノクルとねこを連れた王冠、マフラーとナイトキャップ、ほかにもたくさん">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/level-ja-dark.png">
  <img src="docs/level-ja-light.png" width="640" alt="Mochiのレベル。経験値のリング、次のレベルまでの経験値、次に解放されるアイテム">
</picture>

着るものは、詳細パネルの**着せ替え**セクションから選ぶか、`/mochi 着せ替え メガネ`で選べます。

## ⌨️ コマンド

| コマンド | できること |
| --- | --- |
| `/mochi` | バーを表示/非表示 |
| `/mochi 詳細` | 詳細パネルを開く |
| `/mochi レベル` | レベル、経験値、まだ解放されていないもの |
| `/mochi 着せ替え [アイテム \| 自動 \| なし]` | 何かを着せる、Mochiにおまかせする、または全部外す |
| `/mochi シールド` | シールドのON/OFF |
| `/mochi 通知` | 長い作業の通知のON/OFF |
| `/mochi サウンド` | サウンドのON/OFF |
| `/mochi 言語 [コード \| 自動]` | 言語の確認と切り替え |
| `/mochi 小さく` · `/mochi 大きく` | 1行表示か、フルサイズか |
| `/mochi 状態` | Mochiがいま把握していること |

英語のコマンドもいつでも使えます（`/mochi details`、`/mochi wear`、`/mochi lang`…）。

## 🌍 対応言語

English · Türkçe · Español · Deutsch · Français · Português · Русский · 中文 · 日本語 · 한국어

Claude Codeの`language`設定がこのどれかなら、Mochiはその言語で話します。そうでなければシステムの優先言語、次に`LANG`、どれにも当てはまらなければ英語になります。`/mochi 言語 ja`で自分で選ぶこともでき、`/mochi 言語 自動`で自動に戻せます。

## 🔒 Mochiがアクセスするもの

すべてはあなたのマシンの中で完結します。Mochiは**ネットワーク通信を一切行いません**。

- チャットのフォルダで`git status`、`git log`、`git diff --numstat`を読み取ります。
- 通知にはシステムの仕組みを使います。macOSでは`osascript`、WindowsではPowerShell、Linuxでは`notify-send`を実行します。言語の判定には、macOSで`defaults read -g AppleLanguages`、WindowsでPowerShellを実行し、macOSとLinuxの区別には`uname`を使います。
- `~/.claude/mochi/`の下に小さなJSONファイルを書き込みます。開いている各チャットの状況、日ごとの集計、あなたのレベル、そして予測に使う使用量の記録です。

## 🤝 コントリビュート

バグ報告、アイデア、翻訳、イラスト、プルリクエスト、どれも大歓迎です。[issueを立てる](https://github.com/oztrkemree/mochi/issues/new/choose)か、コードに手をつけるなら[CONTRIBUTING.md](CONTRIBUTING.md)を読んでみてください。2つのコマンド（`claude plugin validate .`と`claude plugin test .`）ですべてをチェックでき、新しい言語の追加はファイル1つで済みます。

## 📄 ライセンス

[MIT](LICENSE)。使うのも、改造するのも、シェアするのもご自由に。

<p align="center"><sub><a href="https://github.com/oztrkemree">Emre Öztürk</a>とClaudeが、心を込めて作りました。</sub></p>
