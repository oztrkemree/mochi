# Agent Party / Agent Village — araştırma ve öneri

Tarih: 2026-10-14. Durum: araştırma, implementasyon yok.
Kaynaklar: Mochi kodu (HEAD `bc0ebee`, 0.5.1), agents-pixel-dungeon reposu (sığ klon, çalıştırılmadı), Reddit gönderisinin RSS akışı, Claude Code resmi dokümanları (code.claude.com/docs, 2026-10-14), yerelde `claude agents --json` denemesi (Claude Code 2.1.296).

## Kısa karar

Agent Party yapılmaya değer ve Mochi'nin mevcut altyapısının üstüne oturuyor: oturumlar zaten `~/.claude/mochi/live/*.json` dosyalarıyla birbirini görüyor, subagent'lar zaten `agent.spawn` / `tool.call` ile sayılıyor, 30 mood ve küçük "helper" figürü zaten var. MVP için yeni bir süreç, sunucu, hook kurulumu ya da dış bağımlılık gerekmiyor: peer dosyasını zenginleştirmek ve Pane'e yeni bir "Ekip" görünümü eklemek yeterli.

Village, Party'nin verisini kullanan ama kendi başına güzel, yaşayan bir sahne olarak tasarlanır: katmanlı vektör köy, gerçek saate bağlı gök, ajanlar alanlar arasında zıplayarak geçer. Ayarlardan açılıp kapanır; kapalıyken hiç kod çalışmaz.

Kapsam: **sadece Claude Code.** Codex, Gemini ve diğer araçlar kapsam dışı. Gösterilenler: diğer Claude Code sohbetleri (oturumlar) ve her oturumun subagent'ları.

Puanlar: Party MVP **82/100**, Village **65/100**.

---

## 1. Referans proje: Agents Pixel Dungeon (APD)

Repo: github.com/JoseValencia125/agents-pixel-dungeon. 2026-10-09'da açıldı, 15 yıldız, 0 issue, v2.3.0. Rust + egui yerel uygulama, menü çubuğu ikonu var. Kod MIT, piksel sanatı orijinal ve MIT (Aseprite, Endesga-32 paleti).

**Nasıl çalışıyor:** Claude Code hook'larını hiç kullanmıyor. Asıl veri kaynağı **Herdr** (ajanların terminallerini yöneten ayrı bir runtime). Herdr'ın soket event'lerine abone oluyor, üstüne saniyede bir şunları okuyor:
- `~/.claude/projects/.../<session>.jsonl` transcript'inde son tool adı → odadaki istasyon (Read=kitap, Edit=örs, Bash=iksir, Task=çağırma dairesi).
- `subagents/` klasörü: dosya son 30 sn'de değiştiyse subagent "aktif".
- `~/.claude/jobs/<id>/state.json` + daemon soketleri (arka plan oturumları).
- Transcript'teki "You've hit your session limit" metni → revir odası.
- `ps` ile arka plan Bash kabukları.
- Codex ve Kiro oturum dosyaları.
- Kullanım: `~/.claude.json` içindeki önbellek ya da opt-in olarak keychain'deki OAuth token ile `api.anthropic.com/api/oauth/usage`.

**Güçlü tarafları**
- Durum = oda fikri anlaşılır: çalışıyor (atölye), seni bekliyor (mühürlü kapı + kırmızı "!"), limit (revir + geri sayım), boşta (han), bitti (hazine + konfeti), bilinmiyor (harabe).
- "Seni bekliyor" durumu çalışmaktan ayrı ve ses/bildirimle destekli. Reddit'te en çok övülen kısım bu.
- Çift yönlü kontrol: odaya tıklayınca canlı terminal, cevap kutusu, Kabul/Ret/Durdur, yeni ajan çağırma, diff ve PR görünümü.
- Çok araç: Claude Code, Codex, Kiro, Gemini CLI, her biri için ayrı kahraman.
- Proje başına hash'ten üretilmiş arma, yani her repo tanınabilir.
- Telemetri yok, ağ dinleyicisi yok.

**Zayıf tarafları**
- Tam işlev için Herdr şart. Ajanlar ancak Herdr içinde çalışıyorsa tam görünüyor; yoksa salt-okunur ve tahmine dayalı bir mod var.
- Belgelenmemiş dosya formatlarına dayanıyor (transcript satırları, `jobs/state.json`, daemon soketleri, limit mesajının metni). Claude Code dokümanı `jobs/` ve daemon dosyalarının kararlı bir arayüz olmadığını açıkça söylüyor.
- "Subagent aktif" = "dosyası 30 sn içinde değişti". Uzun düşünen bir subagent ölü görünür, ölmüş biri 30 sn canlı görünür.
- Canlı kullanım modu OAuth token'ını okuyup belgelenmemiş bir endpoint'e gidiyor. Güvenlik açısından hassas.
- Ayrı bir pencere: kullanıcının çalıştığı yerde değil, yanında duruyor.
- macOS build'i notarize değil, Windows yok, tek Herdr oturumu.
- Çok genç (5 günlük), kullanım verisi yok, issue açılmamış.

## 2. Reddit yorumlarından çıkan ihtiyaçlar

Erişim notu: Reddit JSON ve sayfa erişimi 403 verdi; gönderi ve 4 yorum RSS akışından okundu. **Oy sayılarını göremedim.** Gönderi yaklaşık 13 saatlikti, tartışma küçük ve olumlu.

- **Yanlış "boşta" en kötü hata.** Bir yorumcu: "seni bekliyor" ile "hâlâ yazıyor" kesin ayrılmalı, sert yanıp sönme sadece izin istemlerine ayrılmalı. Yanlış "boşta" gösterimi, eksik bir odadan daha kötü, çünkü kullanıcı başka sekmeye geçiyor ve ajan 20 dakika onay bekliyor. Yazar da bu yüzden ayrı bir "seni şimdi bekliyor" durumu eklediğini söylemiş.
- **Ajan başına maliyet/kota.** Başka bir yorumcu: hangi ajanın token yaktığını veya limite yaklaştığını görmek istiyor. APD bunu sadece araç başına gösteriyor, ajan başına değil. Bu açık bir boşluk.
- Bir yorumcu ortalama ne kadar ödendiğini sormuş; maliyet merakı tekrar ediyor.
- Performans, gimmick, gizlilik veya token şikâyeti yazılmamış. Ama örneklem çok küçük, "şikâyet yok" güçlü bir sinyal değil.

