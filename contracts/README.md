# PikaMd contracts

`GuidelineRegistry` records who published which guideline and every version of it
(`../ARCHITECTURE.md` §5). Built with Arc Foundry (`arc-forge`, `arc-cast`, `arc-anvil`;
install: `../ARC.md` §6.3 — on macOS it also needs `brew install libusb`).

```bash
arc-forge build
arc-forge test                     # unit + fuzz tests
```

Testnet deployment: `0x27cf926771B0A311A9574543ea29dc5e3ea59986`, block 67092487 (`../ARC.md` §8). The first one
(`0x8dA7…b4A1`) had the delist bug fixed in this version and is abandoned.

## Deploy (Arc testnet)

The deployer key lives in an encrypted Foundry keystore, never in a file or on the command line (K17).

```bash
# once: import a NEW wallet used only for deploying (asks for the key and a password)
arc-cast wallet import pikamd-deployer --interactive
arc-cast wallet address --account pikamd-deployer

# simulate first (no transaction is sent)
PIKAMD_ADMIN=0x<admin> arc-forge script script/Deploy.s.sol --rpc-url arc_testnet --account pikamd-deployer

# deploy
PIKAMD_ADMIN=0x<admin> arc-forge script script/Deploy.s.sol --rpc-url arc_testnet --account pikamd-deployer --broadcast

# verify the source: Sourcify (the explorer imports it within a minute). The explorer's own
# Blockscout verifier only knows solc up to 0.8.36 (2026-10-13), so it fails for 0.8.37.
arc-forge verify-contract <ADDRESS> src/GuidelineRegistry.sol:GuidelineRegistry \
  --verifier sourcify --chain 5042002 --watch \
  --constructor-args $(arc-cast abi-encode "constructor(address)" 0x<admin>)
```

`PIKAMD_ADMIN` gets `DEFAULT_ADMIN_ROLE` and `MODERATOR_ROLE`. The script checks both on-chain
after deploying. Record the address and the deploy block (from the receipt) in `../ARC.md` and the
web app's env.

## Tips (`GuidelineTips`)

`GuidelineTips` sends a tip in USDC straight from the tipper to the guideline's author, as the
registry records them (`../ARCHITECTURE.md` K21). It holds no funds, takes no fee and has no owner,
so nothing about it depends on who deploys it.

```bash
arc-forge test --match-contract GuidelineTipsTest                            # unit + fuzz, mock USDC
arc-forge test --match-contract GuidelineTipsForkTest --fork-url arc_testnet # Arc's real USDC + registry

# simulate, then deploy (testnet: the registry address is built into the script)
arc-forge script script/DeployTips.s.sol --rpc-url arc_testnet --account pikamd-deployer
arc-forge script script/DeployTips.s.sol --rpc-url arc_testnet --account pikamd-deployer --broadcast

arc-forge verify-contract <ADDRESS> src/GuidelineTips.sol:GuidelineTips \
  --verifier sourcify --chain 5042002 --watch \
  --constructor-args $(arc-cast abi-encode "constructor(address,address)" \
    0x3600000000000000000000000000000000000000 0x27cf926771B0A311A9574543ea29dc5e3ea59986)
```

Then put the address and the deploy block in `web/lib/chain.ts` (`TIPS`) and `../ARC.md` §8, and
regenerate the web ABIs: `cd ../web && npm run abi`.
