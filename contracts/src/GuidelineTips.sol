// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {GuidelineRegistry} from "./GuidelineRegistry.sol";

/// @title PikaMd tips
/// @notice Anyone can tip the author of a guideline in USDC (ARCHITECTURE.md K21). The USDC moves
/// straight from the tipper's wallet to the author's wallet inside the call: this contract never
/// holds funds, takes no fee, has no owner and can't be paused or upgraded. The recipient is always
/// the author the registry recorded when the guideline was published, so no website, database or
/// client can redirect a tip. The `Tipped` event records which guideline it was for.
/// @dev USDC through its ERC-20 interface (6 decimals; on Arc the same balance as the native gas
/// token, ARC.md §3). The tipper first approves this contract for the amount. Only the caller's
/// own allowance is ever spent: `tip` always pulls from msg.sender, so an allowance left behind
/// (a tip cancelled after its approval) can't be used by anyone else.
contract GuidelineTips {
    using SafeERC20 for IERC20;

    /// @notice Smallest tip: 0.01 USDC. Below it a tip would cost more in network fees than it sends.
    uint256 public constant MIN_TIP = 10_000;

    /// @notice USDC's ERC-20 interface (0x3600…0000 on Arc testnet and mainnet).
    IERC20 public immutable USDC;
    /// @notice Where each guideline's author is read from, at the moment of the tip.
    GuidelineRegistry public immutable REGISTRY;

    event Tipped(uint256 indexed guidelineId, address indexed from, address indexed author, uint256 amount);

    error ZeroAddress();
    error TipTooSmall(uint256 amount);
    error NotListed(uint256 guidelineId);
    error SelfTip(uint256 guidelineId);

    constructor(IERC20 usdc, GuidelineRegistry registry) {
        if (address(usdc) == address(0) || address(registry) == address(0)) revert ZeroAddress();
        USDC = usdc;
        REGISTRY = registry;
    }

    /// @notice Sends `amount` USDC (6 decimals) from the caller to the author of `guidelineId`.
    /// Reverts for unknown guidelines (the registry's UnknownGuideline), for guidelines the author
    /// hid or a moderator locked, for the author's own guidelines and below MIN_TIP.
    function tip(uint256 guidelineId, uint256 amount) external {
        if (amount < MIN_TIP) revert TipTooSmall(amount);
        GuidelineRegistry.Guideline memory g = REGISTRY.getGuideline(guidelineId);
        if (g.authorHidden || g.moderatorLocked) revert NotListed(guidelineId);
        if (g.author == msg.sender) revert SelfTip(guidelineId);

        emit Tipped(guidelineId, msg.sender, g.author, amount);
        USDC.safeTransferFrom(msg.sender, g.author, amount);
    }
}
