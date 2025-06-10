# Spatial Existence NFT

**A 4-token, 3-phase on-chain/ IPFS-hosted NFT drop**  
Each NFT cycles through **Phase A/B/C** every ~30 days, anchored to deployment.  
Includes per-wallet mint cap, configurable mint & claim economics, and owner withdrawal.

---

## Repository Structure

```
├─ contracts/
│ └─ SpatialExistenceNFT.sol
│
├─ scripts/
│ ├─ deploy.js
│ ├─ convert.js
│ └─ generateMetadata.js
│
├─ svgs-original/ # Your source PNGs: 1a.png…4c.png
├─ svgs/ # Output Base64-SVG blobs (1.b64…12.b64)
├─ metadata/ # Output JSON files (1a.json…4c.json)
│
├─ test/
│ └─ SpatialExistenceNFT.full.test.js
│
├─ .env # PINATA_API_KEY, PINATA_API_SECRET, BASE_CID
├─ hardhat.config.js
├─ package.json
└─ README.md # ← you are here

```

## Prerequisites

- **Node.js** ≥ 16, **npm** or **yarn**
- **Hardhat** (dev dependency)
- **Sharp** & **SVGO** (for `convert.js`)
- **Pinata SDK** (optional, for uploading metadata)
- A free [Pinata](https://pinata.cloud) account (to pin metadata & images)

## Installation

```bash
git clone <repo-url>
cd <repo-folder>
npm install
# or
yarn install
```

Create a `.env` in the project root:

```ini
# .env
PINATA_API_KEY=your_pinata_api_key
PINATA_API_SECRET=your_pinata_api_secret
BASE_CID=QmYourPinnedMetadataFolderCID
```

## 1. Convert PNGs → Base64-SVG

Your artwork PNGs live in `svgs-original/` named `1a.png`…`4c.png`.

Run:

```bash
node scripts/convert.js
```

- Reads `svgs-original/[1-4][abc].png`
- Compresses with `sharp`
- Embeds into minimal SVG
- Optimizes via `svgo`
- Emits `svgs/1.b64`…`svgs/12.b64`

## 2. Generate Metadata JSON

With your Base64-SVG blobs, produce `metadata/1a.json`…`4c.json`:

```bash
node scripts/generateMetadata.js
```

Each file contains:

```jsonc
{
	"name": "Spatial Existence #<tokenId>",
	"description": "Description of the project goes here..",
	"image": "data:image/svg+xml;base64,<...your-b64...>",
	"attributes": [
		{ "trait_type": "Type", "value": "Generative Artwork" },
		{ "trait_type": "Phase", "value": "Phase 1 | Phase 2 | Phase 3" }
	]
}
```

## 3. Pin Metadata to IPFS

### A) Web UI

1. Log in to [Pinata](https://pinata.cloud).
2. **Files** → **Upload** → **Folder** → select `metadata/`.
3. After upload, copy the folder **CID** (e.g. `QmYourCID…`).
4. Paste into your `.env` as `BASE_CID`.

### B) Programmatic (optional)

```bash
npm install @pinata/sdk
```

```js
// scripts/pinMetadata.js
require("dotenv").config();
const pinata = require("@pinata/sdk")(
	process.env.PINATA_API_KEY,
	process.env.PINATA_API_SECRET
);
const fs = require("fs");
const path = require("path");

async function main() {
	const dir = path.join(__dirname, "../metadata");
	for (const file of fs.readdirSync(dir)) {
		if (!file.endsWith(".json")) continue;
		const json = JSON.parse(fs.readFileSync(path.join(dir, file)));
		const { IpfsHash } = await pinata.pinJSONToIPFS(json, {
			pinataMetadata: { name: file },
			pinataOptions: { cidVersion: 1 },
		});
		console.log(`${file} → ${IpfsHash}`);
	}
}
main();
```

## 4. Deploy & Mint (Hardhat)

Edit `scripts/deploy.js` if needed, then:

```bash
npx hardhat node           # run a local node
npx hardhat run \
  --network localhost \
  scripts/deploy.js
```

What happens:

1. Reads `BASE_CID` → builds `baseURI = ipfs://<CID>/`.
2. Deploys `SpatialExistenceNFT(baseURI)`.
3. Mints tokens #1–#4 (each costs `mintPrice`).

## Smart Contract Overview

### `SpatialExistenceNFT.sol`

- **ERC-721** `"SPX"` by OpenZeppelin + Ownable
- **Constants**

  - `MAX_TOKENS = 4`
  - `mintPrice` (0.15 ETH), `claimPrice` (0.5 ETH) adjustable by owner

- **Per-wallet mint cap**: `hasMinted[address]`
- **Per-token claim**: `claimed[tokenId]`
- **Withdrawal**: `withdraw()` → owner can pull all ETH
- **Phase logic** anchored at deployment:

  ```solidity
  uint256 public immutable startTime;
  constructor(...) { startTime = block.timestamp; }

  // elapsed = now – startTime
  // month = ((elapsed / 1 day) / 30 + 1) % 12 + 1
  // phase = collapse 1–4→0, 5–8→1, 9–12→2
  function currentPhase() public view returns (uint8) { … }
  function tokenURI(uint256 tokenId) public view override returns (string) { … }
  ```

- **Events**: `TokenMinted`, `TokenClaimed`, `MintPriceUpdated`, `ClaimPriceUpdated`, `Withdraw`.

## 5. Testing

Our comprehensive test covers:

- Mint correctness & reverts
- Claim correctness & reverts
- Price updates & owner-only access
- ETH acceptance & withdrawal
- Phase cycling (a→b→c) anchored to deploy

Run:

```bash
npx hardhat test
```

You’ll see console logs:

```
Phase 0: 0 [ "http://…/1a.json", … ]
Phase 1: 1 [ "http://…/1b.json", … ]
Phase 2: 2 [ "http://…/1c.json", … ]
```

## Data-URL vs. IPFS-link for images

- **Data-URL embedding** in JSON → one HTTP/IPFS fetch, but JSON size ∼100–500 KB.
- **IPFS-link** (`"image":"ipfs://…/1a.png"`) → lean JSON (∼1 KB) + separate image fetch; better caching/CDN performance.

**Recommendation:** link images separately for faster load times in production.

## Lifecycle & Phase Loop

- **Phase 0** upon deploy → days 0–119
- **Phase 1** days 120–239
- **Phase 2** days 240–359
- **Day 360** → loops → Phase 0 again
- **Repeat every 360 days** thereafter

Because we use **fixed 30-day buckets**, the on-chain cycle drifts \~5 days per real year.

## Acknowledgements

- Built with **Hardhat**, **OpenZeppelin**, **SVGO**, **Sharp**, and **Solmate SSTORE2**.
- Inspired by on-chain SVG artcycles and Limited Edition seasonal drops.
