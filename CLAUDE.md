# PikaMd — Claude Çalışma Kuralları

Proje mimarisi ve alınmış tüm kararlar:
@ARCHITECTURE.md

Doğrulanmış Arc ağ bilgileri (mainnet + testnet), kod şablonları ve PikaStake'ten öğrenilen dersler:
@ARC.md

Piksel tasarım sistemi, bileşenler, sayfaların güncel hali, geliştirme ortamı ve açık konular:
@DESIGN.md

## Bağlam
- Arc mainnet üzerinde, kâr amacı gütmeyen, tamamen public bir MD yönerge paylaşım platformu.
- **Durum (2026-10-14): Arc testnet'te gerçek yayın uçtan uca çalışıyor; site henüz internette değil.** `web/` (Next.js 16.4): ana sayfa, `/explore` (arama + akan şeritler), `/collection` (⚠ hâlâ tarayıcıda, mock), `/new` (**gerçek Publish**: tarama → Pinata/IPFS → cüzdanla `register` → onay), `/connect` (⚠ MCP anahtarı hâlâ demo). Cüzdan + SIWE + beğeni/PikaGold Supabase üzerinden. Kontrat `GuidelineRegistry` Arc testnet'te (`contracts/`). Supabase iki proje (canlı + geliştirme). Indexer zincirdeki gizleme/kilitleri siteye taşıyor. MCP `/mcp` çalışıyor (işaretli içerik ajanlara gitmez). **Nerede kaldığımız: aşağıdaki "Nerede kaldık" bölümü.**
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
- **Bitti demeden önce:** `npx tsc --noEmit` + `npx eslint app components lib scripts supabase` + `npm test` (birim + PGlite şema testleri) + kontrat değiştiyse `cd contracts && arc-forge test` + (dev sunucu açıkken) `npm run mcp:smoke` ve `npm run auth:smoke` (geliştirme veritabanında çalışır, canlı projeyi reddeder; veri yoksa `npm run db:seed`); UI işlerinde headless Chrome ile ölçüm + ekran görüntüsü; büyük işlerde `npx next build` (sonra `npx next typegen`, yoksa eski `.next/types` tip kontrolünü bozar). Headless Chrome'u her seferinde kapat.

## Nerede kaldık (2026-10-15)
Yeni oturum buradan devam eder. **Hedef (kullanıcı isteği): projeyi adım adım Arc testnet'te yayına hazır hale getirmek, hiçbir şeyi varsaymadan.** Ayrıntılar: ARCHITECTURE §5.1 (kontrat), §7.1.1 (yayın), §7.4 (indexer), §9.3 (giriş), **§9.4 (güvenlik incelemesi 2026-10-15)**, §10.1 (veritabanı); ARC.md §6.3, §7, §8; DESIGN §3.2.

**Kullanıcı kararları (2026-10-13/14):** hosting **Vercel** (GitHub push → otomatik deploy, PikaStake gibi) · IPFS **Pinata** · GitHub **nftpoetrist** hesabı · lisans **CC BY 4.0** · gizleme = **yazar gizler + moderatör kilidi, iki ayrı bayrak** · Supabase **iki proje** (canlı + geliştirme).

**Git:** `main` = her şey (UI, cüzdan, arama, PikaGold kutusu, güvenlik başlıkları, kontrat, Supabase, geliştirme veritabanı). **Açık dallar, üst üste:** `feat/real-publish` (gerçek yayın + indexer + MCP filtresi) → `feat/unlike` (beğeni geri alınır, PikaGold kalır; `db:migrate`) → `feat/security-review` (2026-10-15 güvenlik incelemesi, ARCHITECTURE §9.4). `main`'e birleştirme kullanıcı onayı bekliyor. Henüz uzak repo yok, hiçbir şey push edilmedi.

