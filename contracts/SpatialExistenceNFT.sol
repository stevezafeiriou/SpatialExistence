// SPDX-License-Identifier: MIT

/*
 ______     ______   ______     ______   __     ______     __            __  __    
/\  ___\   /\  == \ /\  __ \   /\__  _\ /\ \   /\  __ \   /\ \          /\_\_\_\   
\ \___  \  \ \  _-/ \ \  __ \  \/_/\ \/ \ \ \  \ \  __ \  \ \ \____     \/_/\_\/_  
 \/\_____\  \ \_\    \ \_\ \_\    \ \_\  \ \_\  \ \_\ \_\  \ \_____\      /\_\/\_\ 
  \/_____/   \/_/     \/_/\/_/     \/_/   \/_/   \/_/\/_/   \/_____/      \/_/\/_/ 
                                          -- A Limited Edition drop by Rainboy.eth                                                                               
*/

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @title  Spatial Existence NFT with mint & claim economics
/// @notice 4 tokens total; each wallet may mint one by paying `mintPrice`.
///         After mint, owners can “claim” their token exactly once by
///         paying `claimPrice`.  Owner may adjust prices and withdraw funds.
/// @dev    Phase logic & tokenURI unchanged.  See currentPhase() & tokenURI().
contract SpatialExistenceNFT is ERC721, Ownable {
    using Strings for uint256;

    /*╔══════════════════════════════════════════════════════╗
      ║                       EVENTS                        ║
      ╚══════════════════════════════════════════════════════╝*/

    event TokenMinted(address indexed minter, uint256 indexed tokenId);
    event TokenClaimed(address indexed claimer, uint256 indexed tokenId);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event ClaimPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event Withdraw(address indexed to, uint256 amount);

    /*╔══════════════════════════════════════════════════════╗
      ║                    STATE STORAGE                    ║
      ╚══════════════════════════════════════════════════════╝*/

    uint256 public immutable startTime;
    uint256 public constant MAX_TOKENS = 4;
    uint256 public nextTokenId           = 1;
    string  public baseURI;
    uint256 public mintPrice   = 0.15 ether;
    uint256 public claimPrice  = 0.5 ether;
    mapping(address => bool) public hasMinted;
    mapping(uint256 => bool) public claimed;

    /*╔══════════════════════════════════════════════════════╗
      ║                      CONSTRUCTOR                     ║
      ╚══════════════════════════════════════════════════════╝*/

    /// @param _baseURI   initial metadata base URI (with trailing slash)
    constructor(string memory _baseURI)
        ERC721("Spatial Existence", "SPX")
        Ownable(msg.sender)
    {
        baseURI   = _baseURI;
        startTime = block.timestamp;
    }

    /*╔══════════════════════════════════════════════════════╗
      ║                 ADMIN / OWNER ACTIONS               ║
      ╚══════════════════════════════════════════════════════╝*/

    /// @notice Update the base URI for all token metadata
    function setBaseURI(string calldata _newURI) external onlyOwner {
        baseURI = _newURI;
    }

    /// @notice Adjust the mint price
    function setMintPrice(uint256 _newPrice) external onlyOwner {
        emit MintPriceUpdated(mintPrice, _newPrice);
        mintPrice = _newPrice;
    }

    /// @notice Adjust the claim price
    function setClaimPrice(uint256 _newPrice) external onlyOwner {
        emit ClaimPriceUpdated(claimPrice, _newPrice);
        claimPrice = _newPrice;
    }

    /// @notice Withdraw all ETH from contract to owner
    function withdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "No balance");
        emit Withdraw(msg.sender, bal);
        payable(msg.sender).transfer(bal);
    }

    /// @notice Fallback to accept ETH
    receive() external payable {}

    /*╔══════════════════════════════════════════════════════╗
      ║                 PUBLIC / USER ACTIONS               ║
      ╚══════════════════════════════════════════════════════╝*/

    /**
     * @notice Mint one token by paying `mintPrice`.
     * @dev    Each address may mint exactly one.  Excess ETH is not refunded.
     */
    function mint() external payable {
        require(nextTokenId <= MAX_TOKENS, "All minted");
        require(!hasMinted[msg.sender],   "Already minted");
        require(msg.value >= mintPrice,   "Insufficient ETH");

        hasMinted[msg.sender] = true;
        uint256 id = nextTokenId++;
        _safeMint(msg.sender, id);

        emit TokenMinted(msg.sender, id);
    }

    /**
     * @notice Claim a physical item for a token you own by paying `claimPrice`.
     * @dev    Can only be called once per token.  Uses `ownerOf()` to assert existence.
     * @param tokenId the token you wish to claim
     */
    function claim(uint256 tokenId) external payable {
        // ownerOf() reverts if tokenId doesn't exist
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(!claimed[tokenId],               "Already claimed");
        require(msg.value >= claimPrice,         "Insufficient ETH");

        claimed[tokenId] = true;
        emit TokenClaimed(msg.sender, tokenId);
    }

    /*╔══════════════════════════════════════════════════════╗
      ║            TIME‐BASED PHASE LOGIC                    ║
      ╚══════════════════════════════════════════════════════╝*/

    /// @dev Approximate UTC month (1–12) by 30-day buckets
    function _month(uint256 ts) internal pure returns (uint8) {
        return uint8(((ts / 1 days) / 30 + 1) % 12 + 1);
    }

    /// @dev Collapse 1–12 month into 0,1,2
    function _phaseIndex(uint8 month) internal pure returns (uint8) {
        if (month <= 4)      return 0;
        else if (month <= 8) return 1;
        else                 return 2;
    }

    /**
     * @notice Returns the current temporal phase (0,1,2) of the artwork.
     * What phase (0–2) we’re in, where Phase 0 began at deployment.
     * @dev    Matches the same logic used in `tokenURI()`.
     * @return phaseIndex 0 for “a”, 1 for “b”, 2 for “c”
     */
    function currentPhase() public view returns (uint8 phaseIndex) {
        // elapsed seconds since deploy
        uint256 elapsed = block.timestamp - startTime;
        uint8    m       = _month(elapsed);
        phaseIndex      = _phaseIndex(m);
    }

    /**
     * @inheritdoc ERC721
     * @notice Returns `[baseURI][tokenId][phaseChar].json`
     * @dev    phaseChar: 0→'a',1→'b',2→'c'
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        ownerOf(tokenId); // will revert if nonexistent

        uint8 m = _month(block.timestamp - startTime);
        uint8 p = _phaseIndex(m);

        bytes1 phaseChar = p == 0
            ? bytes1("a")
            : p == 1
            ? bytes1("b")
            : bytes1("c");

        return string(
            abi.encodePacked(
                baseURI,
                tokenId.toString(),
                phaseChar,
                ".json"
            )
        );
    }
}