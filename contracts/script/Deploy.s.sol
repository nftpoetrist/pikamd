// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Script, console} from "forge-std/Script.sol";
import {GuidelineRegistry} from "../src/GuidelineRegistry.sol";

/// Deploys GuidelineRegistry with an explicit admin (K17: never msg.sender) and checks the roles.
///   PIKAMD_ADMIN=0x… arc-forge script script/Deploy.s.sol --rpc-url arc_testnet --account pikamd-deployer --broadcast
/// The signing key comes from the encrypted keystore (--account), never from an env var or CLI flag.
/// A wrong admin can't be undone (ARCHITECTURE §5.2, item 7), so the address must be written in its
/// EIP-55 checksummed form (a typo breaks the checksum), and on Arc mainnet also typed a second time
/// as PIKAMD_ADMIN_CONFIRM and already have sent a transaction (someone holds its key) or be a
/// contract (a multisig). Rehearse on a fork of mainnet first (--fork-url, no --broadcast).
contract Deploy is Script {
    uint256 internal constant ARC_MAINNET = 5042;

    function run() external returns (GuidelineRegistry registry) {
        address admin = vm.envAddress("PIKAMD_ADMIN");
        require(admin != address(0), "PIKAMD_ADMIN is not set");
        require(
            keccak256(bytes(vm.envString("PIKAMD_ADMIN"))) == keccak256(bytes(vm.toString(admin))),
            "PIKAMD_ADMIN must be written in its checksummed (EIP-55) form"
        );
        if (block.chainid == ARC_MAINNET) {
            require(vm.envOr("PIKAMD_ADMIN_CONFIRM", address(0)) == admin, "On mainnet, type the admin again as PIKAMD_ADMIN_CONFIRM");
            require(admin.code.length > 0 || vm.getNonce(admin) > 0, "The admin has never sent a transaction: send one from it first");
        }

        vm.startBroadcast();
        registry = new GuidelineRegistry(admin);
        vm.stopBroadcast();

        require(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin), "admin role missing");
        require(registry.hasRole(registry.MODERATOR_ROLE(), admin), "moderator role missing");
        require(registry.licenseCount() == 1, "license list");

        console.log("GuidelineRegistry:", address(registry));
        console.log("Admin + moderator:", admin);
        console.log("Chain id:", block.chainid);
        console.log("Block (approx. deploy block, take the exact one from the receipt):", block.number);
    }
}
