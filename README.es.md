<div align="center">

<img src="docs/hero.webp" width="240" alt="Mochi, una pequeña mascota de arcilla, saludando, pensando, leyendo, escribiendo, celebrando y quedándose dormido">

# Mochi

**Un pequeño amigo de arcilla para Claude Code.**<br>
Se sienta justo encima de tu prompt, reacciona a todo lo que hace Claude<br>
y mantiene a la vista esos números que no paras de mirar.

[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-E08A6A?style=flat-square)](LICENSE)
[![Plugin de Claude Code](https://img.shields.io/badge/Claude_Code-plugin-D97757?style=flat-square)](#-instalación)
[![10 idiomas](https://img.shields.io/badge/idiomas-10-7AA2F7?style=flat-square)](#-idiomas)
[![36 accesorios](https://img.shields.io/badge/armario-36_accesorios-B794F6?style=flat-square)](#-un-armario-que-crece-contigo)
[![PRs bienvenidos](https://img.shields.io/badge/PRs-bienvenidos-4CC38A?style=flat-square)](CONTRIBUTING.md)

[English](README.md) · [Türkçe](README.tr.md) · **Español** · [Deutsch](README.de.md) · [Français](README.fr.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

<br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/band-es-dark.png">
  <img src="docs/band-es-light.png" alt="La franja de Mochi sobre el prompt: editando checkout.tsx, las últimas llamadas a herramientas, la rama, otro chat esperando y anillos para el contexto, la sesión de 5 horas y la semana">
</picture>

<p align="center"><sub>Todo de un vistazo: qué está haciendo Claude ahora mismo, las últimas llamadas a herramientas, tu rama, otro chat que te necesita y cuánto se han llenado tu contexto, tu sesión y tu semana.</sub></p>

## ✨ Instalación

```
/plugin install mochi --marketplace oztrkemree/mochi
```

Escríbelo en cualquier chat de Claude Code, responde `y` para añadir el marketplace y elige el ámbito **user**. Mochi aparece al instante, y también en cada chat que abras a partir de ahí.

> [!NOTE]
> Mochi está construido sobre los módulos de hooks de Claude Code (hooks de función), así que necesita una versión de Claude Code que los admita.

## 🧡 En qué se fija Mochi

<table>
<tr>
<td width="50%" valign="top">

**🎭 27 estados de ánimo, sin cortes bruscos**<br>
Pensando, leyendo, escribiendo código, ejecutando un comando, esperándote, celebrando unos tests en verde, mareado tras tres errores seguidos, durmiendo cuando no estás. Cada pose fluye con suavidad desde la anterior.

</td>
<td width="50%" valign="top">

**📊 Tus límites, con pronóstico**<br>
Anillos para la ventana de contexto, la sesión de 5 horas y la semana. Si gastas un límite más rápido de lo que se reinicia, Mochi te dice *cuándo* se agotará.

</td>
</tr>
<tr>
<td valign="top">

**🛡️ Un escudo para los comandos que dan miedo**<br>
`rm -rf`, `git push --force`, `git reset --hard`, `DROP TABLE`, `npm publish`, `sudo`… se detienen y preguntan antes, explicando en palabras claras qué destruirían.

</td>
<td valign="top">

**🔁 Vigilancia de bucles**<br>
El mismo comando fallando tres veces, el mismo error que vuelve, la misma llamada que devuelve siempre lo mismo: Mochi se da cuenta antes que tu límite.

</td>
</tr>
<tr>
<td valign="top">

**🔔 Alertas de trabajos largos**<br>
Una notificación de macOS cuando termina un turno de más de dos minutos, o cuando un trabajo largo se para a esperar tu aprobación. Aprovecha para prepararte un café.

</td>
<td valign="top">

**💬 Tus otros chats**<br>
Cada chat de tu equipo que tiene Mochi comparte cómo va, así que este puede avisarte de que otro te está esperando o ya ha terminado.

</td>
</tr>
</table>

## 🔍 El panel de detalles

Haz clic en los anillos y todo se despliega: esta sesión de un vistazo, tus otros chats y **cada archivo modificado con sus líneas añadidas y eliminadas**, primero los que Claude tocó en este chat, y la última edición tal cual, en rojo y verde.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/details-es-dark.png">
  <img src="docs/details-es-light.png" width="720" alt="El panel de detalles: anillos de contexto y límites con pronóstico, los números de esta sesión, otros chats y una lista de archivos modificados con el recuento de líneas y la última edición">
</picture>

Más abajo: el contexto por categoría, tus turnos recientes y un calendario con los días de todos tus chats.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/history-es-dark.png">
  <img src="docs/history-es-light.png" width="720" alt="Un calendario de los últimos meses de trabajo, con los turnos de hoy, los últimos siete días y tu racha">
</picture>

## 👒 Un armario que crece contigo

Cada turno, edición, commit y día de trabajo suma experiencia. Los niveles desbloquean cosas que ponerse: **36 accesorios** para la cabeza, la cara, el cuello, la mano y el hueco al lado de Mochi. Algunos llegan con la temporada (un sombrero de bruja a finales de octubre, un gorro de Papá Noel en diciembre), otros con la hora (café por la mañana, gorro de dormir pasada la medianoche).

<p align="center">
  <img src="docs/wardrobe.png" width="840" alt="Doce Mochis con distintos atuendos: un gorro de lana con café, un vaquero con bigote, un mago, un gorro de fiesta, una corona con monóculo y un gato, un gorro de dormir con bufanda, y más">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/level-es-dark.png">
  <img src="docs/level-es-light.png" width="640" alt="El nivel de Mochi: un anillo de experiencia, la experiencia que falta para el siguiente nivel y el próximo accesorio por desbloquear">
</picture>

Elige qué ponerle en la sección **Armario** del panel de detalles, o con `/mochi poner gafas`.

## ⌨️ Comandos

| Comando | Qué hace |
| --- | --- |
| `/mochi` | Oculta o muestra la franja |
| `/mochi detalles` | Abre el panel de detalles |
| `/mochi nivel` | Tu nivel, tu experiencia y lo que aún está bloqueado |
| `/mochi poner [accesorio \| automático \| nada]` | Ponle algo, deja que Mochi se vista solo o quítale todo |
| `/mochi escudo` | Activa o desactiva el escudo |
| `/mochi alertas` | Activa o desactiva las alertas de trabajos largos |
| `/mochi sonido` | Activa o desactiva los sonidos |
| `/mochi idioma [código \| automático]` | Muestra o cambia el idioma |
| `/mochi pequeño` · `/mochi grande` | Una línea o tamaño completo |
| `/mochi estado` | Lo que Mochi sabe ahora mismo |

Los comandos en inglés siempre funcionan (`/mochi details`, `/mochi wear`, `/mochi lang`…).

## 🌍 Idiomas

English · Türkçe · Español · Deutsch · Français · Português · Русский · 中文 · 日本語 · 한국어

Mochi habla el idioma del ajuste `language` de Claude Code si es uno de estos; si no, el idioma preferido de tu sistema y luego `LANG`; y si nada encaja, inglés. Con `/mochi idioma es` eliges uno tú mismo, y con `/mochi idioma automático` vuelves al modo automático.

## 🔒 Qué toca

Todo se queda en tu equipo. Mochi **no hace ninguna petición de red**.

- Lee `git status`, `git log` y `git diff --numstat` en la carpeta del chat.
- En macOS ejecuta `osascript` para las notificaciones y `defaults read -g AppleLanguages` para el idioma; en todas partes, `date +%z` para la hora local.
- Escribe pequeños archivos JSON en `~/.claude/mochi/`: cómo va cada chat abierto, recuentos diarios, tu nivel y lecturas de uso para el pronóstico.

## 🤝 Contribuir

Informes de errores, ideas, traducciones, ilustraciones y pull requests: todo es bienvenido. [Abre un issue](https://github.com/oztrkemree/mochi/issues/new/choose) o lee [CONTRIBUTING.md](CONTRIBUTING.md) para meterte con el código: dos comandos lo comprueban todo (`claude plugin validate .` y `claude plugin test .`), y un idioma nuevo es un solo archivo.

## 📄 Licencia

[MIT](LICENSE). Úsalo, cámbialo, compártelo.

<p align="center"><sub>Hecho con cariño por <a href="https://github.com/oztrkemree">Emre Öztürk</a> y Claude.</sub></p>
