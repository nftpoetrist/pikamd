// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {GuidelineRegistry} from "../src/GuidelineRegistry.sol";

contract GuidelineRegistryTest is Test {
    GuidelineRegistry internal registry;

    address internal admin = makeAddr("admin");
    address internal moderator = makeAddr("moderator");
    address internal ayse = makeAddr("ayse");
    address internal bob = makeAddr("bob");

    string internal constant CID1 = "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
    string internal constant CID2 = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
    bytes32 internal constant HASH1 = keccak256("v1");
    bytes32 internal constant HASH2 = keccak256("v2");

    function setUp() public {
        registry = new GuidelineRegistry(admin);
        bytes32 role = registry.MODERATOR_ROLE();
        vm.prank(admin);
        registry.grantRole(role, moderator);
    }

    function _register(address author) internal returns (uint256) {
        vm.prank(author);
        return registry.register(CID1, HASH1, 0, 0);
    }

    // ── Constructor and roles ──

    function test_ConstructorGivesAdminBothRoles() public view {
        assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(registry.hasRole(registry.MODERATOR_ROLE(), admin));
        assertFalse(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), address(this)), "deployer gets nothing");
        assertFalse(registry.hasRole(registry.MODERATOR_ROLE(), address(this)));
    }

    function test_ConstructorRejectsZeroAdmin() public {
        vm.expectRevert(GuidelineRegistry.ZeroAdmin.selector);
        new GuidelineRegistry(address(0));
    }

    function test_StartsWithCcBy4() public view {
        assertEq(registry.licenseCount(), 1);
        assertEq(registry.licenses(0), "CC-BY-4.0");
        assertEq(registry.nextId(), 1);
    }

    // ── register ──

    function test_RegisterRecordsAuthorAndFirstVersion() public {
        vm.expectEmit(true, true, true, true, address(registry));
        emit GuidelineRegistry.GuidelineRegistered(1, ayse, 0, CID1, HASH1, 0);
        vm.expectEmit(true, true, true, true, address(registry));
        emit GuidelineRegistry.VersionPublished(1, 1, CID1, HASH1);
        uint256 id = _register(ayse);

        assertEq(id, 1);
        assertEq(registry.nextId(), 2);
        GuidelineRegistry.Guideline memory g = registry.getGuideline(id);
        assertEq(g.author, ayse, "author is msg.sender");
        assertEq(g.parentId, 0);
        assertEq(g.license, 0);
        assertEq(g.versionCount, 1);
        assertFalse(g.authorHidden);
        assertFalse(g.moderatorLocked);
        assertEq(g.createdAt, block.timestamp);

        GuidelineRegistry.Version memory v = registry.getVersion(id, 1);
        assertEq(v.cid, CID1);
        assertEq(v.contentHash, HASH1);
        assertEq(registry.latestVersion(id).cid, CID1);
    }

    function test_RegisterRejectsBadInput() public {
        vm.startPrank(ayse);
        vm.expectRevert(GuidelineRegistry.EmptyCid.selector);
        registry.register("", HASH1, 0, 0);

        string memory longCid = string(new bytes(registry.MAX_CID_LENGTH() + 1));
        vm.expectRevert(GuidelineRegistry.CidTooLong.selector);
        registry.register(longCid, HASH1, 0, 0);

        vm.expectRevert(GuidelineRegistry.EmptyContentHash.selector);
        registry.register(CID1, bytes32(0), 0, 0);

        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.UnknownLicense.selector, uint8(1)));
        registry.register(CID1, HASH1, 0, 1);

        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.UnknownGuideline.selector, uint256(7)));
        registry.register(CID1, HASH1, 7, 0);
        vm.stopPrank();
        assertEq(registry.nextId(), 1, "nothing registered");
    }

    function test_RegisterAcceptsMaxLengthCid() public {
        string memory cid = string(new bytes(registry.MAX_CID_LENGTH()));
        vm.prank(ayse);
        assertEq(registry.register(cid, HASH1, 0, 0), 1);
    }

    function test_RegisterRejectsValue() public {
        vm.deal(ayse, 1 ether);
        vm.prank(ayse);
        (bool ok,) = address(registry).call{value: 1}(
            abi.encodeCall(GuidelineRegistry.register, (CID1, HASH1, uint256(0), uint8(0)))
        );
        assertFalse(ok, "register is not payable");
    }

    // ── Forks ──

    function test_ForkPointsAtParent() public {
        uint256 parent = _register(ayse);
        vm.prank(bob);
        uint256 fork = registry.register(CID2, HASH2, parent, 0);
        assertEq(registry.getGuideline(fork).parentId, parent);
        assertEq(registry.getGuideline(fork).author, bob);
    }

    function test_ForkOfDelistedParentIsAllowed() public {
        uint256 parent = _register(ayse);
        vm.prank(moderator);
        registry.setModeratorLock(parent, true);
        vm.prank(bob);
        assertEq(registry.register(CID2, HASH2, parent, 0), 2, "provenance is kept even for hidden parents");
    }

    // ── publishVersion ──

    function test_AuthorPublishesVersionsAndOldOnesStay() public {
        uint256 id = _register(ayse);
        vm.expectEmit(true, true, true, true, address(registry));
        emit GuidelineRegistry.VersionPublished(id, 2, CID2, HASH2);
        vm.prank(ayse);
        assertEq(registry.publishVersion(id, CID2, HASH2), 2);

        assertEq(registry.getGuideline(id).versionCount, 2);
        assertEq(registry.getVersion(id, 1).cid, CID1, "pinned v1 never changes");
        assertEq(registry.getVersion(id, 1).contentHash, HASH1);
        assertEq(registry.getVersion(id, 2).cid, CID2);
        assertEq(registry.latestVersion(id).contentHash, HASH2);
    }

    function test_OnlyAuthorPublishesVersions() public {
        uint256 id = _register(ayse);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.NotAuthor.selector, id, bob));
        registry.publishVersion(id, CID2, HASH2);

        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.NotAuthor.selector, id, admin));
        registry.publishVersion(id, CID2, HASH2);
    }

    function test_PublishVersionChecksInput() public {
        uint256 id = _register(ayse);
        vm.startPrank(ayse);
        vm.expectRevert(GuidelineRegistry.EmptyCid.selector);
        registry.publishVersion(id, "", HASH2);
        vm.expectRevert(GuidelineRegistry.EmptyContentHash.selector);
        registry.publishVersion(id, CID2, bytes32(0));
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.UnknownGuideline.selector, uint256(9)));
        registry.publishVersion(9, CID2, HASH2);
        vm.stopPrank();
    }

    function test_UnknownVersionsRevert() public {
        uint256 id = _register(ayse);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.UnknownVersion.selector, id, uint32(0)));
        registry.getVersion(id, 0);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.UnknownVersion.selector, id, uint32(2)));
        registry.getVersion(id, 2);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.UnknownGuideline.selector, uint256(5)));
        registry.latestVersion(5);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.UnknownGuideline.selector, uint256(0)));
        registry.getGuideline(0);
    }

    // ── Hiding (author) and moderator lock: two separate flags ──

    function test_AuthorHidesAndShowsOwnGuideline() public {
        uint256 id = _register(ayse);
        assertTrue(registry.isListed(id));
        vm.expectEmit(true, true, true, true, address(registry));
        emit GuidelineRegistry.HiddenSet(id, true);
        vm.prank(ayse);
        registry.setHidden(id, true);
        assertTrue(registry.getGuideline(id).authorHidden);
        assertFalse(registry.isListed(id));

        vm.prank(ayse);
        registry.publishVersion(id, CID2, HASH2); // allowed while self-hidden

        vm.prank(ayse);
        registry.setHidden(id, false);
        assertTrue(registry.isListed(id));
    }

    function test_ModeratorLockHidesAndBlocksNewVersions() public {
        uint256 id = _register(ayse);
        vm.expectEmit(true, true, true, true, address(registry));
        emit GuidelineRegistry.ModeratorLockSet(id, true, moderator);
        vm.prank(moderator);
        registry.setModeratorLock(id, true);
        assertTrue(registry.getGuideline(id).moderatorLocked);
        assertFalse(registry.isListed(id));

        vm.prank(ayse);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.LockedByModerator.selector, id));
        registry.publishVersion(id, CID2, HASH2);

        vm.prank(ayse);
        registry.setHidden(id, false); // the author's own flag; the lock still hides it
        assertFalse(registry.isListed(id), "the author can't lift a moderator lock");

        vm.prank(moderator);
        registry.setModeratorLock(id, false);
        assertTrue(registry.isListed(id));
        vm.prank(ayse);
        registry.publishVersion(id, CID2, HASH2);
    }

    /// The bug found in the first deployment: lifting a moderator lock made a guideline the author
    /// had hidden (e.g. after leaking personal data) public again.
    function test_UnlockingKeepsTheAuthorsHide() public {
        uint256 id = _register(ayse);
        vm.prank(ayse);
        registry.setHidden(id, true);
        vm.prank(moderator);
        registry.setModeratorLock(id, true);
        vm.prank(moderator);
        registry.setModeratorLock(id, false);
        assertTrue(registry.getGuideline(id).authorHidden);
        assertFalse(registry.isListed(id), "still hidden by its author");
    }

    function test_AuthorCanHideWhileLocked() public {
        uint256 id = _register(ayse);
        vm.prank(moderator);
        registry.setModeratorLock(id, true);
        vm.prank(ayse);
        registry.setHidden(id, true);
        vm.prank(moderator);
        registry.setModeratorLock(id, false);
        assertFalse(registry.isListed(id), "the author's hide outlives the lock");
    }

    function test_ModeratorWhoIsAlsoAnAuthorHidesAsAnAuthor() public {
        vm.prank(moderator);
        uint256 id = registry.register(CID1, HASH1, 0, 0);
        vm.prank(moderator);
        registry.setHidden(id, true);
        assertTrue(registry.getGuideline(id).authorHidden);
        assertFalse(registry.getGuideline(id).moderatorLocked, "a hide is not a lock");
    }

    function test_OnlyTheAuthorHides() public {
        uint256 id = _register(ayse);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.NotAuthor.selector, id, bob));
        registry.setHidden(id, true);
        vm.prank(moderator);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.NotAuthor.selector, id, moderator));
        registry.setHidden(id, true);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.UnknownGuideline.selector, uint256(3)));
        registry.setHidden(3, true);
    }

    function test_OnlyModeratorsLock() public {
        uint256 id = _register(ayse);
        bytes32 role = registry.MODERATOR_ROLE();
        vm.prank(ayse);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, ayse, role));
        registry.setModeratorLock(id, true);
        vm.prank(moderator);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.UnknownGuideline.selector, uint256(3)));
        registry.setModeratorLock(3, true);
    }

    function test_RevokedModeratorCannotLock() public {
        uint256 id = _register(ayse);
        bytes32 role = registry.MODERATOR_ROLE();
        vm.prank(admin);
        registry.revokeRole(role, moderator);
        vm.prank(moderator);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, moderator, role));
        registry.setModeratorLock(id, true);
    }

    function test_IsListedRevertsForUnknownIds() public {
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.UnknownGuideline.selector, uint256(1)));
        registry.isListed(1);
    }

    function test_ModeratorCannotGrantRoles() public {
        bytes32 role = registry.MODERATOR_ROLE();
        bytes32 adminRole = registry.DEFAULT_ADMIN_ROLE();
        vm.prank(moderator);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, moderator, adminRole)
        );
        registry.grantRole(role, bob);
    }

    // ── Licenses ──

    function test_AdminAddsLicense() public {
        vm.expectEmit(true, true, true, true, address(registry));
        emit GuidelineRegistry.LicenseAdded(1, "CC0-1.0");
        vm.prank(admin);
        assertEq(registry.addLicense("CC0-1.0"), 1);
        assertEq(registry.licenses(1), "CC0-1.0");

        vm.prank(ayse);
        uint256 id = registry.register(CID1, HASH1, 0, 1);
        assertEq(registry.getGuideline(id).license, 1);
    }

    function test_OnlyAdminAddsLicense() public {
        bytes32 adminRole = registry.DEFAULT_ADMIN_ROLE();
        vm.prank(moderator);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, moderator, adminRole)
        );
        registry.addLicense("CC0-1.0");
    }

    function test_LicenseNameIsChecked() public {
        vm.startPrank(admin);
        vm.expectRevert(GuidelineRegistry.BadLicenseName.selector);
        registry.addLicense("");
        vm.expectRevert(GuidelineRegistry.BadLicenseName.selector);
        registry.addLicense(string(new bytes(65)));
        vm.stopPrank();
    }

    function test_LicenseIdsStopAt255() public {
        vm.startPrank(admin);
        for (uint256 i = 1; i <= 255; i++) registry.addLicense("L");
        assertEq(registry.licenseCount(), 256);
        vm.expectRevert(GuidelineRegistry.TooManyLicenses.selector);
        registry.addLicense("L");
        vm.stopPrank();
    }

    // ── Fuzz ──

    function testFuzz_IdsAreSequentialAndAuthorIsCaller(address author, uint8 count) public {
        vm.assume(author != address(0));
        count = uint8(bound(count, 1, 20));
        for (uint256 i = 1; i <= count; i++) {
            vm.prank(author);
            assertEq(registry.register(CID1, keccak256(abi.encode(i)), 0, 0), i);
            assertEq(registry.getGuideline(i).author, author);
        }
        assertEq(registry.nextId(), uint256(count) + 1);
    }

    /// Any order of author hides and moderator locks: the author's last choice and the moderator's
    /// last decision are both kept, and the guideline is listed only when both allow it.
    function testFuzz_HideAndLockNeverOverrideEachOther(uint8[] calldata ops) public {
        uint256 id = _register(ayse);
        bool hidden;
        bool locked;
        for (uint256 i = 0; i < ops.length && i < 24; i++) {
            bool on = ops[i] & 1 == 1;
            if (ops[i] & 2 == 0) {
                vm.prank(ayse);
                registry.setHidden(id, on);
                hidden = on;
            } else {
                vm.prank(moderator);
                registry.setModeratorLock(id, on);
                locked = on;
            }
            GuidelineRegistry.Guideline memory g = registry.getGuideline(id);
            assertEq(g.authorHidden, hidden);
            assertEq(g.moderatorLocked, locked);
            assertEq(registry.isListed(id), !hidden && !locked);
        }
    }

    function testFuzz_OnlyTheAuthorCanPublish(address caller) public {
        vm.assume(caller != ayse);
        uint256 id = _register(ayse);
        vm.prank(caller);
        vm.expectRevert(abi.encodeWithSelector(GuidelineRegistry.NotAuthor.selector, id, caller));
        registry.publishVersion(id, CID2, HASH2);
    }
}
