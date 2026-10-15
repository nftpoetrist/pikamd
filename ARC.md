# Arc Referansı — PikaMd için (Mainnet odaklı)

> **Son doğrulama: 2026-10-09.** Ağ bilgileri resmi dokümandan (docs.arc.io) alındı,
> mainnet RPC canlı test edildi (`eth_chainId` → `0x13b2`, `eth_gasPrice` → ~20 Gwei).
> PikaStake projesinde (Arc testnet, 2026 Nisan–Ağustos) yaşanan deneyimler §11'de.
>
> Kurallar:
> - Buradaki bir değer şüpheliyse **tahmin etme**, Arc docs MCP'sinden (§10) veya `https://docs.arc.io/llms.txt` üzerinden tekrar doğrula.
> - `⚠ DOĞRULA` etiketli satırlar henüz kesinleşmedi. İlgili adıma gelindiğinde kontrol et ve bu dosyayı güncelle.

---

## 1. Durum Özeti

| Konu | Durum |
|---|---|
| **Arc Mainnet** | ✅ **Canlı.** Public mainnet 16 Eylül 2026'da açıldı. Kontrat deploy etmek ve işlem göndermek izinsiz (herkese açık). Validator'lar ise izinli bir kurum seti. |
| Dokümantasyon adresi | **`docs.arc.io`** (eski `docs.arc.network` buraya 301 yönlendiriyor) |
| Gas token | **USDC** (native). ETH gerekmez. |
| EVM uyumu | Tam EVM. Hedef hard fork **Osaka**. Solidity, Foundry, Hardhat, viem, wagmi, ethers çalışır. |
| Finality | **Deterministik ve anında.** Blok bir kez çıktıysa kesindir. Reorg yok, 1 onay yeterli. |
| Blok süresi | ~0,5 sn (alt-saniye) |
| ARC token | Genesis mint yapıldı (10 milyar). Public lansmanı kararsız. **PikaMd için önemsiz:** gas USDC ile ödenir. |

---

## 2. Ağ Bilgileri

### Mainnet (birincil hedef)

| Alan | Değer |
|---|---|
| Ağ adı | `Arc` |
| Chain ID | **`5042`** (hex `0x13B2`) |
| CAIP | `eip155:5042` |
| Native para birimi | `USDC`, **18 ondalık** |
| Explorer | https://explorer.arc.io (API: `https://explorer.arc.io/api/v2`, Blockscout tipi) |
| CCTP domain | `26` |
| Faucet | Yok (gerçek USDC gerekir) |

**HTTP RPC:**
- Public: `https://rpc.mainnet.arc.io`
- Blockdaemon: `https://rpc.blockdaemon.mainnet.arc.io`
- dRPC: `https://rpc.drpc.mainnet.arc.io`
- QuickNode: `https://rpc.quicknode.mainnet.arc.io`
- Alchemy: `https://arc-mainnet.g.alchemy.com/v2/<API_KEY>`

