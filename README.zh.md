<div align="center">

<img src="docs/hero.webp" width="240" alt="Mochi，一个黏土小吉祥物，正在挥手、思考、阅读、打字、庆祝，最后睡着了">

# Mochi

**Claude Code 的黏土小伙伴。**<br>
它住在你的输入框上方，Claude 的一举一动它都有反应，<br>
那些你总忍不住去看的数字，它也一直替你摆在眼前。

[![许可证: MIT](https://img.shields.io/badge/许可证-MIT-E08A6A?style=flat-square)](LICENSE)
[![Claude Code 插件](https://img.shields.io/badge/Claude_Code-插件-D97757?style=flat-square)](#-安装)
[![10 种语言](https://img.shields.io/badge/语言-10_种-7AA2F7?style=flat-square)](#-语言)
[![36 件配饰](https://img.shields.io/badge/衣橱-36_件-B794F6?style=flat-square)](#-和你一起成长的衣橱)
[![欢迎 PR](https://img.shields.io/badge/PR-欢迎-4CC38A?style=flat-square)](CONTRIBUTING.md)

[English](README.md) · [Türkçe](README.tr.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Português](README.pt.md) · [Русский](README.ru.md) · **中文** · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/band-zh-dark.png">
  <img src="docs/band-zh-light.png" alt="Mochi 在输入框上方的状态栏：正在编辑 checkout.tsx、最近的工具调用、当前分支、另一个在等你的对话，以及上下文、5 小时会话和每周限额的圆环">
</picture>

<p align="center"><sub>一眼看全：Claude 此刻在做什么、最近的工具调用、你的分支、需要你回应的另一个对话，还有上下文、会话和每周限额各用了多少。</sub></p>

## ✨ 安装

```
/plugin install mochi --marketplace oztrkemree/mochi
```

在任意 Claude Code 对话里输入这一行，按 `y` 添加 marketplace，再选择 **user** 作用域。Mochi 立刻就会出现，之后你打开的每个对话里也都有它。

> [!NOTE]
> Mochi 基于 Claude Code 的 hooks 模块（function hooks）构建，所以需要一个支持该功能的 Claude Code 版本。

## 🧡 Mochi 都在留意什么

<table>
<tr>
<td width="50%" valign="top">

**🎭 27 种心情，无缝切换**<br>
思考、阅读、打字、运行命令、等你回复、测试全绿时庆祝、连错三次就晕头转向、你离开时就呼呼大睡。每个姿势都从上一个自然过渡，绝不生硬跳切。

</td>
<td width="50%" valign="top">

**📊 你的限额，附带预测**<br>
上下文窗口、5 小时会话和每周限额，各有一个圆环。如果你的消耗速度比重置还快，Mochi 会提前告诉你*什么时候*会用完。

</td>
</tr>
<tr>
<td valign="top">

**🛡️ 危险命令，护盾挡住**<br>
`rm -rf`、`git push --force`、`git reset --hard`、`DROP TABLE`、`npm publish`、`sudo`……运行前都会先停下来问你，并用大白话说清楚它们会毁掉什么。

</td>
<td valign="top">

**🔁 循环监测**<br>
同一条命令连续失败三次、同一个错误反复出现、同一个调用总是返回同样的结果：Mochi 会赶在你的限额耗尽之前发现它。

</td>
</tr>
<tr>
<td valign="top">

**🔔 长任务提醒**<br>
超过两分钟的一轮结束时，或者长任务停下来等你批准时，都会弹出 macOS 通知。放心去泡杯茶吧。

</td>
<td valign="top">

**💬 你的其他对话**<br>
这台电脑上每个运行 Mochi 的对话都会共享自己的进度，所以当前对话能告诉你：另一个对话正在等你，或者已经完成了。

</td>
</tr>
</table>

## 🔍 详情面板

点一下圆环，一切尽收眼底：本次会话概览、你的其他对话，以及**每个改动过的文件和增删的行数**。Claude 在本对话中改过的文件排在最前，最近一次编辑本身也会用红绿两色展示出来。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/details-zh-dark.png">
  <img src="docs/details-zh-light.png" width="720" alt="详情面板：带预测的上下文与限额圆环、本次会话的数据、其他对话，以及附带行数统计和最近编辑的改动文件列表">
</picture>

再往下还有：按类别划分的上下文、最近几轮，以及记录所有对话每一天的日历。

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/history-zh-dark.png">
  <img src="docs/history-zh-light.png" width="720" alt="过去几个月的工作日历，附今日轮数、近 7 天轮数和连续天数">
</picture>

## 👒 和你一起成长的衣橱

每一轮对话、每次编辑、每个 commit、每个工作日都会积累经验值。升级就能解锁可以穿戴的东西：头部、脸部、颈部、手持和 Mochi 身旁，一共 **36 件**。有些随季节而来（十月底的女巫帽、十二月的圣诞帽），有些随时间出现（早上的咖啡、午夜之后的睡帽）。

<p align="center">
  <img src="docs/wardrobe.png" width="840" alt="十二个不同装扮的 Mochi：毛线帽配咖啡、留着胡子的牛仔、巫师、派对帽、王冠配单片眼镜和猫、睡帽配围巾，还有更多">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/level-zh-dark.png">
  <img src="docs/level-zh-light.png" width="640" alt="Mochi 的等级：经验值圆环、距下一级所需的经验值，以及下一个待解锁的配饰">
</picture>

在详情面板的**衣橱**区域挑选要穿戴的配饰，或者直接用 `/mochi 穿戴 眼镜`。

## ⌨️ 命令

| 命令 | 作用 |
| --- | --- |
| `/mochi` | 隐藏或显示状态栏 |
| `/mochi 详情` | 打开详情面板 |
| `/mochi 等级` | 你的等级、经验值，以及还有哪些未解锁 |
| `/mochi 穿戴 [物品 \| 自动 \| 无]` | 戴上一件配饰、让 Mochi 自己搭配，或者全部摘下 |
| `/mochi 护盾` | 开启或关闭护盾 |
| `/mochi 提醒` | 开启或关闭长任务提醒 |
| `/mochi 声音` | 开启或关闭声音 |
| `/mochi 语言 [代码 \| 自动]` | 查看或切换语言 |
| `/mochi 小` · `/mochi 大` | 单行显示或全尺寸 |
| `/mochi 状态` | Mochi 此刻知道的一切 |

英文命令词始终可用（`/mochi details`、`/mochi wear`、`/mochi lang`…）。

## 🌍 语言

English · Türkçe · Español · Deutsch · Français · Português · Русский · 中文 · 日本語 · 한국어

如果 Claude Code 的 `language` 设置是其中之一，Mochi 就说这种语言；否则依次参考系统的首选语言和 `LANG`；都不匹配时就用英文。用 `/mochi 语言 zh` 可以自己指定，`/mochi 语言 自动` 则恢复自动选择。

## 🔒 它会访问什么

一切都留在你的电脑上。Mochi **不发起任何网络请求**。

- 在对话所在的文件夹中读取 `git status`、`git log` 和 `git diff --numstat`。
- 在 macOS 上运行 `osascript` 发送通知，运行 `defaults read -g AppleLanguages` 获取语言；在所有平台上运行 `date +%z` 获取本地时间。
- 在 `~/.claude/mochi/` 下写入几个小小的 JSON 文件：每个打开的对话的状态、每日计数、你的等级，以及用于预测的用量读数。

## 🤝 参与贡献

bug 报告、想法、翻译、美术和 pull request，统统欢迎。[提一个 issue](https://github.com/oztrkemree/mochi/issues/new/choose)，或者阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 开始写代码：两条命令就能检查一切（`claude plugin validate .` 和 `claude plugin test .`），新增一种语言只需要一个文件。

## 📄 许可证

[MIT](LICENSE)。尽管用，尽管改，尽管分享。

<p align="center"><sub>由 <a href="https://github.com/oztrkemree">Emre Öztürk</a> 和 Claude 用心打造。</sub></p>