Benzer projelerden çıkan pazar sinyali:
- **Pixel Agents** (VS Code eklentisi, MIT, ~9,7k yıldız): her terminal bir ofis karakteri, izin balonları, Task subagent'ları bağlı karakterler, ofis düzen editörü. En popüler örnek, bu yüzden "piksel ofis" artık sıradan.
- **Clawd on Desk** (Electron masaüstü evcil hayvanı, **AGPL-3.0**, ~6,4k yıldız): hook ile 12 animasyon, evcil hayvandan izin onaylama.
- **Claude Status Bar** (Swift menü çubuğu, ~710 yıldız): sadece "çalışıyor / izin bekliyor" noktası. Minimal olanın da talep gördüğünü gösteriyor.
- Agent Paperclip, Claude Pet, AgentPet, OpenPets: hepsi tek karakterli evcil hayvan.

Çıkarım: insanlar üç şey istiyor. (1) Dikkatimi isteyen ajanı kaçırmayayım, (2) hangisi ne kadar harcıyor bileyim, (3) bunu bir panele bakmadan, göz ucuyla anlayayım. Sevimlilik tek başına yetmiyor; değeri güvenilir "seni bekliyor" sinyali taşıyor.

## 3. Mochi'de zaten olanlar

| Gereken | Mochi'de durum | Kaynak |
|---|---|---|
| Oturumların birbirini görmesi | Var. Her oturum `~/.claude/mochi/live/<sessionId>.json` yazar (15 sn heartbeat, değişimde ≤1,5 sn), diğerlerini 3 sn'de bir okur, 45 sn'den eski olanı canlı saymaz. | `register.tsx:472-516`, `live.ts` |
| Oturum durumu | Var ama kaba: `busy / asking / idle / error`. "Bitti", "limit", "sessiz/bilinmiyor" yok. | `register.tsx:456-469` |
| Oturum adı, klasör, branch, worktree | Var (`title`, `label`, `folder`, `branch`, `isWorktree`). | `types/index.d.ts:181-186` |
| Diğer oturumlar listesi | Var: Pane'de metin tablo, renkli noktalar, "seni bekleyen" en üstte. Karakter olarak çizilmiyor, satırlara tıklanmıyor. | `chats.ts:53-123` |
| Diğer oturumlara tepki | Var: biri beklerse Mochi de bekler gibi bakar, biri hata alırsa gergin görünür, toast atar. | `live.ts:53-64` |
| Subagent takibi | Var ama sadece kendi oturumu içinde: foreground Agent/Task, arka plan ajanları ve workflow ajanları sayılıyor; `agentId` ile hangi tool çağrısının hangi subagent'tan geldiği biliniyor. Peer dosyasına yazılmıyor. Teammate'ler bilerek dışarıda. | `register.tsx:2113-2283` |
| Tool → mood eşlemesi | Var: okuma, arama, yazma, çalıştırma, test (gergin), web, ajan, soru; test geçti → parti, commit → gururlu, 3 hata → başı dönmüş. | `react.ts:83-150` |
| İzin bekleme | Var: `classic.PermissionRequest` → `asking`. Cevabın ne olduğu görülmüyor; tool çağrısının bitişinden çıkarılıyor. | `register.tsx:2260-2276` |
| Context, maliyet, 5 saatlik ve haftalık limit | Var, oturum başına: `$.session.usage` ve `session.measure`. Limitler hesap genelinde, tahmin modeli var. | `register.tsx:249-287`, `facts.ts` |
| Küçük yardımcı figürler | Var: en fazla 3 helper sprite (49×44 WebP), Mochi'nin yanında sabit noktalarda. | `rig.ts:717-728` |
| 30 mood, poz geçişleri, SMIL animasyon | Var. Desktop'ta tek SVG string, her çizimde yeniden üretiliyor; terminalde 5×9 ASCII ve kaomoji. | `rig.ts`, `looks.ts` |
| 136 aksesuar, 5 slot | Var, base64 WebP ya da vektör. Renk/ten seçeneği yok, gövde rengi sabit. | `wear.ts`, `level.ts` |
| Rozetler, seviye, günlük sayılar | Var (`level.json`, `badges.json`, `days/`). "team lead" rozeti var. | `badges.ts` |
| Ses ve OS bildirimi | Var (varsayılan kapalı ses, uzun bekleme bildirimi). | `sound.ts`, `chats.ts:16` |
| Oturuma geçme (focus) | **Yok.** `osascript` sadece bildirim için. | `system.ts` |
| Codex / Gemini | Yok; kapsam dışı (sadece Claude Code). | — |

Önemli mimari gerçek: Mochi ayrı bir uygulama değil, her Claude Code oturumunun içinde yüklenen bir hooks-module plugin'i. Ayrı bir pencere ya da sürekli açık bir süreç yok. Bu, Party'nin nereye çizileceğini belirliyor: AbovePrompt bandı (76 px yükseklik) ve Pane.

Ayrıca bir yan bulgu: README "network: none" diyor (`README.md:18, 297, 338`) ama 0.5.1'deki güncelleme kontrolü `raw.githubusercontent.com`'a gidiyor (`register.tsx:1660-1686`). Party'den bağımsız düzeltilmesi gereken bir tutarsızlık.

## 4. Agent Party — MVP tasarımı

