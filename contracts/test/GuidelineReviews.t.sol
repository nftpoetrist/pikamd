// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test} from "forge-std/Test.sol";
import {GuidelineRegistry} from "../src/GuidelineRegistry.sol";
import {GuidelineReviews} from "../src/GuidelineReviews.sol";

contract GuidelineReviewsTest is Test {
    GuidelineRegistry internal registry;
    GuidelineReviews internal reviews;

    address internal admin = makeAddr("admin"); // admin + moderator (the registry's constructor)
    address internal ayse = makeAddr("ayse"); // author
    address internal eve = makeAddr("eve");

    string internal constant CID = "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
    bytes32 internal constant HASH_V1 = keccak256("v1");
    bytes32 internal constant HASH_V2 = keccak256("v2");

    event Reviewed(uint256 indexed id, uint32 version, bytes32 contentHash, address indexed reviewer);
    event ReviewRevoked(uint256 indexed id, uint32 version, address indexed moderator);

    function setUp() public {
        registry = new GuidelineRegistry(admin);
        reviews = new GuidelineReviews(registry);
    }

    function _register() internal returns (uint256 id) {
        vm.prank(ayse);
        id = registry.register(CID, HASH_V1, 0, 0);
    }

    function _approve(uint256 id, uint32 version) internal {
        vm.prank(admin);
        reviews.approve(id, version);
    }

    // ── Constructor ──

    function test_RejectsZeroRegistry() public {
        vm.expectRevert(GuidelineReviews.ZeroAddress.selector);
        new GuidelineReviews(GuidelineRegistry(address(0)));
    }

    function test_KeepsTheRegistry() public view {
        assertEq(address(reviews.REGISTRY()), address(registry));
    }

    // ── Approve ──

    function test_ModeratorApprovesAVersion() public {
        uint256 id = _register();
        vm.expectEmit(address(reviews));
        emit Reviewed(id, 1, HASH_V1, admin);
        _approve(id, 1);

        GuidelineReviews.Review memory r = reviews.getReview(id);
        assertEq(r.version, 1);
        assertEq(r.contentHash, HASH_V1, "hash copied from the registry, not from the caller");
        assertEq(r.reviewer, admin);
        assertEq(r.reviewedAt, uint64(block.timestamp));
        assertTrue(reviews.isReviewed(id));
    }

    function test_OnlyModeratorsApprove() public {
        uint256 id = _register();
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(GuidelineReviews.NotModerator.selector, eve));
        reviews.approve(id, 1);
        vm.prank(ayse);
        vm.expectRevert(abi.encodeWithSelector(GuidelineReviews.NotModerator.selector, ayse));
        reviews.approve(id, 1);
        assertFalse(reviews.isReviewed(id));
    }

    function testFuzz_NoOneButAModeratorApproves(address caller) public {
        vm.assume(caller != admin);
        uint256 id = _register();
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(GuidelineReviews.NotModerator.selector, caller));
        reviews.approve(id, 1);
    }

    function test_UnknownGuidelineOrVersionReverts() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.UnknownGuideline.selector, 99));
        reviews.approve(99, 1);
        uint256 id = _register();
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.UnknownVersion.selector, id, 2));
        reviews.approve(id, 2);
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.UnknownVersion.selector, id, 0));
        reviews.approve(id, 0);
    }

    function test_LockedGuidelineCantBeApproved() public {
        uint256 id = _register();
        vm.prank(admin);
        registry.setModeratorLock(id, true);
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(GuidelineReviews.LockedByModerator.selector, id));
        reviews.approve(id, 1);
    }

    function test_HiddenGuidelineCanBeApprovedAndKeepsItsReview() public {
        uint256 id = _register();
        vm.prank(ayse);
        registry.setHidden(id, true);
        _approve(id, 1);
        assertTrue(reviews.isReviewed(id), "hiding is the author's choice, not a safety finding");
    }

    // ── What a review covers ──

    function test_ANewVersionIsNotCoveredByAnOldReview() public {
        uint256 id = _register();
        _approve(id, 1);
        vm.prank(ayse);
        registry.publishVersion(id, CID, HASH_V2);
        assertFalse(reviews.isReviewed(id), "v2 was never read");
        assertEq(reviews.getReview(id).version, 1, "the v1 review is still on record");

        _approve(id, 2);
        assertTrue(reviews.isReviewed(id));
        assertEq(reviews.getReview(id).contentHash, HASH_V2);
    }

    function test_ApprovingAnOlderVersionDoesntCoverTheLatest() public {
        uint256 id = _register();
        vm.prank(ayse);
        registry.publishVersion(id, CID, HASH_V2);
        _approve(id, 1);
        assertFalse(reviews.isReviewed(id));
    }

    function test_ALockAfterTheReviewDropsIt() public {
        uint256 id = _register();
        _approve(id, 1);
        vm.prank(admin);
        registry.setModeratorLock(id, true);
        assertFalse(reviews.isReviewed(id));
        vm.prank(admin);
        registry.setModeratorLock(id, false);
        assertTrue(reviews.isReviewed(id), "unlocked: the same file, the same review");
    }

    function test_AReviewerWhoLosesTheRoleLosesTheirReviews() public {
        address mod = makeAddr("mod");
        bytes32 role = registry.MODERATOR_ROLE();
        vm.prank(admin);
        registry.grantRole(role, mod);
        uint256 id = _register();
        vm.prank(mod);
        reviews.approve(id, 1);
        assertTrue(reviews.isReviewed(id));

        vm.prank(admin);
        registry.revokeRole(role, mod);
        assertFalse(reviews.isReviewed(id), "a lost or compromised key's reviews stop counting");
        vm.prank(mod);
        vm.expectRevert(abi.encodeWithSelector(GuidelineReviews.NotModerator.selector, mod));
        reviews.approve(id, 1);
    }

    function test_UnknownGuidelineIsReviewedReverts() public {
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.UnknownGuideline.selector, 7));
        reviews.isReviewed(7);
    }

    // ── Revoke ──

    function test_ModeratorRevokes() public {
        uint256 id = _register();
        _approve(id, 1);
        vm.expectEmit(address(reviews));
        emit ReviewRevoked(id, 1, admin);
        vm.prank(admin);
        reviews.revoke(id);
        assertFalse(reviews.isReviewed(id));
        assertEq(reviews.getReview(id).version, 0);
    }

    function test_RevokeNeedsAModeratorAndAReview() public {
        uint256 id = _register();
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(GuidelineReviews.NotReviewed.selector, id));
        reviews.revoke(id);
        _approve(id, 1);
        vm.prank(eve);
        vm.expectRevert(abi.encodeWithSelector(GuidelineReviews.NotModerator.selector, eve));
        reviews.revoke(id);
        assertTrue(reviews.isReviewed(id));
    }

    // ── Holds nothing ──

    function test_RejectsValue() public {
        (bool ok,) = address(reviews).call{value: 1}("");
        assertFalse(ok, "no receive/fallback: it never holds funds");
    }
}
