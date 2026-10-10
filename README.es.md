<div align="center">

<img src="docs/hero.webp" width="240" alt="Mochi, una pequeña mascota de arcilla, saludando, pensando, leyendo, escribiendo, celebrando y quedándose dormido">

# Mochi

**Un pequeño amigo de arcilla para Claude Code.**<br>
Se sienta justo encima de tu prompt, reacciona a todo lo que hace Claude<br>
y mantiene a la vista esos números que no paras de mirar.

[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-E08A6A?style=flat-square)](LICENSE)
[![Plugin de Claude Code](https://img.shields.io/badge/Claude_Code-plugin-D97757?style=flat-square)](#-instalación)
[![16 idiomas](https://img.shields.io/badge/idiomas-16-7AA2F7?style=flat-square)](#-idiomas)
[![134 accesorios](https://img.shields.io/badge/armario-134_accesorios-B684F6?style=flat-square)](#-un-armario-que-crece-contigo)
[![PRs bienvenidos](https://img.shields.io/badge/PRs-bienvenidos-4CC38A?style=flat-square)](CONTRIBUTING.md)

[English](README.md) · [Türkçe](README.tr.md) · **Español** · [Deutsch](README.de.md) · [Français](README.fr.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

<br>

<p align="center">
  <img src="docs/demo.svg" width="744" alt="La franja de Mochi pasando por sus estados de ánimo y atuendos: saludando, leyendo, editando, ejecutando un comando, orgulloso, esperándote, celebrando y dormido">
</p>

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
> Mochi está construido sobre los módulos de hooks de Claude Code (hooks de función) y necesita **Claude Code 2.1.293 o posterior** (`claude --version` te dice cuál tienes). Las versiones anteriores, como la 2.1.286, no llegan a cargar el módulo, así que Mochi nunca aparece.

## 🧡 En qué se fija Mochi

<table>
<tr>
<td width="50%" valign="top">

**🎭 30 estados de ánimo, sin cortes bruscos**<br>
Pensando, leyendo, escribiendo código, ejecutando un comando, esperándote, celebrando unos tests en verde, mareado tras tres errores seguidos, durmiendo cuando no estás. Cada pose fluye con suavidad desde la anterior.

</td>
<td width="50%" valign="top">

**📊 Tus límites, con pronóstico**<br>
Anillos para la ventana de contexto, la sesión de 5 horas y la semana. Si gastas un límite más rápido de lo que se reinicia, Mochi te dice *cuándo* se agotará. Y cuando se reinicia un límite que tenías casi agotado, también te avisa.

</td>
</tr>
<tr>
<td valign="top">

**🛡️ Un escudo para los comandos que dan miedo**<br>
`rm -rf`, `Remove-Item -Recurse`, un force push a `main`, `git reset --hard`, `DROP TABLE`, un script de internet que va directo a la shell… se detienen y preguntan antes, explicando en palabras claras qué destruirían. Lo mismo pasa con una clave o un token a punto de escribirse o de entrar en un commit.

</td>
<td valign="top">

**🔁 Vigilancia de bucles**<br>
El mismo comando fallando tres veces, el mismo error que vuelve, la misma llamada que devuelve siempre lo mismo: Mochi se da cuenta antes que tu límite.

</td>
</tr>
<tr>
<td valign="top">

**🔔 Alertas mientras no estás**<br>
Una notificación del sistema (macOS, Windows o Linux) cuando termina un turno de más de dos minutos, cuando un trabajo largo se para a esperarte, cuando se reinicia tu límite o cuando falla la CI. Aprovecha para prepararte un té.

</td>
<td valign="top">

**💬 Todos los chats en un tablero**<br>
Cada chat de tu máquina, primero este y después los que te esperan, con su rama (los worktrees, marcados), qué está haciendo y desde hace cuánto. Si un chat lleva cinco minutos esperándote, te llega una notificación más.

</td>
</tr>
<tr>
<td valign="top">

**🚦 CI después de cada push**<br>
Mochi sigue las ejecuciones de GitHub Actions con tu propio `gh`: `ci en curso · 2/5` en la franja, una fiesta cuando pasan y el nombre del workflow que ha fallado cuando no. Entre ejecuciones, la franja muestra el pull request de tu rama, su revisión y sus checks; el panel de detalles lo muestra completo.

</td>
<td valign="top">

**💡 Consejos en el momento justo**<br>
De vez en cuando, mientras Mochi está en reposo, un consejo breve de Claude Code sobre lo que acaba de pasar: Esc Esc tras un turno detenido, `/compact` cuando el contexto se llena. Si das la misma instrucción por tercera vez, Mochi se ofrece a añadirla a `CLAUDE.md`; solo la escribe si eliges Añadir.

</td>
</tr>
<tr>
<td valign="top">

**🏅 Insignias por trabajo de verdad**<br>
Doce, y cada una se celebra una sola vez: los primeros tests en verde, una remontada en un solo turno, un día de limpieza en el que quitas más de lo que añades, búho nocturno, madrugador, políglota, un turno maratoniano, cien commits…

</td>
<td valign="top">

**🎉 Días especiales, pequeñas sorpresas**<br>
El Eid, el Año Nuevo Lunar, el Nouruz, Diwali, Chuseok, la temporada de sakura, Hacktoberfest, Halloween, Navidad y tu cumpleaños traen algo que ponerse. Dale las buenas noches a Mochi, o las gracias. Si llevas dos horas sin descansar, te propone estirar un poco.

</td>
</tr>
</table>

## 🛡️ El escudo

El escudo lee cada comando que ejecuta Claude, por Bash o por PowerShell, y cada edición que hace. Antes de cualquier cosa que no se pueda deshacer, se detiene y pregunta: borrar archivos y carpetas para siempre (`rm -rf`, `Remove-Item -Recurse`, `del /s`), borrar un disco entero, reescribir el historial de una rama, tirar los cambios sin commit, eliminar una base de datos, destruir infraestructura o un bucket en la nube, `npm unpublish`, `docker system prune -a`, un script de internet que va directo a la shell, `sudo`.

- **Los force push se juzgan según la rama.** Hacia `main`, `master`, `trunk` o `develop`, pregunta y nombra la rama. Hacia tu propia rama pregunta con una mirada nerviosa en vez de la alarma, y la nombra; un `--force-with-lease` allí solo se lleva la mirada.
- **Los secretos no entran en tu historial.** Antes de que Claude escriba, añada con `git add` o haga commit de algo que parezca una clave o un token reales (AWS, GitHub, Anthropic, OpenAI, Slack, Stripe, una clave privada, una contraseña) o de un archivo como `.env` o `id_rsa`, Mochi pregunta y muestra el valor enmascarado: `AKIA••••••LE`. Los marcadores de posición y los valores de prueba evidentes pasan sin preguntar.
- **Permitir siempre aquí.** La pregunta ofrece **Ejecutar** (o **Escribir**), **Detener** y **Permitir siempre aquí**, que recuerda ese tipo de comando para este repositorio. Vale para lo que se queda dentro de él: un comando o una edición que sale de él (`rm -rf ~`, un archivo de tu carpeta personal) vuelve a preguntar. `/mochi escudo` dice si el escudo está activo y muestra qué está permitido y dónde; `/mochi escudo restablecer` lo olvida todo.

Tus propias reglas van en `~/.claude/mochi/shield.json`:

```json
{
  "add": [{ "match": "terraform\\s+apply", "says": "modifica la infraestructura en producción" }],
  "off": ["publish", "sudo"]
}
```

- `match` es una expresión regular que se prueba con cada comando de Bash y de PowerShell, sin distinguir mayúsculas. `says` es lo que haría ese comando y aparece en la pregunta; si falta, la pregunta dice que coincide con una de tus reglas.
- `off` enumera los tipos incorporados por los que ya no quieres que pregunte: cualquier clave de `danger` en [`hooks/lang/es.ts`](hooks/lang/es.ts) (`rm`, `forcePush`, `publish`, `sudo`…), `secret` o uno de sus tipos (`secret:aws`, `secret:github`, `secret:apiKey`, `secret:slack`, `secret:stripe`, `secret:privateKey`, `secret:generic`), `secretFile` y `secretEdit`.
- Mochi vuelve a leer el archivo cada vez que cambia, y lo dice en un aviso. Lo que no puede usar se omite y lo nombra; si el archivo no es JSON válido, ninguna de tus reglas se aplica hasta que lo sea. Antes de que el propio Claude cambie el archivo, el escudo pregunta.

## 🔍 El panel de detalles

Haz clic en los anillos y todo se despliega: esta sesión de un vistazo, todos los chats de tu máquina, tu CI y tu pull request, y **cada archivo modificado con sus líneas añadidas y eliminadas**, primero los que Claude tocó en este chat, y la última edición tal cual, en rojo y verde.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/details-es-dark.png">
  <img src="docs/details-es-light.png" width="720" alt="El panel de detalles: anillos de contexto y límites con pronóstico, los números de esta sesión, otros chats y una lista de archivos modificados con el recuento de líneas y la última edición">
</picture>

Más abajo: el contexto por categoría, tus turnos recientes, un calendario con los días de todos tus chats, y tu nivel, tu armario y tus insignias.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/history-es-dark.png">
  <img src="docs/history-es-light.png" width="720" alt="Un calendario de los últimos meses de trabajo, con los turnos de hoy, los últimos siete días y tu racha">
</picture>

## 👒 Un armario que crece contigo

Cada turno, edición, commit y día de trabajo suma experiencia. Los niveles desbloquean cosas que ponerse: **134 accesorios** para la cabeza, la cara, el cuello, la mano y el hueco al lado de Mochi. Algunos llegan con el día (un sombrero de bruja a finales de octubre, un sobre rojo en el Año Nuevo Lunar, una lámpara diya en Diwali, un gorro de fiesta y un pastel en tu cumpleaños), otros con la hora (café por la mañana, gorro de dormir pasada la medianoche).

<p align="center">
  <img src="docs/wardrobe.png" width="840" alt="Doce Mochis con distintos atuendos: un gorro de lana con café, un vaquero con bigote, un mago, un gorro de fiesta, una corona con monóculo y un gato, un gorro de dormir con bufanda, y más">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/level-es-dark.png">
  <img src="docs/level-es-light.png" width="640" alt="El nivel de Mochi: un anillo de experiencia, la experiencia que falta para el siguiente nivel y el próximo accesorio por desbloquear">
</picture>

Elige qué ponerle en la sección **Armario** del panel de detalles, o con `/mochi poner gafas`. Dile a Mochi cuándo es tu cumpleaños con `/mochi cumpleaños 04-23`; el dato no sale de tu máquina. ¿Se te ocurre algo nuevo que ponerle? [docs/OUTFITS.md](docs/OUTFITS.md) explica cómo añadirlo.

## 📸 Compártelo

- **`/mochi tarjeta`** dibuja una tarjeta: Mochi con el atuendo de hoy, tu nivel, tu experiencia y tus rachas.
- **`/mochi resumen`** resume tu mes, en todos tus chats, en una sola imagen: horas, turnos, commits, tu día más activo, tu racha más larga y la carpeta en la que más tiempo pasaste. `/mochi resumen año` hace lo mismo con el año. En la primera semana de cada mes, Mochi te avisa una vez de que el del mes anterior ya está listo.
- **`/mochi captura`** guarda la franja y el panel de detalles tal como están ahora mismo. Échale un vistazo antes de publicarla: muestra lo mismo que la franja, incluida tu rama. Tus otros chats y las líneas de tu última edición se quedan fuera.

Son archivos SVG en `~/.claude/mochi/share/`, pensados para verse bien en páginas claras y oscuras, y no dependen de nada externo. X y Reddit solo aceptan PNG: con `rsvg-convert` o ImageMagick instalado, `/mochi captura` guarda también un PNG de cada uno.

Para poner la tarjeta en tu perfil de GitHub:

1. Clona el repositorio de tu perfil, el que se llama como tu usuario (`tu-usuario/tu-usuario`).
2. Ejecuta `/mochi tarjeta ~/code/tu-usuario` con la ruta de esa carpeta; la tarjeta se guarda ahí como `mochi-card.svg`.
3. Pega en el `README.md` del repositorio la línea que te da Mochi, y luego haz commit y push:

   ```md
   [![Mochi for Claude Code](mochi-card.svg)](https://github.com/oztrkemree/mochi)
   ```

La tarjeta es una instantánea: cuando subas de nivel, vuelve a ejecutar `/mochi tarjeta` y haz push de la nueva.

## ⌨️ Comandos

| Comando | Qué hace |
| --- | --- |
| `/mochi` | Oculta o muestra la franja (o elige tú con `/mochi ocultar` · `/mochi mostrar`) |
| `/mochi detalles` | Abre el panel de detalles |
| `/mochi nivel` | Tu nivel, tu experiencia y lo que aún está bloqueado |
| `/mochi poner [accesorio \| automático \| nada]` | Ponle algo, deja que Mochi se vista solo o quítale todo |
| `/mochi insignias` | Las insignias que has ganado y cómo conseguir las demás |
| `/mochi conversaciones` | Todos los chats de esta máquina, primero los que te esperan |
| `/mochi escudo [activar \| desactivar]` | Dice si el escudo está activo y qué está siempre permitido y dónde; `activar` o `desactivar` lo cambia |
| `/mochi escudo restablecer` | Olvida todo lo que recordó «Permitir siempre aquí» |
| `/mochi alertas` | Activa o desactiva las notificaciones (y el aviso de que tu resumen está listo) |
| `/mochi ci` | Activa o desactiva la vigilancia de CI |
| `/mochi consejos` | Activa o desactiva los consejos, las sugerencias para `CLAUDE.md` y la nota de novedades |
| `/mochi pausas` | Activa o desactiva la sugerencia de estirarte |
| `/mochi sonido` | Activa o desactiva los sonidos |
| `/mochi complementos` | Activa o desactiva las reacciones de otros plugins |
| `/mochi tarjeta [ruta]` | Guarda una tarjeta para tu perfil de GitHub |
| `/mochi resumen [año]` | Guarda tu mes, o tu año, en una sola imagen |
| `/mochi captura` | Guarda la franja y el panel de detalles como imágenes |
| `/mochi recorrido` | Vuelve a ver el recorrido de bienvenida |
| `/mochi novedades` | Lo que trae esta versión |
| `/mochi cumpleaños [MM-DD \| nada]` | Dile a Mochi tu cumpleaños, consúltalo u olvídalo |
| `/mochi idioma [código \| automático]` | Muestra o cambia el idioma |
| `/mochi pequeño` · `/mochi grande` | Una línea o tamaño completo |
| `/mochi exportar` | Guarda todo lo que conserva Mochi en un solo archivo JSON |
| `/mochi restablecer [nivel \| historial \| todo]` | Borra la memoria del nivel, el historial o todo, ajustes incluidos; pregunta antes, y las exportaciones y tu `shield.json` se conservan |
| `/mochi comentarios` | Un enlace a un informe de error, ya relleno con las versiones, tu sistema, la interfaz y el idioma |
| `/mochi estado` | Lo que Mochi sabe ahora mismo |

Las palabras en inglés siempre funcionan (`/mochi details`, `/mochi wear`, `/mochi lang`…), y cada idioma añade las suyas, como las de esta tabla. Un comando que activa o desactiva algo lo cambia cada vez; añade `activar` o `desactivar` para fijarlo: `/mochi consejos desactivar`.

## 🌍 Idiomas

English · Türkçe · Español · Deutsch · Français · Português · Русский · 中文 · 日本語 · 한국어 · Italiano · Polski · Українська · हिन्दी · Bahasa Indonesia · العربية

Mochi habla el idioma del ajuste `language` de Claude Code si es uno de estos; si no, el idioma preferido de tu sistema y luego `LANG`; y si nada encaja, inglés. Con `/mochi idioma es` eliges uno tú mismo, y con `/mochi idioma automático` vuelves al modo automático.

## 🔒 Qué toca

Todo se queda en tu máquina. Mochi en sí **no hace ninguna petición de red**; lo único que habla con internet es tu propio `gh`, para la vigilancia de CI.

- **git**, en la carpeta del chat y solo para leer: `git status`, `git log`, `git diff --numstat` y `git rev-parse` para la franja y el panel de detalles. Cuando el escudo necesita mirar más de cerca, consulta la rama y la rama por defecto, los archivos que añadiría un `git add` (`git ls-files`) y lo que entraría en un `git commit` (`git diff`).
- **gh**, solo mientras la vigilancia de CI está activada y con tu propia sesión (Mochi nunca ve tu token): `gh pr view` cuando empieza un chat, cuando abres el panel de detalles y en torno a un push; `gh run list` solo después de un push en este chat, cada 30 segundos hasta que terminan las ejecuciones, media hora como mucho. `/mochi ci` desactiva los dos.
- **Las herramientas del propio sistema**: notificaciones con `osascript` en macOS, PowerShell en Windows y `notify-send` en Linux. Para el idioma, `defaults read -g AppleLanguages` en macOS y `reg query` en Windows; `uname` distingue macOS de Linux. Para los PNG de `/mochi captura`, `rsvg-convert` o el `magick` de ImageMagick, si lo tienes. Los archivos de los chats cerrados, y lo que borra `/mochi restablecer`, se eliminan por nombre con `rm`, o con el `del` de `cmd` en Windows, y solo dentro de `~/.claude/mochi/`.
- **Archivos en `~/.claude/mochi/`**: cómo va cada chat abierto, recuentos diarios, tu nivel y tus insignias, lecturas de uso para el pronóstico, cuántas veces se ha mostrado cada consejo y las instrucciones cortas que repites (nunca prompts enteros), las marcas que le indican a un chat que anuncie el reinicio de un límite, tu `shield.json` si escribes uno, y lo que guardan `/mochi tarjeta`, `resumen`, `captura` y `exportar`. Los ajustes, lo que está siempre permitido y tu cumpleaños se guardan en el almacén que Claude Code reserva a los plugins.
- **Tu proyecto**: Mochi lee `CLAUDE.md` antes de sugerir una instrucción y solo añade una línea después de que elijas **Añadir**. Solo guarda ahí la tarjeta si le das a `/mochi tarjeta` una ruta dentro del proyecto. Para contar líneas y detectar secretos, lee el archivo que Claude está a punto de sobrescribir y, si un comando añade y hace commit a la vez, los archivos nuevos que añadiría (hasta 20, de menos de 1 MB cada uno). No conserva nada de lo que lee.
- **Otros plugins** pueden mostrar un estado de ánimo y una frase corta a través de Mochi, firmados con su nombre, cada uno como mucho una vez cada 10 segundos; `/mochi complementos` lo desactiva. `/mochi comentarios` solo muestra un enlace: no se envía nada.

## 🧩 Para autores de plugins

Tu plugin puede hacer que Mochi reaccione: que aplauda cuando termina un despliegue o que ponga cara de preocupación cuando falla un check. Añade `mochi` en `dependencies` y llama a `$.mochi.react({ mood, line })` o a `$.mochi.celebrate({ line })`. En [docs/API.md](docs/API.md) tienes las llamadas, los límites y un plugin de ejemplo completo.

## 🤝 Contribuir

Informes de errores, ideas, traducciones, ilustraciones y pull requests: todo es bienvenido. [Abre un issue](https://github.com/oztrkemree/mochi/issues/new/choose) (`/mochi comentarios` te da un informe de error ya relleno) o lee [CONTRIBUTING.md](CONTRIBUTING.md) para meterte con el código: dos comandos lo comprueban todo (`claude plugin validate .` y `claude plugin test .`), y añadir un idioma es un diccionario y unas pocas líneas. Los cambios de cada versión están en [CHANGELOG.md](CHANGELOG.md).

## 📄 Licencia

[MIT](LICENSE). Úsalo, cámbialo, compártelo.

<p align="center"><sub>Hecho con cariño por <a href="https://github.com/oztrkemree">Emre Öztürk</a> y Claude.</sub></p>
