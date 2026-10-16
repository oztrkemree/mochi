# Mochi yüz aksesuarı promptları (ChatGPT'ye elle)

## Nasıl kullanılır

1. Yeni bir ChatGPT sohbeti aç (görsel üretebilen model).
2. `mochi-reference-magenta.png` dosyasını ekle (aynı klasörde). Bu, magenta zeminli, 500×500 Mochi.
3. Aşağıdaki **ORTAK KURALLAR** metnini yapıştır, hemen altına tek bir **AKSESUAR** bloğunu ekle, gönder.
4. Bir seferde **tek aksesuar** iste (12'li sayfa isteme, uyum bozuluyor).
5. Çıkan görselde şunlara bak: Mochi'nin kendi pikselleri yok mu, gülümseme kapalı değil mi, yer doğru mu. Olmadıysa "aynı tuvalde, aynı konumda, Mochi hiç çizilmesin" diye düzelttir.
6. Sonucu bana ver: arka planı temizleyip Mochi üzerine bindirip kontrol ederim, sonra koda eklerim. (Arka plan magenta ise ben şeffafa çeviririm; ChatGPT şeffaf verirse daha iyi.)

Koordinatlar 500×500 tuvalde: gözler yaklaşık (200,260) ve (300,260), gülümseme (250,315).

---

## ORTAK KURALLAR (her seferinde bunu yapıştır)

```
MOCHI ACCESSORY PRODUCTION RULES.
You are creating a wearable 2D sprite layer for an existing, fixed, front-facing character called Mochi. The attached PNG is the exact character reference (Mochi on a flat magenta background, 500 by 500 pixels). Mochi has two round black eyes at roughly 40 percent and 60 percent of the width and 52 percent of the height, and a small smile at the middle, 63 percent of the height.

CRITICAL: DO NOT DESIGN A STANDALONE ACCESSORY OBJECT. The goal is NOT to draw a complete object as a product. The goal is to create ONLY the visible pixels of the accessory after it has already been equipped on Mochi.

Workflow:
1. Use the attached Mochi PNG as the exact reference for position, scale and proportions.
2. Visualize the accessory being worn naturally on Mochi's face, following the rounded front of Mochi's head.
3. Determine exactly which pixels of the accessory are visible to the front-facing camera.
4. Remove every accessory portion that would be hidden behind Mochi's head or body.
5. Output ONLY those visible accessory pixels, in the SAME 500 by 500 canvas, at the SAME position and scale as in the reference, on a flat pure magenta (#FF00FF) background.
6. Do NOT include any pixels belonging to Mochi: no head, no body, no eyes, no mouth, no arms, no feet, no shadow. Where Mochi would be seen (and where lenses are clear), leave flat magenta so the original Mochi shows through when the layer is overlaid.
7. The layer will be overlaid on the unchanged original Mochi PNG to verify the fit, so every part of the accessory must sit exactly where it would touch Mochi's face and follow its curve.

Scale warning: Mochi's two eyes are only about 100 pixels apart in the 500 pixel canvas (x 200 and x 300), and the whole face is about 250 pixels wide. Anything that goes over the eyes must be sized to the reference, each lens centered exactly on one eye and only about 80 pixels wide.

Strict perspective rules: Mochi never rotates. The camera is permanently front-facing. Never show rear straps, the inside of loops, or complete 3D loops that would be hidden by Mochi. Never render the accessory as a product photograph. Do not invent character body parts or support geometry. Do not change Mochi and never cover Mochi's smile.

Style: soft matte clay / plasticine 3D look, chunky rounded forms, lit from the top left, thin dark brown (#2B1B17) edge feel, same material as Mochi. No text, no logos, no cast shadow, no gradient background, one flat magenta (#FF00FF) background everywhere.

FINAL RULE: design from the worn appearance backward, never from the standalone object forward.

Generate only ONE accessory, the one described below:
```

---

## AKSESUAR blokları (birini seç, ortak kuralların altına ekle)

### Gözlükler

**starglasses**
```
The accessory is a pair of gold star-shaped party glasses: thick glossy gold frames, two stars centered on the two eyes, clear lenses (lens areas left as flat magenta so Mochi's eyes show through), short temple arms along the sides of the head.
```

**cinema3d**
```
The accessory is a pair of retro paper-and-plastic 3D movie glasses: a white cardboard-look rectangular frame, the left lens solid saturated red and the right lens solid saturated cyan, temple arms going back along the sides of the head. The lenses sit over the two eyes.
```

**nerdglasses**
```
The accessory is a pair of big thick black rectangular nerd glasses with a small piece of white tape wrapped around the nose bridge, clear lenses (left as flat magenta), short temple arms along the sides of the head.
```

**visor**
```
The accessory is a sporty one-piece wraparound visor shield in glossy translucent blue (drawn as a solid mid-blue with a small white highlight), wide and curved to follow the front of the head, covering both eyes.
```

### Burun / yanak

**clownnose**
```
The accessory is a round glossy red clown nose with one small white highlight, small (about 40 pixels wide in the 500 px canvas), sitting in the middle of the face between the eyes and the smile, slightly above the smile.
```

**catwhiskers**
```
The accessory is three thin dark-brown whiskers on each cheek (a left group and a right group, fanning outward from near the corners of the smile), plus a tiny pink triangular cat nose in the middle, between the eyes and the smile. Nothing touches the eyes or the smile.
```

**plaster**
```
The accessory is a tan/peach adhesive bandage plaster stuck diagonally on Mochi's right cheek (the viewer's right), with a small white square pad in the middle and tiny perforation dots. About 70 pixels long.
```

**freckles**
```
The accessory is a scatter of small chocolate-brown freckle dots across both cheeks and the nose bridge, painted on the surface of the face, never touching the eyes or the smile.
```

### Kaş / diş

**bushybrows**
```
The accessory is a pair of thick, bushy dark-brown clay eyebrows, a little comic, slightly angled, sitting just above Mochi's eyes (about 20 pixels above them in the 500 px canvas) and not touching the eyes.
```

**eyelashes**
```
The accessory is long curled black eyelashes: three upward-curled lashes on the outer upper corner of each eye, drawn as thick clay strokes around the top outer edge of each eye. The eyes themselves are Mochi's own pixels and are not drawn.
```

**sideburns**
```
The accessory is a pair of thick dark-brown mutton-chop sideburns on the left and right sides of the face, running down the cheeks from the upper side of the head to near the corners of the mouth, hugging the side edges of the face. The eyes and the smile stay completely free.
```

**fangs**
```
The accessory is two small white pointed vampire fangs hanging down from the two ends of Mochi's smile (one at each corner of the smile, at about x 225 and 275, y 318 in the 500 px canvas), with a tiny dark outline. The smile line itself is Mochi's own and is not drawn.
```

### Çıkartma / boya

**blush**
```
The accessory is two soft rosy-pink oval blush marks on the cheeks (centers at about x 155 and 345, y 300 in the 500 px canvas, each about 55 pixels wide) with three short slanted darker-pink hatch lines inside each, in glossy clay style.
```

**starsticker**
```
The accessory is a small glossy golden-yellow star sticker with tiny sparkle strokes around it, stuck on Mochi's right cheek (viewer's right, around x 340, y 295), about 50 pixels wide.
```

**warpaint**
```
The accessory is bold blue clay face-paint stripes: a pair of parallel slanted stripes under the left eye and a mirrored pair under the right eye, each about 60 pixels long, painted on the surface of the face just below the eyes, not touching the eyes and not reaching the smile.
```

**teardrop**
```
The accessory is a single glossy light-blue comic teardrop sliding down from the lower edge of Mochi's left eye (the viewer's left eye, at about x 200, y 260) onto the cheek, about 25 pixels wide and 40 pixels tall, with a small white highlight.
```

---

## Şapka için (ihtiyaç olursa)

Ortak kuralların "Mochi's face" geçen yerini "the top of Mochi's rounded head" yap, 6. maddeden "lenses" kısmını sil ve şapka tarifini aksesuar bloğu olarak ekle, örnek:

```
The accessory is a classic black bowler (derby) hat with a thin dark red band, sitting level and slightly tilted to the left on top of the head. Its brim is short and curves around the head top.
```

