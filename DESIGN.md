# PikaMd — Tasarım Sistemi ve Güncel Durum

> Son güncelleme: 2026-10-13. Arayüz geliştirmesi sürüyor (yol haritası: ARCHITECTURE.md §15).
> Bu dosya **piksel tasarım dilinin kurallarını** ve **sitenin şu anki halini** tutar.
> Yeni bir UI işi yaparken önce burayı oku; buradaki kararlar kullanıcıyla tek tek onaylandı.

---

## 1. Tasarım dili: oyunlaştırılmış, okunaklı piksel sanatı

- **Tarz:** 8-bit / retro oyun estetiği, premium ve okunaklı. Kullanıcı "piksel tarzı ama okunabilir" istedi.
- **Zemin:** PikaStake'in arka plan görseli (`web/public/bg/background1.png`) birebir aynı efektlerle: `blur(2px)` + `scale(1.01)`, üstünde `rgba(4,2,0,0.35)` koyu katman, en üstte 40px silik sarı ızgara. Görsel yüklenene kadar `placeholder="blur"` + amber yedek zemin (asla siyah ekran olmasın).
- **Dil:** Sitedeki her metin İngilizce (ARCHITECTURE K18).

### 1.1 Renkler (`web/app/globals.css` → `:root`)
| Token | Değer | Kullanım |
|---|---|---|
| `--y1` | `#FFCB05` | Marka sarısı (Pikachu sarısı) |
| `--y2` | `#FFD740` | Açık sarı / hover |
| `--g1` / `--g2` | `#F0A500` / `#E08A00` | Koyu altın / amber |
| `--g3` / `--g4` | `#C47A00` / `#7A4200` | Gölge / 3D taban, piksel text-shadow |
| `--ink` | `#1A0800` | Sarı üstünde yazı, piksel dış hat |
| `--bg0` | `#060300` | Sayfa zemini |
| `--t0` / `--t1` / `--t2` | `#FFF8E7` / %75 / %45 | Metin tonları |

### 1.2 Yazı tipleri (`next/font/google`, `latin-ext` = Türkçe karakterler de var)
| Yazı tipi | Değişken | Nerede |
|---|---|---|
| **Jersey 10** | `--font-jersey` | Logo, büyük başlıklar, kart isimleri |
| **VT323** | `--font-vt323` | Menü, butonlar, gövde metinleri, kart açıklamaları |
- **Pixelify Sans kullanma:** küçük boyutta C/O, B/G, 5/S karışıyor (test edildi). Silkscreen ve Sixtyfour'da ş/ğ bozuk.
- Piksel yazılarda sert gölge: `text-shadow: Npx Npx 0 …` (blur yok).

### 1.3 Piksel çerçeve tekniği (her yerde aynı)
- `border-radius` **yok**. Kenarlık 4 ayrı `box-shadow` ile çizilir (üst/alt/sol/sağ) → köşeler boş kalır → basamaklı 8-bit köşe.
- 8-bit kabartma: `inset 0 3px` açık ton (üst), `inset 0 -3px` koyu ton (alt).
- Butonlarda 3D taban: çerçevenin altından `--px-base` kadar görünen koyu şerit; `:active` olunca iner.
- Hareketler `steps(n)` ile (pürüzsüz değil, kare kare): yanıp sönen imleç, para/kalp animasyonu, hover.

### 1.4 Simetri ve boşluk kuralı (kullanıcı özellikle istedi)
- Çerçeveler kutunun **dışına** taşar. Öğeler arası aralık = **iki çerçeve + net boşluk** → çerçeveler asla birbirine değmez.
- Navbar ölçüleri `.navbar` üzerinde: `--px-b: 3px` (çerçeve), `--px-gap: 12px` (net boşluk), `--px-h: 34px` (yükseklik), `--px-base: 4px` (3D taban).
- Butonlar, linkler, ☰ butonu aynı yükseklikte; iki buton aynı iskelet (aynı çerçeve + aynı 3D taban).

### 1.5 CSS kuralları
- Bileşen stilleri **`@layer components`** içinde (yoksa Tailwind'in `hidden` / `md:hidden` gibi utility'lerini ezer).
- Dinamik değerler inline `style={{}}` (CLAUDE.md kuralı); sabit stiller `globals.css` sınıflarında.
- Kod yorumları İngilizce.

---

## 2. Bileşenler (`web/components/`)

