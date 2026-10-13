// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title PikaMd guideline registry
/// @notice On-chain record of who published which guideline file and every version of it
/// (ARCHITECTURE.md §5). The Markdown itself lives on IPFS: the chain keeps the author, the
/// IPFS CID, the sha256 of the file's UTF-8 bytes, the fork source and the license.
/// Not upgradeable on purpose; a v2 would be a new deployment.
/// @dev Arc block timestamps can repeat (ARC.md §5): `createdAt` is for display only, order by
/// block number and log index.
contract GuidelineRegistry is AccessControl {
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");

    /// @notice Longest accepted CID in bytes (a CIDv1 sha256 in base32 is 59).
    uint256 public constant MAX_CID_LENGTH = 128;
    uint256 public constant MAX_LICENSE_NAME_LENGTH = 64;

    struct Guideline {
        address author;
        uint8 license; // index into `licenses`
        uint32 versionCount; // versions are numbered 1..versionCount
        bool authorHidden; // the author's own choice; only the author changes it
        bool moderatorLocked; // a moderator's decision; only a moderator changes it
        uint64 createdAt;
        uint256 parentId; // 0 = original, otherwise the guideline this one forks
    }

    struct Version {
        string cid;
        bytes32 contentHash; // sha256 of the Markdown file's UTF-8 bytes
        uint64 createdAt;
    }

    /// @notice License names by id, e.g. 0 = "CC-BY-4.0". Only ever appended to.
    string[] public licenses;

    /// @notice Next guideline id; ids start at 1 so that parentId 0 can mean "no parent".
    uint256 public nextId = 1;

    mapping(uint256 id => Guideline) internal _guidelines;
    mapping(uint256 id => Version[]) internal _versions;

    event GuidelineRegistered(
        uint256 indexed id, address indexed author, uint256 indexed parentId, string cid, bytes32 contentHash, uint8 license
    );
    event VersionPublished(uint256 indexed id, uint32 version, string cid, bytes32 contentHash);
    event HiddenSet(uint256 indexed id, bool hidden);
    event ModeratorLockSet(uint256 indexed id, bool locked, address indexed moderator);
    event LicenseAdded(uint8 indexed license, string name);

    error ZeroAdmin();
    error EmptyCid();
    error CidTooLong();
    error EmptyContentHash();
    error UnknownLicense(uint8 license);
    error BadLicenseName();
    error TooManyLicenses();
    error UnknownGuideline(uint256 id);
    error NotAuthor(uint256 id, address caller);
    error LockedByModerator(uint256 id);
    error UnknownVersion(uint256 id, uint32 version);

    /// @param admin Gets DEFAULT_ADMIN_ROLE and MODERATOR_ROLE. Passed explicitly, never
    /// msg.sender: a factory or smart-account deployment would otherwise own the registry (K17).
    constructor(address admin) {
        if (admin == address(0)) revert ZeroAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MODERATOR_ROLE, admin);
        _addLicense("CC-BY-4.0");
    }

    // ── Publishing ────────────────────────────────────────────────────────────────────────

    /// @notice Registers a new guideline with its first version; the caller is the author (K7).
    /// @param parentId 0 for an original, or the id of the guideline this one forks (K14).
    function register(string calldata cid, bytes32 contentHash, uint256 parentId, uint8 license)
        external
        returns (uint256 id)
    {
        _checkContent(cid, contentHash);
        if (license >= licenses.length) revert UnknownLicense(license);
        if (parentId != 0) _requireExists(parentId);

        id = nextId++;
        uint64 now_ = uint64(block.timestamp);
        _guidelines[id] = Guideline({
            author: msg.sender,
            license: license,
            versionCount: 1,
            authorHidden: false,
            moderatorLocked: false,
            createdAt: now_,
            parentId: parentId
        });
        _versions[id].push(Version({cid: cid, contentHash: contentHash, createdAt: now_}));

        emit GuidelineRegistered(id, msg.sender, parentId, cid, contentHash, license);
        emit VersionPublished(id, 1, cid, contentHash);
    }

    /// @notice Adds a new version. Earlier versions stay as they are, so pinned versions never change (K13).
    function publishVersion(uint256 id, string calldata cid, bytes32 contentHash) external returns (uint32 version) {
        Guideline storage g = _requireExists(id);
        if (g.author != msg.sender) revert NotAuthor(id, msg.sender);
        if (g.moderatorLocked) revert LockedByModerator(id);
        _checkContent(cid, contentHash);

        version = ++g.versionCount;
        _versions[id].push(Version({cid: cid, contentHash: contentHash, createdAt: uint64(block.timestamp)}));
        emit VersionPublished(id, version, cid, contentHash);
    }

    // ── Hiding and moderation ─────────────────────────────────────────────────────────────
    // Two separate decisions, kept in two flags: a guideline is listed only when neither is set
    // (`isListed`). Nothing is ever deleted; the site, index and MCP stop serving it.

    /// @notice The author hides or shows their own guideline. Allowed while a moderator lock is on
    /// (hiding more is always fine); showing again only takes effect once the lock is lifted.
    function setHidden(uint256 id, bool hidden) external {
        Guideline storage g = _requireExists(id);
        if (g.author != msg.sender) revert NotAuthor(id, msg.sender);
        g.authorHidden = hidden;
        emit HiddenSet(id, hidden);
    }

    /// @notice A moderator locks or unlocks a guideline. While locked it isn't listed and the author
    /// can't publish new versions. Unlocking never changes the author's own hide choice.
    function setModeratorLock(uint256 id, bool locked) external onlyRole(MODERATOR_ROLE) {
        Guideline storage g = _requireExists(id);
        g.moderatorLocked = locked;
        emit ModeratorLockSet(id, locked, msg.sender);
    }

    /// @notice Makes another license available to `register`. Existing ids never change meaning.
    function addLicense(string calldata name) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint8 license) {
        return _addLicense(name);
    }

    // ── Reads ─────────────────────────────────────────────────────────────────────────────

    function getGuideline(uint256 id) external view returns (Guideline memory) {
        return _requireExists(id);
    }

    /// @param version 1-based, like `slug@v3`.
    function getVersion(uint256 id, uint32 version) external view returns (Version memory) {
        Guideline storage g = _requireExists(id);
        if (version == 0 || version > g.versionCount) revert UnknownVersion(id, version);
        return _versions[id][version - 1];
    }

    function latestVersion(uint256 id) external view returns (Version memory) {
        Guideline storage g = _requireExists(id);
        return _versions[id][g.versionCount - 1];
    }

    /// @notice True when neither the author nor a moderator has hidden it.
    function isListed(uint256 id) external view returns (bool) {
        Guideline storage g = _requireExists(id);
        return !g.authorHidden && !g.moderatorLocked;
    }

    function licenseCount() external view returns (uint256) {
        return licenses.length;
    }

    // ── Internal ──────────────────────────────────────────────────────────────────────────

    function _requireExists(uint256 id) internal view returns (Guideline storage g) {
        g = _guidelines[id];
        if (g.author == address(0)) revert UnknownGuideline(id);
    }

    function _checkContent(string calldata cid, bytes32 contentHash) internal pure {
        uint256 length = bytes(cid).length;
        if (length == 0) revert EmptyCid();
        if (length > MAX_CID_LENGTH) revert CidTooLong();
        if (contentHash == bytes32(0)) revert EmptyContentHash();
    }

    function _addLicense(string memory name) internal returns (uint8 license) {
        uint256 length = bytes(name).length;
        if (length == 0 || length > MAX_LICENSE_NAME_LENGTH) revert BadLicenseName();
        if (licenses.length > type(uint8).max) revert TooManyLicenses();
        license = uint8(licenses.length);
        licenses.push(name);
        emit LicenseAdded(license, name);
    }
}
