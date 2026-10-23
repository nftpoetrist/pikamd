// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Script, console} from "forge-std/Script.sol";
import {GuidelineRegistry} from "../src/GuidelineRegistry.sol";
import {GuidelineReviews} from "../src/GuidelineReviews.sol";

/// Deploys GuidelineReviews for this chain's GuidelineRegistry and checks it on-chain.
///   arc-forge script script/DeployReviews.s.sol --rpc-url arc_testnet --account pikamd-deployer --broadcast
/// GuidelineReviews has no owner: who may review is the registry's MODERATOR_ROLE, so nothing
/// depends on who deploys it; the key still comes from our encrypted keystore (--account), never
/// from an env var or CLI flag (K17).
contract DeployReviews is Script {
    /// The registry on Arc testnet (ARC.md §8). Elsewhere PIKAMD_REGISTRY must name it.
    address internal constant TESTNET_REGISTRY = 0x27cf926771B0A311A9574543ea29dc5e3ea59986;

    function run() external returns (GuidelineReviews reviews) {
        require(block.chainid == 5042002 || block.chainid == 5042, "Arc testnet or mainnet only");
        GuidelineRegistry registry =
            GuidelineRegistry(block.chainid == 5042002 ? TESTNET_REGISTRY : vm.envAddress("PIKAMD_REGISTRY"));
        require(address(registry).code.length > 0, "no contract at the registry address");
        require(registry.licenseCount() >= 1 && registry.nextId() >= 1, "not a GuidelineRegistry");

        vm.startBroadcast();
        reviews = new GuidelineReviews(registry);
        vm.stopBroadcast();

        require(address(reviews.REGISTRY()) == address(registry), "registry address");

        console.log("GuidelineReviews:", address(reviews));
        console.log("Registry:", address(registry));
        console.log("Chain id:", block.chainid);
        console.log("Block (approx. deploy block, take the exact one from the receipt):", block.number);
    }
}