### Kapsam
- Sadece Claude Code.
- Her canlı Claude Code sohbeti (diğer chat'ler dahil, hangi projede olursa olsun) = bir mini Mochi.
- Her sohbetin subagent'ları = o Mochi'nin yanındaki helper figürleri (mevcut sprite). Ayrı tam karakter değil, ama kendi işleri (yazıyor, okuyor, arıyor) helper'ın elindeki küçük prop'la gösterilir ve karta tek tek listelenir.
- Gösterim yeri: Pane'de yeni bir **"Ekip"** bloğu (mevcut "chats" bloğunun karakterli hâli) ve bantta küçük bir sayaç/rozet. Ayrı pencere yok.
- Kontrol yok, sadece görüntüleme + mevcut bildirimler + "kopyala" eylemleri. (Gerekçe: bölüm 6, "kontrol".)

### Veri modeli değişikliği (peer dosyası v2)
Mevcut `Peer` alanlarına eklenecekler, hepsi oturumun zaten bildiği şeyler:

| Alan | Kaynak (mevcut) | Not |
|---|---|---|
| `activity`: `writing / testing / reading / searching / running / web / agent / thinking` | `beforeTool` mood'u | Sadece tool adı ve mevcut "test mi" tespiti; komut metni yazılmaz. |
| `waitingFor`: `permission / question / plan` | `classic.PermissionRequest`, AskUserQuestion, ExitPlanMode | Asıl dikkat sinyali. |
| `waitingSince` | aynı | Sıralama ve "ne kadar bekledi" için. |
| `lastTurn`: `{ endedAt, reason, seconds, edits }` | `turn.complete` | "Bitti" durumunu türetmek için. |
| `agents`: `[{ id, type, activity, since }]`, en fazla 8 | `agent.spawn`, `tool.call` (agentId'li) | Subagent adı/türü ve şu anki işi. |
| `context`, `costUsd` | `$.session.usage` | 5 %'lik adımlarla yuvarlanır, gereksiz yazmayı önler. |
| `limitHit`: `five_hour / seven_day` + `resetsAt` | `rateLimits` ≥ %100 ya da turn hata sebebi | Bkz. güvenilirlik tablosu. |
| `v: 2` | — | Eski Mochi'ler v1 yazmaya devam eder; v1 peer'lar sadece kaba durumla çizilir. |

Yazma sıklığı değişmez (değişimde ≤1,5 sn, heartbeat 15 sn). Dosya boyutu birkaç yüz bayttan ~1-2 KB'a çıkar.

### Durum → görünüş eşlemesi (yeni çizim yok, mevcut mood'lar)

| Ajan durumu | Mochi mood'u / poz | Veri güveni |
|---|---|---|
| Kod yazıyor | `writing` (laptop) | Yüksek |
| Test çalıştırıyor | `nervous` (koşuyor); geçerse `party`, kalırsa `error` | Yüksek (mevcut test tespiti) |
| Okuyor / arıyor | `reading` (kitap) / `searching` | Yüksek |
| İzin bekliyor | `asking` + "!" overlay, sıranın başına çıkar, hafif zıplama | Başlangıcı yüksek; bitişi orta (tool çağrısının bitişinden çıkarılıyor) |
| Soru soruyor (AskUserQuestion / plan onayı) | `asking` + "?" overlay | Yüksek |
| Hata aldı | `error` / 3+ hatada `dizzy` | Yüksek |
| Bitti (son 10 dk içinde, hatasız, sen o oturuma dönmedin) | `proud` ya da `success`, üstünde check | Orta: "sen baktın mı" bilgisi sadece o oturum tekrar prompt alınca belli olur |
| Boşta | `sleepy` → `sleeping` (mevcut süreler) | Yüksek |
| Limite takıldı | `tired` + `hourglass` overlay + `resetsAt` geri sayımı | Orta (bkz. teknik bölüm) |
| Sessiz (peer dosyası 45 sn'den eski) | Gri, yarı saydam, "?" — **"boşta" olarak gösterilmez** | Durum bilinmiyor diye açıkça yazılır |
| Mochi yüklü olmayan oturum | MVP'de görünmez; Faz 3'te "kimliksiz" gri siluet | — |

Reddit'teki en önemli uyarı yüzünden kural: veri yoksa ya da eskiyse karakter **bilinmiyor** görünür, asla "boşta" görünmez.

### Tıklayınca açılan kart
- Oturum adı (title, yoksa klasör), klasör ve branch, worktree işareti.
- Durum ve ne kadar süredir o durumda ("izin bekliyor · 4 dk").
- Şu anki iş: tool türü ve özne (mevcut `line`, örn. "yazıyor · rig.ts"). Komut metni ve dosya içeriği yok.
- Son aktivite zamanı.
- Subagent'lar: tür, şu anki iş, ne zamandır çalışıyor.
- Context % ve oturumun maliyeti. Subagent başına token için: **"ölçülemiyor"** yazar (gerekçe bölüm 6).
- 5 saatlik / haftalık limit: hesap genelinde olduğu için kartta değil, Party başlığında tek yerde.
- Eylemler: "Oturum kimliğini kopyala", arka plan oturumu ise "`claude attach <id>` komutunu kopyala". VS Code oturumu ise belgelenmiş `vscode://anthropic.claude-code/open?session=<id>` bağlantısı.

### 1 / 3 / 10 / 20 ajan davranışı
- **1 oturum, subagent yok:** Party hiç görünmez. Bugünkü Mochi aynen kalır.
- **1 oturum + subagent'lar:** bugünkü helper'lar (en fazla 3) aynen kalır; Party bloğu sadece subagent listesini gösterir.
- **2–3 oturum:** Pane'de yan yana tam boy mini Mochi'ler (her biri ~64 px). Bantta Mochi'nin yanında küçük bir sayaç: "3 · 1 bekliyor". Hepsi animasyonlu.
- **4–10 oturum:** üç sıra:
  1. **Kapı önü:** seni bekleyenler, bekleme süresine göre sıralı, büyük ve animasyonlu.
  2. **Çalışanlar:** orta boy, animasyonlu ama en fazla 6 tanesi; fazlası durağan poz.
  3. **Dinlenenler:** tek bir "yastık" yığınında küçük uyuyan yüzler + sayı.
- **11–20+ oturum:** sadece kapı önündekiler ve hata alanlar karakter olarak çizilir. Çalışanlar proje bazında gruplanır ("mochi ×4, web ×3"), her grup tek karakter + rozet sayısı. Dinlenenler sadece sayı. Subagent'lar her zaman "3 helper + "+N"" kuralıyla sınırlı.
- Animasyon bütçesi: aynı anda en fazla **6 SMIL animasyonlu karakter**. Kalanlar statik poz. Kapı önündekiler bütçede her zaman önceliklidir.

### Bant (AbovePrompt) davranışı
76 px yükseklik değişmez. Mochi'nin kendisi ana karakter olarak kalır. Sağ tarafta tek bir rozet: başka oturumlardan seni bekleyen varsa sarı nokta + sayı. Tıklayınca Pane'in Ekip sekmesi açılır (mevcut `hit.tsx` mekanizması). Banda başka karakter koymuyoruz, çünkü bant her oturumda zaten var: 5 oturumda 5 bant × 5 karakter gürültüye döner.

### Terminal
Tek satır kaomoji dizisi: `(•‿•) (>_<)! (-_-)zz +4`. Mevcut `kaomoji` fonksiyonu yeniden kullanılır. Rakiplerin hiçbiri terminalde çalışmıyor; Mochi çalışıyor.

## 5. Agent Village — gelişmiş konsept

Village, Party ile **aynı veriyi** kullanır ama basit bir yerleşim değil, kendi başına güzel ve yaşayan bir sahnedir. Ayrı bir veri modeli, oyun motoru ya da fizik yok; bütün hareket SVG içinde SMIL ile (Mochi'nin bugünkü animasyon dili) yapılır, yani tarayıcı çizer, Mochi'nin 450 ms'lik zamanlayıcısı yük almaz.

### Açma, kapama ve hareket ayarı
Ayarlar sekmesine iki seçenek:
- **Köy:** Kapalı (varsayılan) / Açık. Kapalıyken Ekip bloğu liste görünümünde kalır ve village kodu hiç çağrılmaz. Açıkken Ekip bloğunun sağ üstünde `Liste / Köy` anahtarı çıkar.
- **Köy hareketi:** Tam / Sade / Durgun.
  - Tam: geçişler, ortam canlılığı (duman, fener, ateş böcekleri), gün/gece.
  - Sade: sadece karakter geçişleri ve dikkat animasyonları; ortam durağan.
  - Durgun: hiç döngüsel animasyon yok, sadece durum değişince tek seferlik geçiş. Pil modu ve ekran paylaşımı için.

### Sahne tasarımı
- **Katmanlar:** uzak tepeler → köy evleri → yol → ön plan çimen. 3 katman sabit, hafif paralaks yok (CPU için); derinlik renk tonuyla verilir.
- **Gök gerçek saate bağlı:** sabah, öğlen, akşam, gece paleti. Gece pencerelerde ışık yanar, Kestirme Evi'nin bacasından ince duman çıkar. Mochi'nin mevcut gece kuralı (gece şapkası, erken uyku) köyde de geçerli.
- **Sahne verilerle canlanır, süsle değil:**
  - Atölye'de çalışan biri varsa örs ışığı yanar, yoksa söner.
  - Kapı önünde bekleyen varsa kapı feneri sarı yanıp söner; bekleme uzadıkça (mevcut 5 dk bildirimi gibi) fener daha belirgin olur.
  - Limit dolmaya yaklaştıkça (mevcut 5 saatlik tahmin) kuyu/su deposu seviyesi düşer; reset olunca dolar ve mevcut "limit geri geldi" partisi köyde de oynar.
  - Bir tur başarıyla bitince karakter Hazine Odası'na küçük bir sandık bırakır; günün sonunda sandık sayısı = bugün biten tur sayısı.
  - Test geçince Atölye'de küçük kıvılcım, commit'te bayrak, push'ta konfeti (mevcut `party`/`proud` tepkilerinin köy karşılığı).

### Geçiş animasyonları
- Bir sohbetin durumu değişince mini Mochi eski alandan yeni alana **yay çizerek zıplar** (`animateMotion`, 600–800 ms, mevcut spline easing). Yürüme yolu, çarpışma ya da yol bulma yok: başlangıç ve bitiş noktası arasında tek bir eğri.
- Varışta mevcut pop-in (`presence()`) ve poz geçişi (340 ms) çalışır.
- Subagent helper'ları ebeveynin arkasından kısa bir gecikmeyle (80 ms aralık) aynı eğriyi izler; ilk bakışta "kimin yardımcısı" belli olur.
- Kapı önüne gelen karakter varışta bir kez zile dokunur (ses ayarı açıksa mevcut `ding` sesi).
- Aynı anda en fazla 3 geçiş oynar; fazlası sıraya girer. 20 oturumda aynı anda gelen 10 değişiklik sahneyi dans pistine çevirmez.
- Sessizleşen (peer'ı eskiyen) karakter zıplamaz; yerinde yavaşça sise döner. Veri yokken hareket de yok.

### Alanlar (Mochi'nin kendi dünyasıyla)
| Alan | Kimler | Mevcut varlık |
|---|---|---|
| **Kapı önü / Zil** | Seni bekleyenler, sırayla. En öne, izleyiciye en yakın. | `asking` pozu, `question`/`bang` overlay |
| **Atölye** | Çalışanlar. Masa = yazma (laptop), raf = okuma (kitap), cam kavanoz = test/çalıştırma (glass), anten = web | Mevcut `held` prop'ları: laptop, book, glass, flag |
| **İlan Tahtası** | Aktif görevler: oturum adı + `TaskCreated` / todo ilerlemesi varsa sayı, yoksa sadece süre | Metin + mevcut panel stili |
| **Kestirme Evi** | Boşta olanlar | `sleepy` / `sleeping`, `zzz` overlay, gece şapkası (mevcut outfit kuralı) |
| **Revir yerine "Şarj köşesi"** | Limite takılanlar, üstünde reset saati | `tired` + `hourglass` |
| **Sis** | Sessiz / bilinmeyen | Gri, saydam, "?" |
| **Hazine Odası** | Bugün biten turlar, rozetler, seviye | Mevcut `days/`, `badges.json`, `level.json` |

### Neden ayrı oyun değil
Village kendi başına bir şey "yapmaz": görev vermez, ajan çağırmaz, zaman simülasyonu yok. Sahnedeki her değişen şey (ışık, duman, sandık, su seviyesi, karakter yeri) gerçek bir veriye bağlı; sadece gök rengi ve ateş böcekleri gibi ortam süsleri veriden bağımsız ve "Sade"/"Durgun" modunda kapanır.

### Performans bütçesi (Village)
- Sahne zemini (tepeler, evler, yol) sadece saat dilimi değişince yeniden üretilir; karakter katmanı ayrı bir `<g>` olarak güncellenir. Durum değişimi tüm sahneyi baştan üretmez.
- Ortam animasyonu: en fazla 8 döngüsel SMIL öğesi (duman, fener, ateş böcekleri dahil).
- Karakter animasyonu: Party'deki 6 animasyonlu karakter sınırı aynen geçerli.
- Pane kapalı ya da Ekip sekmesi görünmüyorken hiç çizim yok.
- Hedef: Pane açık, Tam modda, 10 sohbetle tek Mochi'li bugünkü Pane'e göre fark edilir CPU artışı olmaması. Faz 4 kabul kriterinde ölçülür.

### Görsel stil ve varlıklar
- Zemin ve binalar: Mochi'nin kil rengi (`#D97757`) ve mevcut panel paletiyle **vektör** çizim; piksel sanatı değil. Böylece APD ve Pixel Agents'tan hem lisans hem görünüş olarak ayrışır.
- Yeni raster varlık gerekiyorsa mevcut boru hattı (`art/proposed/PROMPTS.md` → `art/*.png` → `assets.ts`) kullanılır. Başka projenin tileset'i, sprite'ı veya arması kullanılmaz.
- Proje kimliği: armaya gerek yok. Her projenin mini Mochi'si, 136 aksesuardan klasör adının hash'iyle seçilmiş **sabit bir şapka** giyer; kullanıcı Pane'den değiştirebilir. Worktree'ler aynı şapka, farklı boyun aksesuarı. Yeni çizim olmadan kimlik verir ve dolabı anlamlı kılar.

## 6. Teknik mimari ve veri kaynakları

### Mimari (MVP)
```
her oturumdaki Mochi
  hook event'leri (zaten var) ──► chat bookkeeping ──► live/<id>.json (v2)
                                                          │
  3 sn'de bir readPeers (zaten var) ◄─────────────────────┘
        │
        ▼
  party modeli (saf fonksiyon, yeni dosya hooks/party.ts)
        │  sıralama, gruplama, animasyon bütçesi, durum türetme
        ▼
  Pane "Ekip" bloğu (render.tsx) + bant rozeti (panel.ts) + terminal satırı (looks.ts)
```
Yeni süreç yok, yeni hook kurulumu yok, ağ yok. `$` kuralı gereği yan etkiler `register.tsx`'te kalır; `party.ts` sadece saf hesaplama yapar (test edilebilir).

### Kullanılabilecek veri kaynakları ve güvenilirlik

| Kaynak | Ne verir | Güven | Not |
|---|---|---|---|
| Mochi'nin kendi hook event'leri | Tur başlangıç/bitiş, tool + agentId, izin istemi, subagent spawn/bitiş, compaction | Yüksek | Zaten kullanılıyor. |
| `$.session.usage` / `session.measure` | Oturum context %, token, maliyet, 5s/7g limit | Yüksek | Oturum başına; limitler hesap geneli. |
| Peer dosyaları | Diğer Mochi'li oturumlar | Yüksek | Sadece Mochi yüklü oturumlar. |
| `claude agents --json` | Tüm canlı oturumlar (Mochi'siz olanlar dahil), arka plan oturumlarında `state` (working/blocked/done/failed) ve `waitingFor` | Yüksek (resmi, belgeli) | Yerelde denendi: 15 oturum döndü, 0,17 sn, anlık ~155 MB bellek. Örnekte interaktif oturumlar sadece `status` (busy/idle) verdi; `state`/`waitingFor` sadece arka plan oturumlarında. |
| `subagentStatusLine` | Subagent başına `tokenCount`, durum, tür | Yüksek (belgeli) | Bir statusline ayarı; plugin'in bunu ayarlayıp ayarlayamayacağı **doğrulanmadı**. Kullanıcının ayarını ezmek kabul edilemez. |
| OpenTelemetry (`CLAUDE_CODE_ENABLE_TELEMETRY`) | Token/maliyet metrikleri, tool event'leri | Yüksek | Kullanıcının ortam değişkeni ve yerel bir OTLP alıcısı gerektirir. Mochi'nin işi değil; dışarıda bırakılmalı. |
| Transcript JSONL'deki `usage` satırları | Mesaj başına token | Düşük | Doküman formatın iç ve değişebilir olduğunu söylüyor. Kullanılmamalı. |
| `~/.claude/jobs/`, daemon soketleri | Arka plan işleri | Düşük | Doküman kararlı arayüz olmadığını söylüyor. APD bunu kullanıyor; biz kullanmamalıyız. |
| OAuth usage endpoint'i | Canlı kota | Kullanılmamalı | Token okumak gerekir; Mochi'nin "yerel, güvenli" çizgisine aykırı. |

### Soruların tek tek cevabı

**Agent ve subagent aktivitesi nasıl izlenir?** Kendi oturumu için hook event'leriyle (Mochi zaten yapıyor; `agentId` ile tool çağrısı hangi subagent'a ait biliniyor). Diğer oturumlar için peer dosyalarıyla. Mochi'siz oturumlar için `claude agents --json`.

**Hangi hook'lar?** Claude Code 33 hook event'i belgeliyor. Party için gerekenler: SessionStart, UserPromptSubmit, PreToolUse/PostToolUse, PostToolUseFailure, PermissionRequest, Notification (`permission_prompt`, `idle_prompt`, `agent_needs_input`, `quota_auto_resume_*`), SubagentStart/SubagentStop, Stop, StopFailure (`error: rate_limit` dahil), PreCompact/PostCompact, SessionEnd. Mochi bunların çoğunu kendi hooks-module isimleriyle (`turn.*`, `tool.call`, `agent.spawn`) zaten alıyor. **Doğrulanması gereken:** `classic.StopFailure` ve `classic.Notification`'ın hooks-module içinden `on('classic.…')` ile alınabildiği. Engine tip dosyası repoda yok (gitignore), bu yüzden kontrol edemedim.

**Durumlar ne kadar güvenilir?**
- Çalışıyor: yüksek (tur açık).
- İzin bekliyor: başlangıcı yüksek ve anlık (`PermissionRequest`). Bitişi orta: Mochi cevabı görmüyor, tool çağrısının bitişinden çıkarıyor. Ret edilen izinde tool çalışmazsa bitişi `PermissionDenied` ya da tur sonu yakalar. `Notification permission_prompt` ise ~6 sn gecikmeli ve her tuş vuruşunda erteleniyor; birincil sinyal olarak kullanılmamalı.
- Boşta / kullanıcı girdisi bekliyor: tur bittiyse yüksek. `idle_prompt` bildirimi 60 sn gecikmeli ve arka plan ajanı varken gelmiyor; gerek yok.
- Engellenmiş (blocked): arka plan oturumları için `claude agents --json` `state: blocked` + `waitingFor` veriyor. Interaktif oturumlar için `asking` ile aynı.
- Tamamlandı: tur sonu yüksek. "Kullanıcı gördü mü" bilgisi yok, 10 dk penceresiyle yaklaşık.
- Hata: yüksek (`turn.complete reason: error`, tool hataları).
- Limit: orta. `rateLimits` ≥ %100 hesap genelinde doğru ama bir oturumun gerçekten takıldığını göstermez; `StopFailure error=rate_limit` takıldığını gösterir. İkisi birlikte kullanılmalı. Limit verisi sadece Pro/Max abonelerinde ve ilk API cevabından sonra var.

**Her agent için ayrı context/token ölçülebilir mi?** Oturum başına evet (context %, token, maliyet). Subagent başına: belgeli tek yol `subagentStatusLine`'daki `tokenCount`; Mochi'nin bunu kullanıp kullanamayacağı doğrulanmadı. Bu yüzden MVP'de subagent başına token gösterilmez, kartta "ölçülemiyor" yazar. Reddit'in istediği "ajan başına maliyet" oturum düzeyinde karşılanır.

**Tıklayınca oturuma geçilebilir mi?** Kısmen.
- VS Code: belgeli `vscode://anthropic.claude-code/open?session=<id>`; oturum aynı pencerede açıksa sekmesini öne getirir.
- Arka plan oturumu: `claude attach <id>`.
- Desktop app: belgeli bir "bu oturuma geç" bağlantısı bulamadım. `claude-cli://open` yeni pencere açar, mevcut oturuma geçmez.
- Terminal: Claude Code'un belgeli bir yolu yok. `pid` → tty → AppleScript ile Terminal/iTerm sekmesini öne getirmek mümkün ama macOS'a özel, kırılgan ve Otomasyon izni ister. MVP'de yok.
- **Uyarı:** aynı oturumu ikinci bir süreçte `claude --resume` ile açmak doküman tarafından önerilmiyor. Canlı oturum için "resume komutunu kopyala" sunulmamalı; sadece bitmiş oturumlar için.

**Güvenli kontrol seçenekleri?**
- MVP: hiç kontrol yok. Sadece kopyalama ve VS Code bağlantısı.
- Faz 3: arka plan oturumu için `claude stop <id>`, onay sorusuyla (`$.ui.ask`).
- Başka oturumun izin isteğini Mochi'den onaylamak: teknik olarak sadece `PermissionRequest` hook'unun karar döndürmesiyle mümkün. Bu, Mochi'yi bir güvenlik kararı veren koda çevirir ve her oturumda çalışır. Önermiyorum. Remote Control zaten resmi ve güvenli yol.

**Farklı projelerdeki agent'lar aynı ekranda?** Evet. Peer dosyaları proje bağımsız, `~/.claude/mochi/live/` altında. Bugünkü sohbet tablosu zaten tüm projeleri gösteriyor.

**Codex, Gemini CLI ve diğerleri?** Kapsam dışı: Agent Party sadece Claude Code sohbetlerini ve subagent'larını gösterir. Not olarak: ikisinin de resmi hook sistemi var, peer formatı ileride bir hook betiğiyle beslenebilir; ama bu karar bugün verilmiyor ve tasarım buna göre karmaşıklaştırılmıyor.

## 7. Performans ve güvenlik riskleri

### Performans
- **Peer okuma:** zaten 3 sn'de bir yapılıyor, mtime önbellekli. v2 alanları dosya başına ~1-2 KB ekler; 20 oturumda 3 sn'de bir ~40 KB okuma. İhmal edilebilir.
- **Peer yazma:** sıklık değişmez. Risk: `activity` alanı her tool çağrısında değişirse yazma 1,5 sn'de bir olur. Çözüm: activity sadece kategori değişince yazılır, aynı kategori içindeki dosya adı değişimi yazdırmaz.
- **SVG boyutu (asıl risk):** desktop SVG her çizimde string olarak yeniden üretiliyor ve aksesuarlar base64 WebP olarak gömülü. 20 karakter × şapka × helper sprite aynı data URI'yi 20 kez gömerse SVG yüzlerce KB'a çıkar ve her redraw'da yeniden parse edilir. Çözüm: her görsel bir kez `<defs>` içinde `<symbol>`/`<image id>` olarak tanımlanır, karakterler `<use>` ile referans verir. Bu MVP'nin kabul kriteri olmalı.
- **SMIL animasyonu:** tarayıcı tarafında; 6 animasyonlu karakter sınırı CPU'yu bugünkü tek Mochi'nin birkaç katında tutar. 20 karakterin hepsi animasyonlu olursa özellikle düşük güçlü makinelerde sürekli compositing maliyeti oluşur.
- **Redraw sıklığı:** Party bloğu sadece Pane açıkken ve sadece model değiştiğinde (durum, sıra, grup) çizilir. Context gibi sayılar 5 %'lik adımla yuvarlanır (mevcut `sceneOf` kuralı).
- **`claude agents --json`:** çağrı başına 0,17 sn CPU ve anlık ~155 MB bellek (yerelde ölçüldü). Her oturum 3 sn'de bir çağırırsa 10 oturumda saniyede ~0,6 çağrı ve sürekli bellek dalgalanması olur. Kural: sadece Pane'in Ekip sekmesi açıkken, sadece tek bir "lider" oturum (mevcut `reset-*.json` claim deseni), en sık 15 sn'de bir, sonucu `live/_agents.json`'a yazar; diğerleri oradan okur. Opt-in.
- **Bellek:** party modeli birkaç KB. Pane kapalıyken hiçbir şey çizilmez.

### Güvenlik ve gizlilik
- Peer dosyaları oturum başlığı, klasör, branch ve ilk prompt kelimelerini (label) içeriyor. Yerel, ama ekran paylaşımında Party bunları toplu gösterir. Ayarlarda "başlıkları gizle" seçeneği olmalı (sadece proje adı ve durum).
- Peer dosyasına komut metni, dosya içeriği, prompt metni ya da tool input'u yazılmamalı. Sadece kategori ve dosya adı.
- `live/` klasörü kullanıcıya özel izinlerle yazılmalı; `$.fs`'in hangi izinle yazdığı doğrulanmadı.
- `claude` CLI çağrısı argüman dizisiyle yapılmalı, shell string'iyle değil (oturum adı içinde özel karakter olabilir).
- Peer dosyaları başka süreçlerin yazdığı veri sayılmalı: şema kontrolü, uzunluk sınırı, oturum başlığı gibi metinler SVG'ye kaçışlanarak basılmalı (başlıkta `<` ya da `&` olan bir sohbet SVG'yi bozmasın).
- OAuth token okumak, belgelenmemiş endpoint'e gitmek, başka oturumların izinlerini onaylamak: hiçbiri yapılmamalı.
- README'deki "network: none" iddiası zaten yanlış; Party ağ eklemediği sürece bu durumu kötüleştirmez, ama ayrıca düzeltilmeli.

## 8. Uygulanabilirlik puanı

| Parça | Puan | Neden |
|---|---|---|
| Party MVP (Mochi'li oturumlar, Pane, bant rozeti, terminal satırı) | **82** | Veri ve çizim altyapısı hazır. Eksi puan: SVG boyutu riski, "bitti" ve izin bitişinin yaklaşık olması, focus'un sadece VS Code'da belgeli olması. |
| Mochi'siz oturumlar (`claude agents --json`) | **75** | Resmi ve yerelde çalışıyor; maliyeti ve lider seçimi dikkat istiyor. |
| Subagent başına token | **35** | Tek belgeli yol (subagentStatusLine) plugin'den erişilebilir mi bilinmiyor. |
| Village | **65** | Veri Party'den geliyor; tek araç (Claude Code) kapsamı işi daraltıyor. Asıl risk güzel bir vektör sahnenin tasarım süresi ve 10+ sohbette okunabilirlik. |
| Oturuma geçme (terminal / Desktop) | **30** | Belgeli bir yol yok; AppleScript kırılgan. |

## 9. Yaklaşık karmaşıklık

| Faz | İş | Tahmini süre (tek kişi) | Risk |
|---|---|---|---|
| 0 | Peer v2 şeması, yazma kuralları, `party.ts` saf model + testler | 2–3 gün | Düşük |
| 1 | Pane "Ekip" bloğu, kart, SVG `<defs>/<use>` tekilleştirme, animasyon bütçesi | 4–6 gün | Orta (SVG boyutu) |
| 2 | Bant rozeti, terminal kaomoji satırı, 16 dilde metinler, proje şapkası | 2–3 gün | Düşük |
| 3 | `claude agents --json` (opt-in, lider oturum), arka plan oturumu için `attach` kopyala / `stop` | 2–3 gün | Orta |
| 4a | Village sahnesi: katmanlı vektör köy, gün/gece paletleri, alanlar, Köy ve Köy hareketi ayarları | 2 hafta | Orta-yüksek (tasarım) |
| 4b | Geçişler (yay zıplama, helper takibi, geçiş kuyruğu), veriye bağlı ortam (fener, örs, kuyu, sandık), performans ölçümü | 1–1,5 hafta | Orta |

## 10. Aşamalı plan ve kabul kriterleri

**Faz 0 — Veri**
- 2 oturum açıkken birinde izin istemi çıkınca diğerinin `live/` dosyasında 2 sn içinde `waitingFor: permission` görünür; izin verilip tool bitince 2 sn içinde kalkar.
- Subagent başlatılınca peer dosyasında `agents[]` içinde türüyle görünür, bitince 3 sn içinde düşer; 10 dk sessiz kalan subagent mevcut `FLOW_STALE_MS` kuralıyla düşer.
- Peer dosyasında hiçbir komut metni, prompt metni ya da dosya içeriği yoktur (testle).
- v1 yazan eski Mochi ile v2 Mochi aynı anda çalışınca ikisi de hata vermez.
- Peer yazma sıklığı yoğun bir turda 1,5 sn'den sık olmaz.

**Faz 1 — Party**
- 1 oturumda Party bloğu görünmez; bugünkü bant ve Pane bayt bayt aynı kalır (görsel snapshot).
- 20 sahte peer ile SVG boyutu 150 KB'ı geçmez ve aynı data URI SVG'de en fazla bir kez geçer.
- Aynı anda en fazla 6 karakter animasyonludur; bekleyenler her zaman bu 6'nın içindedir.
- 45 sn'den eski peer "bilinmiyor" çizilir, asla "boşta" çizilmez.
- Kart; ad, klasör, branch, durum + süre, şu anki iş, son aktivite, subagent'lar, context ve maliyet gösterir; ölçülemeyen alan "ölçülemiyor" yazar.
- Pane kapalıyken Party için hiçbir redraw olmaz (test: render sayacı).

**Faz 2 — Bant ve terminal**
- Başka oturumdan bekleyen varsa bant rozeti 3 sn içinde belirir; rozete tıklayınca Ekip sekmesi açılır.
- Terminal satırı 80 sütuna sığar, fazlası "+N" olur.
- "Başlıkları gizle" açıkken hiçbir yüzeyde oturum başlığı ya da prompt kelimesi görünmez.

**Faz 3 — Mochi'siz ve arka plan oturumları**
- Varsayılan kapalı. Açıkken tek bir oturum `claude agents --json` çalıştırır (log ile doğrulanır), en sık 15 sn'de bir, sadece Ekip sekmesi açıkken.
- `claude` bulunamazsa ya da hata verirse Party sessizce sadece peer'larla çalışır.
- `stop` her seferinde onay ister ve sadece `kind: background` oturumlarda görünür.

**Faz 4 — Village**
- Ayarlardan kapatılabilir, varsayılan kapalı; kapalıyken hiçbir village kodu çizim yapmaz.
- Köy hareketi Tam / Sade / Durgun çalışır; Durgun'da sahnede hiç döngüsel animasyon yoktur.
- Durum değişince karakter 600–800 ms'lik yay ile yeni alana geçer, helper'ları arkasından gelir; aynı anda en fazla 3 geçiş oynar.
- Eskiyen peer zıplamaz, yerinde sise döner.
- Tam modda 10 sohbetle Pane açıkken CPU kullanımı bugünkü Pane'e göre ölçülür ve sonuç PR'a yazılır; fark edilir artış varsa Sade varsayılan yapılır.
- Gün/gece paleti gerçek saate göre değişir; sahne zemini sadece saat dilimi değişince yeniden üretilir.
- 1, 3, 10, 20 peer ile ekran görüntüleri tasarım incelemesinden geçer; 20'de bekleyenler ilk bakışta (ekran görüntüsünde) seçilebilir.
- Her alan sadece gerçek bir durumdan beslenir; durum tablosunda olmayan bir sahne (ör. "ajan dinleniyor ama aslında bilinmiyor") yoktur.

## 11. Mochi'yi gerçekten farklılaştıracak fikirler

1. **"Kapı zili" sırası.** Seni bekleyen ajanlar bekleme süresine göre kapının önünde sıraya girer; en uzun bekleyen en önde ve en büyük. Rakipler "bekliyor" durumunu işaretliyor ama önceliklendirmiyor. Reddit'teki ana şikâyete doğrudan cevap.
2. **Dürüst sis.** Verisi eski ya da olmayan ajan gri ve "?" olarak görünür. "Bilmiyorum" diyen tek görselleştirici olmak güven kazandırır.
3. **Ana Mochi ev sahibi.** Party ayrı bir dünya değil; kendi oturumundaki Mochi diğerlerine bakar, biri beklerse oraya döner (zaten var olan tepkinin karakterli hâli). Rakiplerde karakterler birbirinden habersiz.
4. **Proje şapkaları.** 136 aksesuardan her projeye kalıcı bir şapka. Sıfır yeni sanatla kimlik, ve kullanıcının açtığı dolap eşyaları ekibe de giydirilir: ilerleme sistemi Party'ye anlam katar.
5. **Subagent'lar ayrı karakter değil, yardımcı.** Ebeveyn–çocuk ilişkisi görsel olarak doğru kalır, 20 subagent'lı bir workflow ekranı doldurmaz. Mevcut helper sprite'ı kullanılır.
6. **Her yerde çalışır.** Desktop'ta karakterler, terminalde kaomoji satırı, mobilde bant rozeti. Rakipler ya VS Code ya ayrı pencere.
7. **Oturum başına maliyet + limit tahmini birlikte.** Mochi'nin zaten olan haftalık tahmin modeli Party başlığında: "bu tempoda haftalık limit Perşembe 14:00'te dolar, en çok yakan: mochi (3,20 $)". Reddit'in istediği ajan başına maliyetin oturum düzeyinde gerçek cevabı.
8. **Günün sonu ekip kartı.** Bugün kaç oturum, kaç tur, kaç commit, kim en uzun bekledi; mevcut `days/` verisinden ve paylaşım resmi altyapısından (`share/`). Village'ın Hazine Odası'nın sadeleştirilmiş, Party'de de çalışan hâli.
9. **Sessiz saatler.** Odaklanma modunda Party sadece kapı önündekileri gösterir, gerisi tek sayı. Her gün açık tutulabilmesinin şartı.
10. **"Bitti, bakmadın" rozeti.** Biten turlar sen o oturuma dönene kadar küçük bir check ile durur; döndüğünde (yeni prompt) kalkar. Basit ama arka planda çok oturum koşanların en çok kaçırdığı şey.

## 12. Lisans ve attribution

- **Mochi:** MIT, "Copyright (c) 2026 Emre Öztürk". Değişiklik gerekmez.
- **Agents Pixel Dungeon:** kod MIT, sanat MIT (orijinal). MIT sadece **kodu veya varlığı kopyalarsak** telif bildirimini korumamızı ister. Fikirler (durum = oda, kahraman başına araç) telifle korunmaz. Bu tasarım APD'den kod, sanat, oda isimlerinin birebir listesi ya da arma üretim yöntemi almadığı sürece hukuken attribution gerekmez.
- **Önerilen nezaket:** README'nin teşekkür bölümüne ya da CHANGELOG'a tek satır: "Agent Party, Nacho Valencia'nın Agents Pixel Dungeon projesinden ilham aldı." İlham açıkça bu projeden geldiği için yazılması doğru olur, zorunlu değil.
- **Dikkat edilecekler:**
  - APD'nin `art/*.aseprite` dosyaları ve Endesga-32 tabanlı görselleri referans görsel olarak da AI görsel üretimine verilmemeli; türev çalışma tartışmasına girmemek için kendi promptlarımızla üretmeli.
  - **Clawd on Desk AGPL-3.0.** Kodunu okuyup benzerini yazmak bile riskli bir alan; ona hiç bakmadan ilerlemek en temizi.
  - Pixel Agents MIT; aynı kural geçerli, kod kopyalanmazsa bir yükümlülük yok.
  - Herdr Apache-2.0; Mochi Herdr kullanmayacağı için ilgisiz.

## Doğrulanmamış noktalar (implementasyondan önce bakılmalı)

1. `classic.StopFailure`, `classic.Notification`, `classic.PermissionDenied` hooks-module içinden alınabiliyor mu? (Engine tip dosyası repoda yok.)
2. Subagent'ın izin isteğinde `PermissionRequest` payload'ında `agent_id` geliyor mu? (Doküman subagent hook'larında geldiğini söylüyor, Mochi'nin classic köprüsünde test edilmedi.)
3. Plugin `subagentStatusLine` verisine erişebilir mi, yoksa sadece kullanıcı ayarı mı?
4. `$` API'sinde bir oturumu Desktop app'te öne getiren bir çağrı var mı?
5. `$.fs`'in `live/` dosyalarını hangi izinlerle yazdığı.
6. `claude agents --json` interaktif oturumlar için `waitingFor` alanını hangi durumda dolduruyor (yerel örnekte boştu, çünkü bekleyen oturum yoktu).
