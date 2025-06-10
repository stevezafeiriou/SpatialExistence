require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
	// 1) Grab the first signer (your deployer account)
	const [deployer] = await ethers.getSigners();
	console.log("Deploying from:", deployer.address);

	// 2) Read your IPFS folder CID from .env
	const cid = "your_ipfs_cid_here";
	// 3) Build the baseURI for metadata (must include ipfs:// + trailing slash)
	const baseURI = `ipfs://${cid}/`;

	// 4) Fetch the compiled contract factory
	const Factory = await ethers.getContractFactory("SpatialExistenceNFT");
	// 5) Deploy, passing in baseURI
	const nft = await Factory.deploy(baseURI);
	await nft.deployed();
	console.log("NFT deployed at:", nft.address);
	console.log("baseURI:", baseURI);

	// // 6) Mint all four tokens to the deployer
	// for (let i = 1; i <= 4; i++) {
	// 	const tx = await nft.mint({ value: await nft.mintPrice() });
	// 	await tx.wait();
	// 	console.log(` → minted token #${i}`);
	// }
	const tx = await nft.mint({ value: await nft.mintPrice() });
	await tx.wait();
	console.log(` → minted token #1`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
