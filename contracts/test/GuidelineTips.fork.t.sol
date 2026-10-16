// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {GuidelineRegistry} from "../src/GuidelineRegistry.sol";
import {GuidelineTips} from "../src/GuidelineTips.sol";

/// The tip flow against Arc testnet itself: the real USDC (one balance behind the native and the
/// ERC-20 interface, blocklist enforced) and the deployed GuidelineRegistry. Skipped unless forked:
///   arc-forge test --match-contract GuidelineTipsForkTest --fork-url arc_testnet
/// Each test registers its own guideline on the fork, so it doesn't depend on testnet content.
contract GuidelineTipsForkTest is Test {
    IERC20 internal constant USDC = IERC20(0x3600000000000000000000000000000000000000);
    GuidelineRegistry internal constant REGISTRY = GuidelineRegistry(0x27cf926771B0A311A9574543ea29dc5e3ea59986);
    /// Arc's documented testnet blocklist test address (ARC.md §8): value transfers revert.
    address internal constant BLOCKLISTED = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    /// Arc's EIP-7708 emitter of native USDC Transfer logs (18 decimals).
    address internal constant SYSTEM_EMITTER = 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE;

    uint256 internal constant ONE = 1_000_000;
    bytes32 internal constant TRANSFER = keccak256("Transfer(address,address,uint256)");

    GuidelineTips internal tips;
    address internal author = makeAddr("fork-author");
    address internal tipper = makeAddr("fork-tipper");

    modifier onlyArcTestnetFork() {
        if (block.chainid != 5042002) vm.skip(true, "needs --fork-url arc_testnet");
        _;
    }

    function setUp() public {
        if (block.chainid != 5042002) return;
        tips = new GuidelineTips(USDC, REGISTRY);
        vm.deal(tipper, 10 ether); // native balance, 18 decimals: 10 USDC
    }

    function _register(address who) internal returns (uint256 id) {
        vm.prank(who);
        id = REGISTRY.register("bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku", keccak256(abi.encode(who)), 0, 0);
    }

    function test_Fork_UsdcIsTheSixDecimalViewOfTheNativeBalance() public onlyArcTestnetFork {
        assertEq(IERC20Metadata(address(USDC)).decimals(), 6);
        assertEq(USDC.balanceOf(tipper), 10 * ONE, "vm.deal of 10e18 native = 10 USDC on the ERC-20 interface");
    }

    function test_Fork_TipMovesRealUsdcToTheAuthor() public onlyArcTestnetFork {
        uint256 id = _register(author);
        uint256 amount = 2_500_000; // 2.50 USDC
        vm.prank(tipper);
        USDC.approve(address(tips), amount);

        vm.recordLogs();
        vm.prank(tipper);
        tips.tip(id, amount);

        assertEq(USDC.balanceOf(author), amount, "100% to the author");
        assertEq(author.balance, amount * 1e12, "same balance on the native side (18 decimals)");
        assertEq(USDC.balanceOf(tipper), 10 * ONE - amount);
        assertEq(USDC.balanceOf(address(tips)), 0);
        assertEq(address(tips).balance, 0, "the contract never holds USDC");
        assertEq(USDC.allowance(tipper, address(tips)), 0);

        // Logs: our Tipped event, plus USDC's own Transfer (6 decimals) and, when the node emits it,
        // the EIP-7708 system Transfer (18 decimals). The index only ever reads Tipped.
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 tipped;
        uint256 erc20;
        for (uint256 i = 0; i < logs.length; i++) {
            Vm.Log memory l = logs[i];
            if (l.emitter == address(tips)) {
                assertEq(l.topics[0], GuidelineTips.Tipped.selector);
                assertEq(uint256(l.topics[1]), id);
                assertEq(address(uint160(uint256(l.topics[2]))), tipper);
                assertEq(address(uint160(uint256(l.topics[3]))), author);
                assertEq(abi.decode(l.data, (uint256)), amount);
                tipped++;
            } else if (l.emitter == address(USDC) && l.topics[0] == TRANSFER) {
                assertEq(address(uint160(uint256(l.topics[1]))), tipper, "straight from the tipper");
                assertEq(address(uint160(uint256(l.topics[2]))), author, "straight to the author");
                assertEq(abi.decode(l.data, (uint256)), amount);
                erc20++;
            } else if (l.emitter == SYSTEM_EMITTER) {
                assertEq(abi.decode(l.data, (uint256)), amount * 1e12, "system log in 18 decimals");
            }
        }
        assertEq(tipped, 1);
        assertEq(erc20, 1);
    }

    function test_Fork_BlocklistedAuthorCantReceiveTips() public onlyArcTestnetFork {
        uint256 id = _register(BLOCKLISTED); // registering moves no value, so it's allowed
        vm.prank(tipper);
        USDC.approve(address(tips), ONE);
        vm.prank(tipper);
        vm.expectRevert();
        tips.tip(id, ONE);
        assertEq(USDC.balanceOf(tipper), 10 * ONE, "the tipper keeps the USDC");
    }

    /// Arc enforces the blocklist on value transfers, not on approvals (measured on the fork,
    /// 2026-10-16): a blocklisted wallet's approve goes through, its tip reverts.
    function test_Fork_BlocklistedWalletCantTip() public onlyArcTestnetFork {
        uint256 id = _register(author);
        vm.deal(BLOCKLISTED, 1 ether);
        vm.startPrank(BLOCKLISTED);
        USDC.approve(address(tips), ONE);
        vm.expectRevert();
        tips.tip(id, ONE);
        vm.stopPrank();
        assertEq(USDC.balanceOf(author), 0);
        assertEq(USDC.balanceOf(BLOCKLISTED), ONE);
    }

    function test_Fork_HiddenGuidelineAndSelfTipRevert() public onlyArcTestnetFork {
        uint256 id = _register(author);
        vm.prank(author);
        REGISTRY.setHidden(id, true);
        vm.startPrank(tipper);
        USDC.approve(address(tips), ONE);
        vm.expectRevert(abi.encodeWithSelector(GuidelineTips.NotListed.selector, id));
        tips.tip(id, ONE);
        vm.stopPrank();

        uint256 own = _register(tipper);
        vm.prank(tipper);
        vm.expectRevert(abi.encodeWithSelector(GuidelineTips.SelfTip.selector, own));
        tips.tip(own, ONE);
    }
}
