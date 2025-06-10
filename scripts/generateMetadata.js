// Takes your 1.b64…12.b64 blobs and wraps them into 1a.json…4c.json files
const fs = require("fs");
const path = require("path");

async function main() {
	// Directory of Base64-SVG blobs
	const b64Dir = path.join(__dirname, "../svgs");
	// Output metadata JSON folder
	const outDir = path.join(__dirname, "../metadata");
	if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

	// Human‐readable phase labels
	const phaseNames = ["Phase 1", "Phase 2", "Phase 3"];
	const letters = ["a", "b", "c"];

	for (let idx = 1; idx <= 12; idx++) {
		// 1) Read the raw Base64 SVG (no data URL prefix)
		const b64 = fs.readFileSync(path.join(b64Dir, `${idx}.b64`), "utf8").trim();

		// 2) Compute tokenId and phase
		const tokenId = Math.ceil(idx / 3);
		const phaseIndex = (idx - 1) % 3;
		const suffix = letters[phaseIndex];
		const phaseName = phaseNames[phaseIndex];

		// 3) Build the metadata object
		const metadata = {
			name: `Spatial Existence #${tokenId}`,
			description: "Description of the project goes here..",
			image: `data:image/svg+xml;base64,${b64}`,
			attributes: [
				{ trait_type: "Type", value: "Generative Artwork" },
				{ trait_type: "Phase", value: phaseName },
			],
		};

		// 4) Write to e.g. metadata/1a.json, 1b.json … 4c.json
		const filename = `${tokenId}${suffix}.json`;
		fs.writeFileSync(
			path.join(outDir, filename),
			JSON.stringify(metadata, null, 2)
		);
		console.log(`→ Wrote metadata/${filename}`);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