**Altyapı (hepsi canlı ve doğrulandı):**
- **Kontrat:** `0x27cf926771B0A311A9574543ea29dc5e3ea59986` (Arc testnet, blok 67092487), admin = deployer = `0xd76B24F43bCF5C3fFe09906A7414CD4D02EA7cDe` (kullanıcının cüzdanı; anahtarı keystore `pikamd-deployer`, kullanıcı kendi terminalinden deploy etti). Sourcify ile doğrulandı (Arc explorer'ın Blockscout'u solc ≤0.8.36 biliyor). İlk deploy `0x8dA7…b4A1` delist hatası yüzünden terk edildi. Web'de `lib/chain.ts` → `REGISTRY`, ABI `lib/registry-abi.ts` (Foundry çıktısından üretilir).
- **Supabase:** canlı `sdjsvemkchgonznhbuku` (Vercel'e girecek; anahtarı `.env.local`'da yok) · geliştirme `bvtmtkkscseouplfinvj` (`.env.local`, `npm run db:seed` = 18 örnek, id'ler 900.000.001+). **7 migration iki projede de çalıştırıldı** (`web/supabase/migrations/`). **Migration'ları artık ben uygularım:** `npm run db:migrate` (geliştirme) / `npm run db:migrate -- live` (canlı, önce geliştirmede test), `-- --status` sadece listeler; Supabase Management API + `public.schema_migrations` kaydı. Token'lar `.env.local`'da `SUPABASE_ACCESS_TOKEN_DEV` / `_LIVE` (kapsamlı PAT, sadece Database: Read-write; iki proje ayrı kuruluşlarda → iki token; 2026-10-15, ⚠ ikisi de sohbete yapıştırıldı, yenilenmeli). Free plan: 7 gün kullanılmazsa duraklar.
- **Pinata:** scoped JWT (Files: Write), gateway `ivory-electrical-dog-795.mypinata.cloud`. Yüklemeler `network=public` (Pinata varsayılanı private).
- **`web/.env.local` (git dışında):** `PIKAMD_SESSION_SECRET`, `PINATA_JWT`, `PINATA_GATEWAY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (geliştirme projesi). ⚠ Kullanıcı değerleri 3 kez yanlışlıkla `.env.example`'a kaydetti; değerleri göstermeden taşıdım. Yeni anahtar gerekirse **terminalden `getpass` ile `.env.local`'a yazan, önce doğrulayan tek satırlık komut** ver. Gizli değerleri asla yazdırma. Commit kancası (`.githooks/pre-commit`, bu klonda açık) gizli değerleri engelliyor.
- **Test cüzdanı:** `0xE3494f1C76644d5976DdCB35b42770d5F9eA3A78`, ≈2,99 testnet USDC; anahtarı oturumun scratchpad'inde (`e2e/test-wallet.key`) → **yeni oturumda yok sayılır**; gerekirse yenisini üret, kullanıcıdan testnet USDC iste. Uçtan uca betik de scratchpad'deydi (headless Chrome + EIP-6963 enjekte cüzdan, imzalar Node'da).

**Yol haritası (kullanıcıya gösterilen sıra):**
1. ✅ Gerçek yayın + indexer (Explore sonrası `after()` ≤2 dk'da bir + günlük cron [Vercel Hobby: günde 1] + yayında anında; Arc testnet getLogs sınırı 10.000 blok)
2. ⏳ **Sırada:** yönerge detay sayfası `/g/[slug]` (+ `/raw`, "zincirde doğrulandı" rozeti) ve Explore'un boş liste görünümü → **önce kullanıcıya tasarımı sor**
3. ⏳ Koleksiyon ve "Connect your agent"in cüzdana bağlanması (Supabase `collections`, `mcp_keys`; şu an localStorage + `web/.data/mock-mcp.json`)
4. 🟡 Kötüye kullanım koruması: ✅ yazma uçlarında hız sınırı (veritabanı, Upstash gerekmedi) + yükleme sınırları (ARCHITECTURE §9.4); ⏳ okumalar için Vercel WAF kuralı (yayına almada) · ⏳ rapor/moderasyon ekranı (`setModeratorLock` + güvenli unpin)
5. ⏳ Yayına alma: `gh auth login` (nftpoetrist; şu an gh `pierrenode`), repo, Vercel projesi + env (canlı Supabase anahtarı, Pinata, yeni `PIKAMD_SESSION_SECRET`, `CRON_SECRET`, `PIKAMD_ALLOWED_HOSTS` — yoksa MCP canlıda 403), **Firewall → 1 rate limit kuralı** (`/api/` + `/mcp`, IP başına), fonksiyon bölgesi (Supabase Europe → Vercel `fra1`?), canlıda smoke
6. ⏳ Son kontroller: gerçek olmayan iddialar ("Earn tips", "Authors recorded on Arc" artık doğru; tip K21 yok), Pikachu/AI logoları, WalletConnect (Reown id), mainnet için ayrı admin/multisig

**Açık konular:** dalları `main`'e birleştirme onayı · "Earn tips" (Publish) ve ana sayfa 003 kartı bağış yokken vaat ediyor → kullanıcı kararı · PikaGold ne işe yarayacak · domain · gas'ı kim öder · yeni sürüm (`publishVersion`) akışı yok · terk edilen Pinata yüklemeleri (24 saatte süresi dolan ayırmalar) için unpin işi yok · ajan dosya okurken `/raw` yok.

**Araçlar:** arc-foundry v0.8.0-2 `~/.local/bin/arc-{forge,cast,anvil}` (macOS'ta libusb gerekiyor, kuruldu). Vercel CLI ve Supabase CLI yok.
