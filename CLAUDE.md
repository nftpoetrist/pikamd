# PikaMd — Claude Çalışma Kuralları

Proje mimarisi ve alınmış tüm kararlar:
@ARCHITECTURE.md

Doğrulanmış Arc ağ bilgileri (mainnet + testnet), kod şablonları ve PikaStake'ten öğrenilen dersler:
@ARC.md

Piksel tasarım sistemi, bileşenler, sayfaların güncel hali, geliştirme ortamı ve açık konular:
@DESIGN.md

## Bağlam
- Arc mainnet üzerinde, kâr amacı gütmeyen, tamamen public bir MD yönerge paylaşım platformu.
- **Durum (2026-10-12): arayüz mock veriyle hazır; cüzdan + SIWE + beğeni/PikaGold çalışıyor (yerel depo).** `web/` (Next.js 16.4) çalışıyor: ana sayfa, `/explore` (arama çubuğu + akan şeritler; kartlarda OPEN önizleme, ♥ beğeni, ★ Tip, + Add), `/collection` (mock koleksiyon), `/new` (4 adımlı Publish + kişisel veri / sır tarayıcısı, demo yayın), `/connect` (Connect your agent: kod + ajan prompt'u + Claude Code/Cursor/VS Code/Codex kurulumu, demo), piksel navbar, sayfa geçişleri. Testler: `cd web && npm test` · dev sunucu açıkken uçtan uca: `npm run mcp:smoke` (MCP), `npm run auth:smoke` (cüzdan girişi + beğeni). MCP sunucusu `/mcp` yerel önizlemede çalışıyor (mock veri, ARCHITECTURE §8.0). Arama: site ve MCP aynı motor (`web/lib/search/`, ARCHITECTURE §11.1). Cüzdan: wagmi 3 + kendi seçicimiz, SIWE oturumu (`web/.env.local` → `PIKAMD_SESSION_SECRET`), ARCHITECTURE §9.3. Kontrat ve gerçek backend (Supabase/IPFS) henüz yok. **Nerede kaldığımız: aşağıdaki "Nerede kaldık" bölümü** (ayrıntı: ARCHITECTURE.md §15.1, DESIGN.md §3, §7).
- Ana özellik: kullanıcı sitede yönergeleri koleksiyonuna ekler, AI ajanı (Claude Code, Cursor, VS Code, Codex… MCP uyumlu her araç) MCP ile koleksiyona doğrudan erişir. Bağlantı sayfası: "Connect your agent" (`/connect`).
- `ARCHITECTURE.md` §2'deki kararlar (K1–K22) ve "Reddedilen fikirler" kesinleşti; bunları yeniden önerme. §16'daki açık soruları ilgili adıma gelince kullanıcıya sor.
- Eski proje (referans): `/Users/nftpoetrist/Desktop/AI Corpus/app/` — Aptos + Shelby üzerinde AI Corpus. Taşınacak parçalar ARCHITECTURE.md §14'te.

## Kullanıcı tercihleri
- **Dil kuralı (kesin, 2026-10-09):** Ürünle ilgili her şey **İngilizce** — site arayüzü ve tüm metinleri, sayfa başlıkları/açıklamaları, hata mesajları, erişilebilirlik etiketleri, kod, kod yorumları, commit mesajları, MCP araç adları/cevapları, sosyal medya görselleri (X profil/kapak). **Kullanıcıyla sohbet Türkçe.**
- Kullanıcıyla **Türkçe** iletişim kur.
- Adım adım ilerle: önce vizyon → tasarım → geliştirme. Büyük adımlardan önce planı kısaca göster.
- **Görsel dil: oyunlaştırılmış, okunaklı piksel sanatı** + premium kalite (eski "glass UI" yerine). Kurallar DESIGN.md §1'de: piksel çerçeve tekniği, simetri/boşluk kuralı (çerçeveler asla birbirine değmez), Jersey 10 + VT323, renk token'ları. Okunurluk her zaman süslemeden önce gelir.
- **Tailwind v4'te dinamik değerler için className yerine her zaman inline `style={{}}` kullan** — dinamik class'lar eski projede çalışmadı. Bileşen CSS'i `@layer components` içinde.
- Arc ağ bilgilerini (chain ID, RPC, USDC ondalık sayısı) tahmin etme; önce `ARC.md`'ye bak, orada yoksa veya `⚠ DOĞRULA` etiketliyse resmi dokümandan (docs.arc.io / Arc docs MCP) doğrula ve `ARC.md`'yi güncelle.
- Ürün metinlerinde dürüst ol: gerçekte olmayan bir şeyi vaat etme (örn. yayınlamak Arc gas'ı ister → "0% platform fee", "0 fees" değil).

## Çalışma şekli
- Geliştirme sunucusu: `cd web && npm run dev -- -p 3001` → http://localhost:3001. 3000 portu kullanıcının başka projesine ait; ona dokunma. Yeniden başlatırken sadece 3001'deki `PikaMd/web` sürecini durdur (`pkill -f "next dev"` kullanma).
- Bu Next.js sürümü eğitim verisinden farklı: kod yazmadan önce `web/node_modules/next/dist/docs/` rehberine bak.
- Her UI değişikliğinden sonra sonucu kendin doğrula (tip kontrolü, lint, sunulan CSS'te yeni kural, headless Chrome ekran görüntüsü / CDP ölçümü) ve kullanıcıya ne gördüğünü söyle.
- UI'da yapılan önemli değişiklikleri ve yeni kararları DESIGN.md / ARCHITECTURE.md'ye işle.
- **Git:** repo `PikaMd/` kökünde. Her iş kendi dalında (`feat/…`); main'e birleştirme ve push kullanıcı onayıyla. `.env*` ve `web/.data/` asla commit edilmez (şablon: `web/.env.example`).
- **Hiçbir şeyi varsayma (kullanıcı isteği, tekrar tekrar söylendi):** kütüphane API'lerini kurulu paketin kaynağından / tip dosyalarından, Next kurallarını `node_modules/next/dist/docs/`'tan, Arc bilgisini ARC.md / docs.arc.io'dan, mock veriyi dosyadan oku; test verisi bile tahminle yazılmaz. UX kararlarında (sonuç nasıl görünsün, hangi özellikler) önce kullanıcıya sor.
- **Bitti demeden önce:** `npx tsc --noEmit` + `npx eslint app components lib scripts` + `npm test` + (dev sunucu açıkken) `npm run mcp:smoke` ve `npm run auth:smoke`; UI işlerinde headless Chrome ile ölçüm + ekran görüntüsü; büyük işlerde `npx next build` (sonra `npx next typegen`, yoksa eski `.next/types` tip kontrolünü bozar). Headless Chrome'u her seferinde kapat.

## Nerede kaldık (2026-10-12 oturumu sonu)
Yeni oturum buradan devam eder. Ayrıntılar ilgili bölümlerde; bu bir özet ve yol gösterici.

**Bu oturumda yapılanlar (sırayla):**
1. Footer: ince (46px), tam genişlik, alta yapışık şerit (DESIGN §2 `Footer.tsx`). Sayfa sonundaki esnemede arka plan görünmesi için denenen çözümler (overscroll kapatma, sticky arka plan) **kullanıcı isteğiyle geri alındı**; konu açık değil, kullanıcı şu anki hali kabul etti.
2. Git kuruldu (kök dizinde, `main` = ilk commit).
3. **Cüzdan + SIWE girişi + beğeni/PikaGold (K22)** → ARCHITECTURE §9.3. wagmi 3 + kendi piksel cüzdan seçicimiz (RainbowKit wagmi 3'ü desteklemiyor). Arc Studio'ya incelettik (doğrulanmamış ajan çıktısı); önerilerinden 30 sn bağlanma zaman aşımı, sunucu zamanlı imza ve checksum'lı adres uygulandı.
4. **Explore araması** → ARCHITECTURE §11.1. Açılır liste (şeritler akmaya devam eder), tür/etiket düğmeleri, dosya içi eşleşen satırlar, yazım hatası toleransı, sorgu dili; MCP `search_guidelines` aynı motoru kullanır.
5. Explore şerit kartları kompakt (272px), arama çubuğu büyük (800×54) → DESIGN §2.
6. Dokümanlar ve eskimiş UI metinleri (Connect / Publish'teki "cüzdan yok" ifadeleri) güncellendi.

**Git durumu:** `main` ← `feat/wallet-siwe-likes` (cüzdan + beğeni) ← `feat/explore-search` (arama + kompakt kartlar + doküman güncellemesi, **şu an checkout edilmiş dal**). İkisi de **main'e birleştirilmedi**; kullanıcıya sorulacak. Yeni iş başlamadan önce hangi daldan devam edileceğini netleştir.

**Sıradaki adım (kullanıcının önerdiğimiz sırayı onayladığı plan):** Adım 7 — `GuidelineRegistry` kontratı (Foundry + testler + Arc testnet deploy, K17: kendi keystore cüzdanımızla, explorer verify). **Kullanıcıdan gerekenler:** deploy için yeni ve ayrı bir cüzdan (özel anahtarı keystore'a kendisi girer), faucet.circle.com'dan testnet USDC. Foundry (arc-foundry) bu makinede **kurulu değil**. Sonra Adım 6 (Supabase + IPFS; IPFS servisi Pinata mı Filebase mi → kullanıcıya sor). Kullanıcı kontrattan önce başka işler yapmak istediğini söyledi; yeni oturumda önce ne istediğini sor.

**Bekleyen kararlar / açık konular:** dalların main'e birleştirilmesi · PikaGold ne işe yarayacak (rozet, sıralama…) · WalletConnect için Reown proje kimliği (kullanıcı açacak) · lisans CC BY 4.0 onayı · domain · gas'ı kim öder · rate limit (Upstash) · ilk işlem özelliğinden önce `wallet_addEthereumChain` / ağ değiştirme yolu (ARCHITECTURE §9.3) · ARCHITECTURE §16 ve DESIGN §7'deki diğer maddeler.
