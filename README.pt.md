<div align="center">

<img src="docs/hero.webp" width="260" alt="Mochi, um pequeno mascote de argila, acenando, pensando, lendo, digitando, comemorando e caindo no sono">

# Mochi Buddy

### Um amiguinho de argila que mora acima do seu prompt do Claude Code.

Ele reage a tudo o que o Claude faz, segura os comandos de que você se arrependeria<br>
e deixa à vista o seu contexto e os limites da sessão e da semana.

<a href="https://cdn.jsdelivr.net/gh/oztrkemree/mochi@main/docs/mochi-short.mp4"><img src="docs/watch-pt.svg" height="82" alt="▶ Veja a demo (0:31)"></a>

[![Licença: MIT](https://img.shields.io/badge/licença-MIT-E08A6A?style=for-the-badge)](LICENSE)
[![Plugin do Claude Code](https://img.shields.io/badge/Claude_Code-plugin-D97757?style=for-the-badge)](#-instale-em-10-segundos)
[![16 idiomas](https://img.shields.io/badge/idiomas-16-7AA2F7?style=for-the-badge)](#-16-idiomas)
[![136 acessórios](https://img.shields.io/badge/guarda--roupa-136_itens-B684F6?style=for-the-badge)](#-um-guarda-roupa-que-cresce-com-você)
[![Sem telemetria](https://img.shields.io/badge/telemetria-nenhuma-4CC38A?style=for-the-badge)](#-o-que-ele-acessa)

<sub>[English](README.md) · [Türkçe](README.tr.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · **Português** · [Русский](README.ru.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)</sub>

<br>

<img src="docs/gif/session.webp" width="760" alt="Um chat do Claude Code: você pede um botão de modo escuro, e o Mochi, de gorro e com um café, pensa, lê, busca, edita, roda os testes, fica tonto quando dois falham, edita de novo, comemora quando 48 passam e termina orgulhoso com o tempo, as ferramentas e as edições do turno, enquanto os anéis de contexto, sessão e semana vão enchendo">

<sub>Um turno de verdade. Cada carinha e cada frase aqui saem do próprio código de desenho e de reações do Mochi.</sub>

</div>

<br>

## ⚡ Instale em 10 segundos

```
/plugin install mochi-buddy --marketplace oztrkemree/mochi
```

Digite isso em qualquer chat do Claude Code, responda `y` para adicionar o marketplace e escolha o escopo **user**. Pronto: o Mochi aparece na hora, e em todo chat que você abrir depois. Não há nada para configurar.

> [!NOTE]
> O Mochi é construído sobre os módulos de hooks do Claude Code (function hooks) e precisa do **Claude Code 2.1.293 ou mais recente** (`claude --version` mostra qual é a sua). Versões mais antigas, como a 2.1.286, nem carregam o módulo, então o Mochi nunca aparece.

> [!TIP]
> **Atualizar.** O Mochi avisa quando sai uma versão nova, e `/mochi atualizar` mostra o que rodar. O Claude Code não atualiza sozinho um marketplace do GitHub, então o botão Update pode ficar cinza; num terminal:
>
> ```
> claude plugin marketplace update mochi
> claude plugin update mochi-buddy@mochi
> ```
>
> depois reinicie o Claude Code.

> [!IMPORTANT]
> **Já tinha o Mochi antes da 0.7.0?** Agora ele se chama Mochi Buddy. Em um terminal:
>
> ```
> claude plugin marketplace update mochi
> claude plugin install mochi-buddy@mochi
> claude plugin uninstall mochi@mochi
> ```
>
> e depois reinicie o Claude Code. Suas configurações vêm junto, e seu nível, histórico e guarda-roupa ficam como estão. Se rodar `claude plugin update mochi@mochi` em vez disso, o Mochi antigo mostra um botão **Mudar** que faz o mesmo.

<br>

<table>
<tr>
<td align="center" width="25%">🎭<br><b>30 humores</b><br><sub>que acompanham cada chamada de ferramenta</sub></td>
<td align="center" width="25%">🛡️<br><b>Um escudo</b><br><sub>contra <code>rm -rf</code>, force pushes e chaves vazadas</sub></td>
<td align="center" width="25%">📊<br><b>Anéis de limite</b><br><sub>com a previsão de quando vão acabar</sub></td>
<td align="center" width="25%">👒<br><b>136 coisas para vestir</b><br><sub>conquistadas com trabalho de verdade</sub></td>
</tr>
</table>

## 🎭 Ele sente o que o Claude está fazendo

Pensando, lendo, buscando, digitando, rodando um comando, esperando você, comemorando os testes no verde, tonto depois de três erros seguidos, dormindo quando você sai. **Trinta humores, sem cortes bruscos**: cada pose flui suavemente da anterior, então a faixa nunca pisca, ela respira.

<p align="center">
  <img src="docs/demo.svg" width="744" alt="A faixa do Mochi passando pelos seus humores e roupas: acenando, lendo, editando, rodando um comando, orgulhoso, esperando você, comemorando e dormindo">
</p>

Ao lado da carinha: o que está acontecendo, com todas as letras (`editando checkout.tsx`, `testes passaram · 4s`), as últimas chamadas de ferramentas como uma fileira de quadradinhos (a que está rodando respira, a que falhou fica vermelha), seu branch e quantos arquivos mudaram.

## 📊 Seus limites num relance, com previsão

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/band-pt-dark.png">
  <img src="docs/band-pt-light.png" alt="A faixa do Mochi acima do prompt: editando checkout.tsx, as últimas chamadas de ferramentas, o branch, outro chat esperando e anéis para o contexto, a sessão de 5 horas e a semana">
</picture>

Três anéis: a **janela de contexto**, a **sessão de 5 horas** e a **semana**. Chega de digitar `/usage` a cada dez minutos.

- **Uma previsão, não só um número.** Está gastando uma janela mais rápido do que ela reinicia? O anel diz *quando* ela vai acabar (`cheio 16:40`), em âmbar, e depois em vermelho conforme a hora se aproxima.
- **Boas notícias também.** Quando um limite que você quase esgotou reinicia, o Mochi avisa.
- **O anel de contexto sabe o que tem dentro**: prompt do sistema, ferramentas, MCP, memória, skills, mensagens, cada um com sua cor, e uma marquinha onde o auto‑compact vai entrar.

## 🛡️ O escudo: segura o que não tem volta

<p align="center">
  <img src="docs/gif/shield.webp" width="760" alt="O Claude está prestes a rodar rm -rf ./dist ~/; o Mochi, de capacete, fica assustado e o escudo pergunta: Este comando apaga arquivos e pastas de vez, Executar? A resposta é Parar, e nada é apagado">
</p>

O escudo lê cada comando que o Claude roda, no Bash ou no PowerShell, e cada edição que ele faz. Antes de qualquer coisa que não tem volta, ele para e pergunta, **dizendo com todas as letras o que seria destruído**: apagar arquivos e pastas de vez (`rm -rf`, `Remove-Item -Recurse`, `del /s`), formatar um disco, sobrescrever o histórico de um branch, jogar fora alterações sem commit, apagar um banco de dados, derrubar infraestrutura ou um bucket na nuvem, `npm unpublish`, `docker system prune -a`, um script da internet passado direto para o shell, `sudo`.

- **Force push é julgado pelo branch.** Na `main`, `master`, `trunk` ou `develop`, ele pergunta e diz o nome do branch. No seu próprio branch, ele pergunta com um olhar nervoso em vez do alarme; um `--force-with-lease` ali só ganha o olhar.
- **Segredos ficam fora do seu histórico.** Antes de o Claude gravar, dar `git add` ou fazer commit de algo que pareça uma chave ou um token de verdade (AWS, GitHub, Anthropic, OpenAI, Slack, Stripe, uma chave privada, uma senha) ou de um arquivo como `.env` ou `id_rsa`, o Mochi pergunta e mostra o valor mascarado: `AKIA••••••LE`. Placeholders e valores de teste óbvios passam direto.
- **Sempre permitir aqui.** A pergunta oferece **Executar** (ou **Gravar**), **Parar** e **Sempre permitir aqui**, que lembra aquele tipo de comando neste repositório. Vale para o que fica dentro dele: um comando ou uma edição que sai dele (`rm -rf ~`, um arquivo da sua pasta pessoal) pergunta de novo. `/mochi escudo` lista o que está liberado e onde; `/mochi escudo redefinir` esquece tudo.
- **Uma rede de segurança, não um sandbox.** O escudo compara o texto de um comando com padrões conhecidos, então pega descuidos, inclusive dentro de `bash -c`, subshells e `$(…)`. Ele não vê um comando montado na hora (variáveis, codificações), escondido num script ou rodado fora das ferramentas Bash e PowerShell, e não impede quem tenta contorná-lo. Para isolamento de verdade, use um sandbox ou um contêiner. [O que ele vê e o que não vê](docs/SHIELD.md).

<details>
<summary><b>Escreva suas próprias regras</b> em <code>~/.claude/mochi/shield.json</code></summary>

<br>

```json
{
  "add": [{ "match": "terraform\\s+apply", "says": "altera a infraestrutura em produção" }],
  "off": ["publish", "sudo"]
}
```

- `match` é uma expressão regular testada em cada comando do Bash e do PowerShell, sem diferenciar maiúsculas de minúsculas. `says` é o que esse comando faria, mostrado na pergunta; sem ele, a pergunta diz que o comando bate com uma das suas regras.
- `off` lista os tipos embutidos sobre os quais o escudo para de perguntar: qualquer chave de `danger` em [`hooks/lang/pt.ts`](hooks/lang/pt.ts) (`rm`, `forcePush`, `publish`, `sudo`…), `secret` ou um tipo dele (`secret:aws`, `secret:github`, `secret:apiKey`, `secret:slack`, `secret:stripe`, `secret:privateKey`, `secret:generic`), `secretFile` e `secretEdit`.
- O Mochi relê o arquivo sempre que ele muda, e avisa num toast. O que não der para usar é ignorado e citado; se o arquivo não for um JSON válido, nenhuma das suas regras vale até ele ser corrigido. Antes que o próprio Claude mude o arquivo, o escudo pergunta.

</details>

## 🧡 Tudo o mais que ele percebe

<table>
<tr>
<td width="50%" valign="top">

### 🔁 Um vigia de loops
O mesmo comando falhando três vezes, o mesmo erro voltando, a mesma chamada devolvendo sempre a mesma coisa: o Mochi percebe **antes que o seu limite acabe**, e diz para você apertar Esc.

</td>
<td width="50%" valign="top">

### 🔔 Alertas enquanto você está fora
Uma notificação do sistema (macOS, Windows ou Linux) quando termina um turno de mais de dois minutos, quando uma tarefa longa para e fica esperando você, quando seu limite reinicia ou quando a CI falha. **Vai passar um café.**

</td>
</tr>
<tr>
<td valign="top">

### 💬 Todos os chats num só quadro
Todos os chats do Claude Code da sua máquina, este primeiro e logo depois os que estão esperando você, cada um com seu branch (worktrees marcadas), o que está fazendo e há quanto tempo. Um chat que está há cinco minutos esperando você manda mais uma notificação.

</td>
<td valign="top">

### 🚦 CI depois do push
O Mochi acompanha as execuções do GitHub Actions pelo seu próprio `gh`: `ci rodando · 2/5` na faixa, festa quando passam, o nome do workflow que falhou quando não passam. Entre as execuções: o pull request do seu branch, a revisão e as verificações (`PR #12 · aprovado · verificações 4/5`).

</td>
</tr>
<tr>
<td valign="top">

### 💡 Dicas na hora certa
De vez em quando, com o Mochi parado, uma dica curta do Claude Code sobre o que acabou de acontecer: Esc Esc depois de um turno interrompido, `/compact` quando o contexto vai enchendo. Dê a mesma instrução pela terceira vez e o Mochi se oferece para adicioná-la ao `CLAUDE.md`; ele só grava se você escolher **Adicionar**.

</td>
<td valign="top">

### 🏅 Conquistas por trabalho de verdade
Dezoito delas, cada uma comemorada uma vez só: os primeiros testes no verde, uma virada num único turno, um dia de faxina que remove mais do que adiciona, coruja, madrugador, poliglota, um turno maratona, cem commits, e as difíceis: 30 dias seguidos, 500 commits, 5.000 edições, 10.000 linhas removidas…

</td>
</tr>
<tr>
<td valign="top">

### 🎉 Datas especiais, pequenas surpresas
A época das cerejeiras, Hacktoberfest, Halloween, Ano-Novo e o seu aniversário: cada um veste o Mochi, com o que ele já conquistou. Dê boa noite ao Mochi, ou agradeça. Depois de duas horas sem pausa, ele sugere um alongamento.

</td>
<td valign="top">

### 🧩 Outros plugins podem falar por ele
Seu plugin de deploy pode fazer o Mochi vibrar quando uma versão sai, seu linter pode fazê-lo franzir a testa. Uma chamada só: `$.mochi.react({ mood, line })`. Veja [para autores de plugins](#-para-autores-de-plugins).

</td>
</tr>
</table>

## 🔍 O painel de detalhes

**Clique nos anéis** e tudo se abre: esta sessão num relance, todos os chats da sua máquina, sua CI e seu pull request, e **cada arquivo alterado, com as linhas adicionadas e removidas**, os que o Claude mexeu neste chat no topo, com o diff de cada arquivo em vermelho e verde.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/details-pt-dark.png">
  <img src="docs/details-pt-light.png" width="760" alt="O painel de detalhes: anéis de contexto e limites com previsão, os números desta sessão, outros chats e uma lista de arquivos alterados com a contagem de linhas e a última edição">
</picture>

Mais abaixo: o contexto por categoria, seus turnos recentes, um calendário com os dias de todos os chats, seu nível, seu guarda-roupa e suas conquistas, e cada configuração e ação, a um clique de distância.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/history-pt-dark.png">
  <img src="docs/history-pt-light.png" width="760" alt="Um calendário dos últimos meses de trabalho, com os turnos de hoje, os últimos sete dias e seus dias seguidos">
</picture>

## 👒 Um guarda-roupa que cresce com você

<p align="center">
  <img src="docs/gif/wardrobe.webp" width="760" alt="O Mochi provando roupas uma depois da outra: gorro com café, coroa com monóculo e gato, chapéu de mago e cachecol, chapéu de festa com medalha e balão, chapéu de caubói com bigode, capelo de formatura com óculos, chapéu de pirata com óculos escuros e um patinho, capacete com chave inglesa, chapéu de chef com gravata-borboleta e bolo, e touca de dormir ao lado de um cacto">
</p>

Cada turno, edição, commit e dia de trabalho rende experiência. Os níveis liberam coisas para vestir: **136 itens** entre cabeça, rosto, pescoço, mão e o cantinho ao lado do Mochi. Nada se abre pela data: os níveis liberam a maior parte, os hábitos alguns, e as conquistas difíceis o resto (um chapéu de bruxa e uma abóbora por cento e cinquenta noites, um bolo por quinhentos commits). Depois de conquistado, o chapéu de bruxa aparece no Halloween e o bolo no seu aniversário; o café chega de manhã e a touca de dormir depois da meia-noite.

<p align="center">
  <img src="docs/wardrobe.png" width="840" alt="Doze Mochis com roupas diferentes: gorro com café, caubói de bigode, mago, chapéu de festa, coroa com monóculo e gato, touca de dormir com cachecol e mais">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/level-pt-dark.png">
  <img src="docs/level-pt-light.png" width="640" alt="O nível do Mochi: um anel de experiência, a experiência que falta para o próximo nível e o próximo item a ser liberado">
</picture>

Escolha o que vestir na seção **Guarda-roupa** do painel de detalhes, ou com `/mochi vestir óculos`. Conte ao Mochi quando é seu aniversário com `/mochi aniversário 04-23`; a data fica só na sua máquina. Tem uma ideia de algo novo para vestir? O [docs/OUTFITS.md](docs/OUTFITS.md) mostra como adicionar.

## 📸 Mostre por aí

- **`/mochi cartão`** desenha um cartão: o Mochi com a roupa de hoje, seu nível, sua experiência e seus dias seguidos.
- **`/mochi retrospectiva`** resume o seu mês, somando todos os chats, numa só imagem: horas, turnos, commits, seu dia mais movimentado, sua maior sequência de dias e a pasta em que você passou mais tempo. `/mochi retrospectiva ano` faz a do ano. Na primeira semana de cada mês, o Mochi avisa uma vez que a do mês passado está pronta.
- **`/mochi captura`** salva a faixa e o painel de detalhes do jeito que estão agora. Dê uma olhada antes de postar: ela mostra o que a faixa mostra, inclusive seu branch. Os outros chats e as linhas da sua última edição ficam de fora.

São arquivos SVG em `~/.claude/mochi/share/`, feitos para ficar legíveis em páginas claras e escuras e sem depender de nada externo. O X e o Reddit só aceitam PNG: com o `rsvg-convert` ou o ImageMagick instalado, `/mochi captura` também salva um PNG de cada um.

<details>
<summary><b>Coloque seu cartão no seu perfil do GitHub</b></summary>

<br>

1. Clone o repositório do seu perfil, aquele com o mesmo nome do seu usuário (`seu-usuario/seu-usuario`).
2. Rode `/mochi cartão ~/code/seu-usuario` com o caminho dessa pasta; o cartão vai parar lá como `mochi-card.svg`.
3. Cole a linha que o Mochi te passa no `README.md` do repositório, depois faça commit e push:

   ```md
   [![Mochi para Claude Code](mochi-card.svg)](https://github.com/oztrkemree/mochi)
   ```

O cartão é uma foto do momento: depois de subir de nível, rode `/mochi cartão` de novo e faça push do novo.

</details>

## ⌨️ Comandos

Você nunca precisa de nenhum: o Mochi funciona assim que é instalado. Quando quiser dar uma direção a ele, está tudo em `/mochi`.

| Comando | O que faz |
| --- | --- |
| `/mochi` | Esconde ou mostra a faixa (`/mochi hide` · `/mochi show` dizem qual) |
| `/mochi details` | Abre o painel de detalhes |
| `/mochi wear [item \| auto \| none]` | Veste algo, deixa o Mochi se vestir sozinho ou tira tudo |
| `/mochi shield [on \| off]` | Diz se o escudo está ligado e mostra o que está sempre permitido e onde |
| `/mochi card [path]` · `/mochi wrapped [year]` · `/mochi snap` | Salva uma imagem para compartilhar |
| `/mochi small` · `/mochi big` | Uma linha ou tamanho completo |

<details>
<summary><b>Todos os comandos</b></summary>

<br>

| Comando | O que faz |
| --- | --- |
| `/mochi` | Esconde ou mostra a faixa (`/mochi hide` · `/mochi show` dizem qual) |
| `/mochi details` | Abre o painel de detalhes |
| `/mochi level` | Seu nível, sua experiência e o que ainda está bloqueado |
| `/mochi wear [item \| auto \| none]` | Veste algo, deixa o Mochi se vestir sozinho ou tira tudo |
| `/mochi badges` | As conquistas que você já tem, e como ganhar as outras |
| `/mochi chats` | Todos os chats desta máquina, primeiro os que estão esperando você |
| `/mochi shield [on \| off]` | Diz se o escudo está ligado e mostra o que está sempre permitido e onde; `on` ou `off` o muda |
| `/mochi shield reset` | Esquece tudo o que o “Sempre permitir aqui” guardou |
| `/mochi alerts` | Liga ou desliga as notificações (e o aviso de que sua retrospectiva está pronta) |
| `/mochi ci` | Liga ou desliga o acompanhamento de CI |
| `/mochi tips` | Liga ou desliga as dicas, as sugestões para o `CLAUDE.md` e o aviso de novidades |
| `/mochi breaks` | Liga ou desliga a sugestão de alongamento |
| `/mochi sound` | Liga ou desliga os sons |
| `/mochi plugins` | Liga ou desliga as reações de outros plugins |
| `/mochi card [path]` | Salva um cartão para o seu perfil do GitHub |
| `/mochi wrapped [year]` | Salva o seu mês, ou o seu ano, numa só imagem |
| `/mochi snap` | Salva a faixa e o painel de detalhes como imagens |
| `/mochi tour` | Mostra de novo o tour da primeira vez |
| `/mochi news` | O que esta versão trouxe |
| `/mochi birthday [MM-DD \| none]` | Conta ao Mochi quando é seu aniversário, mostra a data salva ou a esquece |
| `/mochi lang [code \| auto]` | Mostra ou troca o idioma |
| `/mochi small` · `/mochi big` | Uma linha ou tamanho completo |
| `/mochi export` | Salva tudo o que o Mochi guarda num único arquivo JSON |
| `/mochi reset [level \| history \| all]` | Apaga a memória do nível, o histórico ou tudo, inclusive as configurações; pergunta antes, e as exportações e o seu `shield.json` ficam |
| `/mochi feedback` | Um link para um relato de bug, já preenchido com as versões, seu sistema, a interface e o idioma |
| `/mochi status` | O que o Mochi sabe neste momento |

Os comandos em inglês sempre funcionam, e cada idioma acrescenta os seus (`/mochi aksesuar`, `/mochi idioma`, `/mochi sprache`…). Um comando que liga ou desliga algo alterna a cada vez; acrescente `on` ou `off` para fixar: `/mochi tips off`.

</details>

## 🌍 16 idiomas

English · Türkçe · Español · Deutsch · Français · Português · Русский · 中文 · 日本語 · 한국어 · Italiano · Polski · Українська · हिन्दी · Bahasa Indonesia · العربية

O Mochi fala o idioma da configuração `language` do Claude Code quando ela é um destes; senão, o idioma preferido do seu sistema, depois o `LANG`; e, se nada disso servir, inglês. Com `/mochi idioma ja` você mesmo escolhe, e `/mochi idioma automático` volta para o automático.

## 🔒 O que ele acessa

**Tudo fica na sua máquina.** O Mochi não envia nada sobre você ou o seu trabalho para lugar nenhum. A única requisição dele mesmo lê o número da versão no GitHub, no máximo a cada 12 horas, para avisar quando sai uma atualização; enquanto `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` estiver definida, nem isso. A única outra coisa que fala com a internet é o seu próprio `gh`, para o acompanhamento de CI, e `/mochi ci` desliga isso.

<details>
<summary><b>A lista completa</b></summary>

<br>

- **git**, na pasta do chat, só para ler: `git status`, `git log`, `git diff --numstat` e `git rev-parse` para a faixa e o painel de detalhes. Quando o escudo precisa olhar mais de perto, ele pergunta qual é o branch atual e o branch padrão, quais arquivos um `git add` adicionaria (`git ls-files`) e o que um `git commit` levaria (`git diff`).
- **gh**, só enquanto o acompanhamento de CI estiver ligado, com o seu próprio login (o Mochi nunca vê seu token): `gh pr view` quando um chat começa, quando você abre o painel de detalhes e em torno de um push; `gh run list` só depois de um push neste chat, a cada 30 segundos até as execuções terminarem, por meia hora no máximo. `/mochi ci` desliga os dois.
- **GitHub, para atualizações**: no máximo a cada 12 horas, e quando você roda `/mochi update`, um download simples de `.claude-plugin/plugin.json` a partir de `raw.githubusercontent.com/oztrkemree/mochi` para comparar números de versão. Não leva nada sobre você ou o seu trabalho e não acontece enquanto `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` estiver definida.
- **As ferramentas do próprio sistema**: notificações via `osascript` no macOS, PowerShell no Windows e `notify-send` no Linux. Para o idioma, `defaults read -g AppleLanguages` no macOS e `reg query` no Windows; `uname` distingue o macOS do Linux. Para os PNGs do `/mochi captura`, o `rsvg-convert` ou o `magick` do ImageMagick, se você tiver. Os arquivos de chats fechados, e o que o `/mochi redefinir` apaga, são removidos pelo nome com `rm`, ou com o `del` do `cmd` no Windows, e só dentro de `~/.claude/mochi/`.
- **Arquivos em `~/.claude/mochi/`**: em que pé está cada chat aberto, contagens diárias, seu nível e suas conquistas, leituras de uso para a previsão, quantas vezes cada dica apareceu e as instruções curtas que você repete (nunca prompts inteiros), os marcadores que dizem a um chat para avisar que um limite reiniciou, seu `shield.json` se você escrever um, e o que `/mochi cartão`, `retrospectiva`, `captura` e `exportar` salvam. As configurações, o que está sempre permitido e seu aniversário ficam no armazenamento do Claude Code para plugins.
- **Seu projeto**: o Mochi lê o `CLAUDE.md` antes de sugerir uma instrução e só acrescenta uma linha depois que você escolhe **Adicionar**. Ele só grava o cartão no projeto se você passar para o `/mochi cartão` um caminho lá dentro. Para contar linhas e detectar segredos, ele lê um arquivo que o Claude está prestes a sobrescrever e, num comando que adiciona e faz commit de uma vez, os arquivos novos que seriam adicionados (até 20, com menos de 1 MB cada). Nada do que ele lê é guardado.
- **Outros plugins** podem mostrar um humor e uma frase curta pelo Mochi, assinados com o nome deles, cada um no máximo uma vez a cada 10 segundos; `/mochi extensões` desliga isso. O `/mochi relatar` só mostra um link: nada é enviado.
- **Os hooks do próprio Claude Code**: o Mochi observa chamadas de ferramentas, prompts, subagentes e turnos para escolher sua expressão e manter as contagens do dia, e repassa cada um sem mudanças; lê as mensagens do chat só para achar o título dele. Num pedido de permissão, só mostra que o Claude está esperando por você, e nunca o responde. O escudo é o único hook que age: antes de um comando ou edição que considera irreversível, ele pergunta a você, e só se você escolher **Parar**, ou se a pergunta não puder ser concluída, ele recusa essa chamada. Ele nunca permite nada por você. O Mochi adiciona o comando `/mochi` e, para plugins que dependem dele, `$.mochi`. Não grava nada na própria pasta do plugin e não carrega código além dos próprios arquivos. Na primeira vez que inicia, lê uma vez as configurações do antigo plugin `mochi`, no armazenamento do Claude Code em `~/.claude/plugins/store/`, para trazê-las.

</details>

## ❓ Perguntas frequentes

<details>
<summary><b>Instalei, mas o Mochi não aparece.</b></summary>

<br>

Confira `claude --version`: o Mochi precisa da **2.1.293 ou mais recente**. Versões mais antigas nem carregam módulos de hooks. Se a sua versão já é nova o bastante, `/mochi status` diz o que o Mochi sabe, e `/mochi relatar` te dá um relato de bug já preenchido.

</details>

<details>
<summary><b>Ele ocupa espaço demais.</b></summary>

<br>

`/mochi pequeno` coloca ele numa linha só. `/mochi` esconde ele de vez, e de novo traz ele de volta.

</details>

<details>
<summary><b>Ele manda meu código ou meus prompts para algum lugar?</b></summary>

<br>

Não. O Mochi não envia nada sobre o seu código ou seus prompts para lugar nenhum; a única requisição dele lê o próprio número de versão no GitHub. Ele guarda contagens curtas em `~/.claude/mochi/`, nunca prompts inteiros. Veja [o que ele acessa](#-o-que-ele-acessa).

</details>

<details>
<summary><b>O escudo pode me atrapalhar?</b></summary>

<br>

Ele só pergunta antes do que não tem volta, e o **Sempre permitir aqui** lembra sua resposta naquele repositório. `/mochi escudo desligar` desliga o escudo; o `shield.json` desliga tipos específicos.

</details>

## 🧩 Para autores de plugins

Seu plugin pode fazer o Mochi reagir: comemorar quando um deploy termina, ficar preocupado quando uma verificação falha. Coloque `mochi-buddy` em `dependencies` e chame `$.mochi.react({ mood, line })` ou `$.mochi.celebrate({ line })`. O [docs/API.md](docs/API.md) traz as chamadas, os limites e um plugin de exemplo completo.

## 🤝 Como contribuir

Relatos de bugs, ideias, traduções, arte e pull requests: tudo é bem-vindo. [Abra uma issue](https://github.com/oztrkemree/mochi/issues/new/choose) (o `/mochi relatar` te dá um relato de bug já preenchido) ou leia o [CONTRIBUTING.md](CONTRIBUTING.md) para começar a mexer no código: dois comandos verificam tudo (`claude plugin validate .` e `claude plugin test .`), e adicionar um idioma é um dicionário e poucas linhas. O que mudou em cada versão está no [CHANGELOG.md](CHANGELOG.md).

As imagens animadas desta página são desenhadas pelo próprio código do Mochi: `node scripts/gifs.mjs` e `node scripts/demo.mjs` geram tudo de novo.

## 📄 Licença

[MIT](LICENSE). Use, modifique, compartilhe.

<br>

<div align="center">

**Se o Mochi te fez sorrir, uma ⭐ ajuda outras pessoas a encontrá-lo.**

<sub>Feito com carinho por <a href="https://github.com/oztrkemree">Emre Öztürk</a> e Claude.</sub>

</div>
