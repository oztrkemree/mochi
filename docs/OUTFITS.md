# Adding something for Mochi to wear

Mochi's wardrobe is 134 items in five slots. A new one touches a handful of places, and a test checks that none is missed: an item without a slot, art, a place on the drawing, a way to get it or a name in every language fails `claude plugin test .`.

Have an idea but no art? Open an **Outfit idea** issue instead; someone may draw it.

## 1. Pick an id and a slot

- **Id**: one short lowercase English word, letters only (`beret`, `sombrero`, `headset`). It is saved in people's settings, so it never changes once released. It must not be an id in use, nor a key of `OLD_IDS` in `hooks/level.ts` (older versions' Turkish ids).
- **Slot**: `head`, `face`, `neck`, `held` (in the right hand) or `ground` (standing beside Mochi). One item, one slot.

Add the id to the `Item` type in `types/index.d.ts`, on the line of its slot, and to that slot's list in `SLOT_ITEMS` in `hooks/level.ts`. The list's order is the wardrobe's order: roughly the order things unlock.

## 2. Art

Every item has a picture in `WEAR` in `hooks/wear.ts`, lines in `VECTOR_WEAR` in `hooks/rig.ts`, or both.

A picture is `{ w, h, uri }`, a WebP data URI and its size in pixels. The drawing and the wardrobe's buttons both use it.

- Transparent background, cropped tight, 40 to 90 pixels on its longer side.
- The look of the rest: soft clay, lit from the top left, a dark brown edge (`#2B1B17`) rather than black, no text, no logos, no brands.
- To make the data URI from a PNG: `cwebp -q 90 -alpha_q 100 item.png -o item.webp`, then `base64 -w0 item.webp` (on macOS `base64 -i item.webp`), and put `data:image/webp;base64,` before it.

Thin things that vanish as a picture at band size (a wire frame, a chain), and simple shapes in the same clay look (the sakura sprig, the cake), are drawn as lines instead, in `VECTOR_WEAR`:

- `svg`: the markup, in the drawing's own 100×100 coordinates (see below). Give any `id` inside it a prefix of the item's id (`scarfP`), so it never clashes.
- `box`: `[x, y, width, height]`, the part of the drawing the wardrobe button shows.
- `onSkin: true` when it reads only on Mochi's clay (glasses): the button puts a patch of clay behind it.

An item with both is drawn as lines, and its picture shows in the details pane beside the next unlock.

## 3. Where it sits

`WEAR_AT` in `hooks/rig.ts` places the picture: `{ x, y, w }` is its center and width in the drawing's 100×100 frame; the height follows from the picture.

| Option | What it does |
| --- | --- |
| `r` | Tilt in degrees around the center. Most hats lean left, −9 to −20, their center left of the middle (x 36 to 42); straight ones sit at x 50. |
| `flip: true` | Mirrors the picture (the duck looks at Mochi). |
| `ground: true` | Stands beside Mochi and casts the same soft shadow. |

Landmarks in the frame:

| Where | x, y |
| --- | --- |
| The body | x 21 to 79, y 31 to 81; its middle is x 50 |
| Top of the head | y ≈ 30 |
| The eyes | (40, 52) and (60, 52) |
| The mouth | (50, 60) |
| The collar | y 73 to 78 |
| The right hand | (82, 69) |
| Beside, on the ground | x ≈ 12, bottom at y ≈ 88 |

Look at your neighbours in the same slot: a new hat starts from `beanie` or `cowboy`, a new held thing from `mug`. Things in the hand are left out while a pose uses that hand, and things on the ground make way for the first helper when a subagent runs.

## 4. How to get it

At least one of:

- **Earned**: one entry in `UNLOCKS` in `hooks/level.ts`, by `level` or by a habit: `turns`, `days` (active days), `streak` (days in a row), `commits`, `edits` or `night` (turns between midnight and 5 am). Keep levels spread out: two items per level at most.
- **Worn on a day**: the item under its occasion in `DRESS` in the same file (`halloween: { head: 'witchhat', ground: 'pumpkin' }`), worn by the date alone. The occasions and their dates are `RULES` in `hooks/fun.ts`; a new one needs its dates there, and its greeting (`fun.greet`) and hint (`item.hint`) in every language.

An item can be both: the party hat is earned with 50 commits and also worn on a birthday and at New Year.

To have Mochi put it on by itself once earned (as it does the best hat), add it to `HEAD_RANK` or `NECK_RANK` there. Otherwise people choose it in the wardrobe or with `/mochi wear <name>`.

## 5. Names in every language

Every file in `hooks/lang/` has the item under `item.name` (its full name, lower case: `cowboy hat`) and `item.short` (one word for the wardrobe's buttons: `cowboy`). Every language needs both. Keep Chinese, Japanese and Korean names short: each character takes two columns. If you do not speak one of them, write your best guess and say so in the pull request.

## 6. In the terminal

The terminal draws Mochi in characters. A **head** item needs its row there: `ASCII_HAT` in `hooks/level.ts`, exactly five cells (`' ▄█▄ '`). Other slots have no characters.

## 7. See it

**On the drawing, offline.** Put this in `tests/preview.test.ts` (with your id), run the tests, and open the page it prints:

```ts
import { test } from 'claude-code/testing'
import { svgFor } from '../hooks/rig'

declare const console: { log: (text: string) => void }

test('preview', () => {
  const outfit = { head: 'beret', face: null, neck: null, held: null, ground: null } as const
  const moods = ['idle', 'wave', 'thinking', 'writing', 'party', 'sleeping'] as const
  const cells = moods.map(mood => `<div style="width:220px;height:220px">${svgFor({ mood, scene: { context: -1, agents: 0, outfit }, from: null }, 2000)}</div>`)
  console.log(`PREVIEW <body style="display:flex;flex-wrap:wrap;background:#f4efe9">${cells.join('')}</body>`)
})
```

```
claude plugin test . | grep PREVIEW | cut -c9- > preview.html
```

Delete `tests/preview.test.ts` and `preview.html` before you commit.

**In Claude Code.** Load your copy of Mochi as [CONTRIBUTING.md](../CONTRIBUTING.md) describes, give the item `level: 1` for a moment, and put it on with `/mochi wear <name>`; `/mochi details` shows the wardrobe with its button. Set the real unlock back afterwards.

## 8. Check and send

```
claude plugin validate .
claude plugin test .
```

The test "every item has art, a place, a slot, a way to get it and a name in every language" (`tests/data.test.ts`) names the item and what it lacks. Then open a pull request with a screenshot of the preview, and say where the art comes from: only art you made, or may share under the project's MIT license.
