// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {GuidelineRegistry} from "./GuidelineRegistry.sol";

/// @title PikaMd guideline reviews
/// @notice A PikaMd moderator read a guideline's file and approved it: the "Reviewed" badge
/// (ARCHITECTURE.md §9.5). Anyone can check it here; no website or database can add one.
/// @dev Who may review comes from the registry's MODERATOR_ROLE, read at every call: there is no
/// separate list to keep in step, and a wallet that loses the role (a lost key, say) loses its
/// past reviews with it. A review names one version, so a newer version of the file is never
/// covered by an older review (versions themselves never change, K13). No owner, no funds, not
/// upgradeable.
contract GuidelineReviews {
    /// @notice Where guidelines, their versions and the moderator role live.
    GuidelineRegistry public immutable REGISTRY;

    struct Review {
        uint32 version; // 0 = no review
        bytes32 contentHash; // the registry's sha256 of that version, for display and indexing
        address reviewer;
        uint64 reviewedAt; // display only: order by block number and log index (ARC.md §5)
    }

    mapping(uint256 id => Review) internal _reviews;

    event Reviewed(uint256 indexed id, uint32 version, bytes32 contentHash, address indexed reviewer);
    event ReviewRevoked(uint256 indexed id, uint32 version, address indexed moderator);

    error ZeroAddress();
    error NotModerator(address caller);
    error LockedByModerator(uint256 id);
    error NotReviewed(uint256 id);

    constructor(GuidelineRegistry registry) {
        if (address(registry) == address(0)) revert ZeroAddress();
        REGISTRY = registry;
    }

    /// @notice A moderator approves `version` of guideline `id`: the exact file they read. Reverts
    /// for unknown guidelines or versions (the registry's errors) and for locked guidelines. A new
    /// approval replaces the previous one.
    function approve(uint256 id, uint32 version) external {
        _requireModerator();
        if (REGISTRY.getGuideline(id).moderatorLocked) revert LockedByModerator(id);
        bytes32 contentHash = REGISTRY.getVersion(id, version).contentHash;
        _reviews[id] = Review({version: version, contentHash: contentHash, reviewer: msg.sender, reviewedAt: uint64(block.timestamp)});
        emit Reviewed(id, version, contentHash, msg.sender);
    }

    /// @notice A moderator takes the approval back.
    function revoke(uint256 id) external {
        _requireModerator();
        uint32 version = _reviews[id].version;
        if (version == 0) revert NotReviewed(id);
        delete _reviews[id];
        emit ReviewRevoked(id, version, msg.sender);
    }

    /// @notice The stored approval, if any (version 0: none), whether or not it still holds.
    function getReview(uint256 id) external view returns (Review memory) {
        return _reviews[id];
    }

    /// @notice True when the guideline's latest version is the one approved, no moderator has
    /// locked it since, and the wallet that approved it still holds MODERATOR_ROLE. Reverts for
    /// unknown guidelines.
    function isReviewed(uint256 id) external view returns (bool) {
        Review memory r = _reviews[id];
        GuidelineRegistry.Guideline memory g = REGISTRY.getGuideline(id);
        if (r.version == 0 || r.version != g.versionCount || g.moderatorLocked) return false;
        return REGISTRY.hasRole(REGISTRY.MODERATOR_ROLE(), r.reviewer);
    }

    function _requireModerator() internal view {
        if (!REGISTRY.hasRole(REGISTRY.MODERATOR_ROLE(), msg.sender)) revert NotModerator(msg.sender);
    }
}
