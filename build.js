const fs   = require('fs');
const { minify } = require('terser');
const { encodeWordFile } = require('./lib.js');
const CleanCSS = require('clean-css')
const ACCEPTED   = require('./scripts/words.js');
const { generateSolutions } = require('./scripts/solutions-gen.js');

async function build() {
	await generateSolutions();
	delete require.cache[require.resolve('./scripts/solutions.js')];
	const SOLUTIONS = require('./scripts/solutions.js');
	const html       = fs.readFileSync('index.html', 'utf8');
	const libJs      = fs.readFileSync('lib.js', 'utf8');
	const indexJs    = fs.readFileSync('index.js', 'utf8');
	const examplesJs = fs.readFileSync('examples.js', 'utf8');
    const css = fs.readFileSync('style.css', 'utf8')
	const workerJs = fs.readFileSync('worker.js', 'utf8');

    // Embed favicon as base64 data URI to avoid a second request
	const faviconB64 = fs.readFileSync('favicon.png').toString('base64');
	const faviconUri = `data:image/png;base64,${faviconB64}`;

	// Concatenate lib.js + index.js — lib.js globals are available to index.js directly.
	// lib.js guards module.exports with `if (typeof module !== 'undefined')` so it's safe
	// to paste into a browser context.
	const bundle        = [libJs, indexJs].join('\n');
	const minJS         = (await minify(bundle, { compress: true, mangle: true })).code;
	const minExamplesJS = (await minify(examplesJs, { compress: true, mangle: false })).code;
    const minCSS = new CleanCSS({ level: 2 }).minify(css).styles

	// Worker gets the same lib.js globals + worker entry point.
	const workerBundle = [libJs, workerJs].join('\n');
	const minWorkerJs  = (await minify(workerBundle, { compress: true, mangle: true })).code;

	let out = html
        .replace('<link rel="stylesheet" href="style.css">', `<style>${minCSS}</style>`)
        .replace('<link rel="icon" href="favicon.png">', `<link rel="icon" href="${faviconUri}">`)
        .replace('<script src="examples.js"></script>', `<script>${minExamplesJS}</script>`)
		.replace('<script src="lib.js"></script>', '')
        .replace('<script src="index.js"></script>', `<script>${minJS}</script>`)
        .replace('<li>Wordle day <= 1765</li>', `<li>Wordle day <= ${SOLUTIONS.length}</li>`)
        .replace('max="1765"', `max="${SOLUTIONS.length}"`)
        // Strip HTML comments and collapse whitespace
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/\s+/g, ' ')
		.replace(/> </g, '><')
		.trim();

	const wordList   = Object.keys(ACCEPTED);
	const freqs      = wordList.map(w => ACCEPTED[w]);
	const wordIndex  = new Map(wordList.map((w, i) => [w, i]));
	const solIndices = SOLUTIONS.map(s => wordIndex.get(s) ?? 0xFFFF);
	const wordBytes  = encodeWordFile(wordList, freqs, solIndices);

	fs.rmSync('dist', { recursive: true, force: true });
	fs.mkdirSync('dist');
	fs.writeFileSync('dist/index.html', out);
	fs.writeFileSync('dist/words.bin', wordBytes);
	fs.writeFileSync('dist/worker.js', minWorkerJs);

	const kb       = (Buffer.byteLength(out) / 1024).toFixed(1);
	const binKb    = (wordBytes.length / 1024).toFixed(1);
	const workerKb = (Buffer.byteLength(minWorkerJs) / 1024).toFixed(1);
	console.log(`dist/index.html — ${kb} KB`);
	console.log(`dist/words.bin  — ${binKb} KB`);
	console.log(`dist/worker.js  — ${workerKb} KB`);
}

module.exports = { build };

if (require.main === module) {
	build().catch(err => { console.error(err); process.exit(1); });
}
