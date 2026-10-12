# PikaMd — Claude Çalışma Kuralları

Proje mimarisi ve alınmış tüm kararlar:
@ARCHITECTURE.md

Doğrulanmış Arc ağ bilgileri (mainnet + testnet), kod şablonları ve PikaStake'ten öğrenilen dersler:
@ARC.md

Piksel tasarım sistemi, bileşenler, sayfaların güncel hali, geliştirme ortamı ve açık konular:
@DESIGN.md

## Bağlam
- Arc mainnet üzerinde, kâr amacı gütmeyen, tamamen public bir MD yönerge paylaşım platformu.
- **Durum (2026-10-12): arayüz geliştirmesi sürüyor, mock veriyle.** `web/` (Next.js 16.4) çalışıyor: ana sayfa, `/explore` (akan şeritler; kartlarda OPEN önizleme, ♥ beğeni, ★ Tip, + Add), `/collection` (mock koleksiyon), `/new` (4 adımlı Publish + kişisel veri / sır tarayıcısı, demo yayın), `/connect` (Connect your agent: kod + ajan prompt'u + Claude Code/Cursor/VS Code/Codex kurulumu, demo), piksel navbar, sayfa geçişleri. Testler: `cd web && npm test` · MCP uçtan uca: dev sunucu açıkken `cd web && npm run mcp:smoke`. MCP sunucusu `/mcp` yerel önizlemede çalışıyor (mock veri, ARCHITECTURE §8.0). Kontrat, cüzdan ve gerçek backend henüz yok. Nerede kaldığımız: ARCHITECTURE.md §15.1 ve DESIGN.md §3, §7.
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
