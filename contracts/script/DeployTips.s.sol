// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {GuidelineRegistry} from "../src/GuidelineRegistry.sol";
import {GuidelineTips} from "../src/GuidelineTips.sol";

/// Deploys GuidelineTips for this chain's GuidelineRegistry and checks it on-chain.
///   arc-forge script script/DeployTips.s.sol --rpc-url arc_testnet --account pikamd-deployer --broadcast
/// GuidelineTips has no owner and no roles, so nothing depends on who deploys it; the key still
/// comes from our encrypted keystore (--account), never from an env var or CLI flag (K17).
contract DeployTips is Script {
    /// USDC's ERC-20 interface: the same address on Arc testnet and mainnet (ARC.md §8).
    address internal constant USDC = 0x3600000000000000000000000000000000000000;
    /// The registry on Arc testnet (ARC.md §8). Elsewhere PIKAMD_REGISTRY must name it.
    address internal constant TESTNET_REGISTRY = 0x27cf926771B0A311A9574543ea29dc5e3ea59986;

    function run() external returns (GuidelineTips tips) {
        require(block.chainid == 5042002 || block.chainid == 5042, "Arc testnet or mainnet only");
        GuidelineRegistry registry =
            GuidelineRegistry(block.chainid == 5042002 ? TESTNET_REGISTRY : vm.envAddress("PIKAMD_REGISTRY"));
        require(address(registry).code.length > 0, "no contract at the registry address");
        require(registry.licenseCount() >= 1 && registry.nextId() >= 1, "not a GuidelineRegistry");
        require(IERC20Metadata(USDC).decimals() == 6, "USDC's ERC-20 interface must have 6 decimals");

        vm.startBroadcast();
        tips = new GuidelineTips(IERC20(USDC), registry);
        vm.stopBroadcast();

        require(address(tips.USDC()) == USDC, "USDC address");
        require(address(tips.REGISTRY()) == address(registry), "registry address");
        require(tips.MIN_TIP() == 10_000, "minimum tip");

        console.log("GuidelineTips:", address(tips));
        console.log("Registry:", address(registry));
        console.log("Chain id:", block.chainid);
        console.log("Block (approx. deploy block, take the exact one from the receipt):", block.number);
    }
}
