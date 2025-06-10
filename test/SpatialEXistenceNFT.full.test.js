const chai = require("chai");
const { solidity } = require("ethereum-waffle");
chai.use(solidity);
const { expect } = chai;

const { ethers, network } = require("hardhat");

// helper to extract the 'a'|'b'|'c' suffix just before ".json"
function suffixOf(uri) {
	return uri.slice(-6, -5);
}

// roll a→b→c→a
function nextSuffix(c) {
	if (c === "a") return "b";
	if (c === "b") return "c";
	return "a";
}

describe("SpatialExistenceNFT – full functionality", function () {
	let owner, alice, bob, carol, nft;
	const BASE_URI = "http://example.com/";

	beforeEach(async () => {
		[owner, alice, bob, carol] = await ethers.getSigners();
		const Factory = await ethers.getContractFactory(
			"SpatialExistenceNFT",
			owner
		);
		nft = await Factory.deploy(BASE_URI);
		await nft.deployed();
	});

	describe("Minting", function () {
		it("lets each address mint exactly one at 0.15 ETH and no more", async () => {
			const price = await nft.mintPrice();

			// alice mints #1
			await expect(nft.connect(alice).mint({ value: price }))
				.to.emit(nft, "TokenMinted")
				.withArgs(alice.address, 1);
			expect(await nft.hasMinted(alice.address)).to.be.true;
			expect(await nft.ownerOf(1)).to.equal(alice.address);

			// alice cannot mint again
			await expect(
				nft.connect(alice).mint({ value: price })
			).to.be.revertedWith("Already minted");

			// bob, carol, owner mint #2–#4
			await expect(nft.connect(bob).mint({ value: price }))
				.to.emit(nft, "TokenMinted")
				.withArgs(bob.address, 2);
			await expect(nft.connect(carol).mint({ value: price }))
				.to.emit(nft, "TokenMinted")
				.withArgs(carol.address, 3);
			await expect(nft.connect(owner).mint({ value: price }))
				.to.emit(nft, "TokenMinted")
				.withArgs(owner.address, 4);

			// no more tokens left
			await expect(nft.connect(bob).mint({ value: price })).to.be.revertedWith(
				"All minted"
			);
		});

		it("reverts if insufficient ETH sent", async () => {
			const price = await nft.mintPrice();
			await expect(
				nft.connect(alice).mint({ value: price.sub(1) })
			).to.be.revertedWith("Insufficient ETH");
		});
	});

	describe("Claiming", function () {
		beforeEach(async () => {
			// alice mints token #1
			const mp = await nft.mintPrice();
			await nft.connect(alice).mint({ value: mp });
		});

		it("lets the owner claim once at 0.5 ETH", async () => {
			const cp = await nft.claimPrice();

			// non-owner cannot claim
			await expect(nft.connect(bob).claim(1, { value: cp })).to.be.revertedWith(
				"Not token owner"
			);

			// insufficient ETH
			await expect(
				nft.connect(alice).claim(1, { value: cp.sub(1) })
			).to.be.revertedWith("Insufficient ETH");

			// successful claim
			await expect(nft.connect(alice).claim(1, { value: cp }))
				.to.emit(nft, "TokenClaimed")
				.withArgs(alice.address, 1);

			// cannot re-claim
			await expect(
				nft.connect(alice).claim(1, { value: cp })
			).to.be.revertedWith("Already claimed");
		});

		it("reverts if token does not exist", async () => {
			const cp = await nft.claimPrice();
			await expect(nft.connect(alice).claim(999, { value: cp })).to.be.reverted; // ownerOf will revert
		});
	});

	describe("Price adjustments & withdrawals", function () {
		beforeEach(async () => {
			// alice & bob mint; alice claims
			const mp = await nft.mintPrice();
			await nft.connect(alice).mint({ value: mp });
			await nft.connect(bob).mint({ value: mp });
			const cp = await nft.claimPrice();
			await nft.connect(alice).claim(1, { value: cp });
		});

		it("only owner can update mint & claim prices", async () => {
			const newMint = ethers.utils.parseEther("0.2");
			const oldMint = await nft.mintPrice();

			// owner updates
			await expect(nft.connect(owner).setMintPrice(newMint))
				.to.emit(nft, "MintPriceUpdated")
				.withArgs(oldMint, newMint);
			// non-owner cannot
			await expect(nft.connect(bob).setMintPrice(newMint)).to.be.reverted;

			const newClaim = ethers.utils.parseEther("1.0");
			const oldClaim = await nft.claimPrice();

			await expect(nft.connect(owner).setClaimPrice(newClaim))
				.to.emit(nft, "ClaimPriceUpdated")
				.withArgs(oldClaim, newClaim);
			await expect(nft.connect(bob).setClaimPrice(newClaim)).to.be.reverted;
		});

		it("collects ETH correctly and allows owner withdrawal", async () => {
			const mp = await nft.mintPrice();
			const cp = await nft.claimPrice();
			const expected = mp.mul(2).add(cp);

			// contract holds the correct amount
			expect(
				(await ethers.provider.getBalance(nft.address)).toString()
			).to.equal(expected.toString());

			// non-owner cannot withdraw
			await expect(nft.connect(alice).withdraw()).to.be.reverted;

			// owner withdraws and emits
			await expect(nft.connect(owner).withdraw())
				.to.emit(nft, "Withdraw")
				.withArgs(owner.address, expected);

			// contract drained
			expect(
				(await ethers.provider.getBalance(nft.address)).toString()
			).to.equal("0");
		});
	});

	describe("Phase rotations & currentPhase()", function () {
		beforeEach(async () => {
			// mint all 4 tokens with distinct signers
			const mp = await nft.mintPrice();
			for (const signer of [alice, bob, carol, owner]) {
				await nft.connect(signer).mint({ value: mp });
			}
		});

		it("cycles suffix a→b→c and currentPhase() 0→1→2", async () => {
			// PHASE 0
			const ph0 = await nft.currentPhase();
			const uris0 = await Promise.all(
				[1, 2, 3, 4].map((id) => nft.tokenURI(id))
			);
			console.log("Phase 0:", ph0, uris0);
			expect(uris0.every((u) => suffixOf(u) === ["a", "b", "c"][ph0])).to.be
				.true;

			// ADVANCE ~4 months
			const fourM = 4 * 30 * 24 * 60 * 60;
			await network.provider.send("evm_increaseTime", [fourM]);
			await network.provider.send("evm_mine");

			// PHASE 1
			const ph1 = await nft.currentPhase();
			const uris1 = await Promise.all(
				[1, 2, 3, 4].map((id) => nft.tokenURI(id))
			);
			console.log("Phase 1:", ph1, uris1);
			expect(ph1).to.equal((ph0 + 1) % 3);
			expect(uris1.every((u) => suffixOf(u) === nextSuffix(suffixOf(uris0[0]))))
				.to.be.true;

			// ADVANCE another ~4 months
			await network.provider.send("evm_increaseTime", [fourM]);
			await network.provider.send("evm_mine");

			// PHASE 2
			const ph2 = await nft.currentPhase();
			const uris2 = await Promise.all(
				[1, 2, 3, 4].map((id) => nft.tokenURI(id))
			);
			console.log("Phase 2:", ph2, uris2);
			expect(ph2).to.equal((ph0 + 2) % 3);
			expect(uris2.every((u) => suffixOf(u) === nextSuffix(suffixOf(uris1[0]))))
				.to.be.true;
		});
	});
});
