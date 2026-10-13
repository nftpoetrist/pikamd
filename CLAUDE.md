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

## Nerede kaldık (2026-10-13 oturumu)
Yeni oturum buradan devam eder. Hedef (kullanıcı isteği): **projeyi adım adım Arc testnet'te yayına hazır hale getirmek, hiçbir şeyi varsaymadan.** Plan ve durum aşağıda; ayrıntılar ARCHITECTURE §5.1, §9.2, §10.1, ARC.md §6.3.

**Kararlar (2026-10-13, kullanıcı):** hosting **Vercel** (PikaStake gibi GitHub push → otomatik deploy) · IPFS **Pinata** (JWT sadece sunucuda) · GitHub reposu **nftpoetrist** hesabında · lisans **CC BY 4.0** (kontratta lisans listesi kalır) · delist = **moderatör kilidi**.

**PikaStake nasıl çalışmıştı (referans, `~/Desktop/PikaStake`):** tek `index.html` (ethers.js), Vercel'de `main`'e push ile deploy; kontratlar Hardhat + `.env`'de düz `PRIVATE_KEY` (PikaMd'de yapılmaz: keystore, K17), verify `testnet.arcscan.app/api` Blockscout. ⚠ PikaStake `index.html`'inde herkese açık bir Pinata JWT var; kullanıcıya iptal etmesi önerildi.

**Git:** `main` = UI + cüzdan + arama + PikaGold kutusu + güvenlik başlıkları. Birleştirilmemiş dallar: `feat/guideline-registry` (kontrat, submodule'ler `contracts/lib/`) ve `feat/supabase-backend` (şema + Supabase deposu). İkisi de main'den ayrı; birleştirme kullanıcı onayıyla.

**Adımlar:**
- 0 ✅ commit'ler, dallar main'e birleşti · ⏳ GitHub repo (kullanıcı `gh auth login` ile nftpoetrist'e girecek; şu an gh `pierrenode`) · ⏳ Vercel projesi
- 1 ✅ `GuidelineRegistry` + 25 test + Deploy betiği, yerel arc-anvil + testnet simülasyonu · ⏳ **deploy**: kullanıcı yeni deploy cüzdanı açar, faucet USDC (≥0,1), `arc-cast wallet import pikamd-deployer --interactive` kendisi çalıştırır; **admin adresi** sorulacak → deploy → verify (`explorer.testnet.arc.io/api/`, Blockscout) → adres + deploy bloğu ARC.md/env
- 2 ✅ kod (şema, RLS, Supabase deposu, önbellekli okuma, 77 test) · ✅ **Supabase canlı (2026-10-13):** proje `sdjsvemkchgonznhbuku` (Europe, Free plan: 7 gün kullanılmazsa duraklar), Data API açık, "Automatically expose new tables" kapalı, "automatic RLS" açık; migration çalıştırıldı (kullanıcı 3 kez Run'a bastı, ilki yükledi). Canlı doğrulama: tüm fonksiyonlar secret anahtarla çalışıyor, nonce tek kullanımlık, anahtarsız/sahte anahtar 401, site girişi + beğeni özeti + profil Supabase üzerinden çalışıyor. Henüz yapılmadı: publishable anahtarla saldırı testi (isteğe bağlı, kullanıcıya önerildi). ⚠ DB boş → Explore'da boş durum tasarımı yok (Adım 4'te kullanıcıya sor)
- **`.env.local` (git dışında):** `PIKAMD_SESSION_SECRET`, `PINATA_JWT` (scoped, Files: Write; doğrulandı), `PINATA_GATEWAY` (`ivory-electrical-dog-795.mypinata.cloud`), `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. Kullanıcı iki kez değeri yanlışlıkla `.env.example`'a kaydetti; değerler gösterilmeden `.env.local`'a taşındı, `.env.example` geri alındı. **Gizli değerleri asla yazdırma; `.env.example`'ı her commit öncesi kontrol et.** Kullanıcının sohbete yapıştırdığı ilk Pinata anahtarı sızmış sayıldı (iptal edilmesi önerildi; kullanılan anahtar farklı).
- 3 ⏳ IPFS (Pinata, güncel API dokümandan doğrulanacak) + gerçek Publish: `prepare` (tarama + pin + pending) → cüzdanla `register` (ağ değiştirme yolu dahil) → `confirm` (receipt + event doğrulama) → indexer cron
- 4 ⏳ `/g/[slug]` detay sayfası (tasarımı kullanıcıya sor), `/raw`, hash rozeti · 5 ⏳ MCP anahtarı + koleksiyon cüzdana bağlı (Supabase) · 6 ⏳ Upstash rate limit, rapor + delist · 7 ⏳ yayın kontrolleri, gerçek olmayan iddialar için metin kararları (kullanıcıya sor), PIKAMD_ALLOWED_HOSTS / domain

**Araçlar:** arc-foundry v0.8.0-2 `~/.local/bin/arc-{forge,cast,anvil}` (macOS'ta libusb gerekiyor, kuruldu). Vercel CLI ve Supabase CLI yok (gerekmeyebilir).
