<div align="center">

<img src="docs/hero.webp" width="240" alt="Mochi, um pequeno mascote de argila, acenando, pensando, lendo, digitando, comemorando e caindo no sono">

# Mochi

**Um amiguinho de argila para o Claude Code.**<br>
Ele fica logo acima do seu prompt, reage a tudo o que o Claude faz<br>
e deixa à vista os números que você vive conferindo.

[![Licença: MIT](https://img.shields.io/badge/licença-MIT-E08A6A?style=flat-square)](LICENSE)
[![Plugin do Claude Code](https://img.shields.io/badge/Claude_Code-plugin-D97757?style=flat-square)](#-instalação)
[![16 idiomas](https://img.shields.io/badge/idiomas-16-7AA2F7?style=flat-square)](#-idiomas)
[![46 acessórios](https://img.shields.io/badge/guarda--roupa-46_itens-B794F6?style=flat-square)](#-um-guarda-roupa-que-cresce-com-você)
[![PRs bem-vindos](https://img.shields.io/badge/PRs-bem--vindos-4CC38A?style=flat-square)](CONTRIBUTING.md)

[English](README.md) · [Türkçe](README.tr.md) · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · **Português** · [Русский](README.ru.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

<br>

<p align="center">
  <img src="docs/demo.svg" width="744" alt="A faixa do Mochi passando pelos seus humores e roupas: acenando, lendo, editando, rodando um comando, orgulhoso, esperando você, comemorando e dormindo">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/band-pt-dark.png">
  <img src="docs/band-pt-light.png" alt="A faixa do Mochi acima do prompt: editando checkout.tsx, as últimas chamadas de ferramentas, o branch, outro chat esperando e anéis para o contexto, a sessão de 5 horas e a semana">
</picture>

<p align="center"><sub>Tudo num relance: o que o Claude está fazendo agora, as últimas chamadas de ferramentas, seu branch, outro chat que precisa de você e o quanto o contexto, a sessão e a semana já encheram.</sub></p>

## ✨ Instalação

```
/plugin install mochi --marketplace oztrkemree/mochi
```

Digite isso em qualquer chat do Claude Code, responda `y` para adicionar o marketplace e escolha o escopo **user**. O Mochi aparece na hora, e em todo chat que você abrir depois.

> [!NOTE]
> O Mochi é construído sobre os módulos de hooks do Claude Code (function hooks) e precisa do **Claude Code 2.1.293 ou mais recente** (`claude --version` mostra qual é a sua). Versões mais antigas, como a 2.1.286, nem carregam o módulo, então o Mochi nunca aparece.

## 🧡 O que o Mochi percebe

<table>
<tr>
<td width="50%" valign="top">

**🎭 30 humores, sem cortes bruscos**<br>
Pensando, lendo, digitando, rodando um comando, esperando você, comemorando os testes no verde, tonto depois de três erros seguidos, dormindo quando você sai. Cada pose flui suavemente da anterior.

</td>
<td width="50%" valign="top">

**📊 Seus limites, com previsão**<br>
Anéis para a janela de contexto, a sessão de 5 horas e a semana. Se você está gastando um limite mais rápido do que ele reinicia, o Mochi avisa *quando* ele vai acabar. E quando um limite que você quase esgotou reinicia, ele avisa também.

</td>
</tr>
<tr>
<td valign="top">

**🛡️ Um escudo para os comandos assustadores**<br>
`rm -rf`, `Remove-Item -Recurse`, um force push na `main`, `git reset --hard`, `DROP TABLE`, um script da internet passado direto para o shell… eles param e perguntam antes, dizendo com todas as letras o que vão destruir. O mesmo vale para uma chave ou um token prestes a ser gravado ou ir para um commit.

</td>
<td valign="top">

**🔁 Um vigia de loops**<br>
O mesmo comando falhando três vezes, o mesmo erro voltando, a mesma chamada devolvendo sempre a mesma coisa: o Mochi percebe antes que o seu limite acabe.

</td>
</tr>
<tr>
<td valign="top">

**🔔 Alertas enquanto você está fora**<br>
Uma notificação do sistema (macOS, Windows ou Linux) quando termina um turno de mais de dois minutos, quando uma tarefa longa para e fica esperando você, quando seu limite reinicia ou quando a CI falha. Vai passar um café.

</td>
<td valign="top">

**💬 Todos os chats num só quadro**<br>
Todos os chats da sua máquina, este primeiro e logo depois os que estão esperando você, cada um com seu branch (worktrees marcadas), o que está fazendo e há quanto tempo. Um chat que está há cinco minutos esperando você manda mais uma notificação.

</td>
</tr>
<tr>
<td valign="top">

**🚦 CI depois do push**<br>
O Mochi acompanha as execuções do GitHub Actions pelo seu próprio `gh`: `ci rodando · 2/5` na faixa, festa quando passam, o nome do workflow que falhou quando não passam. Entre as execuções, a faixa mostra o pull request do seu branch, a revisão e as verificações; o painel de detalhes mostra tudo.

</td>
<td valign="top">

**💡 Dicas na hora certa**<br>
De vez em quando, com o Mochi parado, uma dica curta do Claude Code sobre o que acabou de acontecer: Esc Esc depois de um turno interrompido, `/compact` quando o contexto vai enchendo. Dê a mesma instrução pela terceira vez e o Mochi se oferece para adicioná-la ao `CLAUDE.md`; ele só grava se você escolher Adicionar.

</td>
</tr>
<tr>
<td valign="top">

**🏅 Conquistas por trabalho de verdade**<br>
Doze delas, cada uma comemorada uma vez só: os primeiros testes no verde, uma virada num único turno, um dia de faxina que remove mais do que adiciona, coruja, madrugador, poliglota, um turno maratona, cem commits…

</td>
<td valign="top">

**🎉 Datas especiais, pequenas surpresas**<br>
Eid, Ano-Novo Lunar, Nowruz, Diwali, Chuseok, a época das cerejeiras, Hacktoberfest, Halloween, Natal e o seu aniversário: cada um traz algo para vestir. Dê boa noite ao Mochi, ou agradeça. Depois de duas horas sem pausa, ele sugere um alongamento.

</td>
</tr>
</table>

## 🛡️ O escudo

O escudo lê cada comando que o Claude roda, no Bash ou no PowerShell, e cada edição que ele faz. Antes de qualquer coisa que não tem volta, ele para e pergunta: apagar arquivos e pastas de vez (`rm -rf`, `Remove-Item -Recurse`, `del /s`), formatar um disco, sobrescrever o histórico de um branch, jogar fora alterações sem commit, apagar um banco de dados, derrubar infraestrutura ou um bucket na nuvem, `npm unpublish`, `docker system prune -a`, um script da internet passado direto para o shell, `sudo`.

- **Force push é julgado pelo branch.** Na `main`, `master`, `trunk` ou `develop`, ele pergunta e diz o nome do branch. No seu próprio branch, ele pergunta com um olhar nervoso em vez do alarme e diz o nome do branch; um `--force-with-lease` ali só ganha o olhar.
- **Segredos ficam fora do seu histórico.** Antes de o Claude gravar, dar `git add` ou fazer commit de algo que pareça uma chave ou um token de verdade (AWS, GitHub, Anthropic, OpenAI, Slack, Stripe, uma chave privada, uma senha) ou de um arquivo como `.env` ou `id_rsa`, o Mochi pergunta e mostra o valor mascarado: `AKIA••••••LE`. Placeholders e valores de teste óbvios passam direto.
- **Sempre permitir aqui.** A pergunta oferece **Executar** (ou **Gravar**), **Parar** e **Sempre permitir aqui**, que lembra aquele tipo de comando neste repositório. Vale para o que fica dentro dele: um comando ou uma edição que sai dele (`rm -rf ~`, um arquivo da sua pasta pessoal) pergunta de novo. `/mochi escudo` diz se o escudo está ligado e lista o que está liberado e onde; `/mochi escudo redefinir` esquece tudo.

Suas próprias regras ficam em `~/.claude/mochi/shield.json`:

```json
{
  "add": [{ "match": "terraform\\s+apply", "says": "altera a infraestrutura em produção" }],
  "off": ["publish", "sudo"]
}
```

- `match` é uma expressão regular testada em cada comando do Bash e do PowerShell, sem diferenciar maiúsculas de minúsculas. `says` é o que esse comando faria, mostrado na pergunta; sem ele, a pergunta diz que o comando bate com uma das suas regras.
- `off` lista os tipos embutidos sobre os quais o escudo para de perguntar: qualquer chave de `danger` em [`hooks/lang/pt.ts`](hooks/lang/pt.ts) (`rm`, `forcePush`, `publish`, `sudo`…), `secret` ou um tipo dele (`secret:aws`, `secret:github`, `secret:apiKey`, `secret:slack`, `secret:stripe`, `secret:privateKey`, `secret:generic`), `secretFile` e `secretEdit`.
- O Mochi relê o arquivo sempre que ele muda, e avisa num toast. O que não der para usar é ignorado e citado; se o arquivo não for um JSON válido, nenhuma das suas regras vale até ele ser corrigido. Antes que o próprio Claude mude o arquivo, o escudo pergunta.

## 🔍 O painel de detalhes

Clique nos anéis e tudo se abre: esta sessão num relance, todos os chats da sua máquina, sua CI e seu pull request, e **cada arquivo alterado, com as linhas adicionadas e removidas**, os que o Claude mexeu neste chat no topo, e a própria última edição, em vermelho e verde.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/details-pt-dark.png">
  <img src="docs/details-pt-light.png" width="720" alt="O painel de detalhes: anéis de contexto e limites com previsão, os números desta sessão, outros chats e uma lista de arquivos alterados com a contagem de linhas e a última edição">
</picture>

Mais abaixo: o contexto por categoria, seus turnos recentes, um calendário com os dias de todos os chats, e seu nível, seu guarda-roupa e suas conquistas.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/history-pt-dark.png">
  <img src="docs/history-pt-light.png" width="720" alt="Um calendário dos últimos meses de trabalho, com os turnos de hoje, os últimos sete dias e seus dias seguidos">
</picture>

## 👒 Um guarda-roupa que cresce com você

Cada turno, edição, commit e dia de trabalho rende experiência. Os níveis liberam coisas para vestir: **46 itens** entre cabeça, rosto, pescoço, mão e o cantinho ao lado do Mochi. Alguns chegam com a data (chapéu de bruxa no fim de outubro, envelope vermelho no Ano-Novo Lunar, uma lamparina diya no Diwali, chapéu de festa e bolo no seu aniversário), outros com a hora (café de manhã, touca de dormir depois da meia-noite).

<p align="center">
  <img src="docs/wardrobe.png" width="840" alt="Doze Mochis com roupas diferentes: gorro com café, caubói de bigode, mago, chapéu de festa, coroa com monóculo e gato, touca de dormir com cachecol e mais">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/level-pt-dark.png">
  <img src="docs/level-pt-light.png" width="640" alt="O nível do Mochi: um anel de experiência, a experiência que falta para o próximo nível e o próximo item a ser liberado">
</picture>

Escolha o que vestir na seção **Guarda-roupa** do painel de detalhes, ou com `/mochi vestir óculos`. Conte ao Mochi quando é seu aniversário com `/mochi aniversário 04-23`; a data fica só na sua máquina. Tem uma ideia de algo novo para vestir? O [docs/OUTFITS.md](docs/OUTFITS.md) mostra como adicionar.

## 📸 Compartilhe

- **`/mochi cartão`** desenha um cartão: o Mochi com a roupa de hoje, seu nível, sua experiência e seus dias seguidos.
- **`/mochi retrospectiva`** resume o seu mês, somando todos os chats, numa só imagem: horas, turnos, commits, seu dia mais movimentado, sua maior sequência de dias e a pasta em que você passou mais tempo. `/mochi retrospectiva ano` faz a do ano. Na primeira semana de cada mês, o Mochi avisa uma vez que a do mês passado está pronta.
- **`/mochi captura`** salva a faixa e o painel de detalhes do jeito que estão agora. Dê uma olhada antes de postar: ela mostra o que a faixa mostra, inclusive seu branch. Os outros chats e as linhas da sua última edição ficam de fora.

São arquivos SVG em `~/.claude/mochi/share/`, feitos para ficar legíveis em páginas claras e escuras e sem depender de nada externo. O X e o Reddit só aceitam PNG: com o `rsvg-convert` ou o ImageMagick instalado, `/mochi captura` também salva um PNG de cada um.

Para colocar o cartão no seu perfil do GitHub:

1. Clone o repositório do seu perfil, aquele com o mesmo nome do seu usuário (`seu-usuario/seu-usuario`).
2. Rode `/mochi cartão ~/code/seu-usuario` com o caminho dessa pasta; o cartão vai parar lá como `mochi-card.svg`.
3. Cole a linha que o Mochi te passa no `README.md` do repositório, depois faça commit e push:

   ```md
   [![Mochi para Claude Code](mochi-card.svg)](https://github.com/oztrkemree/mochi)
   ```

O cartão é uma foto do momento: depois de subir de nível, rode `/mochi cartão` de novo e faça push do novo.

## ⌨️ Comandos

| Comando | O que faz |
| --- | --- |
| `/mochi` | Esconde ou mostra a faixa (`/mochi esconder` · `/mochi mostrar` dizem qual) |
| `/mochi detalhes` | Abre o painel de detalhes |
| `/mochi nível` | Seu nível, sua experiência e o que ainda está bloqueado |
| `/mochi vestir [item \| automático \| nenhum]` | Veste algo, deixa o Mochi se vestir sozinho ou tira tudo |
| `/mochi conquistas` | As conquistas que você já tem, e como ganhar as outras |
| `/mochi conversas` | Todos os chats desta máquina, primeiro os que estão esperando você |
| `/mochi escudo [ligar \| desligar]` | Diz se o escudo está ligado e mostra o que está sempre permitido e onde; `ligar` ou `desligar` o muda |
| `/mochi escudo redefinir` | Esquece tudo o que o “Sempre permitir aqui” guardou |
| `/mochi alertas` | Liga ou desliga as notificações (e o aviso de que sua retrospectiva está pronta) |
| `/mochi ci` | Liga ou desliga o acompanhamento de CI |
| `/mochi dicas` | Liga ou desliga as dicas, as sugestões para o `CLAUDE.md` e o aviso de novidades |
| `/mochi pausas` | Liga ou desliga a sugestão de alongamento |
| `/mochi som` | Liga ou desliga os sons |
| `/mochi extensões` | Liga ou desliga as reações de outros plugins |
| `/mochi cartão [caminho]` | Salva um cartão para o seu perfil do GitHub |
| `/mochi retrospectiva [ano]` | Salva o seu mês, ou o seu ano, numa só imagem |
| `/mochi captura` | Salva a faixa e o painel de detalhes como imagens |
| `/mochi apresentação` | Mostra de novo o tour da primeira vez |
| `/mochi novidades` | O que esta versão trouxe |
| `/mochi aniversário [MM-DD \| nenhum]` | Conta ao Mochi quando é seu aniversário, mostra a data salva ou a esquece |
| `/mochi idioma [código \| automático]` | Mostra ou troca o idioma |
| `/mochi pequeno` · `/mochi grande` | Uma linha ou tamanho completo |
| `/mochi exportar` | Salva tudo o que o Mochi guarda num único arquivo JSON |
| `/mochi redefinir [nível \| histórico \| tudo]` | Apaga a memória do nível, o histórico ou tudo, inclusive as configurações; pergunta antes, e as exportações e o seu `shield.json` ficam |
| `/mochi relatar` | Um link para um relato de bug, já preenchido com as versões, seu sistema, a interface e o idioma |
| `/mochi status` | O que o Mochi sabe neste momento |

Os comandos em inglês sempre funcionam também (`/mochi details`, `/mochi wear`, `/mochi badges`…), e cada idioma acrescenta os seus. Um comando que liga ou desliga algo alterna a cada vez; acrescente `ligar` ou `desligar` para fixar: `/mochi dicas desligar`.

## 🌍 Idiomas

English · Türkçe · Español · Deutsch · Français · Português · Русский · 中文 · 日本語 · 한국어 · Italiano · Polski · Українська · हिन्दी · Bahasa Indonesia · العربية

O Mochi fala o idioma da configuração `language` do Claude Code quando ela é um destes; senão, o idioma preferido do seu sistema, depois o `LANG`; e, se nada disso servir, inglês. Com `/mochi idioma pt` você mesmo escolhe, e `/mochi idioma automático` volta para o automático.

## 🔒 O que ele acessa

Tudo fica na sua máquina. O Mochi em si **não faz nenhuma requisição de rede**; a única coisa que fala com a internet é o seu próprio `gh`, para o acompanhamento de CI.

- **git**, na pasta do chat, só para ler: `git status`, `git log`, `git diff --numstat` e `git rev-parse` para a faixa e o painel de detalhes. Quando o escudo precisa olhar mais de perto, ele pergunta qual é o branch atual e o branch padrão, quais arquivos um `git add` adicionaria (`git ls-files`) e o que um `git commit` levaria (`git diff`).
- **gh**, só enquanto o acompanhamento de CI estiver ligado, com o seu próprio login (o Mochi nunca vê seu token): `gh pr view` quando um chat começa, quando você abre o painel de detalhes e em torno de um push; `gh run list` só depois de um push neste chat, a cada 30 segundos até as execuções terminarem, por meia hora no máximo. `/mochi ci` desliga os dois.
- **As ferramentas do próprio sistema**: notificações via `osascript` no macOS, PowerShell no Windows e `notify-send` no Linux. Para o idioma, `defaults read -g AppleLanguages` no macOS e `reg query` no Windows; `uname` distingue o macOS do Linux. Para os PNGs do `/mochi captura`, o `rsvg-convert` ou o `magick` do ImageMagick, se você tiver. Os arquivos de chats fechados, e o que o `/mochi redefinir` apaga, são removidos pelo nome com `rm`, ou com o `del` do `cmd` no Windows, e só dentro de `~/.claude/mochi/`.
- **Arquivos em `~/.claude/mochi/`**: em que pé está cada chat aberto, contagens diárias, seu nível e suas conquistas, leituras de uso para a previsão, quantas vezes cada dica apareceu e as instruções curtas que você repete (nunca prompts inteiros), os marcadores que dizem a um chat para avisar que um limite reiniciou, seu `shield.json` se você escrever um, e o que `/mochi cartão`, `retrospectiva`, `captura` e `exportar` salvam. As configurações, o que está sempre permitido e seu aniversário ficam no armazenamento do Claude Code para plugins.
- **Seu projeto**: o Mochi lê o `CLAUDE.md` antes de sugerir uma instrução e só acrescenta uma linha depois que você escolhe **Adicionar**. Ele só grava o cartão no projeto se você passar para o `/mochi cartão` um caminho lá dentro. Para contar linhas e detectar segredos, ele lê um arquivo que o Claude está prestes a sobrescrever e, num comando que adiciona e faz commit de uma vez, os arquivos novos que seriam adicionados (até 20, com menos de 1 MB cada). Nada do que ele lê é guardado.
- **Outros plugins** podem mostrar um humor e uma frase curta pelo Mochi, assinados com o nome deles, cada um no máximo uma vez a cada 10 segundos; `/mochi extensões` desliga isso. O `/mochi relatar` só mostra um link: nada é enviado.

## 🧩 Para autores de plugins

Seu plugin pode fazer o Mochi reagir: comemorar quando um deploy termina, ficar preocupado quando uma verificação falha. Coloque `mochi` em `dependencies` e chame `$.mochi.react({ mood, line })` ou `$.mochi.celebrate({ line })`. O [docs/API.md](docs/API.md) traz as chamadas, os limites e um plugin de exemplo completo.

## 🤝 Como contribuir

Relatos de bugs, ideias, traduções, arte e pull requests: tudo é bem-vindo. [Abra uma issue](https://github.com/oztrkemree/mochi/issues/new/choose) (o `/mochi relatar` te dá um relato de bug já preenchido) ou leia o [CONTRIBUTING.md](CONTRIBUTING.md) para começar a mexer no código: dois comandos verificam tudo (`claude plugin validate .` e `claude plugin test .`), e adicionar um idioma é um dicionário e poucas linhas. O que mudou em cada versão está no [CHANGELOG.md](CHANGELOG.md).

## 📄 Licença

[MIT](LICENSE). Use, modifique, compartilhe.

<p align="center"><sub>Feito com carinho por <a href="https://github.com/oztrkemree">Emre Öztürk</a> e Claude.</sub></p>