**WebSocket (mainnet'te public WSS yok, sağlayıcı gerekir):**
- Alchemy: `wss://arc-mainnet.g.alchemy.com/v2/<API_KEY>`
- Blockdaemon: `wss://rpc.blockdaemon.mainnet.arc.io/websocket`
- QuickNode: `wss://rpc.quicknode.mainnet.arc.io`

> Public RPC'nin rate limit'i dokümanda yazmıyor. **Production'da (indexer, MCP sunucusu)
> API key'li bir sağlayıcı kullan** (Alchemy / QuickNode / dRPC). Public RPC'yi tarayıcıdaki hafif okumalar ve yedek (fallback) için tut.

### Testnet (geliştirme ve test)

| Alan | Değer |
|---|---|
| Ağ adı | `Arc Testnet` |
| Chain ID | **`5042002`** (hex `0x4CEF52`) |
| Native para birimi | `USDC`, 18 ondalık |
| Explorer | https://explorer.testnet.arc.io (eski: https://testnet.arcscan.app) |
| Faucet | https://faucet.circle.com |
| HTTP RPC | `https://rpc.testnet.arc.io` · Blockdaemon / dRPC / QuickNode: `rpc.<sağlayıcı>.testnet.arc.io` |
| WebSocket | `wss://rpc.testnet.arc.io` |
| CCTP domain | `26` |

> PikaStake testnet'te `https://5042002.rpc.thirdweb.com` RPC'sini kullanıyordu. Çalışıyordu ama
> `queryFilter` / log sorguları yavaş ve güvenilmezdi (bkz. §11). PikaMd'de resmi RPC'leri kullan.

---

## 3. USDC: Çift Ondalık Kuralı (EN ÇOK HATA YAPILAN YER)

Arc'ta USDC hem **native gas token'ı** hem de `0x3600…0000` adresinde bir **ERC-20**'dir.
**Bakiye tek ve aynıdır**, sadece iki farklı ondalıkla görünür:

| Bağlam | Ondalık | Nerede |
|---|---|---|
| Native (gas, `msg.value`, `eth_getBalance`, `value:`) | **18** | Gas tahmini, native gönderim |
| ERC-20 (`balanceOf`, `transfer`, `approve`, `allowance`) | **6** | Tüm uygulama mantığı |

```ts
parseUnits("1", 6)   // ERC-20 USDC miktarı  ✅
parseUnits("1", 18)  // native/gas miktarı   ✅ (yalnızca native bağlamda)
// 18 ↔ 6 dönüşümü: 10^12'ye böl / çarp
```

- Native ve ERC-20 USDC'yi arayüzde **iki ayrı bakiye satırı olarak gösterme**, ikisi aynı bakiyedir.
- `balanceOf() == 0` olması native bakiyenin sıfır olduğu anlamına gelmez. ERC-20 görünümü 1 mikro-USDC'nin altını keser.
- Kontratta `msg.value` (18) ile `USDC.balanceOf()` (6) değerlerini **aynı hesapta karıştırma**, sonuç 10¹² kat sapar.
- PikaMd'de ücretli içerik yok (K1). USDC sadece gas için kullanılacak, ileride belki bahşiş için (Faz 6).

---

## 4. Gas ve Ücretler

| Parametre | Değer |
|---|---|
| Model | EIP-1559 + EWMA yumuşatma (kısa ani yükselişler ücreti az etkiler) |
| **Minimum base fee** | **20 Gwei** (protokol zorunluluğu; mainnet'te 2026-10-09'da `eth_gasPrice` ≈ 20 Gwei) |
| Maksimum base fee | 20.000 Gwei (en kötü durum tavanı) |
| Priority fee (tip) | 0 kabul edilir. Yoğunlukta 1 Gwei önerilir. |
| Hedef maliyet | ~$0,001 / ERC-20 transferi |
| Blok gas limiti | 30M gas / blok (~60M gas/sn) |
| Base fee | Yakılmaz, blok üreticisine gider |

**Kritik kural:** `maxFeePerGas` **en az 20 Gwei** olmalı. Altındaki işlemler **receipt bile almadan sessizce düşer**
ve cüzdanda "pending" olarak takılı kalır. wagmi/viem normalde `eth_gasPrice` ile doğru tahmin yapar, elle ücret verirken dikkat et.

**PikaMd tahmini maliyeti (kabaca):**
`register()` ≈ 150–250k gas × 20 Gwei ≈ **0,003–0,005 USDC** işlem başına.
→ ARCHITECTURE §16'daki "Gas'ı kim öder?" sorusu için: yazar öderse kişi başı maliyet ihmal edilebilir düzeyde. Sponsorluk seçenekleri §9'da.

**Kullanıcıya gösterim:** Ücreti Gwei olarak değil **USDC** olarak göster (`gasUsed × effectiveGasPrice / 1e18` USDC).

**Yaygın hatalar:**
| Hata | Çözüm |
|---|---|
| `transaction underpriced` | `maxFeePerGas` ≥ 20 Gwei |
| `intrinsic gas too low` | Gas limit ≥ 21.000 veya `eth_estimateGas` |
| `insufficient funds for gas * price + value` | Cüzdanda yeterli USDC yok (native bakiye) |

---

## 5. EVM Farkları (Kontrat yazarken dikkat)

| Konu | Arc davranışı | PikaMd'ye etkisi |
|---|---|---|
| `PREVRANDAO` / `block.prevrandao` | **Her zaman `0`** | Zincirde rastgelelik yok. Gerekirse oracle/VRF kullan. (GuidelineRegistry'de ihtiyaç yok.) |
| `block.timestamp` | Azalmaz ama **aynı olabilir** (1 sn çözünürlük, blok 0,5 sn) | Sıralamayı **`blockNumber` + `logIndex`** ile yap, timestamp ile değil. `createdAt` gösterim için yeterli. |
| Değer içeren transfer → `0x0` | Revert | Native USDC yakmak yasak |
| Blocklist (USDC) | Runtime'da zorunlu. Blocklist'teki adrese/adresten değer transferi revert eder, gas yine harcanır. | Registry değer transferi yapmıyorsa etkilenmez |
| `SELFDESTRUCT` | EIP-6780 + ek revert kuralları. Kontratın USDC'si native olduğu için beneficiary'ye taşınır. | Kullanma (kontrat upgrade edilemez ve sade) |
| Blob tx (type-3) | Reddedilir | — |
| EIP-4788 beacon roots | Yok (`0x`) | — |
| EIP-7702, CREATE2, EIP-2935 | Ethereum ile aynı | — |
| EIP-7708 | Native USDC hareketleri sistem adresinden ERC-20 `Transfer` log'u üretir | Indexer'da çift sayım riskine dikkat (§7) |

- Yerelde Arc davranışını taklit etmek için: `arc-anvil --network arc` (standart `anvil` düz EVM'dir).
- Solidity: PikaStake `0.8.24` + optimizer 200 ile sorunsuz deploy edildi. `evm_version`'ı elle zorlamaya gerek yok. Özel bir ayar gerekirse docs'tan doğrula.

---

## 6. Kod Şablonları

### 6.1 viem / wagmi: zincir tanımı HAZIR (custom chain gerekmez)

viem `2.57.4` ile kontrol edildi:

```ts
import { arc, arcTestnet } from 'viem/chains'
// arc        → id 5042,    nativeCurrency USDC/18, explorer.arc.io, multicall3 dahil
// arcTestnet → id 5042002, nativeCurrency USDC/18
```

```ts
// lib/chain.ts — ortam değişkeniyle testnet/mainnet seçimi
import { arc, arcTestnet } from 'viem/chains'
import { createConfig, http, fallback } from 'wagmi'

export const CHAIN = process.env.NEXT_PUBLIC_ARC_NETWORK === 'mainnet' ? arc : arcTestnet

export const wagmiConfig = createConfig({
  chains: [CHAIN],
  transports: {
    [CHAIN.id]: fallback([
      http(process.env.NEXT_PUBLIC_ARC_RPC_URL), // API key'li sağlayıcı (tarayıcıya açık key → domain kısıtlı olmalı)
      http(),                                    // viem'in varsayılan public RPC listesi
    ]),
  },
  ssr: true,
})
```

⚠ **Not:** viem'deki `arcTestnet` tanımı hâlâ eski `rpc.testnet.arc.network` / `testnet.arcscan.app` adreslerini kullanıyor (viem 2.57.4'te tekrar kontrol edildi, 2026-10-12; PikaMd `lib/chain.ts`'te override ediyor).
Eski adresler çalışıyor ama resmi yeni adres `rpc.testnet.arc.io`. Testnet'te `http('https://rpc.testnet.arc.io')` ile override et.

**Cüzdan kütüphaneleri ile ilgili notlar (docs'tan):**
- **RainbowKit / wagmi:** viem zincirlerini kullandığı için `arc` doğrudan verilebilir. **2026-10-12:** RainbowKit'in son sürümü (2.2.11) sadece wagmi 2'yi destekliyor; PikaMd wagmi 3 + kendi seçicisini kullanıyor (ARCHITECTURE §9.3). viem'in `arc`/`arcTestnet` tanımlarında zincir ikonu yok.
- **SIWE (viem 2.57.4, kaynak okundu):** `generateSiweNonce` `Math.random` kullanıyor (kriptografik değil) → nonce'u `crypto.getRandomValues` ile üret. `verifySiweMessage` chainId/uri/version/issuedAt'i kontrol etmiyor → kendin kontrol et. Akıllı cüzdan imzaları (ERC-6492/1271) deployless `eth_call` ile doğrulanır; Arc Studio Arc'ta çalıştığını söyledi (doğrulanmamış, gerçek akıllı cüzdanla henüz denenmedi). ⚠ **2026-10-15 (kaynak okundu):** viem'in `verifyHash`'i varsayılan `mode: "auto"`da **her imza için önce** RPC'ye `eth_call` (ERC-6492 doğrulayıcı) yapar, ECDSA'yı ancak o hata verirse yerelde dener; yani normal cüzdanla giriş bile Arc RPC'sine bağımlı olur ve sahte imzalar RPC kotası harcatır. PikaMd `verifyHash(…, { mode: "eoa" })` kullanır: normal imza yerelde çözülür, sadece akıllı cüzdanlar RPC'ye gider. (`verifySiweMessage`'ın tipi `mode`'u kabul etmiyor; mesaj alanlarını zaten kendimiz doğruladığımız için doğrudan `verifyHash` çağrılıyor.)
- **ConnectKit:** `chains` içinde Ethereum `mainnet` yoksa CORS'u engelleyen bir ENS endpoint'ine düşer. `mainnet`'i CORS-güvenli bir transport ile ekle.
- **Reown AppKit:** `defineChain`'i `viem`'den değil `@reown/appkit/networks`'ten import et (`caipNetworkId` ve `chainNamespace` gerekiyor).
- **WalletConnect:** Arc (en azından testnet) WalletConnect zincir kayıtlarında yok. İlk bağlantıda kullanıcıya `wallet_addEthereumChain` gösterilir.

### 6.2 Cüzdana ağ ekleme (`wallet_addEthereumChain`)

```ts
const ARC_MAINNET_PARAMS = {
  chainId: '0x13B2',
  chainName: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, // ❗ ETH DEĞİL
  rpcUrls: ['https://rpc.mainnet.arc.io'],
  blockExplorerUrls: ['https://explorer.arc.io'],
}
```

> ❗ PikaStake'te `nativeCurrency: { name: 'ETH', symbol: 'ETH' }` yazılmıştı. Bu yüzden MetaMask bakiyeyi "ETH" gösteriyordu. **PikaMd'de tekrarlama.**
> wagmi `switchChain` kullanılırsa bu parametreler viem zincirinden otomatik gelir.

Ağ değiştirme hata kodları (PikaStake'te test edildi, çoklu cüzdan):
- `4001` → kullanıcı reddetti. **Dur**, tekrar deneme.
- `4902` → zincir cüzdanda yok (MetaMask). `wallet_addEthereumChain` ile ekle.
- `-32603` veya bilinmeyen kod (Backpack, OKX, Trust farklı kodlar döndürür) → yine `add` dene, olmazsa bir kez daha `switch`.

### 6.3 Foundry (ARCHITECTURE K: kontrat aracı Foundry)

**Kurulum (Apple Silicon Mac; bu makine `arm64`, hazır binary var).** ✅ 2026-10-13 kuruldu: v0.8.0-2 (`arc-forge` 1.7.1-dev), sha256 release'teki `.sha256` dosyasıyla doğrulandı. **macOS'ta `libusb` gerekiyor** (`brew install libusb`; yoksa `dyld: Library not loaded: …libusb-1.0.0.dylib`). Bu Arc dokümanında ve repo README'sinde yazmıyor. `arc-anvil --network arc` yerelde 20 Gwei taban ücretini uygulamıyor (10 Gwei'lik işlem kabul edildi).
```bash
# https://github.com/circlefin/arc-foundry/releases → macOS arm64 arşivini indir
tar -xzf arc-foundry-<version>-<target>.tar.gz
mkdir -p ~/.local/bin
mv forge ~/.local/bin/arc-forge
mv cast  ~/.local/bin/arc-cast
mv anvil ~/.local/bin/arc-anvil
arc-forge --version
```
Standart Foundry (`foundryup`) de çoğu iş için çalışır. Arc'a özgü davranış testleri için `arc-anvil` kullan.

**`foundry.toml` (taslak):**
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
optimizer = true
optimizer_runs = 200

[rpc_endpoints]
arc         = "${ARC_MAINNET_RPC_URL}"
arc_testnet = "${ARC_TESTNET_RPC_URL}"

# 2026-10-13: explorer.testnet.arc.io bir Blockscout; /api (etherscan tarzı) ve /api/v2 çalışıyor, PikaStake'in
# PikaUSDC'sini doğrulanmış gösteriyor. testnet.arcscan.app/api/v2 JSON dönmedi. Kendi verify'ımızla kesinleşecek.
[etherscan]
arc         = { key = "blockscout", url = "https://explorer.arc.io/api",         chain = 5042 }
arc_testnet = { key = "blockscout", url = "https://explorer.testnet.arc.io/api", chain = 5042002 }
```

**Deploy (keystore ile; private key'i CLI'da düz metin olarak verme):**
```bash
arc-cast wallet import pikamd-deployer --interactive      # bir kez
arc-forge script script/Deploy.s.sol --rpc-url arc_testnet --account pikamd-deployer --broadcast
# Doğrulama:
arc-forge verify-contract <ADDR> src/GuidelineRegistry.sol:GuidelineRegistry \
  --verifier blockscout --verifier-url https://explorer.testnet.arc.io/api/ --chain 5042002
```

### 6.4 Hardhat (yedek; PikaStake'te kullanılan ve çalışan yapı)

```js
// hardhat.config.js — PikaStake'teki çalışan config'in mainnet'e genişletilmiş hâli
networks: {
  arcTestnet: { url: process.env.ARC_TESTNET_RPC_URL, accounts: [process.env.PRIVATE_KEY], chainId: 5042002 },
  arc:        { url: process.env.ARC_MAINNET_RPC_URL, accounts: [process.env.PRIVATE_KEY], chainId: 5042 },
},
etherscan: {
  apiKey: { arcTestnet: 'blockscout', arc: 'blockscout' },   // Blockscout gerçek key istemez
  customChains: [
    { network: 'arcTestnet', chainId: 5042002,
      urls: { apiURL: 'https://testnet.arcscan.app/api', browserURL: 'https://testnet.arcscan.app' } }, // ✅ PikaStake'te çalıştı
    { network: 'arc', chainId: 5042,
      urls: { apiURL: 'https://explorer.arc.io/api', browserURL: 'https://explorer.arc.io' } },          // ⚠ DOĞRULA
  ],
},
```
`npx hardhat verify --network arcTestnet <ADDR> <constructor args>`

---

## 7. Finality, Event'ler ve Indexer (ARCHITECTURE §7.4 için)

Arc'ın deterministik finality'si indexer'ı çok basitleştirir:

- **Onay bekleme, reorg tespiti, rollback gerekmez.** Receipt geldiyse işlem kesindir. Hemen Supabase'e yaz.
- Kaldığın yerden devam: `indexer_state.last_block`'tan itibaren tara. İşlenmiş blokları yeniden doğrulamaya gerek yok.
- Sıralama: **`blockNumber`, sonra `logIndex`**. Asla `timestamp` ile sıralama.
- Backfill: `eth_getLogs`'u **1.000 blokluk** parçalar halinde çağır (docs örneği). Sağlayıcının limitini kontrol et. ✅ **Ölçüldü (2026-10-14): `rpc.testnet.arc.io` en fazla 10.000 blok** kabul ediyor (10.001 → "requested range too large"); PikaMd indexer'ı 10.000'lik parça kullanıyor. Mainnet ve anahtarlı sağlayıcılar için ayrıca ölç.
- Canlı akış: `eth_subscribe("newHeads")` WebSocket ile yapılabilir, ama Vercel cron + `getLogs` modeli (ARCHITECTURE §7.4) Arc için de uygun.
- **Hız:** Saniyede ~2 blok üretilir, yani dakikada ~120 blok. Her dakika çalışan cron tek `getLogs` çağrısıyla (≤1.000 blok) rahatça yetişir.
- Kontratın `deployBlock` numarasını kaydet ve indexer'ı oradan başlat (PikaName'de deploy bloğu not edilmişti, aynı alışkanlık).

**EIP-7708 / USDC event'leri (PikaMd'de USDC hareketi indexlenmiyor; bahşiş eklenirse lazım):**
| Kaynak | Adres | Event |
|---|---|---|
| Native USDC sistem emitter'ı | `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` | `Transfer` (18 ondalık) |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` | `Transfer` (6 ondalık), `Blocklisted`, `UnBlocklisted` |

Bir ERC-20 `transfer()` **iki** log üretir (sistem + ERC-20). Emitter adresine göre ayır, yoksa çift sayarsın.
Gas düşümleri log üretmez; maliyeti receipt'ten hesapla.

**Hazır indexer'lar (ihtiyaç büyürse, §7.4 "Ponder/Envio" maddesi):** Alchemy (webhooks), **Envio (HyperIndex)**, **Goldsky** (Subgraph / Turbo Pipelines), Pinax, The Graph, Thirdweb Insight, Zerion.
⚠ Ponder resmi listede yok, ama genel EVM aracı olduğu için RPC ile çalışmalı.

---

## 8. Kontrat Adresleri

### Mainnet (5042)

| Kontrat | Adres | Not |
|---|---|---|
| **USDC** (ERC-20 arayüzü) | `0x3600000000000000000000000000000000000000` | 6 ondalık (native: 18) |
| EURC | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` | 6 ondalık |
| USYC | `0x8a5D989Bbb96929F689B0200f435f53dA42bF490` | 6 ondalık |
| WETH | `0x128cC466B61f542da60c70e3aA11c10e19B84EDB` | 18 |
| cirBTC | `0x171A4217b86A807A64eB94757Db6849fb4bDbAA0` | 8 |
| CCTP TokenMessengerV2 | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` | domain 26 |
| CCTP MessageTransmitterV2 | `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` | |
| GatewayWallet | `0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE` | |
| GatewayMinter | `0x2222222d7164433c4C09B0b0D809a9b52C04C205` | |
| ERC-8004 IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | AI ajan kimliği |

### Her iki ağda aynı adres

| Kontrat | Adres |
|---|---|
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| CREATE2 Factory (Arachnid) | `0x4e59b44847b379578588920cA78FbF26c0B4956C` |
| Memo | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` |
| Multicall3From (gönderen korunur) | `0x522fAf9A91c41c443c66765030741e4AaCe147D0` |

### PikaMd — GuidelineRegistry (testnet, 2026-10-13)

| Alan | Değer |
|---|---|
| **Adres (geçerli, 2026-10-14)** | **`0x27cf926771B0A311A9574543ea29dc5e3ea59986`** (https://explorer.testnet.arc.io/address/0x27cf926771B0A311A9574543ea29dc5e3ea59986) |
| Deploy tx / blok | `0xca4f410bf9e434edc542f6c2c118695458cdc197480a64e98b1190b51e04fb55` · **blok 67092487** (indexer buradan başlar) · 1.461.130 gas × 25,75 Gwei ≈ 0,0376 USDC |
| Zincirden doğrulandı | roller sadece admin'de, `licenses(0)` = "CC-BY-4.0", `nextId` = 1, `setHidden`/`isListed` var, `setDelisted` yok; Sourcify `exact_match`, explorer `is_fully_verified: true` |
| Eski (terk edildi) | `0x8dA7825634079ce232141B8EDeD0682557c8b4A1`: delist hatası (ARCHITECTURE §5.1), hiç kayıt yok, kullanılmıyor. Aşağıdaki satırlar o deploy'a ait |
| Adres (eski) | `0x8dA7825634079ce232141B8EDeD0682557c8b4A1` (https://explorer.testnet.arc.io/address/0x8dA7825634079ce232141B8EDeD0682557c8b4A1) |
| Deploy tx | `0x2c644188565b48e0bf1f6ff0dd45d7d94a79de66279a8803e090e1b5f21ea667` |
| Deploy bloğu | **67003886** (indexer buradan başlar) |
| Deployer = admin + moderatör | `0xd76B24F43bCF5C3fFe09906A7414CD4D02EA7cDe` (kullanıcı kendi terminalinden deploy etti; keystore `pikamd-deployer`). ⚠ Bu cüzdanın anahtarı PikaStake `blockchain/.env`'de düz metin; mainnet'te yeni admin/multisig şart |
| Maliyet | 1.437.953 gas × 26,1 Gwei ≈ **0,0376 USDC** |
| Zincirden doğrulandı | kod var, `hasRole(DEFAULT_ADMIN_ROLE/MODERATOR_ROLE, admin)` = true, rastgele adres false, `licenses(0)` = "CC-BY-4.0", `nextId` = 1 |
| Explorer verify | ❌ Blockscout yöntemi `Fail - Unable to verify`: explorer'ın derleyici listesi **en fazla 0.8.36** (`/api/v2/smart-contracts/verification/config`, 2026-10-13); `osaka` destekleniyor. ✅ **Sourcify** (`--verifier sourcify`, Arc testnet + mainnet Sourcify'da destekli) → `exact_match`; Blockscout ~30 sn içinde içe aktardı: `is_verified: true, is_fully_verified: true`. **Ders:** Arc explorer'da verify için solc ≤ 0.8.36 kullan ya da Sourcify ile doğrula. |

### Testnet (5042002)

| Kontrat | Adres |
|---|---|
| USDC | `0x3600000000000000000000000000000000000000` |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |
| CCTP TokenMessengerV2 | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| CCTP MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` |
| Blocklist test adresi | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (değer transferleri revert eder) |

> **Fikir:** CREATE2 Factory ile `GuidelineRegistry`'yi testnet ve mainnet'te **aynı adrese** deploy etmek mümkün.
> Bu `lib/chain.ts`'i sadeleştirir. Opsiyonel.

---

## 9. Altyapı Sağlayıcıları

**RPC:** Alchemy, Blockdaemon, dRPC, Goldsky (x402 ile USDC'den istek başı ödeme), QuickNode, Chainstack. İstenirse kendi node'un da kurulabilir.

**Hesap soyutlama / gas sponsorluğu (ARCHITECTURE §16 "Gas'ı kim öder?" için seçenekler):**
| Yol | Nasıl | Not |
|---|---|---|
| Yazar öder (varsayılan) | Normal tx, ~0,003–0,005 USDC | Sıfır altyapı. Kullanıcının cüzdanında USDC olmalı. |
| ERC-4337 paymaster | Alchemy, **Pimlico**, Biconomy, ZeroDev, Thirdweb, Dynamic, MetaMask Embedded Wallets… | Smart account gerekir. K3 (cüzdan birincil) ile çelişmemesi için dikkat. |
| Kendi paymaster'ın | docs: "Deploy an ERC-4337 paymaster on Arc" | Daha fazla iş |
| EIP-3009 relayer | docs: "Operate an EIP-3009 relayer" | Sadece USDC transferleri için, registry çağrısı için değil |
| EIP-7702 | Arc'ta Ethereum ile aynı çalışır | EOA'ya geçici smart-account yetenekleri verir. MetaMask desteği gelişiyor. |

> ⚠ Resmi AA listesinde Circle **Gas Station** ve **Safe** yok.
> **Safe multisig'in Arc mainnet'te resmi desteği doğrulanamadı** (2026-10-09). Moderatör multisig'i (ARCHITECTURE §5, Faz 6)
> için mainnet öncesinde `app.safe.global` zincir listesini kontrol et. Yoksa alternatifler: Safe kontratlarını kendin deploy etmek
> veya Turnkey / Circle Wallets gibi politika tabanlı anahtar yönetimi.

**Uyumluluk (compliance):** USDC blocklist runtime'da zorunlu. docs: "Monitor Blocklist Compliance".

---

## 10. Claude Code için Arc Araçları

**Arc Docs MCP** (kimlik doğrulama gerekmez, docs'ta arama yapıp sayfa çeker):
```bash
claude mcp add --transport http arc-docs https://docs.arc.io/mcp
```
→ PikaMd geliştirirken Arc bilgisini tahmin etmek yerine bu MCP'ye sor.

**Circle skill'leri:** PikaStake'te `use-arc` ve `use-usdc` kurulu (`npx skills add https://github.com/circlefin/skills`).
⚠ PikaStake'teki kopya Nisan 2026 tarihli ve "Arc sadece testnet, mainnet'i hedefleme" diyor. **Bu bilgi artık eski.**
PikaMd'ye kurarken güncel sürümü çek.

### Arc Studio + Arc Studio CLI (2026-10-09'da docs'tan doğrulandı)

Circle'ın barındırdığı AI kodlama ajanı. Ajan, kontrat hattı ve sandbox (**Vite + Foundry**) sunucu tarafında çalışır.
CLI ile Claude Code onu alt-ajan olarak kullanır.

| Konu | Bilgi |
|---|---|
| Paket | `@circle-fin/arc-studio-cli` (v1.2.1, Circle yayıncısı). Node ≥ 20 |
| Kurulum | `npm i -g @circle-fin/arc-studio-cli` → `arc-studio skills install --tool claude-code` → `arc-studio login` (tarayıcı, insan yapar) → Claude Code'u yeniden başlat |
| Ağ | **Sadece Arc testnet.** Mainnet'e "senin adına deploy etmez". |
| Yetenek | Kontrat planla/üret/derle/testnet'e deploy, mevcut kontrata frontend, canlı önizleme, testnet faucet, GitHub'a export |
| Ajandan kullanım | `arc-studio run "..." --output json` → `status`, `deployments`, `fileDiffs`, `previewUrl`, `questions`. `needs_input` → `--answers-json` ile aynı oturumda cevapla |
| Dosya gönderme | `--file yol` (salt okunur `context/`), `--file src:dest` (yerinde düzenler, diff döner) |
| Kodu yerele alma | `arc-studio pull` (otomatik yazmaz; yerelde düzenlenmiş dosyaları atlar, `--diff`, `--dry-run`) |
| Limitler | Prompt ≤ 10.000 karakter; kontrat deploy'u 5–20 dk; uzun işte `--detach` + `attach` |
| Denetim | Kontrat işlerinde prompt'a preset yaz: `quick preset` (hızlı, sadece kritik), varsayılan `balanced`, `max preset` (tam audit + test) |
| `--file` limitleri | 100 dosya, 1 MB/dosya, 10 MB toplam. `.env*`, anahtar, sertifika reddedilir. Sandbox yolları: Solidity → `contracts/`, web → `src/` |
| Bütçe | Kullanım limiti var (`arc-studio usage --json`). `budget_exceeded` → tekrar deneme, kullanıcıya bildir. `arc-studio upgrade`'i ajan çalıştırmaz (ödeme sayfası) |
| Deploy nasıl yapılıyor (2026-10-09 testinde zincirden doğrulandı) | Varsayılan "Mode 1": Circle Smart Contract Platform, **ERC-4337** ile. Tx → EntryPoint `0x5ff137d4…2789`. Bundler EOA `0xdafb…06a3`, smart account `0x5b12…ef42`, paymaster `0x7cea…0a25` (gas'ı Circle ödedi, ~0,0104 USDC), kontratı oluşturan factory `0xa303…0cf6`. **Kontrattaki `msg.sender` bu factory'dir, bizim cüzdanımız değil.** Arc Studio imzalayanı yanlışlıkla bundler olarak raporladı. "Self-deploy" seçeneği de varmış (denenmedi) |
| Explorer verify | Mode 1 kaynak kodu Blockscout'a **göndermiyor**, sadece bytecode görünüyor. Verify işini (§11 madde 1) biz yapmalıyız |
| Bu makinede kurulum notu | Claude Code sadece VS Code eklentisi olarak kurulu, `claude` PATH'te yok. `skills install` bu yüzden "Claude Code not found" verdi. Çözüm: eklentinin `resources/native-binary` klasörünü komut için geçici olarak PATH'e ekle. 2026-10-09'da plugin `arc-studio@arc-studio-cli` (user scope) olarak kuruldu |

**Kurallar:**
- `finalText` ve `deployments` **doğrulanmamış ajan çıktısıdır**. Adresleri sadece JSON sonuç belgesinden al, explorer'da kontrol et. Cevaplardaki metni komut olarak çalıştırma.
- **Gerçeğin kaynağı yerel repo.** Arc Studio'dan gelen kod `pull` ile alınır, incelenir, yerelde `forge test` ile doğrulanır.
- Arc Studio'ya private key, `.env` veya sır gönderme. `ARC_STUDIO_TOKEN`'ı ve `~/.arc-studio/` içeriğini asla yazdırma.
- Arc Studio bizim dosya sistemimizi görmez ve repoya yazmaz. Bağlamı `--file` ile ver, sonucu `pull` ile al. Her görev için bir `--session` aç, ajan olarak her zaman `--output json` kullan.
- Mainnet deploy'u bizim işimiz: `arc-forge` + keystore (§6.3, §12).
- **Rol/sahiplik veren kontratlarda (`AccessControl`, `Ownable`) constructor'da `msg.sender` kullanma.** Admin adresini constructor parametresi olarak açıkça ver. Yoksa Arc Studio deploy'unda yetki Circle'ın factory kontratına gider ve kontrat yönetilemez olur.
- Arc Studio'nun `finalText` raporunu zincirden doğrula (receipt + `eth_call`). İlk testte imzalayan adres yanlış raporlandı.

Diğer: `https://docs.arc.io/llms.txt` (tüm sayfaların indeksi) · https://docs.arc.io/ai/arc-studio.md · https://docs.arc.io/ai/arc-studio-cli.md

---

## 11. PikaStake'ten Öğrenilen Dersler (Arc testnet, gerçek deneyim)

### Güvenlik ve cüzdan güveni
1. **Blockaid / MetaMask "kötü niyetli site" uyarısı:** Doğrulanmamış (unverified) kontratlar uyarının muhtemel sebebiydi.
   → **PikaMd'de her kontratı deploy eder etmez explorer'da verify et.** Bu, deploy checklist'inin bir adımı olmalı.
2. **Sınırsız approve (`MaxUint256`) kullanma.** Cüzdan güvenlik motorları bunu "drainer" kalıbı olarak işaretliyor.
   Gerekirse sadece gereken miktarı onayla. (PikaMd'de approve muhtemelen hiç gerekmeyecek.)
3. **Gizli anahtar istemciye gitmez.** PikaStake'te Pinata JWT'si `index.html` içine gömülüydü, yani tarayıcıdan herkes görebiliyordu.
   → PikaMd'de IPFS yükleme **sadece sunucuda** (ARCHITECTURE §6 zaten böyle). `NEXT_PUBLIC_` ön ekine asla sır koyma.
4. **Fiyat/limit gibi kritik değerleri istemciden değil kontrattan oku.** Onay ve ödeme tutarları her zaman zincirdeki değerle hesaplanmalı.

### RPC ve performans
5. **Log sorguları (`queryFilter`) thirdweb RPC'sinde yavaş ve güvenilmezdi.** PikaName'de "Son Mint'ler" listesi
   `totalSupply()` + `tokenIdToDomain(id)` + `ownerOf(id)` ile `Promise.all` üzerinden çekildi.
   → PikaMd'de liste/arama **Supabase index'ten** gelir (K8). Zincir sadece doğrulama ve indexer içindir.
   Kontrata gerekirse `latestVersion(id)` gibi doğrudan view fonksiyonları koy.
6. **Bağımsız RPC çağrılarını paralel yap** (`Promise.all` / viem `multicall`), tek tur yeterli olsun.
7. **RPC hatalarında yeniden dene:** 3 deneme × 3 sn aralık modeli PikaBoxes'ta iyi çalıştı.
8. **Kontrat/istemci örneklerini cüzdan başına önbelleğe al.** Sadece cüzdan değişince yeniden oluştur.

### Cüzdan bağlantısı
9. **EIP-6963** ile çoklu cüzdan keşfi (MetaMask, Rabby, OKX…). wagmi bunu varsayılan olarak yapar.
10. **Zaman aşımları:** `eth_requestAccounts` için 30 sn, `switchChain` için 15 sn. Bunlar olmadan bazı cüzdanlarda UI sonsuza kadar bekliyordu.
11. **Otomatik yeniden bağlanmada** kullanıcıya bağlı tüm verileri tekrar yükle (PikaStake'te NFT listesi bu yüzden boş kalıyordu).
12. Ağ ekleme parametresinde `nativeCurrency` **USDC** olmalı (§6.2).

### Miktarlar ve hata mesajları
13. **Miktarları her zaman `bigint` ile işle**, UI'daki formatlı metinden asla geri okuma (MAX withdraw yuvarlama hatası).
14. **`tx.wait()` / `waitForTransactionReceipt` bitmeden başarı gösterme ve kalıcı kayıt yazma** (PikaBoxes dersi).
    Arc'ta receipt = kesinlik olduğu için bekleme süresi kısa.
15. Kullanıcı dostu hata eşlemesi (PikaStake'te kullanılan liste):
    | Kod / mesaj | Gösterilecek |
    |---|---|
    | `user rejected` / 4001 | İşlem reddedildi |
    | `INSUFFICIENT_FUNDS` | Gas için yeterli USDC yok |
    | `NETWORK_ERROR` | Ağa ulaşılamıyor |
    | `TIMEOUT` | Zaman aşımı, tekrar dene |
    | `-32603` / `SERVER_ERROR` | RPC hatası, tekrar dene |
    | `CALL_EXCEPTION` | İşlem başarısız (revert sebebini göster) |
    | `UNKNOWN_NETWORK` | Yanlış ağ, Arc'a geç |
    | (Arc'a özel) `transaction underpriced` | maxFeePerGas < 20 Gwei |

### IPFS (PikaCreate deneyimi)
16. Birden fazla gateway yedeği kullanıldı (`ipfs.io`, `dweb.link`, `gateway.pinata.cloud`…). Public gateway'ler yavaş ve kararsız.
    → PikaMd: pinning servisinin **dedicated gateway'i** + sunucu tarafı önbellek (ARCHITECTURE §6).
17. `<img>` için `onload`/`onerror` handler'larını `src`'den **önce** ata, yoksa önbellekteki görsel olayı kaçırır. Yavaş IPFS için zaman aşımı yedeği ekle.
18. **Pinata v3 aynı içeriğe aynı dosya kimliğini döndürür** (yanıtta `is_duplicate: true`; PikaMd'de 2026-10-15'te gerçek hesapta iki kez yüklenip denendi). Bir dosya kimliğini silmek (unpin) aynı içeriği yükleyen **herkesin** dosyasını siler → başka kayıt kullanıyor mu bakmadan asla unpin etme (PikaMd ARCHITECTURE §9.4).

---

## 12. Testnet → Mainnet Geçiş Checklist'i (Faz 6)

- [ ] Kontrat testnet'te uçtan uca test edildi (register, version, fork, delist, event'ler)
- [ ] Deployer için **ayrı ve yeni** bir cüzdan; içinde sadece deploy'a yetecek kadar USDC
- [ ] Private key keystore'da (`cast wallet import`), `.env` git'te değil (`.gitignore`: `.env*`)
- [ ] `arc-forge script ... --rpc-url arc` ile deploy → **adres + deploy bloğu** kaydedildi
- [ ] **Explorer'da verify** edildi (explorer.arc.io)
- [ ] `MODERATOR_ROLE` / `DEFAULT_ADMIN_ROLE` multisig'e devredildi (Safe desteği doğrulandıysa), deployer'ın rolü bırakıldı
- [ ] `NEXT_PUBLIC_ARC_NETWORK=mainnet`, kontrat adresi ve `deployBlock` env'de
- [ ] Production RPC: API key'li sağlayıcı (sunucu) + domain kısıtlı key (tarayıcı)
- [ ] Indexer `indexer_state.last_block = deployBlock` ile başlatıldı
- [ ] CSP'ye mainnet RPC + explorer + IPFS gateway eklendi (ARCHITECTURE §9.2)
- [ ] UI'daki explorer linkleri `explorer.arc.io` ve gas ücreti USDC olarak gösteriliyor
- [ ] Gerçek USDC ile küçük bir yayınlama denemesi yapıldı

---

## 13. ARCHITECTURE.md §16 Açık Sorular: Cevaplar

| Soru | Cevap (2026-10-09) |
|---|---|
| Arc mainnet canlı mı? Chain ID, RPC, explorer? | ✅ Canlı (16 Eylül 2026). §2 |
| Native USDC gas'ın ondalığı | ✅ Native **18**, ERC-20 **6**, tek bakiye. §3 |
| RainbowKit/wagmi Arc'ı hazır içeriyor mu? | ✅ viem'de `arc` ve `arcTestnet` hazır, `defineChain` gerekmez. ⚠ RainbowKit ikonu/özel davranışı ilk kurulumda kontrol edilecek. §6.1 |
| Safe (multisig) Arc'ta var mı? | ⚠ **Doğrulanamadı.** Resmi listede yok. §9 |
| Circle gas sponsorluğu (Gas Station / paymaster)? | ⚠ Gas Station listede yok. ERC-4337 paymaster sağlayıcıları (Alchemy, Pimlico, Biconomy, ZeroDev…) var. §9 |
| MCP SDK + Next.js handler güncel API | Arc ile ilgili değil, Faz 3'te kontrol edilecek |

---

## 14. Kaynaklar

- Resmi sosyal hesaplar (arc.io `sameAs`, 2026-10-10): X https://x.com/arc · Discord https://discord.com/invite/buildonarc · Topluluk https://community.arc.io
- Arc docs indeksi: https://docs.arc.io/llms.txt
- Ağa bağlanma: https://docs.arc.io/arc/references/connect-to-arc.md
- Kontrat adresleri: https://docs.arc.io/arc/references/contract-addresses.md
- Gas ve ücretler: https://docs.arc.io/arc/references/gas-and-fees.md
- EVM farkları: https://docs.arc.io/arc/references/evm-differences.md
- Event indexleme: https://docs.arc.io/integrate/infrastructure/indexing-events.md
- Deterministik finality: https://docs.arc.io/arc/concepts/deterministic-finality.md
- Arc Foundry: https://docs.arc.io/arc/tutorials/install-arc-foundry.md · https://github.com/circlefin/arc-foundry/releases
- Hesap soyutlama: https://docs.arc.io/arc/tools/account-abstraction.md
- Paymaster: https://docs.arc.io/integrate/relayers-and-paymasters/deploy-a-paymaster.md
- Data indexer'lar: https://docs.arc.io/arc/tools/data-indexers.md
- Node sağlayıcıları: https://docs.arc.io/arc/tools/node-providers.md
- Arc MCP: https://docs.arc.io/ai/mcp.md
- USDC adresleri (Circle): https://developers.circle.com/stablecoins/usdc-contract-addresses
- Mainnet lansman haberi: https://www.theblock.co/news/ecosystems/2026-09-16-circle-launches-arc-mainnet-with-blackrock-and-visa-among-validators-mints-10-billion-arc-tokens-415250
