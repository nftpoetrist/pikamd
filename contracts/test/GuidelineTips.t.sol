// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test, Vm} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {GuidelineRegistry} from "../src/GuidelineRegistry.sol";
import {GuidelineTips} from "../src/GuidelineTips.sol";

/// A plain 6-decimal ERC-20 standing in for USDC. GuidelineTips.fork.t.sol runs the same flow
/// against Arc's real USDC (blocklist and shared native balance included).
contract MockUSDC is ERC20 {
    constructor() ERC20("USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract GuidelineTipsTest is Test {
    GuidelineRegistry internal registry;
    GuidelineTips internal tips;
    MockUSDC internal usdc;

    address internal admin = makeAddr("admin");
    address internal ayse = makeAddr("ayse"); // author
    address internal bob = makeAddr("bob"); // tipper
    address internal eve = makeAddr("eve");

    uint256 internal constant ONE = 1_000_000; // 1 USDC
    string internal constant CID = "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";

    event Transfer(address indexed from, address indexed to, uint256 value);

    function setUp() public {
        registry = new GuidelineRegistry(admin);
        usdc = new MockUSDC();
        tips = new GuidelineTips(IERC20(address(usdc)), registry);
        usdc.mint(bob, 100 * ONE);
    }

    function _register(address author) internal returns (uint256) {
        vm.prank(author);
        return registry.register(CID, keccak256(abi.encode(author)), 0, 0);
    }

    function _tip(address from, uint256 id, uint256 amount) internal {
        vm.startPrank(from);
        usdc.approve(address(tips), amount);
        tips.tip(id, amount);
        vm.stopPrank();
    }

    // ── Constructor ──

    function test_ConstructorKeepsTheAddresses() public view {
        assertEq(address(tips.USDC()), address(usdc));
        assertEq(address(tips.REGISTRY()), address(registry));
        assertEq(tips.MIN_TIP(), 10_000, "0.01 USDC");
    }

    function test_ConstructorRejectsZeroAddresses() public {
        vm.expectRevert(GuidelineTips.ZeroAddress.selector);
        new GuidelineTips(IERC20(address(0)), registry);
        vm.expectRevert(GuidelineTips.ZeroAddress.selector);
        new GuidelineTips(IERC20(address(usdc)), GuidelineRegistry(address(0)));
    }

    // ── tip ──

    function test_TipMovesUsdcStraightToTheAuthor() public {
        uint256 id = _register(ayse);
        vm.prank(bob);
        usdc.approve(address(tips), 3 * ONE);

        vm.expectEmit(true, true, true, true, address(tips));
        emit GuidelineTips.Tipped(id, bob, ayse, 3 * ONE);
        vm.expectEmit(true, true, true, true, address(usdc));
        emit Transfer(bob, ayse, 3 * ONE); // tipper → author directly, never through the contract
        vm.prank(bob);
        tips.tip(id, 3 * ONE);

        assertEq(usdc.balanceOf(ayse), 3 * ONE, "100% to the author");
        assertEq(usdc.balanceOf(bob), 97 * ONE);
        assertEq(usdc.balanceOf(address(tips)), 0, "the contract holds nothing");
        assertEq(usdc.allowance(bob, address(tips)), 0, "the approval is used up");
    }

    function test_SmallestTipIsOneCent() public {
        uint256 id = _register(ayse);
        uint256 min = tips.MIN_TIP();
        vm.startPrank(bob);
        usdc.approve(address(tips), 10 * ONE);
        vm.expectRevert(abi.encodeWithSelector(GuidelineTips.TipTooSmall.selector, min - 1));
        tips.tip(id, min - 1);
        vm.expectRevert(abi.encodeWithSelector(GuidelineTips.TipTooSmall.selector, 0));
        tips.tip(id, 0);
        tips.tip(id, min);
        vm.stopPrank();
        assertEq(usdc.balanceOf(ayse), min);
    }

    function test_UnknownGuidelinesCantBeTipped() public {
        vm.startPrank(bob);
        usdc.approve(address(tips), ONE);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.UnknownGuideline.selector, uint256(7)));
        tips.tip(7, ONE);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.UnknownGuideline.selector, uint256(0)));
        tips.tip(0, ONE);
        vm.stopPrank();
        assertEq(usdc.balanceOf(bob), 100 * ONE);
    }

    function test_HiddenOrLockedGuidelinesCantBeTipped() public {
        uint256 id = _register(ayse);
        vm.prank(bob);
        usdc.approve(address(tips), 10 * ONE);

        vm.prank(ayse);
        registry.setHidden(id, true);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(GuidelineTips.NotListed.selector, id));
        tips.tip(id, ONE);

        vm.prank(ayse);
        registry.setHidden(id, false);
        vm.prank(admin);
        registry.setModeratorLock(id, true);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(GuidelineTips.NotListed.selector, id));
        tips.tip(id, ONE);

        vm.prank(admin);
        registry.setModeratorLock(id, false);
        vm.prank(bob);
        tips.tip(id, ONE);
        assertEq(usdc.balanceOf(ayse), ONE, "listed again: tips work again");
    }

    function test_AuthorsCantTipThemselves() public {
        uint256 id = _register(ayse);
        usdc.mint(ayse, ONE);
        vm.startPrank(ayse);
        usdc.approve(address(tips), ONE);
        vm.expectRevert(abi.encodeWithSelector(GuidelineTips.SelfTip.selector, id));
        tips.tip(id, ONE);
        vm.stopPrank();
    }

    function test_TipNeedsTheApproval() public {
        uint256 id = _register(ayse);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(tips), 0, ONE));
        tips.tip(id, ONE);

        vm.prank(bob);
        usdc.approve(address(tips), ONE - 1);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(tips), ONE - 1, ONE));
        tips.tip(id, ONE);
    }

    function test_TipNeedsTheBalance() public {
        uint256 id = _register(ayse);
        vm.startPrank(eve);
        usdc.approve(address(tips), ONE);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, eve, 0, ONE));
        tips.tip(id, ONE);
        vm.stopPrank();
    }

    /// An approval left behind (the tip was cancelled after it) can't be spent by anyone else.
    function test_OnlyTheCallersOwnApprovalIsSpent() public {
        uint256 id = _register(ayse);
        vm.prank(bob);
        usdc.approve(address(tips), 10 * ONE);

        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(tips), 0, ONE));
        tips.tip(id, ONE);

        assertEq(usdc.balanceOf(bob), 100 * ONE, "bob's USDC is untouched");
        assertEq(usdc.allowance(bob, address(tips)), 10 * ONE);
    }

    function test_EveryTipIsRecordedSeparately() public {
        uint256 first = _register(ayse);
        uint256 second = _register(ayse);
        vm.recordLogs();
        _tip(bob, first, ONE);
        _tip(bob, second, 2 * ONE);
        _tip(bob, first, 3 * ONE);
        assertEq(usdc.balanceOf(ayse), 6 * ONE);

        uint256 count;
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(tips)) {
                assertEq(logs[i].topics[0], GuidelineTips.Tipped.selector);
                count++;
            }
        }
        assertEq(count, 3, "one Tipped event per tip");
    }

    function test_RejectsNativeValue() public {
        uint256 id = _register(ayse);
        vm.deal(bob, 1 ether);
        vm.startPrank(bob);
        usdc.approve(address(tips), ONE);
        (bool ok,) = address(tips).call{value: 1}(abi.encodeCall(GuidelineTips.tip, (id, ONE)));
        assertFalse(ok, "tip is not payable");
        (ok,) = address(tips).call{value: 1}("");
        assertFalse(ok, "no receive or fallback: the contract never holds value");
        vm.stopPrank();
        assertEq(address(tips).balance, 0);
    }

    // ── Fuzz ──

    function testFuzz_TipConservesUsdc(uint256 amount) public {
        amount = bound(amount, tips.MIN_TIP(), 100 * ONE);
        uint256 id = _register(ayse);
        uint256 supply = usdc.totalSupply();
        _tip(bob, id, amount);
        assertEq(usdc.balanceOf(ayse), amount);
        assertEq(usdc.balanceOf(bob), 100 * ONE - amount);
        assertEq(usdc.balanceOf(address(tips)), 0);
        assertEq(usdc.totalSupply(), supply);
    }

    function testFuzz_NobodyElseCanSpendAnApproval(address caller, uint256 amount) public {
        vm.assume(caller != bob);
        amount = bound(amount, tips.MIN_TIP(), 100 * ONE);
        uint256 id = _register(ayse);
        vm.prank(bob);
        usdc.approve(address(tips), amount);

        vm.prank(caller);
        vm.expectRevert();
        tips.tip(id, amount);
        assertEq(usdc.balanceOf(bob), 100 * ONE);
        assertEq(usdc.allowance(bob, address(tips)), amount);
    }
}
