<div align="center">

<img src="docs/hero.webp" width="260" alt="손을 흔들고, 생각하고, 읽고, 타이핑하고, 축하하다가 스르르 잠드는 작은 점토 마스코트 Mochi">

# Mochi

### Claude Code 프롬프트 위에 사는 작은 점토 친구.

Claude가 하는 모든 일에 반응하고, 나중에 후회할 명령은 막아 주고,<br>
컨텍스트와 세션, 주간 한도를 늘 눈앞에 띄워 둬요.

[![라이선스: MIT](https://img.shields.io/badge/라이선스-MIT-E08A6A?style=for-the-badge)](LICENSE)
[![Claude Code 플러그인](https://img.shields.io/badge/Claude_Code-플러그인-D97757?style=for-the-badge)](#-10초-만에-설치)
[![16개 언어](https://img.shields.io/badge/언어-16개-7AA2F7?style=for-the-badge)](#-16개-언어)
[![아이템 134개](https://img.shields.io/badge/옷장-아이템_134개-B684F6?style=for-the-badge)](#-함께-자라는-옷장)
[![네트워크 없음](https://img.shields.io/badge/네트워크-없음-4CC38A?style=for-the-badge)](#-mochi가-손대는-것들)

[English](README.md) · [Türkçe](README.tr.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [中文](README.zh.md) · [日本語](README.ja.md) · **한국어**

<br>

<img src="docs/gif/session.webp" width="760" alt="Claude Code 채팅: 다크 모드 토글을 부탁하자, 비니를 쓰고 커피를 든 Mochi가 생각하고, 읽고, 검색하고, 수정하고, 테스트를 돌리다가 두 개가 실패하자 어질어질해하고, 다시 수정한 뒤 48개가 통과하자 축하하고, 턴에 걸린 시간과 도구 호출, 수정 횟수를 보여 주며 뿌듯하게 마무리해요. 그동안 컨텍스트·세션·주간 링이 차올라요">

<sub>실제 턴 하나 그대로예요. 여기 나오는 표정과 문구는 모두 Mochi가 직접 그리고 반응하는 코드에서 나왔어요.</sub>

</div>

<br>

## ⚡ 10초 만에 설치

```
/plugin install mochi --marketplace oztrkemree/mochi
```

아무 Claude Code 채팅에나 입력하고, 마켓플레이스를 추가할지 물으면 `y`로 답한 뒤 **user** 범위를 고르세요. 그게 다예요: Mochi가 곧바로 나타나고, 그 뒤로 여는 모든 채팅에도 함께해요. 따로 설정할 건 없어요.

> [!NOTE]
> Mochi는 Claude Code의 hooks 모듈(함수 hook) 위에서 동작해서 **Claude Code 2.1.293 이상**이 필요해요(내 버전은 `claude --version`으로 확인할 수 있어요). 2.1.286 같은 이전 빌드는 모듈을 아예 불러오지 않아서 Mochi가 나타나지 않아요.

<br>

<table>
<tr>
<td align="center" width="25%">🎭<br><b>30가지 기분</b><br><sub>도구 호출 하나하나를 따라가요</sub></td>
<td align="center" width="25%">🛡️<br><b>보호막</b><br><sub><code>rm -rf</code>, 강제 푸시, 새어 나간 키 앞에서</sub></td>
<td align="center" width="25%">📊<br><b>한도 링</b><br><sub>언제 바닥날지 예측까지</sub></td>
<td align="center" width="25%">👒<br><b>입을 거리 134개</b><br><sub>진짜 작업으로 얻어요</sub></td>
</tr>
</table>

## 🎭 Claude가 하는 일을 함께 느껴요

생각하고, 읽고, 검색하고, 코드를 쓰고, 명령을 실행하고, 내 응답을 기다리고, 테스트가 초록불이면 축하하고, 세 번 연속 오류가 나면 어질어질해하고, 자리를 비우면 잠들어요. **30가지 기분, 끊김 없는 전환**: 모든 동작이 바로 앞 동작에서 부드럽게 이어져서, 밴드는 깜빡이지 않고 숨을 쉬어요.

<p align="center">
  <img src="docs/demo.svg" width="744" alt="기분과 옷차림을 바꿔 가는 Mochi의 밴드: 손 흔들기, 읽기, 수정하기, 명령 실행, 뿌듯함, 내 응답 기다리기, 축하, 잠들기">
</p>

얼굴 옆에는 지금 무슨 일이 일어나는지 쉬운 말로(`checkout.tsx 수정 중`, `테스트 통과 · 4초`), 최근 도구 호출은 작은 네모 한 줄로(실행 중인 건 숨 쉬듯 깜빡이고, 실패한 건 빨갛게 변해요), 그리고 지금 브랜치와 바뀐 파일 수가 떠요.

## 📊 한도를 한눈에, 소진 예측까지

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/band-ko-dark.png">
  <img src="docs/band-ko-light.png" alt="프롬프트 위에 뜬 Mochi의 밴드: checkout.tsx 수정 중, 최근 도구 호출, 브랜치, 응답을 기다리는 다른 채팅, 그리고 컨텍스트·5시간 세션·주간 한도를 보여 주는 링">
</picture>

링은 세 개예요: **컨텍스트 창**, **5시간 세션**, 그리고 **주간 한도**. 이제 10분마다 `/usage`를 칠 필요가 없어요.

- **숫자만이 아니라 예측까지.** 초기화되는 속도보다 빠르게 쓰고 있나요? 링이 *언제* 소진될지 알려 줘요(`16:40 소진`). 가까워질수록 호박색에서 빨간색으로 바뀌어요.
- **좋은 소식도 전해요.** 거의 다 써 가던 한도가 초기화되면 Mochi가 알려 줘요.
- **컨텍스트 링은 안에 뭐가 들었는지 알아요**: 시스템 프롬프트, 도구, MCP, 메모리, 스킬, 메시지가 저마다 다른 색으로 보이고, 자동 압축이 시작될 지점엔 눈금이 표시돼요.

## 🛡️ 보호막: 되돌릴 수 없는 일은 일단 멈춰요

<p align="center">
  <img src="docs/gif/shield.webp" width="760" alt="Claude가 rm -rf ./dist ~/를 실행하려는 순간, 안전모를 쓴 Mochi가 겁먹은 표정을 짓고 보호막이 물어봐요: 이 명령은 파일과 폴더를 영구히 삭제해요, 실행할까요? 답은 중지, 아무것도 지워지지 않아요">
</p>

보호막은 Claude가 Bash나 PowerShell로 실행하는 모든 명령과 모든 파일 수정을 읽어요. 되돌릴 수 없는 일 앞에서는 멈추고, **무엇이 날아가는지 쉬운 말로 알려 준 뒤** 물어봐요: 파일과 폴더 영구 삭제(`rm -rf`, `Remove-Item -Recurse`, `del /s`), 드라이브 통째로 지우기, 브랜치 기록 덮어쓰기, 커밋하지 않은 변경 사항 버리기, 데이터베이스 삭제, 인프라나 클라우드 버킷 철거, `npm unpublish`, `docker system prune -a`, 인터넷에서 받아 바로 실행하는 스크립트, `sudo`.

- **강제 푸시는 브랜치를 보고 판단해요.** `main`, `master`, `trunk`, `develop`에 강제 푸시하면 브랜치 이름을 짚어 물어봐요. 내 브랜치에 강제 푸시하면 경보 대신 긴장한 표정으로 물어보고, `--force-with-lease`라면 그 표정만 지어요.
- **비밀 정보는 기록에 남기지 않아요.** 실제로 쓰이는 키나 토큰처럼 보이는 값(AWS, GitHub, Anthropic, OpenAI, Slack, Stripe, 개인 키, 비밀번호)이나 `.env`, `id_rsa` 같은 파일을 Claude가 쓰거나, `git add`하거나, 커밋하기 전에 Mochi가 값을 가려서 보여 주며 물어봐요: `AKIA••••••LE`. 자리표시자나 누가 봐도 테스트용인 값은 그냥 통과해요.
- **여기서는 항상 허용.** 질문에는 **실행**(또는 **쓰기**), **중지**, **여기서는 항상 허용**이 있어요. 마지막을 고르면 이 저장소에서는 그런 종류의 명령을 기억해 둬요. 저장소 안에서 끝나는 것만 해당되고, 밖으로 나가는 명령이나 편집(`rm -rf ~`, 홈 폴더의 파일 등)은 다시 물어봐요. `/mochi 보호막`은 어디서 무엇을 허용했는지 보여 주고, `/mochi 보호막 초기화`는 전부 잊어요.

<details>
<summary><b>나만의 규칙</b>은 <code>~/.claude/mochi/shield.json</code>에 적어요</summary>

<br>

```json
{
  "add": [{ "match": "terraform\\s+apply", "says": "운영 중인 인프라 변경" }],
  "off": ["publish", "sudo"]
}
```

- `match`는 모든 Bash·PowerShell 명령에 대소문자 구분 없이 대어 보는 정규식이에요. `says`는 그 명령이 하는 일로, 질문에 그대로 나와요. 없으면 질문에는 내 규칙에 해당한다고만 나와요.
- `off`에는 더는 묻지 않을 기본 종류를 적어요: [`hooks/lang/ko.ts`](hooks/lang/ko.ts)에 있는 `danger`의 키 중 아무거나(`rm`, `forcePush`, `publish`, `sudo`…), `secret` 또는 그 세부 종류 하나(`secret:aws`, `secret:github`, `secret:apiKey`, `secret:slack`, `secret:stripe`, `secret:privateKey`, `secret:generic`), `secretFile`, `secretEdit`.
- Mochi는 파일이 바뀔 때마다 다시 읽고 토스트로 알려 줘요. 쓸 수 없는 항목은 건너뛰고 이름을 알려 줘요. 파일이 올바른 JSON이 아니면 고칠 때까지 내 규칙은 하나도 적용되지 않아요. Claude가 직접 이 파일을 바꾸려 하면 보호막이 먼저 물어봐요.

</details>

## 🧡 그 밖에 Mochi가 알아채는 것들

<table>
<tr>
<td width="50%" valign="top">

### 🔁 반복 감시
같은 명령이 세 번 연속 실패할 때, 같은 오류가 자꾸 돌아올 때, 같은 호출이 매번 똑같은 결과만 낼 때: **한도가 바닥나기 전에** Mochi가 먼저 눈치채고, Esc를 누르라고 알려 줘요.

</td>
<td width="50%" valign="top">

### 🔔 자리를 비운 사이에도 알림
2분 넘게 걸린 턴이 끝나거나, 긴 작업이 멈춰 내 응답을 기다리거나, 한도가 초기화되거나, CI가 실패하면 시스템 알림(macOS, Windows, Linux)을 보내요. **그동안 차 한 잔 하고 오세요.**

</td>
</tr>
<tr>
<td valign="top">

### 💬 모든 채팅을 한 보드에
이 컴퓨터의 모든 Claude Code 채팅을 지금 채팅부터, 그다음엔 나를 기다리는 채팅 순으로 보여 줘요. 채팅마다 브랜치(워크트리는 따로 표시), 하고 있는 일, 그 일을 얼마나 오래 하고 있는지까지. 나를 5분째 기다린 채팅은 알림을 한 번 더 보내요.

</td>
<td valign="top">

### 🚦 푸시 후 CI
Mochi가 내 `gh`로 GitHub Actions 실행을 따라가요. 밴드에는 `CI 실행 중 · 2/5`, 통과하면 축하 파티, 실패하면 실패한 워크플로 이름이 떠요. 실행이 없을 때는 내 브랜치의 PR과 리뷰, 검사 결과가 떠요(`PR #12 · 승인됨 · 검사 4/5`).

</td>
</tr>
<tr>
<td valign="top">

### 💡 지금 딱 맞는 팁
Mochi가 쉬고 있을 때 가끔, 방금 일어난 일에 맞는 짧은 Claude Code 팁을 하나 보여 줘요: 턴을 멈춘 뒤엔 Esc Esc, 컨텍스트가 차오르면 `/compact`. 같은 지시를 세 번째 하면 `CLAUDE.md`에 추가할지 물어보고, **추가**를 골라야만 써요.

</td>
<td valign="top">

### 🏅 진짜 작업으로 얻는 배지
모두 열여덟 개, 각각 딱 한 번씩 축하해요: 첫 테스트 통과, 한 턴 만의 역전, 추가한 줄보다 지운 줄이 많은 깔끔한 하루, 올빼미, 아침형 인간, 폴리글랏, 마라톤 턴, 커밋 100개, 그리고 어려운 것들: 30일 연속, 커밋 500개, 수정 5,000번, 지운 줄 10,000개…

</td>
</tr>
<tr>
<td valign="top">

### 🎉 특별한 날, 소소한 깜짝 선물
이드, 설날, 노루즈, 디왈리, 추석, 벚꽃 시즌, Hacktoberfest, 핼러윈, 크리스마스, 그리고 내 생일엔 Mochi가 그동안 얻은 옷으로 차려입어요. Mochi에게 잘 자라고 인사하거나 고맙다고 말해 보세요. 쉬지 않고 두 시간이 지나면 기지개를 권해요.

</td>
<td valign="top">

### 🧩 다른 플러그인도 Mochi를 통해 말해요
배포 플러그인은 릴리스가 나가면 Mochi를 환호하게, 린터는 얼굴을 찌푸리게 만들 수 있어요. 호출 한 번이면 돼요: `$.mochi.react({ mood, line })`. [플러그인 개발자라면](#-플러그인-개발자라면)을 참고하세요.

</td>
</tr>
</table>

## 🔍 상세 패널

**링을 클릭하면** 모든 게 펼쳐져요: 이번 세션을 한눈에, 이 컴퓨터의 모든 채팅, CI와 PR, 그리고 **변경된 모든 파일과 추가·삭제된 줄 수**까지. 이 채팅에서 Claude가 건드린 파일이 맨 위에 오고, 파일마다 diff를 빨간색과 초록색으로 보여 줘요.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/details-ko-dark.png">
  <img src="docs/details-ko-light.png" width="760" alt="상세 패널: 소진 예측이 붙은 컨텍스트·한도 링, 이번 세션의 수치, 다른 채팅, 줄 수가 표시된 변경 파일 목록과 마지막 수정">
</picture>

조금 더 내려가면: 카테고리별 컨텍스트, 최근 턴, 모든 채팅의 하루하루를 담은 달력, 내 레벨과 옷장, 배지, 그리고 모든 설정과 동작이 클릭 한 번 거리에 있어요.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/history-ko-dark.png">
  <img src="docs/history-ko-light.png" width="760" alt="지난 몇 달간의 작업 기록 달력과 오늘 턴, 최근 7일, 연속 기록">
</picture>

## 👒 함께 자라는 옷장

<p align="center">
  <img src="docs/gif/wardrobe.webp" width="760" alt="옷을 하나씩 갈아입어 보는 Mochi: 커피를 든 비니, 모노클과 고양이를 곁들인 왕관, 마법사 모자와 목도리, 메달과 풍선을 든 파티 모자, 콧수염 난 카우보이 모자, 안경 쓴 학사모, 선글라스와 오리를 곁들인 해적 모자, 렌치를 든 안전모, 나비넥타이와 케이크를 곁들인 요리사 모자, 그리고 선인장 옆의 수면 모자">
</p>

턴 하나, 수정 하나, 커밋 하나, 그리고 작업한 하루하루가 모두 경험치가 돼요. 레벨이 오르면 입을 거리가 해제돼요: 머리, 얼굴, 목, 손, 그리고 Mochi 옆자리까지 **아이템 134개**. 날짜가 됐다고 열리는 건 없어요: 대부분은 레벨로, 일부는 습관으로, 나머지는 어려운 배지로 열려요(밤 150번이면 마녀 모자와 호박, 커밋 500개면 케이크). 한번 얻고 나면 핼러윈엔 마녀 모자, 생일엔 케이크, 디왈리엔 디야 등잔을 꺼내 입고, 아침엔 커피, 자정이 넘으면 수면 모자를 써요.

<p align="center">
  <img src="docs/wardrobe.png" width="840" alt="저마다 다른 옷을 입은 Mochi 열두 명: 커피를 든 비니, 콧수염 난 카우보이, 마법사, 파티 모자, 모노클과 고양이를 곁들인 왕관, 목도리를 두른 수면 모자 등">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/level-ko-dark.png">
  <img src="docs/level-ko-light.png" width="640" alt="Mochi의 레벨: 경험치 링, 다음 레벨까지 남은 경험치, 다음에 해제될 아이템">
</picture>

입을 옷은 상세 패널의 **옷장** 섹션에서 고르거나, `/mochi 착용 안경`처럼 직접 입혀 보세요. `/mochi 생일 04-23`으로 생일을 알려 주면 이 컴퓨터에만 저장돼요. 새로 입힐 거리가 떠올랐나요? 추가하는 방법은 [docs/OUTFITS.md](docs/OUTFITS.md)에 있어요.

## 📸 자랑하기

- **`/mochi 카드`**는 카드를 그려요: 오늘 옷차림의 Mochi, 내 레벨, 경험치, 연속 기록.
- **`/mochi 결산`**은 모든 채팅에서 보낸 한 달을 그림 한 장에 정리해요: 작업 시간, 턴, 커밋, 가장 바빴던 날, 가장 긴 연속 기록, 가장 오래 머문 폴더. `/mochi 결산 연간`은 한 해를 정리해요. 매달 첫 주에는 지난달 결산이 준비됐다고 Mochi가 한 번 알려 줘요.
- **`/mochi 스냅샷`**은 밴드와 상세 패널을 지금 모습 그대로 저장해요. 올리기 전에 한번 확인하세요: 밴드에 보이는 건 다 담기니까 브랜치도 함께 나와요. 다른 채팅과 마지막 편집의 내용 줄은 빠져요.

모두 `~/.claude/mochi/share/` 아래에 SVG 파일로 저장돼요. 밝은 페이지에서도 어두운 페이지에서도 잘 보이고, 다른 파일 없이 그 파일 하나로 충분해요. X와 Reddit은 PNG만 받아요. `rsvg-convert`나 ImageMagick이 설치되어 있으면 `/mochi 스냅샷`이 각각의 PNG도 저장해요.

<details>
<summary><b>GitHub 프로필에 카드 올리기</b></summary>

<br>

1. 내 사용자 이름과 같은 이름의 프로필 저장소(`you/you`)를 클론해요.
2. 그 폴더 경로를 붙여 `/mochi 카드 ~/code/you`를 실행하면, 카드가 그 안에 `mochi-card.svg`로 저장돼요.
3. Mochi가 알려 주는 줄을 저장소의 `README.md`에 붙여 넣고, 커밋하고 푸시하세요:

   ```md
   [![Mochi for Claude Code](mochi-card.svg)](https://github.com/oztrkemree/mochi)
   ```

카드는 만든 순간의 모습 그대로예요. 레벨이 오르면 `/mochi 카드`를 다시 실행하고 새 카드를 푸시하세요.

</details>

## ⌨️ 명령어

명령어는 하나도 몰라도 괜찮아요: Mochi는 설치하는 순간부터 알아서 움직여요. 직접 다뤄 보고 싶을 때는 모두 `/mochi` 아래에 있어요.

| 명령어 | 하는 일 |
| --- | --- |
| `/mochi` | 밴드 숨기기 또는 보이기 (어느 쪽인지 정하려면 `/mochi hide` · `/mochi show`) |
| `/mochi details` | 상세 패널 열기 |
| `/mochi wear [item \| auto \| none]` | 골라서 입히기, Mochi가 알아서 입게 두기, 또는 전부 벗기기 |
| `/mochi shield [on \| off]` | 보호막이 켜져 있는지, 어디서 무엇을 항상 허용했는지 보기 |
| `/mochi card [path]` · `/mochi wrapped [year]` · `/mochi snap` | 공유할 그림 저장 |
| `/mochi small` · `/mochi big` | 한 줄 또는 전체 크기 |

<details>
<summary><b>전체 명령어</b></summary>

<br>

| 명령어 | 하는 일 |
| --- | --- |
| `/mochi` | 밴드 숨기기 또는 보이기 (어느 쪽인지 정하려면 `/mochi hide` · `/mochi show`) |
| `/mochi details` | 상세 패널 열기 |
| `/mochi level` | 내 레벨, 경험치, 아직 잠겨 있는 것들 |
| `/mochi wear [item \| auto \| none]` | 골라서 입히기, Mochi가 알아서 입게 두기, 또는 전부 벗기기 |
| `/mochi badges` | 지금까지 얻은 배지와 나머지를 얻는 방법 |
| `/mochi chats` | 이 컴퓨터의 모든 채팅, 나를 기다리는 채팅부터 |
| `/mochi shield [on \| off]` | 보호막이 켜져 있는지, 어디서 무엇을 항상 허용했는지 보기. `on`이나 `off`로 바꾸기 |
| `/mochi shield reset` | “여기서는 항상 허용”으로 기억해 둔 것을 모두 잊기 |
| `/mochi alerts` | 알림 켜기/끄기 (결산이 준비됐다는 안내도 함께) |
| `/mochi ci` | CI 추적 켜기/끄기 |
| `/mochi tips` | 팁, `CLAUDE.md` 제안, 새소식 안내 켜기/끄기 |
| `/mochi breaks` | 기지개 제안 켜기/끄기 |
| `/mochi sound` | 소리 켜기/끄기 |
| `/mochi plugins` | 다른 플러그인의 반응 켜기/끄기 |
| `/mochi card [path]` | GitHub 프로필용 카드 저장 |
| `/mochi wrapped [year]` | 한 달, 또는 한 해를 그림 한 장으로 저장 |
| `/mochi snap` | 밴드와 상세 패널을 그림으로 저장 |
| `/mochi tour` | 첫 실행 안내 다시 보기 |
| `/mochi news` | 이번 버전에서 달라진 점 |
| `/mochi birthday [MM-DD \| none]` | 생일 알려 주기, 확인하기, 또는 지우기 |
| `/mochi lang [code \| auto]` | 언어 확인 또는 변경 |
| `/mochi small` · `/mochi big` | 한 줄 또는 전체 크기 |
| `/mochi export` | Mochi가 보관하는 모든 것을 JSON 파일 하나로 저장 |
| `/mochi reset [level \| history \| all]` | 레벨 정보, 기록, 또는 설정까지 전부 지우기. 먼저 물어보고, 내보낸 파일과 `shield.json`은 남아요 |
| `/mochi feedback` | 버전, 시스템, 화면, 언어가 미리 채워진 버그 신고 링크 |
| `/mochi status` | Mochi가 지금 알고 있는 것 |

영어 명령어는 언제나 그대로 쓸 수 있고, 언어마다 제 말로 된 명령어도 있어요 (`/mochi 착용`, `/mochi 보호막`, `/mochi 결산`…). 켜고 끄는 명령은 칠 때마다 바뀌어요. `켜기`나 `끄기`를 붙이면 그 상태로 맞춰요: `/mochi 팁 끄기`.

</details>

## 🌍 16개 언어

English · Türkçe · Español · Deutsch · Français · Português · Русский · 中文 · 日本語 · 한국어 · Italiano · Polski · Українська · हिन्दी · Bahasa Indonesia · العربية

Claude Code의 `language` 설정이 이 중 하나라면 Mochi는 그 언어로 말해요. 아니라면 시스템의 기본 언어를, 그다음엔 `LANG`을 따르고, 그래도 맞는 게 없으면 영어로 말해요. `/mochi 언어 ko`로 직접 고를 수 있고, `/mochi 언어 자동`으로 다시 자동 설정으로 돌아가요.

## 🔒 Mochi가 손대는 것들

**모든 건 내 컴퓨터 안에만 머물러요.** Mochi 자체는 **네트워크 요청을 전혀 보내지 않아요**. 인터넷과 통신하는 건 CI 추적에 쓰는 내 `gh` 하나뿐이고, `/mochi ci`로 그것도 끌 수 있어요.

<details>
<summary><b>전체 목록</b></summary>

<br>

- **git**: 채팅 폴더에서 읽기만 해요. 밴드와 상세 패널을 위해 `git status`, `git log`, `git diff --numstat`, `git rev-parse`를 실행해요. 보호막이 더 자세히 봐야 할 때는 현재 브랜치와 기본 브랜치, `git add`가 추가할 파일(`git ls-files`), `git commit`이 커밋할 내용(`git diff`)을 확인해요.
- **gh**: CI 추적이 켜져 있을 때만, 내 로그인으로 실행해요(Mochi는 토큰을 볼 수 없어요). `gh pr view`는 채팅이 시작될 때, 상세 패널을 열 때, 그리고 푸시 전후로 실행해요. `gh run list`는 이 채팅에서 푸시한 뒤에만, 실행이 끝날 때까지 30초마다, 길어야 30분 동안 실행해요. `/mochi ci`로 둘 다 끌 수 있어요.
- **시스템 도구**: 알림은 macOS에서 `osascript`, Windows에서 PowerShell, Linux에서 `notify-send`로 보내요. 언어 확인에는 macOS에서 `defaults read -g AppleLanguages`, Windows에서 `reg query`를 쓰고, macOS와 Linux는 `uname`으로 구분해요. `/mochi 스냅샷`의 PNG에는 설치되어 있으면 `rsvg-convert`나 ImageMagick의 `magick`을 써요. 닫힌 채팅의 파일과 `/mochi 초기화`가 지우는 파일은 `~/.claude/mochi/` 안에서만, 이름을 하나하나 지정해 `rm`(Windows에서는 `cmd`의 `del`)으로 지워요.
- **`~/.claude/mochi/` 아래 파일**: 열려 있는 채팅별 상태, 일별 카운트, 내 레벨과 배지, 소진 예측에 쓰는 사용량 기록, 팁마다 보여 준 횟수와 내가 반복한 짧은 지시(프롬프트 전체는 저장하지 않아요), 한도 초기화를 한 채팅에서만 알리도록 하는 표시, 직접 만들었다면 `shield.json`, 그리고 `/mochi 카드`, `결산`, `스냅샷`, `내보내기`가 저장하는 파일. 설정, 항상 허용한 항목, 생일은 Claude Code의 플러그인용 저장소에 보관해요.
- **내 프로젝트**: 지시를 제안하기 전에 `CLAUDE.md`를 읽고, **추가**를 고른 뒤에만 한 줄을 덧붙여요. 카드는 `/mochi 카드`에 프로젝트 안의 경로를 줬을 때만 거기에 저장해요. 줄 수를 세고 비밀 정보를 찾으려고 Claude가 덮어쓰려는 파일을 읽고, 추가와 커밋을 한 번에 하는 명령이라면 새로 추가될 파일도 읽어요(최대 20개, 각각 1MB 미만). 읽은 내용은 하나도 남기지 않아요.
- **다른 플러그인**은 Mochi를 통해 기분과 짧은 한 줄을 보여 줄 수 있어요. 플러그인 이름이 함께 붙고, 플러그인마다 10초에 한 번까지예요. `/mochi 플러그인`으로 끌 수 있어요. `/mochi 피드백`은 링크만 보여 줄 뿐, 아무것도 보내지 않아요.

</details>

## ❓ 자주 묻는 질문

<details>
<summary><b>설치했는데 Mochi가 안 보여요.</b></summary>

<br>

`claude --version`을 확인해 보세요: Mochi는 **2.1.293 이상**이 필요해요. 이전 빌드는 hooks 모듈을 아예 불러오지 않아요. 버전이 충분히 최신이라면 `/mochi 상태`가 Mochi가 아는 것을 보여 주고, `/mochi 피드백`이 내용이 미리 채워진 버그 신고서를 만들어 줘요.

</details>

<details>
<summary><b>자리를 너무 많이 차지해요.</b></summary>

<br>

`/mochi 작게`를 치면 한 줄로 줄어요. `/mochi`는 아예 숨기고, 한 번 더 치면 다시 보여 줘요.

</details>

<details>
<summary><b>내 코드나 프롬프트를 어딘가로 보내나요?</b></summary>

<br>

아니요. Mochi는 네트워크 요청을 전혀 보내지 않아요. `~/.claude/mochi/` 아래에 짧은 카운트만 남기고, 프롬프트 전체는 절대 저장하지 않아요. 자세한 건 [Mochi가 손대는 것들](#-mochi가-손대는-것들)을 보세요.

</details>

<details>
<summary><b>보호막이 방해되진 않나요?</b></summary>

<br>

되돌릴 수 없는 일 앞에서만 물어보고, **여기서는 항상 허용**을 고르면 그 저장소에서는 답을 기억해 둬요. `/mochi 보호막 끄기`로 끌 수 있고, `shield.json`으로 종류 하나씩 끌 수도 있어요.

</details>

## 🧩 플러그인 개발자라면

내 플러그인이 Mochi를 반응하게 만들 수 있어요: 배포가 끝나면 환호하고, 검사가 실패하면 걱정스러운 표정을 짓게요. `dependencies`에 `mochi`를 넣고 `$.mochi.react({ mood, line })`이나 `$.mochi.celebrate({ line })`을 호출하면 돼요. 호출 방법과 제한, 예제 플러그인 하나가 통째로 [docs/API.md](docs/API.md)에 있어요.

## 🤝 기여하기

버그 제보, 아이디어, 번역, 그림, PR 모두 대환영이에요. [이슈를 열거나](https://github.com/oztrkemree/mochi/issues/new/choose)(`/mochi 피드백`을 쓰면 내용이 미리 채워진 버그 신고서가 나와요), 코드부터 살펴보고 싶다면 [CONTRIBUTING.md](CONTRIBUTING.md)를 읽어 보세요. 명령어 두 개로 전부 검사할 수 있고(`claude plugin validate .`와 `claude plugin test .`), 새 언어는 사전 하나와 몇 줄이면 충분해요. 버전마다 달라진 점은 [CHANGELOG.md](CHANGELOG.md)에 있어요.

이 페이지의 움직이는 그림은 모두 Mochi 자신의 코드가 그렸어요: `node scripts/gifs.mjs`와 `node scripts/demo.mjs`로 다시 만들 수 있어요.

## 📄 라이선스

[MIT](LICENSE). 마음껏 쓰고, 고치고, 나눠 주세요.

<br>

<div align="center">

**Mochi 덕분에 미소 지었다면, ⭐ 하나가 다른 사람들이 Mochi를 찾는 데 큰 힘이 돼요.**

<sub><a href="https://github.com/oztrkemree">Emre Öztürk</a>, 그리고 Claude가 정성껏 만들었어요.</sub>

</div>
