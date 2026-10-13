# PikaMd contracts

`GuidelineRegistry` records who published which guideline and every version of it
(`../ARCHITECTURE.md` §5). Built with Arc Foundry (`arc-forge`, `arc-cast`, `arc-anvil`;
install: `../ARC.md` §6.3 — on macOS it also needs `brew install libusb`).

```bash
arc-forge build
arc-forge test                     # unit + fuzz tests
```

Testnet deployment: `0x8dA7825634079ce232141B8EDeD0682557c8b4A1`, block 67003886 (`../ARC.md` §8).

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
