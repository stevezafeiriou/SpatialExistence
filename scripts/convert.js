// Converts 1a.png…4c.png into optimized Base64-SVG blobs for on-chain storage
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { optimize } = require("svgo");

async function main() {
	// Input directory containing your original PNGs
	const inDir = path.join(__dirname, "../originals");
	// Output directory for Base64-SVG (.b64) files
	const outDir = path.join(__dirname, "../svgs");
	if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

	// 1) List only files matching 1a.png, 1b.png … 4c.png
	const files = fs
		.readdirSync(inDir)
		.filter((f) => /^[1-4][abc]\.png$/.test(f));

	for (const file of files) {
		const fullIn = path.join(inDir, file);

		// 2) Load the image and measure its original width/height
		const img = sharp(fullIn);
		const meta = await img.metadata();
		const W = meta.width;
		const H = meta.height;

		// 3) Compress to a PNG buffer (no resizing)
		const pngBuf = await img.png({ compressionLevel: 9 }).toBuffer();

		// 4) Embed the PNG into an SVG <image> tag
		const b64png = pngBuf.toString("base64");
		const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <image href="data:image/png;base64,${b64png}" width="${W}" height="${H}"/>
      </svg>`;

		// 5) Optimize the SVG via SVGO
		const { data: optSvg } = optimize(svg, {
			multipass: true,
			plugins: [
				"preset-default",
				{ name: "removeDimensions", active: true },
				{ name: "convertStyleToAttrs", active: true },
			],
		});

		// 6) Base64-encode the optimized SVG markup
		const finalB64 = Buffer.from(optSvg).toString("base64");

		// 7) Map filenames to pointer index 1…12
		//    e.g. 1a→1.b64, 1b→2.b64, …, 4c→12.b64
		const [_, tokChar, phaseChar] = file.match(/^([1-4])([abc])\.png$/);
		const token = Number(tokChar);
		const phase = { a: 0, b: 1, c: 2 }[phaseChar];
		const idx = (token - 1) * 3 + phase + 1;

		// 8) Write out svgs/1.b64 … svgs/12.b64
		fs.writeFileSync(path.join(outDir, `${idx}.b64`), finalB64);
		console.log(`→ ${file} → svgs/${idx}.b64`);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
