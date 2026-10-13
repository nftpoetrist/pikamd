// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Script, console} from "forge-std/Script.sol";
import {GuidelineRegistry} from "../src/GuidelineRegistry.sol";

/// Deploys GuidelineRegistry with an explicit admin (K17: never msg.sender) and checks the roles.
///   PIKAMD_ADMIN=0x… arc-forge script script/Deploy.s.sol --rpc-url arc_testnet --account pikamd-deployer --broadcast
/// The signing key comes from the encrypted keystore (--account), never from an env var or CLI flag.
contract Deploy is Script {
    function run() external returns (GuidelineRegistry registry) {
        address admin = vm.envAddress("PIKAMD_ADMIN");
        require(admin != address(0), "PIKAMD_ADMIN is not set");

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
