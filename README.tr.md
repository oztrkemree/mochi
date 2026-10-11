<div align="center">

<img src="docs/hero.webp" width="260" alt="Kilden küçük bir maskot olan Mochi: el sallıyor, düşünüyor, okuyor, yazıyor, kutluyor ve uyuyakalıyor">

# Mochi

### Claude Code'un yazı alanının hemen üstünde yaşayan kilden küçük bir arkadaş.

Claude'un yaptığı her şeye tepki verir, sonradan pişman olacağın komutları durdurur,<br>
context'ini, oturum ve haftalık limitlerini de hep göz önünde tutar.

[![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-E08A6A?style=for-the-badge)](LICENSE)
[![Claude Code eklentisi](https://img.shields.io/badge/Claude_Code-eklenti-D97757?style=for-the-badge)](#-10-saniyede-kurulum)
[![16 dil](https://img.shields.io/badge/dil-16-7AA2F7?style=for-the-badge)](#-16-dil)
[![133 aksesuar](https://img.shields.io/badge/gardırop-133_parça-B684F6?style=for-the-badge)](#-seninle-büyüyen-bir-gardırop)
[![Ağ yok](https://img.shields.io/badge/ağ-yok-4CC38A?style=for-the-badge)](#-neye-dokunur)

[English](README.md) · **Türkçe** · [Español](README.es.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Português](README.pt.md) · [Русский](README.ru.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

<br>

<img src="docs/gif/session.webp" width="760" alt="Bir Claude Code sohbeti: karanlık mod düğmesi istiyorsun; bereli ve kahveli Mochi düşünüyor, okuyor, arıyor, düzenliyor, testleri çalıştırıyor, ikisi kalınca başı dönüyor, yeniden düzenliyor, 48'i geçince kutluyor ve turun süresi, araçları ve düzenlemeleriyle gururla bitiriyor; bu arada context, oturum ve hafta halkaları doluyor">

<sub>Gerçek bir tur. Buradaki her yüz ve her satır Mochi'nin kendi çizim ve tepki kodundan.</sub>

</div>

<br>

## ⚡ 10 saniyede kurulum

```
/plugin install mochi --marketplace oztrkemree/mochi
```

Herhangi bir Claude Code sohbetine yaz, marketplace'i eklemek için `y` de ve **user** kapsamını seç. Bu kadar: Mochi hemen gelir, sonra açtığın her sohbette de orada olur. Ayarlanacak hiçbir şey yok.

> [!NOTE]
> Mochi, Claude Code'un hooks modülleri (fonksiyon hook'ları) üzerine kurulu; bu yüzden **Claude Code 2.1.293 ya da daha yeni** bir sürüm gerekiyor (seninkini `claude --version` söyler). 2.1.286 gibi daha eski sürümler modülü hiç yüklemez, Mochi de hiç görünmez.

<br>

<table>
<tr>
<td align="center" width="25%">🎭<br><b>30 ruh hali</b><br><sub>her araç çağrısını takip eder</sub></td>
<td align="center" width="25%">🛡️<br><b>Bir kalkan</b><br><sub><code>rm -rf</code>, force push ve sızan anahtarlar için</sub></td>
<td align="center" width="25%">📊<br><b>Limit halkaları</b><br><sub>ne zaman biteceğinin tahminiyle</sub></td>
<td align="center" width="25%">👒<br><b>Giyilecek 133 şey</b><br><sub>gerçek işle kazanılır</sub></td>
</tr>
</table>

## 🎭 Claude'un ne yaptığını hisseder

Düşünür, okur, arar, yazar, komut çalıştırır, seni bekler, testler yeşil geçince kutlar, üst üste üç hatada başı döner, sen yokken uyur. **Otuz ruh hali, hiç kesik yok**: her poz bir öncekinden yumuşakça akar, bu yüzden bant hiç titremez, nefes alır.

<p align="center">
  <img src="docs/demo.svg" width="744" alt="Mochi'nin bandı ruh hallerinden ve kıyafetlerinden geçiyor: el sallıyor, okuyor, düzenliyor, komut çalıştırıyor, gururlu, seni bekliyor, kutluyor ve uyuyor">
</p>

Yüzün yanında: olan biten sade sözcüklerle (`checkout.tsx düzenleniyor`, `testler geçti · 4sn`), son araç çağrıları küçük kareler halinde (çalışan nefes alır, başarısız olan kırmızıya döner), dalın ve kaç dosyanın değiştiği.

## 📊 Limitlerin tek bakışta, tahminiyle birlikte

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/band-tr-dark.png">
  <img src="docs/band-tr-light.png" alt="Mochi'nin yazı alanının üstündeki bandı: checkout.tsx düzenleniyor, son araç çağrıları, dal, bekleyen başka bir sohbet ve context, 5 saatlik oturum ve hafta için halkalar">
</picture>

Üç halka: **context penceresi**, **5 saatlik oturum** ve **hafta**. On dakikada bir `/usage` yazmaya son.

- **Yalnızca bir rakam değil, bir tahmin.** Bir pencereyi sıfırlanmasından hızlı mı tüketiyorsun? Halka *ne zaman* dolacağını söyler (`16:40'ta dolu`); önce kehribar, yaklaştıkça kırmızı.
- **İyi haberler de var.** Neredeyse bitirdiğin bir limit sıfırlanınca Mochi haber verir.
- **Context halkası içinde ne olduğunu bilir**: sistem prompt'u, araçlar, MCP, hafıza, skill'ler, mesajlar, her biri kendi renginde; bir de otomatik sıkıştırmanın devreye gireceği yerde bir çentik.

## 🛡️ Kalkan: geri alamayacağın şeyleri durdurur

<p align="center">
  <img src="docs/gif/shield.webp" width="760" alt="Claude rm -rf ./dist ~/ çalıştırmak üzere; baretli Mochi korkmuş görünüyor ve kalkan soruyor: Bu komut dosya ve klasörleri kalıcı olarak siler, Çalıştırılsın mı? Cevap Durdur, hiçbir şey silinmiyor">
</p>

Kalkan, Claude'un Bash ya da PowerShell'de çalıştırdığı her komutu ve yaptığı her düzenlemeyi okur. Geri alınamayacak bir şeyden önce durur ve sorar, **neyin yok olacağını da açıkça söyler**: dosya ve klasörleri kalıcı olarak silmek (`rm -rf`, `Remove-Item -Recurse`, `del /s`), bir sürücüyü baştan sona silmek, bir dalın geçmişini ezmek, commit edilmemiş değişiklikleri çöpe atmak, bir veritabanını silmek, altyapıyı ya da bir bulut bucket'ını yıkmak, `npm unpublish`, `docker system prune -a`, internetten indirilip doğrudan çalıştırılan bir betik, `sudo`.

- **Force push'lar dala göre değerlendirilir.** `main`, `master`, `trunk` ya da `develop`'a yapılacaksa sorar ve dalın adını söyler. Kendi dalına yapılacaksa alarm yerine tedirgin bir bakışla sorar; oraya bir `--force-with-lease` ise yalnızca o bakışı alır.
- **Gizli bilgiler geçmişine girmez.** Claude canlı bir anahtara ya da token'a benzeyen bir şeyi (AWS, GitHub, Anthropic, OpenAI, Slack, Stripe, özel anahtar, parola) ya da `.env`, `id_rsa` gibi bir dosyayı yazmadan, `git add` etmeden ya da commit etmeden önce Mochi sorar ve değeri maskeli gösterir: `AKIA••••••LE`. Yer tutucular ve belli ki test olan değerler sorulmadan geçer.
- **Burada hep izin ver.** Soruda **Çalıştır** (ya da **Yaz**), **Durdur** ve **Burada hep izin ver** seçenekleri çıkar; sonuncusu o tür komutu bu depo için hatırlar. Bu, deponun içinde kalanlar için geçerlidir: dışarıya uzanan bir komut ya da düzenleme (`rm -rf ~`, ev klasöründe bir dosya) yine sorar. `/mochi kalkan` neyin nerede izinli olduğunu listeler; `/mochi kalkan sıfırla` hepsini unutur.

<details>
<summary><b>Kendi kurallarını yaz</b>: <code>~/.claude/mochi/shield.json</code></summary>

<br>

```json
{
  "add": [{ "match": "terraform\\s+apply", "says": "canlı altyapıyı değiştirir" }],
  "off": ["publish", "sudo"]
}
```

- `match`, her Bash ve PowerShell komutunda büyük-küçük harf ayrımı yapılmadan denenen bir düzenli ifadedir. `says`, böyle bir komutun ne yapacağıdır ve soruda gösterilir; yazmazsan soru, komutun kurallarından birine uyduğunu söyler.
- `off`, artık sorulmasını istemediğin yerleşik türleri listeler: [`hooks/lang/tr.ts`](hooks/lang/tr.ts) içindeki `danger`'ın herhangi bir anahtarı (`rm`, `forcePush`, `publish`, `sudo`…), `secret` ya da onun tek bir türü (`secret:aws`, `secret:github`, `secret:apiKey`, `secret:slack`, `secret:stripe`, `secret:privateKey`, `secret:generic`), `secretFile` ve `secretEdit`.
- Dosya her değiştiğinde Mochi onu yeniden okur ve kısa bir uyarıyla söyler. Kullanamadığı her şeyi atlar ve adını verir; dosya geçerli bir JSON değilse, düzelene kadar kurallarının hiçbiri uygulanmaz. Claude bu dosyayı kendisi değiştirmeden önce kalkan sorar.

</details>

## 🧡 Fark ettiği diğer her şey

<table>
<tr>
<td width="50%" valign="top">

### 🔁 Döngü bekçisi
Aynı komutun üç kez hata vermesi, aynı hatanın geri gelmesi, aynı çağrının hep aynı sonucu döndürmesi: Mochi bunları **limitin dolmadan** fark eder ve Esc'e basmanı söyler.

</td>
<td width="50%" valign="top">

### 🔔 Sen yokken bildirimler
İki dakikadan uzun bir tur bittiğinde, uzun bir iş durup seni beklemeye başladığında, limitin sıfırlandığında ya da CI kaldığında sistem bildirimi gelir (macOS, Windows ya da Linux). **Git bir çay koy.**

</td>
</tr>
<tr>
<td valign="top">

### 💬 Bütün sohbetler tek panoda
Bilgisayarındaki bütün Claude Code sohbetleri: önce bu sohbet, ardından seni bekleyenler; her birinin dalı (worktree'ler işaretli), ne yaptığı ve ne zamandır yaptığı. Seni beş dakikadır bekleyen bir sohbet bir bildirim daha gönderir.

</td>
<td valign="top">

### 🚦 Push'tan sonra CI
Mochi, GitHub Actions çalıştırmalarını senin kendi `gh`'ınla takip eder: bantta `ci çalışıyor · 2/5`, geçince kutlama, kalınca başarısız workflow'un adı. Çalıştırma yokken: dalının pull request'i, incelemesi ve kontrolleri (`PR #12 · onaylandı · kontroller 4/5`).

</td>
</tr>
<tr>
<td valign="top">

### 💡 O ana uygun ipuçları
Arada bir, Mochi boştayken, az önce olana uygun kısa bir Claude Code ipucu: durdurulan bir turdan sonra Esc Esc, context dolarken `/compact`. Aynı talimatı üçüncü kez verirsen Mochi onu `CLAUDE.md`'ye eklemeyi önerir; yalnızca **Ekle** dersen yazar.

</td>
<td valign="top">

### 🏅 Gerçek işle kazanılan rozetler
On sekiz tane, her biri bir kez kutlanır: ilk yeşil test koşusu, tek turda geri dönüş, eklediğinden çok satır silinen bir temizlik günü, gece kuşu, erkenci kuş, çok dilli, maraton bir tur, yüz commit; bir de zorları: 30 günlük seri, 500 commit, 5.000 düzenleme, 10.000 silinen satır…

</td>
</tr>
<tr>
<td valign="top">

### 🎉 Özel günler, küçük sürprizler
Sakura mevsimi, Hacktoberfest, Cadılar Bayramı, Yeni Yıl ve doğum günün Mochi'yi giydirir, kazandıklarından seçerek. Mochi'ye iyi geceler de ya da teşekkür et. İki saat ara vermeden çalışınca biraz gerinmeyi önerir.

</td>
<td valign="top">

### 🧩 Diğer eklentiler onun ağzından konuşabilir
Deploy eklentin bir sürüm çıkınca Mochi'yi sevindirebilir, linter'ın kaşlarını çattırabilir. Tek bir çağrı: `$.mochi.react({ mood, line })`. Bkz. [eklenti yazarları için](#-eklenti-yazarları-için).

</td>
</tr>
</table>

## 🔍 Detay ekranı

**Halkalara tıkla**, her şey açılsın: bu oturum tek bakışta, bilgisayarındaki bütün sohbetler, CI'ın ve pull request'in, bir de **değişen her dosya, eklenen ve silinen satırlarıyla**. Claude'un bu sohbette dokunduğu dosyalar en üstte, her dosyanın farkı da kırmızı ve yeşil satırlarla.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/details-tr-dark.png">
  <img src="docs/details-tr-light.png" width="760" alt="Detay ekranı: tahminli context ve limit halkaları, bu oturumun rakamları, diğer sohbetler ve satır sayılarıyla değişen dosyalar ile son düzenleme">
</picture>

Aşağısında: kategorilere göre context, son turların, bütün sohbetlerinin günlerini gösteren bir takvim, seviyen, gardırobun ve rozetlerin; her ayar ve her işlem de bir tık uzağında.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/history-tr-dark.png">
  <img src="docs/history-tr-light.png" width="760" alt="Son ayların çalışma takvimi; bugünkü turlar, son yedi gün ve seri">
</picture>

## 👒 Seninle büyüyen bir gardırop

<p align="center">
  <img src="docs/gif/wardrobe.webp" width="760" alt="Mochi kıyafetleri birbiri ardına deniyor: kahveli bere, monokllü ve kedili taç, sihirbaz şapkası ve atkı, madalyalı ve balonlu parti şapkası, bıyıklı kovboy şapkası, gözlüklü mezuniyet kepi, güneş gözlüklü ve ördekli korsan şapkası, İngiliz anahtarlı baret, papyonlu ve pastalı aşçı şapkası ve bir kaktüsün yanında gece şapkası">
</p>

Her tur, her düzenleme, her commit ve çalıştığın her gün deneyim kazandırır. Seviyeler giyilecek şeyler açar: baş, yüz, boyun, el ve Mochi'nin yanı için **133 parça**. Hiçbiri takvimle açılmaz: çoğunu seviyeler, bir kısmını alışkanlıklar, kalanını da zor rozetler açar (yüz elli gece için cadı şapkası ve balkabağı, beş yüz commit için pasta). Bir kez kazanıldı mı, cadı şapkası Cadılar Bayramı'nda, pasta doğum gününde gelir; kahve sabahları, gece şapkası da gece yarısından sonra.

<p align="center">
  <img src="docs/wardrobe.png" width="840" alt="Farklı kıyafetlerle on iki Mochi: kahveli bere, bıyıklı kovboy, sihirbaz, parti şapkası, monokllü ve kedili taç, atkılı gece şapkası ve daha fazlası">
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/level-tr-dark.png">
  <img src="docs/level-tr-light.png" width="640" alt="Mochi'nin seviyesi: deneyim halkası, sonraki seviyeye kalan deneyim ve açılacak sıradaki aksesuar">
</picture>

Ne giyeceğini detay ekranındaki **Gardırop** bölümünden ya da `/mochi aksesuar gözlük` ile seç. Doğum gününü `/mochi doğumgünü 04-23` ile Mochi'ye söyle; yalnızca bu bilgisayarda kalır. Giyilecek yeni bir şey için aklında bir fikir mi var? Nasıl ekleneceği [docs/OUTFITS.md](docs/OUTFITS.md)'de.

## 📸 Hava at

- **`/mochi kart`** bir kart çizer: bugünkü kıyafetiyle Mochi, seviyen, deneyimin ve serilerin.
- **`/mochi özet`** ayını, bütün sohbetlerinle birlikte tek bir resimde özetler: saatler, turlar, commit'ler, en yoğun günün, en uzun serin ve en çok vakit geçirdiğin klasör. `/mochi özet yıl` aynısını yıl için yapar. Ayın ilk haftasında Mochi, geçen ayınkinin hazır olduğunu bir kez söyler.
- **`/mochi fotoğraf`** bandı ve detay ekranını o anki halleriyle kaydeder. Paylaşmadan önce bir göz at: dalın dahil, bantta ne varsa onu gösterir. Diğer sohbetlerin ve son düzenlemenin satırları dışarıda kalır.

Hepsi `~/.claude/mochi/share/` altında SVG dosyalarıdır; açık ve koyu sayfalarda okunacak şekilde çizilir, dışarıdan hiçbir şeye ihtiyaç duymaz. X ve Reddit yalnızca PNG kabul eder: `rsvg-convert` ya da ImageMagick kuruluysa `/mochi fotoğraf` her birinin PNG'sini de kaydeder.

<details>
<summary><b>Kartını GitHub profiline koy</b></summary>

<br>

1. Profil deponu, yani kullanıcı adınla aynı adı taşıyan depoyu (`kullanici/kullanici`) klonla.
2. O klasörün yoluyla `/mochi kart ~/code/kullanici` çalıştır; kart oraya `mochi-card.svg` olarak düşer.
3. Mochi'nin verdiği satırı deponun `README.md`'sine yapıştır, sonra commit edip push et:

   ```md
   [![Claude Code için Mochi](mochi-card.svg)](https://github.com/oztrkemree/mochi)
   ```

Kart bir anlık görüntüdür: seviye atladıktan sonra `/mochi kart`'ı yeniden çalıştır ve yenisini push et.

</details>

## ⌨️ Komutlar

Hiçbirine ihtiyacın yok: Mochi kurulduğu an çalışır. Yön vermek istediğinde hepsi `/mochi` altında.

| Komut | Ne yapar |
| --- | --- |
| `/mochi` | Bandı gizler ya da gösterir (hangisini istediğini `/mochi hide` · `/mochi show` ile söyleyebilirsin) |
| `/mochi details` | Detay ekranını açar |
| `/mochi wear [item \| auto \| none]` | Bir şey tak, Mochi kendi giyinsin ya da hepsini çıkar |
| `/mochi shield [on \| off]` | Kalkanın açık olup olmadığını ve neyin nerede hep izinli olduğunu gösterir |
| `/mochi card [path]` · `/mochi wrapped [year]` · `/mochi snap` | Paylaşmak için bir resim kaydeder |
| `/mochi small` · `/mochi big` | Tek satır ya da tam boy |

<details>
<summary><b>Bütün komutlar</b></summary>

<br>

| Komut | Ne yapar |
| --- | --- |
| `/mochi` | Bandı gizler ya da gösterir (hangisini istediğini `/mochi hide` · `/mochi show` ile söyleyebilirsin) |
| `/mochi details` | Detay ekranını açar |
| `/mochi level` | Seviyen, deneyimin ve hâlâ kilitli olanlar |
| `/mochi wear [item \| auto \| none]` | Bir şey tak, Mochi kendi giyinsin ya da hepsini çıkar |
| `/mochi badges` | Kazandığın rozetler ve kalanların nasıl kazanılacağı |
| `/mochi chats` | Bu bilgisayardaki bütün sohbetler, seni bekleyenler önce |
| `/mochi shield [on \| off]` | Kalkanın açık olup olmadığını ve neyin nerede hep izinli olduğunu gösterir; `on` ya da `off` onu öyle yapar |
| `/mochi shield reset` | “Burada hep izin ver” ile hatırlanan her şeyi unutur |
| `/mochi alerts` | Bildirimleri açar ya da kapatır (aylık özetinin hazır olduğu notunu da) |
| `/mochi ci` | CI takibini açar ya da kapatır |
| `/mochi tips` | İpuçlarını, `CLAUDE.md` önerilerini ve yenilikler notunu açar ya da kapatır |
| `/mochi breaks` | Gerinme önerisini açar ya da kapatır |
| `/mochi sound` | Sesleri açar ya da kapatır |
| `/mochi plugins` | Diğer eklentilerin tepkilerini açar ya da kapatır |
| `/mochi card [path]` | GitHub profilin için bir kart kaydeder |
| `/mochi wrapped [year]` | Ayını ya da yılını tek bir resimde kaydeder |
| `/mochi snap` | Bandı ve detay ekranını resim olarak kaydeder |
| `/mochi tour` | İlk açılıştaki tanıtımı yeniden gösterir |
| `/mochi news` | Bu sürümün getirdikleri |
| `/mochi birthday [MM-DD \| none]` | Doğum gününü kaydeder, gösterir ya da siler |
| `/mochi lang [code \| auto]` | Dili gösterir ya da değiştirir |
| `/mochi small` · `/mochi big` | Tek satır ya da tam boy |
| `/mochi export` | Mochi'nin tuttuğu her şeyi tek bir JSON dosyasına kaydeder |
| `/mochi reset [level \| history \| all]` | Seviye hafızasını, geçmişi ya da ayarlar dahil her şeyi siler; önce sorar, dışa aktarılan dosyalar ve `shield.json`'ın kalır |
| `/mochi feedback` | Sürümlerin, sisteminin, arayüzün ve dilin önceden doldurulduğu bir hata bildirimi bağlantısı |
| `/mochi status` | Mochi'nin şu an bildikleri |

İngilizce komutlar her zaman çalışır, her dil de kendi sözcüklerini ekler (`/mochi aksesuar`, `/mochi idioma`, `/mochi sprache`…). Bir şeyi açıp kapatan komutlar her seferinde onu tersine çevirir; `aç` ya da `kapat` eklersen öyle ayarlar: `/mochi ipucu kapat`.

</details>

## 🌍 16 dil

English · Türkçe · Español · Deutsch · Français · Português · Русский · 中文 · 日本語 · 한국어 · Italiano · Polski · Українська · हिन्दी · Bahasa Indonesia · العربية

Claude Code'un `language` ayarı bunlardan biriyse Mochi o dili konuşur; değilse sisteminin tercih ettiği dili, sonra `LANG`'i; hiçbiri uymazsa İngilizceyi. `/mochi dil tr` ile kendin seçebilir, `/mochi dil otomatik` ile otomatiğe dönebilirsin.

## 🔒 Neye dokunur

**Her şey bilgisayarında kalır.** Mochi'nin kendisi **hiçbir ağ isteği yapmaz**; internetle konuşan tek şey, CI takibi için senin kendi `gh`'ın, onu da `/mochi ci` kapatır.

<details>
<summary><b>Tam liste</b></summary>

<br>

- **git**, sohbetin klasöründe ve yalnızca okumak için: bant ve detay ekranı için `git status`, `git log`, `git diff --numstat` ve `git rev-parse`. Kalkanın daha yakından bakması gerektiğinde dalı ve varsayılan dalı, bir `git add`'in ekleyeceği dosyaları (`git ls-files`) ve bir `git commit`'in commit edeceklerini (`git diff`) sorar.
- **gh**, yalnızca CI takibi açıkken ve senin kendi oturumunla (Mochi token'ını hiç görmez): bir sohbet başladığında, detay ekranını açtığında ve bir push'un çevresinde `gh pr view`; `gh run list` ise yalnızca bu sohbette bir push'tan sonra, çalıştırmalar bitene kadar 30 saniyede bir, en fazla yarım saat. `/mochi ci` ikisini de kapatır.
- **Sistemin kendi araçları**: bildirimler için macOS'te `osascript`, Windows'ta PowerShell, Linux'ta `notify-send`. Dil için macOS'te `defaults read -g AppleLanguages`, Windows'ta `reg query`; macOS ile Linux'u `uname` ayırır. `/mochi fotoğraf`'ın PNG'leri için, kuruluysa `rsvg-convert` ya da ImageMagick'in `magick`'i. Kapanmış sohbetlerin dosyaları ve `/mochi sıfırla`'nın temizledikleri, yalnızca `~/.claude/mochi/` içinde ve adıyla, `rm` ile (Windows'ta `cmd`'nin `del`'i ile) silinir.
- **`~/.claude/mochi/` altındaki dosyalar**: her açık sohbetin durumu, günlük sayılar, seviyen ve rozetlerin, tahmin için kullanım ölçümleri, her ipucunun kaç kez gösterildiği ve tekrarladığın kısa talimatlar (asla prompt'un tamamı değil), bir limit sıfırlanmasını tek bir sohbetin duyurmasını sağlayan işaretler, yazdıysan `shield.json`'ın ve `/mochi kart`, `özet`, `fotoğraf` ve `aktar`'ın kaydettikleri. Ayarlar, hep izin verilenler ve doğum günün Claude Code'un eklentiler için tuttuğu depoda durur.
- **Projen**: Mochi bir talimat önermeden önce `CLAUDE.md`'yi okur ve yalnızca sen **Ekle**'yi seçince sonuna tek bir satır ekler. Kartı projene yalnızca `/mochi kart`'a oradaki bir yolu verirsen yazar. Satırları saymak ve gizli bilgileri yakalamak için Claude'un üzerine yazmak üzere olduğu dosyayı, aynı anda ekleyip commit eden bir komut için de ekleyeceği yeni dosyaları (en fazla 20 tane, her biri 1 MB'tan küçük) okur. Okuduğu hiçbir şeyi saklamaz.
- **Diğer eklentiler** Mochi aracılığıyla bir ruh hali ve kısa bir satır gösterebilir; satır eklentinin adıyla imzalanır, her eklenti için en fazla 10 saniyede bir. `/mochi eklentiler` bunu kapatır. `/mochi geribildirim` yalnızca bir bağlantı yazdırır: hiçbir şey gönderilmez.

</details>

## ❓ SSS

<details>
<summary><b>Kurdum ama Mochi görünmüyor.</b></summary>

<br>

`claude --version`'a bak: Mochi **2.1.293 ya da daha yenisini** ister. Daha eski sürümler hooks modüllerini hiç yüklemez. Sürümün yeterince yeniyse `/mochi durum` Mochi'nin ne bildiğini söyler, `/mochi geribildirim` de sana önceden doldurulmuş bir hata bildirimi verir.

</details>

<details>
<summary><b>Çok yer kaplıyor.</b></summary>

<br>

`/mochi küçük` onu tek satıra indirir. `/mochi` tamamen gizler, bir daha yazınca geri getirir.

</details>

<details>
<summary><b>Kodumu ya da prompt'larımı bir yere gönderiyor mu?</b></summary>

<br>

Hayır. Mochi hiçbir ağ isteği yapmaz. `~/.claude/mochi/` altında kısa sayılar tutar, asla prompt'un tamamını değil. Bkz. [neye dokunur](#-neye-dokunur).

</details>

<details>
<summary><b>Kalkan ayağıma dolanır mı?</b></summary>

<br>

Yalnızca geri alınamayacak şeylerden önce sorar, **Burada hep izin ver** de cevabını o depo için hatırlar. `/mochi kalkan kapat` onu kapatır; `shield.json` tek tek türleri kapatır.

</details>

## 🧩 Eklenti yazarları için

Eklentin Mochi'nin tepki vermesini sağlayabilir: bir deploy bitince sevinsin, bir kontrol kalınca endişelensin. `dependencies` altına `mochi` ekle ve `$.mochi.react({ mood, line })` ya da `$.mochi.celebrate({ line })` çağır. Çağrılar, sınırlar ve eksiksiz bir örnek eklenti [docs/API.md](docs/API.md)'de.

## 🤝 Katkı

Hata bildirimleri, fikirler, çeviriler, çizimler ve PR'lar hepsi baş tacı. [Bir issue aç](https://github.com/oztrkemree/mochi/issues/new/choose) (`/mochi geribildirim` sana önceden doldurulmuş bir hata bildirimi verir) ya da koda başlamak için [CONTRIBUTING.md](CONTRIBUTING.md)'yi oku: iki komut her şeyi kontrol eder (`claude plugin validate .` ve `claude plugin test .`), yeni bir dil eklemek de bir sözlük ve birkaç satırdan ibaret. Her sürümde nelerin değiştiği [CHANGELOG.md](CHANGELOG.md)'de.

Bu sayfadaki hareketli resimleri Mochi'nin kendi kodu çiziyor: `node scripts/gifs.mjs` ve `node scripts/demo.mjs` onları yeniden üretir.

## 📄 Lisans

[MIT](LICENSE). Kullan, değiştir, paylaş.

<br>

<div align="center">

**Mochi yüzünü güldürdüyse, bir ⭐ başkalarının da onu bulmasına yardım eder.**

<sub><a href="https://github.com/oztrkemree">Emre Öztürk</a> ve Claude tarafından özenle yapıldı.</sub>

</div>