| Bileşen | Ne yapar |
|---|---|
| `Navbar.tsx` | Siyahımsı piksel panel (tarama çizgileri, alt kenarda kesik altın çizgi). 3 sütunlu grid (`1fr auto 1fr`): sol logo, **tam ortada** menü, sağ butonlar. Menü linkleri **≥1280px**'te görünür, altında ☰ açılır menü. Aktif sayfada yanıp sönen kare imleç. |
| `Footer.tsx` | Her sayfanın en altındaki **ince, tam genişlik şerit** (layout'ta, `<Navbar>` gibi). **2026-10-12 (kullanıcı isteği):** kenarlardan ve alttan boşluksuz, sayfanın altına yapışık; yükseklik 72px → **46px**; sadece üst kenar çerçeveli (koyu piksel çizgi + ortada kesik altın çizgi), yan/alt çerçeve yok; içerik kenarları navbar'la hizalı (iç genişlik 1180 + 20px kenar); daha küçük ölçüler (`--px-h: 26px`, `--px-b: 2px`, `--px-base: 3px`, buton yazısı 18px, Arc logosu `scale={1}`, X işareti 13,5px); iPhone ana çubuğu için `safe-area-inset-bottom`. Navbar zemini ve tarama çizgileri aynı. 3 sütun (`1fr auto 1fr`): solda küçük **PikaMd** + "for the community", **tam ortada** piksel Arc logosu + **"Built on Arc"** (Arc sarı), sağda navbar'daki ghost butonlarla aynı üç buton, arası 18px: **"X @pikamd"** (→ `https://x.com/PikaStake`; PikaMd'nin X hesabı şimdilik @PikaStake, buton kullanıcı isteğiyle "@pikamd" gösterir; ekran okuyucuya "PikaMd on X"; aynı `.btn-x` tasarımı), **"X @arc"** (piksel X logosu, kalın "\" + ince "/" çizgi, buton **tamamen X renklerinde** (`.btn-x`, kullanıcı isteği: "belli olsun X olduğu"): siyah zemin, beyaz logo ve yazı, beyaz piksel çerçeve, koyu gri 3D taban; hover'da X'in koyu tonu `#16181C` + tam beyaz çerçeve; iskelet ghost butonlarla aynı → `https://x.com/arc`) ve **"Arc docs ↗"** (→ `https://docs.arc.io`); ikisi de yeni sekmede açılır, adresler arc.io'dan doğrulandı (2026-10-10). <1024px'te alt alta ve ortalı (Built on Arc en üstte, üç buton sığmazsa alt satıra geçer; satır arası çerçeve + 3D taban kadar). Sayfa geçişinde sabit (`view-transition-name: site-footer`). Publish çalışma penceresinde (≥1024×600) gizli, yoksa sayfa kayar. |
| `PageTransition.tsx` | React `<ViewTransition>`; her `page.tsx` içeriğini sarar (layout'a konmaz). Eski içerik 140ms solar, yenisi bulanıktan netleşip 8px yükselir. Navbar (`site-header`) ve arka plan (`site-bg`) geçişte sabit. |
| `ComingSoon.tsx` | Henüz yapılmamış sayfalar için piksel panel ("COMING SOON"). Sayfanın var olması tam sayfa yenilemesini (siyah ekran) önler. |
| `MdCard.tsx` | Explore'daki yönerge kartı: dosya adı, tür rozeti (RULES/SKILL/PROMPT/AGENT/GUIDE), sürüm, başlık, **dosyanın ne işe yaradığını anlatan özet** (`description`, 17px krem, en az 3 satır yer → şeritteki kartlar eşit boy), yazar, etiketler, en altta buton satırı. Markdown önizlemesi kaldırıldı (okunurluk). Alt satır (soldan sağa): **OPEN** (34px) · **♥ beğeni** (`LikeButton`: piksel kalp + sayı, basınca altın ve +1; veri modelinde `stars`) · **★ Tip** (`TipButton`: piksel yıldız + "Tip"; K21 henüz yok → basınca "Tips go wallet to wallet in USDC, 100% to @yazar. Coming soon" balonu 2,6 sn, butona ortalı, kartın içinde kalır) · **+ Add / ✓ Added** (kısa etiket; tam anlam `title` ve `aria-label`'da). Aralar 18px (iki çerçeve + 12px). Beğeni sayısı alt bilgi satırından butona taşındı (tekrar yok). Kullanıcı kararı: beğeni = kalp, bağış = yıldız. Kart genişliği **304px** (mobil 288px) ki dört buton sığsın; ölçüldü, masaüstü ve mobilde taşma yok ("Added" dahil). Beğeniler mock: localStorage `pikamd:likes` (`lib/collection/store.ts`, koleksiyonla aynı genel store). Kart üzerinde normal ok imleci (`cursor: default`), metin yine seçilip kopyalanabilir; buton `pointer`. Özetler ~60–80 karakter, "Teaches your agent…" / "A skill that…" kalıbında yazılır. Mock içerikler (`content`) önizlemede okunacak gerçekçi, bölümlü MD dosyalarıdır (10–15 satır). |
| `MdPreview.tsx` | **Tam içerik önizlemesi.** Kartın altındaki **OPEN** butonuyla açılır (34×30px; CSS ile çizilmiş 4 piksel köşe çerçevesi, ortasında 15px "OPEN"; `title="Open full file"`; hover ile açılma **kaldırıldı**, kullanıcı kararı). Kart yerinden büyüyerek ekranın ortasına gelir (FLIP, `steps(6)`, 240ms); kapanınca 180ms'de geri küçülür. İçinde: dosya adı/tür/sürüm + sağ üstte **✕**, büyük başlık, özet, MD dosyasının tamamı (işaretler altın, uzunsa panel içinde kayar), yazar · lisans (CC BY 4.0) · tüm etiketler, altta **♥ beğeni · ★ Tip · Add to collection** (önizlemede uzun etiket). Opak zemin + altın çerçeve. Kapatma: ✕, karartılmış alana tıklama (`rgba(4,2,0,.7)`) veya Esc. Açılınca odak ✕'e, kapanınca OPEN butonuna döner (`role="dialog"`, `aria-modal`). Açıkken `:root[data-md-preview]` şeritleri durdurur. `prefers-reduced-motion`'da animasyonsuz. Portal kartın **kardeşi** olarak render edilir. Animasyonlar efekt temizliğinde iptal edilir (dev StrictMode'da ikinci çalışma büyümeyi siliyordu). |
| `CollectButton.tsx` | Koleksiyon düğmesi (`aria-pressed`): kartta kısa etiket **"+ Add"** → altın **"✓ Added"**, büyük önizlemede (`long`) **"+ Add to collection"** → **"✓ In collection"**; tekrar basınca çıkar. Durum `web/lib/collection/store.ts`'te (**mock:** tarayıcının localStorage'ı, anahtar `pikamd:collection`, en yeni başta; `useSyncExternalStore` ile tüm kartlar ve sekmeler senkron). Adım 8'de gerçek koleksiyon API'sine (Supabase + SIWE) geçer; sadece bu dosya değişir. |
| `CollectionPanel.tsx` | My Collection rafı: başlık satırı (**"Saved guidelines"** + altın sayaç rozeti, sağda "Connect your agent" butonu, altında kesik altın çizgi) + kaydedilen kartlar. Kartlar ortalanmış satırlarda (flex-wrap, yarım kalan son satır da ortada → simetrik), aralık 22px (iki çerçeve + 16px). Panel genişliği tam 4 kart + eşit iç boşluk (28px). Boşken: "Your library is empty." + "Explore guidelines" butonu. Hidrasyondan önce içerik boş (sunucu localStorage'ı göremez). |
| `search/ExploreSearch.tsx` (+ `search/Marked.tsx`) | Explore arama çubuğu (ARCHITECTURE §11.1): şeritlerin üstünde, `min(800px, 100% - 40px)`, 54px (kısa ekranda ve mobilde 48px) piksel kutu: altın büyüteç 27px (9 piksellik harita × 3, keskin), VT323 25px (kısa ekran 23, mobil 20), sağda `/` tuşu ipucu veya ✕ temizle (kullanıcı isteğiyle büyütüldü, 2026-10-12); odakta altın çerçeve + ışıma. Açılır panel kutunun 15px altında (çerçeveler değmez), opak, altın çerçeve, kendi içinde kayar (`min(62svh, 560px)`): Type / Tags düğmeleri (basılıyken altın), sonuçlar (2px çerçeveli satırlar, seçili olan altın çerçeve), dosya satırları koyu şeritte numaralı, vurgular altın zemin + koyu yazı (`.srch-mark`), uyarılar turuncu, altta kesik çizgi + söz dizimi ipucu. Sonuçtan açılan önizlemede eşleşen satır `.mdp-hit` (altın sol şerit + zemin). Mobilde klavye ipuçları gizli, panel ekran içinde. URL'yi okuduğu için `Suspense` içinde; yedeği aynı boyutta `SearchBoxShell` (kayma yok). |
| `MdLanes.tsx` | Explore'daki sonsuz akan şeritler. **Şeritteki kartlar kompakt** (kullanıcı isteği, 2026-10-12): 272px (mobil 264px), başlık 20px, özet 16px, butonlar 27px, buton arası 15px (iki çerçeve + 9px); sadece tam piksel ölçüler (zoom/scale yok → çerçeveler keskin), diğer sayfalardaki kartlar (Collection, Publish önizlemesi) tam boy kalır. Ölçüldü: 36 kartın hepsi "✓ Added" durumundayken bile dört buton tek satıra sığıyor. Kartlar iki kopya render edilir, `-50%` kaydırılır (kesintisiz döngü). Saf CSS animasyon, hover'da durur. İkinci kopya `aria-hidden` + butonları `tabIndex=-1`. **`inert` kullanma:** fare etkileşimini de kapatır, o kartlarda hover ışığı yanmaz ve butona basılamaz (2026-10-09'da yaşandı). |
| `LikeButton.tsx` / `TipButton.tsx` | ♥ beğeni (K22, **gerçek**: sunucu + cüzdan oturumu) ve ★ Tip (bağış K21 henüz yok → "Coming soon" balonu). Kalp: bağlı değilken cüzdan seçicisini açar, bağlanınca beğeni kendiliğinden devam eder; ilk beğenide tek ücretsiz imza; beğenilince altın ve kilitli, tekrar basınca "You liked this. Likes are permanent" balonu (`md-note-start`: kalp kartın solunda olduğu için balon sağa açılır, panelin içinde kalır). Sayı önce ekranda artar, sonra sunucunun sayısını alır. Hata/iptal mesajları aynı balonda. |
| `wallet/WalletButton.tsx` | Navbar'daki cüzdan: bağlı değilken "Connect Wallet" (ghost buton), bağlıyken **sadece kısa adres** (`0x3C44…93BC`; PikaGold 2026-10-13'te yanındaki ayrı kutuya taşındı). Basınca opak panel: "Connected wallet", adres + Copy address, **N PikaGold** (PikaGold sikkesi + Jersey, altın) + "You earn 1 PikaGold for every like on guidelines you share", Disconnect. Esc / dışarı tıklama kapatır. Mobil menüde panel akış içinde açılır. Hidrasyondan önce hep "Connect Wallet" (sunucu cüzdanı göremez). |
| `wallet/PikaGoldBox.tsx` + `PikaGoldCoin.tsx` | **PikaGold kutusu (2026-10-13, kullanıcı isteği):** navbar'da cüzdan butonunun **sağında**, ghost buton iskeleti (34px, aynı çerçeve + 3D taban, arası 18px). İçinde **PikaGold sikkesi** + sayı (Jersey 24px, altın, `--g4` gölge). Sikke 15×15 ASCII harita, **2× (30px)**; logoyla uyumlu ama aynısı değil: mürekkep dış hat, altın kenar (sol-üst açık / sağ-alt koyu kabartma), içi çökük koyu amber (`--g2`), ortada kabartma **Pikachu yüzü** (siyah kulak uçları, mürekkep gözler + burun, logodaki kırmızı yanaklar `#E23A28`). Animasyon (hepsi `steps`): her 4,8 sn'de açık renkli çapraz şerit sikkenin üzerinden **2 piksellik sıçramalarla** geçer (hover'da hemen bir kez), ardından kenarda piksel ışıltı (nokta → artı → nokta); PikaGold artınca sikke 2px adımlarla **zıplar**, kutunun üstünde **"+N"** belirip yükselerek söner (sikkenin üstünde sarı üstüne sarı kalıp okunmuyordu). Bağlı değilken `–`, tıklayınca cüzdan seçicisi; bağlıyken tıklayınca altta balon "You earn 1 PikaGold for every like on guidelines you share" (2,6 sn). Profil alınamazsa (production'da backend yokken 503) sonsuz `…` yerine `–` ve balon "PikaGold opens with wallet sign-in. Coming soon"; cüzdan menüsü "PikaGold isn't available right now". ≥10.000 kısaltılır (12.3K), tam sayı `aria-label`'da. **Mobilde de görünür** (☰'nin solunda). `prefers-reduced-motion`'da animasyon yok. Ölçüldü (CDP): 1440'ta yükseklik 34, aralık 18; 390'da taşma yok; gerçek beğeniyle 96 → 97 ve "+1" görüldü. |
| `wallet/WalletModal.tsx` | Cüzdan seçici: native `<dialog>` (odak içeride, Esc kapatır), karartılmış zemine tıklama kapatır. Önizlemeyle aynı opak panel + altın çerçeve, başlık "Connect a wallet", EIP-6963 cüzdanları ikon + adla; beklerken "Check your wallet…", 30 sn sonra "Your wallet didn't answer…". Cüzdan yoksa MetaMask / Rabby linkleri. Altta dürüstlük notu: bağlanmak ücretsiz ve sadece adresi paylaşır, ilk beğeni tek ücretsiz imza ister. |
| `wallet/WalletProvider.tsx` | wagmi + TanStack Query sağlayıcısı (layout'ta), tek cüzdan seçici ve oturum senkronu (bağlantı kesilince / hesap değişince oturumu kapatır). |
| `TradingCard.tsx` | **Koleksiyon kartı** (Pokémon TCG düzeni, logo/isim kullanılmadan): etiket · isim · büyük değer · enerji ikonu → resim penceresi → altın şerit → koyu metin panelinde 2 "hamle" → kart numarası. Tema sınıfıyla renklenir. `footer` ve `flavor` opsiyonel. |
| `VisionCards.tsx` | Ana sayfadaki kart dizisi (aşağıda §3.1). |
| `VisionPanel.tsx` | Ana sayfada 3 kartın hemen altındaki büyük piksel panel **"How PikaMd works"** (§3.2a). |
| `PixelGlyph.tsx` | ASCII haritadan küçük piksel ikonlar (`file`, `collect`, `plug`, `shield`); `#` yüz, `-` iç detay (ink). Renkler CSS'ten: `--glyph-face/-light/-shade/-ink`. |
| `PixelCoin.tsx` / `PixelHeart.tsx` / `PixelArcLogo.tsx` | ASCII haritadan çizilen piksel görseller; ortak dil: açık sol-üst kenar, koyu sağ-alt kenar, 1px dış hat. |

### 2.1 Koleksiyon kartı kuralları
- Boyut **250px** genişlik, oran **63:88** (minimum; içerik büyürse kart uzar, yazı asla kesilmez).
- **Okunurluk önce:** parıltı ve tarama çizgileri **sadece resim penceresinde**; metinler koyu panelde, krem renkte, açıklamalar 16px. Her açıklama **tek satır** (~30 karakter).
- Tema = tek CSS sınıfı (`.tcg-purple`, `.tcg-arc`, `.tcg-green`): `--tcg-1..5` zemin tonları, `--frame*` çerçeve, `--stat*` değer rengi, `--strip-*` şerit, `--energy-*` enerji ikonu, `--art-glow`, resim renkleri (`--arc-*`, `--heart-*`).
- Yeni kart = `VisionCards.tsx`'e bir `<TradingCard>` + gerekirse yeni tema sınıfı + piksel görsel bileşeni.

---

## 3. Sayfalar (güncel durum)

| Rota | İçerik | Durum |
|---|---|---|
| `/` | **Ana sayfa (vizyon).** Başlık *"Built by the community / for the community"* + iki satır alt yazı + koleksiyon kartları + altında **"How PikaMd works"** paneli (§3.2a). Akan şerit **yok**. Navbar logosu buraya gider. | ✅ UI (mock) |
| `/explore` | Başlık *"Give your agent / a creative edge"* + iki satır alt yazı (ana sayfayla aynı `hero-title` / `hero-sub` düzeni) + **arama çubuğu** (açılır sonuç listesi, §2 `ExploreSearch`) + iki sonsuz şerit (üst sağdan sola, alt soldan sağa, ~20px/sn), navbar ile aynı genişlikte (20px kenar). Kartlar mock veriden; yazarlar İngilizce nick veya kısa cüzdan adresi. | ✅ UI (mock) |
| `/collection` | Başlık *"Your agent's / personal library"* + alt yazı *"Every guideline you've collected, in one place / Connect your agent once and it can read them all over MCP"* (ana sayfa düzeni) + `CollectionPanel` (Explore'da kaydedilenler, mock localStorage). Kart butonuyla koleksiyondan çıkarılabilir. | ✅ UI (mock) |
| `/new` | **Publish.** Başlık *"Contribute to the community / by sharing your guidelines"* + tek satır alt yazı *"Earn tips, collect likes and get PikaGold"* (kullanıcı metni, 2026-10-10; eski "Share what makes your agent great…" metni kaldırıldı; gizlilik mesajı artık I–IV kareleri ve Clean up'ta) + 4 adımlı görev paneli (`components/publish/`). Ayrıntı §3.2. | ✅ UI (demo yayın) |
| `/connect` | **Connect your agent.** Başlık *"Connect your agent / to your library"* + alt yazı *"Paste one prompt into Claude Code, Cursor, VS Code or Codex / Your agent reads your collection over MCP, no downloads"* + `ConnectPanel` (§3.3). | ✅ UI (demo) |
| 404 | `ComingSoon` paneli | ⏳ |

- Başlıklarda ve alt yazılarda **sondaki noktalama yok** (kullanıcı kararı: görüntüyü bozuyor). Alt yazıda her cümle kendi satırında başlar (mobilde de `display: block`), yoksa noktasız cümleler birbirine karışır.
- Ana sayfa yerleşimi: içerik navbar'ın hemen altından başlar (`.page-center-high`), başlık + alt yazı ayrıca `top: -32px` ile yukarıda; kartlar 700–1080px yüksekliğindeki ekranların hepsinde ilk ekrana sığar.
- Alt yazı (onaylı metin): *"Share your guidelines with the community and build on the best of what others have shared / The decentralized guideline platform for getting the most out of your AI agents"* (masaüstünde tam 2 satır, her cümle bir satır).
- Explore alt yazısı (onaylı metin): *"Browse guidelines shared by the community / Add the ones you like to your collection and your agent can use them over MCP"* Arama çubuğu alt yazının altında, hero metniyle birlikte 32px yukarı kaldırılır; şeritler `-18px` ile ona yaklaşır → arama çerçevesi ile kart çerçeveleri arası her ekranda **24px** (iki çerçeve + 18px net). Yüksekliği ≤820px ekranlarda (`.explore-hero`) üst boşluk 22px, başlık `6svh` ve alt boşluğu 10px, alt yazı boşluğu 12px, arama kutusu 48px, şerit/kart aralıkları daralır → iki şeridin butonları ilk ekrana sığar (CDP ölçümü 2026-10-12, kompakt kartlar + büyük arama: 1280×720'de son buton 704px, 1366×768'de 713px; 1440×900'de 836px). Başlık ile navbar'ın kesik çizgisi arası 720px'te ~15px.

### 3.1 Ana sayfadaki kartlar
| No | Tema | İçerik | Not |
|---|---|---|---|
| 001 | Mor, altın çerçeve | **Platform Fee · FEE 0%** · piksel para · "Owned by the community" · Free to Use (0) / Publish (<1¢) | "0 işlem ücreti" yazılmadı: yayınlamak Arc gas'ı ister. Doğru ifade **0% platform ücreti**. |
| 002 | Lacivert, gümüş-beyaz çerçeve | **Build on Arc · BLOCK 0.5s** · piksel Arc logosu · "Native Arc dApp" · Instant Final (1) / Stable Gas (USDC) | Bilgiler ARC.md'den doğrulanmış. Logo resmi `arc-icon.svg`'den rasterize edildi (`design/arc-logo/`). |
| 003 | Zümrüt yeşili, altın çerçeve | **Tip Authors · AUTHOR 100%** · atan piksel kalp · "Wallet to wallet on Arc" · Send a Tip (USDC) / Direct Payout (0%) | K21; Faz 6'da kodlanacak. |

### 3.2a Ana sayfa vizyon paneli (`VisionPanel`, 2026-10-10)
- 3 kartın hemen altında, `pixel-panel` zemini, genişlik `min(1080px, 100% - 40px)`.
- Üstte altın rozet **"HOW PIKAMD WORKS"**, başlık *"One library / for every agent"* (ikinci kısım sarı), iki satır alt yazı (her cümle kendi satırında, nokta yok), altında kesik altın çizgi.
- **4 kare** (siyahımsı → koyu altın degrade + silik 16px piksel dama deseni, koyu altın çerçeve, hover'da altın çerçeve ve 3px yükselme `steps(2)`): **01 Share · 02 Collect · 03 Connect · 04 Stay safe** (güvenlik karesi, kullanıcı isteği: "Ask" yerine; kalkan ikonu). Masaüstünde 4 sütun ve en az kare (`min-height` container query ile, `aspect-ratio` değil: stretch ile birlikte genişliği büyütüp kareleri birbirine değdiriyordu); tablet 2×2 ve mobil tek sütunda kare zorunluluğu yok. Aralık 22px (iki çerçeve + 16px).
- Altta **"For example, in your agent"** terminal kutusu: ürünün kalbindeki cümle (koleksiyondaki Secure Solidity ile CLAUDE.md'yi tamamla) + 3 yeşil ✓ adım (`my_collection`, `get_guideline secure-solidity@v3`). Yanıp sönen imleç.
- En altta güven şeridi: No account needed to read · Authors recorded on Arc · Works with any MCP agent · 0% platform fee.
- ⚠ MCP sadece yerel önizlemede çalışıyor; sabitlenmiş sürüm ve Arc kaydı henüz yok (Adım 7–8); panel vizyonu anlatıyor. Yayına açılmadan önce bu özellikler hazır olmalı ya da metin "coming soon" demeli (§7).

---

### 3.2 Publish akışı (`/new`, `components/publish/`)
- **Adım çubuğu** (`StepBar`): 4 piksel kutu, kesik altın hat. Biten adım altın + ✓ (tıklanır), aktif adım yanıp sönen çerçeve, sonraki adımlar kilitli. Bir adım ancak öncekiler tamamsa açılır (`PublishFlow` → `reachable`); **Clean up atlanamaz**.
- **1 File** (`StepFile`): sürükle-bırak / dosya seç / "No file yet? Write one from scratch". Drop alanının altında **"How to share a guideline"**: **I–IV** roma rakamlı 4 kare (Ask your agent for a clean copy · Upload the clean copy · Check what we found · Describe and publish); tek cümle, sonda nokta yok. Altında **"Prompt for your agent"** kutusu + **Copy prompt** butonu (`CLEAN_COPY_PROMPT`): yazarın kendi ajanı (Claude Code, Cursor…) kişisel veri / sır / proje adlarını yer tutucuyla değiştirip `CLAUDE.shared.md` kaydeder; bizim kural tabanlı filtremiz ikinci kontroldür (kullanıcı kararı 2026-10-10; platformda AI yeniden yazma yok, reddedilen fikirlerle çelişmez). `CLAUDE.shared.md` / `SKILL.x.md` gibi adlar tür tahmininde tanınır. Masaüstü 4 sütun, tablet 2×2, mobil tek sütun. (Şablonlar kaldırıldı, kullanıcı kararı; tür etiketleri `KIND_INFO` olarak `lib/publish/templates.ts`'te kaldı.) Editör (VT323 textarea) + canlı önizleme (`MarkdownPreview`: react-markdown + remark-gfm + **rehype-sanitize**, frontmatter ayrı kutuda). Boyut göstergesi `x / 512 KB`; >100 KB uyarı, >512 KB kilit. Mobilde Write / Preview sekmeleri. Yüklemede görünmez karakterler temizlenir, tür dosya adından tahmin edilir (`SKILL.md` → skill).
- **2 Clean up** (`StepCleanup`): özet kutusu (sayaçlar: kırmızı sır, sarı kişisel, turuncu inceleme, gri link) + dürüstlük notu ("Automatic checks catch common patterns, not everything"). Solda bulgular (aynı kural + aynı metin = tek karar, "Replace all (n)"), sağda dosya satır numaralı ve vurgulu (yapışkan). Sırlar **maskeli** gösterilir (`sk-ant••••••5f`), sadece Replace. Kişisel: Replace / Keep anyway. İnceleme: Remove / Keep for review. Yazar kendi gizli kelimelerini ekleyebilir ("Anything else private?"). Replace **sadece işaretli aralıkları** değiştirir. Zararlı satır içinde kişisel veri varsa satır turuncu şeritle işaretlenir, veri satır içinde sarı vurgulanır (metin iki kez çizilmez).
- **3 Details** (`StepDetails`): başlık (≤60, dosya adı `slug.md` canlı, mock'taki slug'larla çakışma kontrolü), özet (≤100, kart için ideal ≤80), tür (5 kutu), etiketler (≤5, `a-z0-9-`). **Lisans seçimi yok** (kullanıcı kararı 2026-10-10): her yönerge tek lisansla, `LICENSE` = CC BY 4.0 (`lib/publish/draft.ts`); Publish özetinde tek satır bilgi olarak gösterilir. Sağda **canlı Explore kartı** (`MdCard`, `inert`). Başlık/özet temizlenmiş dosyadan **Details'e girerken** doldurulur; kart metni de taranır, sızıntı varsa Continue kilitli.
- **4 Publish** (`StepPublish`): **"Demo mode"** bandı (cüzdan yok, hiçbir şey gönderilmez), özet tablo, inceleme notu, gas açıklaması ("usually less than a cent. PikaMd takes no fee"). **Publish (demo) butonu alttaki sabit satırda**, yanında soluk bir kalıcılık notu: *"Published guidelines are stored on IPFS and Arc, so treat them as permanent"* (K20 gereği söylenir; **onay kutusu yok**, kullanıcı kararı 2026-10-10). Sonra 4 aşama (Checking → IPFS → wallet → Arc) ve "Demo complete" ekranı. Sahte CID / tx gösterilmez.
- **Çalışma penceresi (≥1024px genişlik, ≥600px yükseklik):** Dosya yüklenince panel `is-working` olur; başlık + alt yazı gizlenir (`:has`), panel navbar'ın altından ekranın altına kadar sabit yükseklikte (`100svh - 124px`). Adım çubuğu üstte, Back / Continue altta **her zaman görünür**; uzun içerik kendi alanında kayar (editör bölmeleri, Clean up'ta liste ve dosya ayrı ayrı, Details'te form, Publish sütunu). Ölçüldü: 1280×720, 1440×900, 1920×1080'de 4 adımda da sayfa kaymıyor. Telefonda ve başlangıç ekranında normal sayfa akışı. Kaydırılan alanların içindeki `sr-only` öğelerin konum kapsayıcısı olmalı (yoksa formun dibinden taşıp sayfayı uzatıyor).
- **Taslak:** `lib/publish/draft.ts`, localStorage `pikamd:publish-draft` (300ms gecikmeli kayıt). Yenilemede kalınan adımdan devam; "Discard draft" / "Start a new guideline" siler.
- Renk token'ları: `--red` (sır), `--orange` (inceleme), `--green` (temiz/bitti). Panel içi `code` VT323.

### 3.3 Connect your agent (`/connect`, `components/connect/ConnectPanel.tsx`, 2026-10-12)
- Öncelik bilgisayarda geliştirme yapanlar (K11). Panel `min(980px, 100% - 40px)`, `pixel-panel`; adımlar kesik altın çizgiyle ayrılır, numaralar **01–04** (Jersey, sarı; Roma rakamı Jersey'de çubuk gibi okunuyordu).
- Üstte turuncu bant: geliştirmede **"Local preview"** (MCP sunucusu bu bilgisayarda örnek yönergelerle çalışıyor; key ve koleksiyon henüz cüzdana bağlı değil, tek key + tek koleksiyon bu bilgisayarda; metin 2026-10-12'de cüzdan girişi gelince düzeltildi), production'da **"Demo mode"** (MCP sunucusu ve cüzdan girişi orada henüz yok).
- `Create key` / `Revoke` sunucuyla konuşur (sadece hash gider, ARCHITECTURE §8.0); beklerken buton "Working…" ve kilitli, sunucu kaydedemezse kod **gösterilmez**, dürüst hata çıkar.
- **01 Create your key:** `Create key` → `pmd_` + 40 hex (`crypto.getRandomValues`) **bir kez** gösterilir + `Copy key` / `Revoke`. Tarayıcıya **sadece maskeli iz** (`pmd_3f9a…c21e`) ve tarih yazılır (`pikamd:mcp-key`, `lib/mcp/key-store.ts`); tam kod hiçbir yerde saklanmaz (gerçek tasarımdaki hash mantığı). Yenilemede iz + `Create a new key` (eskisini geçersiz kılar) + `Revoke`.
- **02 Paste this into your agent:** tek prompt (`agentPrompt`), ajan kendi uygulamasına göre kurar; yapamazsa adımları gösterir. Kod yokken `Copy prompt` kilitli, prompt `<YOUR_PIKAMD_KEY>` gösterir. Kutu 300px, içinde kayar (odaklanabilir). Dürüstlük notu: kod prompt içinde olduğu için ajanın sohbet geçmişinde kalır → elle kurulum önerilir.
- **03 Or set it up yourself:** sekmeler Claude Code · Cursor · VS Code · Codex (ok tuşlarıyla gezilir, WAI-ARIA tabs). Her biri "nereye" + kod + Copy + notlar. Biçimler ARCHITECTURE §8.1'deki resmi dokümanlardan; VS Code (`${input:…}`) ve Codex (`bearer_token_env_var`) dosyasında kod **yok**.
- **04 Ask your agent:** 3 örnek cümle + araç listesi (`search_guidelines`, `get_guideline`, `my_collection`) + koleksiyon sayısı / Explore linki.
- Ortak parça: `components/CopyButton.tsx` (Publish'teki "✓ Copied" geri bildirimiyle aynı). Saf mantık `lib/mcp/connect.ts` + 10 test (`lib/mcp/connect.test.mjs`; ör. üretilen kod yayın tarayıcısının `pikamd-key` kuralına takılıyor).
- MCP adresi sayfanın kendi origin'i + `/mcp` (domain kararı gelince otomatik doğru olur). Ölçüldü: 1440 ve 390 genişlikte taşma yok; tüm akış (üret → prompt dolar → sekmeler → yenile → iptal) CDP ile test edildi.

## 4. Veri katmanı
- Tipler: `web/lib/types.ts` (`Guideline`, `GuidelineKind` = rules | skill | prompt | agent | guide — K20).
- Okuma tek giriş noktasından: `web/lib/data/guidelines.ts` → `listGuidelines()`, `getGuideline(slug)`, `searchIndex(query)`. Şu an `mock-guidelines.ts`'teki 18 İngilizce örnek; Supabase + IPFS gelince **sadece bu dosya** değişir.
- Sunucu verisi (beğeniler, giriş nonce'ları): `web/lib/server/store.ts` → `AppStore` arayüzü; şimdi yerel dosya `web/.data/pikamd-dev.json` (ARCHITECTURE §9.3).

---

## 5. Marka varlıkları (`design/`, sitede yayınlanmaz)
| Dosya | Ne |
|---|---|
| `web/public/brand/pikamd-logo.png` | Navbar logosu: 25×37 piksel Pikachu sprite (kağıt fotoğrafından üretildi, altın dış çerçeve). `image-rendering: pixelated`, `unoptimized`. |
| `web/app/favicon.ico`, `icon.png`, `apple-icon.png` | **Site ikonları (2026-10-13):** aynı sprite, tam sayı ölçekle (keskin): favicon 48×48 (1×, içinde tek PNG), sekme ikonu 74×74 (2×, şeffaf), iOS ana ekran 180×180 (4×, `--bg0` zemin). Next'in varsayılan "N" favicon'u ve create-next-app'ten kalan `public/*.svg` dosyaları kaldırıldı. Sayfa başlıkları: "Explore · PikaMd", "My Collection · PikaMd", "Publish · PikaMd", "Connect your agent · PikaMd", "Page not found · PikaMd"; ana sayfa "PikaMd". |
| `design/logo/pikamd-x-profile.png` | X profil fotoğrafı (1000×1000, daire kırpmasına güvenli) |
| `design/logo/pikamd-x-header.png` | X kapak (1500×500): Pikachu AI logolarını (Claude, ChatGPT, Gemini, Mistral) kovalıyor; metinler İngilizce. Kaynak: `x-header.html` |
| `design/logo/*.mjs` | Sprite / profil / kapak üretim betikleri (sharp ile) |
| `design/arc-logo/` | Resmi `arc-icon.svg` + piksel haritayı üreten `arc-pixel.mjs` |

---

## 6. Geliştirme ortamı
- Uygulama `web/` klasöründe: **Next.js 16.4** (App Router, Turbopack, `cacheComponents`), React 19.3, Tailwind v4.
- Sunucu: `cd web && npm run dev -- -p 3001` → **http://localhost:3001** (3000 portu kullanıcının başka bir projesine ait; ona dokunma).
- Tailwind **PostCSS** üzerinden (`postcss.config.mjs`, `@tailwindcss/postcss`). Eski `@tailwindcss/turbopack` loader'ı CSS değişikliklerini izlemeyi bırakıyordu → kaldırıldı. `turbopackFileSystemCacheForDev: false`.
- Sunucuyu yeniden başlatırken **sadece** 3001'i dinleyen ve cwd'si `PikaMd/web` olan süreci durdur. `pkill -f "next dev"` kullanma (kullanıcının diğer uygulamasını kapattı).
- Bu Next sürümü eğitim verisinden farklı: kod yazmadan önce `web/node_modules/next/dist/docs/` içindeki ilgili rehbere bak (`web/AGENTS.md`). Örn. `next/image`'da `priority` yerine `preload`.
- Testler: `cd web && npm test` (64 birim testi: tarama, MCP, SIWE/oturum, beğeni, arama) · dev sunucu açıkken `npm run mcp:smoke` ve `npm run auth:smoke`. Cüzdan akışı headless Chrome'da EIP-6963 test cüzdanı enjekte edilerek denendi (imzayı CDP binding'iyle Node atar); arama da tarayıcıda uçtan uca denendi (masaüstü + 390px).
- **Git:** repo kökte (`PikaMd/`). Her iş kendi dalında (`feat/…`), main'e birleştirme kullanıcı onayıyla. Gizli dosyalar (`.env*`, `web/.data/`) git dışında; şablon `web/.env.example`.
- Doğrulama alışkanlığı: CSS değişikliği sonrası sunulan CSS chunk'ında yeni kuralı ara; görseli headless Chrome ile kontrol et (pencere en az ~500px genişlik açar; mobil için CDP `Emulation.setDeviceMetricsOverride`).

---

## 7. Açık konular (kullanıcıya sorulacak / karar bekleyen)
- **Gas'ı kim öder?** Yazar öderse kart "0% platform fee" kalır; platform sponsor olursa "Zero fees / publishing is free" yazılabilir (paymaster + kötüye kullanım limitleri gerekir, ARC.md §9).
- **Telif / marka:** Pikachu (logo, PikaStake arka planı, X görselleri) ve AI şirket logoları (X kapağı) yerelde sorun değil; **site herkese açılmadan önce** değerlendirilmeli. Arc'ın yayımlanmış marka kılavuzu bulunamadı; logoyu pikselleştirdik → yayın öncesi Arc/Circle kuralına bak.
- **Dokümanların dili:** ARCHITECTURE.md / ARC.md / CLAUDE.md / DESIGN.md şu an Türkçe (kullanıcı okuyor). İngilizceye çevrilsin mi sorusu cevap bekliyor. `design/logo/*.mjs` yorumları Türkçe → K18 gereği İngilizceye çevrilecek.
- **Bağış (K21) henüz yok:** yönerge kartlarındaki ★ Tip butonu "Coming soon" diyor; ana sayfadaki 003 kartı ve Publish başlığındaki "Earn tips" için de yayın öncesi ya özellik hazır olmalı ya da "coming soon" denmeli.
- **PikaGold (K22, 2026-10-12):** yönergelerine verilen her beğeni yazara 1 PikaGold (zincir dışı itibar puanı). Beğeni sadece cüzdan + SIWE oturumuyla, cüzdan başına yönerge başına 1, kalıcı, yazar kendine de verebilir. Kartlardaki ♥ artık K22'ye göre çalışıyor (yerel depo, ARCHITECTURE §9.3). PikaGold'un ne işe yarayacağı (rozet, sıralama…) henüz açık.
- **Lisans:** yazar seçmiyor; tek lisans şimdilik CC BY 4.0 (öneri, onay bekliyor; CC0 tek satırlık değişiklik).
- Sıradaki öneriler: yönerge detay sayfası `/g/[slug]` (en önemli sayfa); kontrat (Adım 7, deploy cüzdanı + faucet USDC kullanıcıdan); Supabase + IPFS (Adım 6); MCP key ve koleksiyonun cüzdana bağlanması; gerçek backend gelince `/connect`'e canlı bağlantı durumu ("✓ connected · last used…").
- **Connect sayfası açık noktalar:** domain yok (adres şimdilik sayfanın origin'i); VS Code / Cursor tek tık kurulum linkleri resmi dokümanda tam doğrulanamadı → eklenmedi; claude.ai / Desktop / mobil OAuth fazında gelir (ARCHITECTURE §8.1).
