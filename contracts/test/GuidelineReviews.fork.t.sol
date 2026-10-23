// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test} from "forge-std/Test.sol";
import {GuidelineRegistry} from "../src/GuidelineRegistry.sol";
import {GuidelineReviews} from "../src/GuidelineReviews.sol";

/// Reviews against the deployed GuidelineRegistry on Arc testnet: its real moderator and a real
/// guideline. Skipped unless forked:
///   arc-forge test --match-contract GuidelineReviewsForkTest --fork-url arc_testnet
contract GuidelineReviewsForkTest is Test {
    GuidelineRegistry internal constant REGISTRY = GuidelineRegistry(0x27cf926771B0A311A9574543ea29dc5e3ea59986);
    /// The registry's admin and only moderator on testnet (ARC.md §8).
    address internal constant MODERATOR = 0xd76B24F43bCF5C3fFe09906A7414CD4D02EA7cDe;
    /// "Test2", registered by the moderator's wallet and listed (ARC.md §8).
    uint256 internal constant GUIDELINE = 4;

    GuidelineReviews internal reviews;

    modifier onlyArcTestnetFork() {
        if (block.chainid != 5042002) vm.skip(true, "needs --fork-url arc_testnet");
        _;
    }

    function setUp() public {
        if (block.chainid != 5042002) return;
        reviews = new GuidelineReviews(REGISTRY);
    }

    function test_Fork_TheRegistryModeratorApprovesARealGuideline() public onlyArcTestnetFork {
        assertTrue(REGISTRY.hasRole(REGISTRY.MODERATOR_ROLE(), MODERATOR), "moderator on testnet");
        uint32 latest = REGISTRY.getGuideline(GUIDELINE).versionCount;
        vm.prank(MODERATOR);
        reviews.approve(GUIDELINE, latest);
        assertTrue(reviews.isReviewed(GUIDELINE));
        assertEq(reviews.getReview(GUIDELINE).contentHash, REGISTRY.latestVersion(GUIDELINE).contentHash);
    }

    function test_Fork_AnyoneElseIsRefused() public onlyArcTestnetFork {
        address eve = makeAddr("eve");
        assertFalse(REGISTRY.hasRole(REGISTRY.MODERATOR_ROLE(), eve));
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(GuidelineReviews.NotModerator.selector, eve));
        reviews.approve(GUIDELINE, 1);
    }

    function test_Fork_ApproveGasCost() public onlyArcTestnetFork {
        uint32 latest = REGISTRY.getGuideline(GUIDELINE).versionCount;
        vm.prank(MODERATOR);
        uint256 before = gasleft();
        reviews.approve(GUIDELINE, latest);
        uint256 used = before - gasleft();
        emit log_named_uint("approve execution gas", used);
        assertLt(used, 120_000);
    }
}
