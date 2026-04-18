const fs   = require('fs');
const { minify } = require('terser');
const { encodeWordFile } = require('./lib.js');

function iife(src) {
	return `(function(module,exports){\n${src}\nreturn module.exports;})({exports:{}},{})`;
}

async function build() {
	const html  = fs.readFileSync('index.html', 'utf8');
	const libJs = fs.readFileSync('lib.js', 'utf8');

	const faviconB64 = fs.readFileSync('favicon.png').toString('base64');
	const faviconUri = `data:image/png;base64,${faviconB64}`;

	// Transform index.js for inlining:
	// - strip the loadModule helper (used only for dynamic loading)
	// - strip the `let lib, ACCEPTED, SOLUTIONS` declaration
	// - strip the Promise.all loader block at the end
	let script = fs.readFileSync('index.js', 'utf8');
	script = script
		.replace(/async function loadModule\(src\) \{[\s\S]*?return mod\.exports;\s*\}/, '')
		.replace(/let lib, ACCEPTED, SOLUTIONS;/, 'let ACCEPTED, SOLUTIONS;')
		.replace(/Promise\.all\(\[[\s\S]*/, '');

	const bundle = [
		`const lib = ${iife(libJs)};`,
		script,
		`fetch('./words.bin').then(r => r.arrayBuffer()).then(buf => {`,
		`    const { words, freqs, solutionIndices } = lib.decodeWordFile(buf);`,
		`    ACCEPTED  = Object.fromEntries(words.map((w, i) => [w, freqs[i]]));`,
		`    SOLUTIONS = solutionIndices.map(idx => idx === 0xFFFF ? null : words[idx]);`,
		`    statusEl.textContent = \`Ready — \${words.length} words loaded.\`;`,
		`    runBtn.disabled = false;`,
		`}).catch(e => {`,
		`    statusEl.textContent = \`Failed to load data: \${e.message}\`;`,
		`    console.error(e);`,
		`});`,
	].join('\n');

	const minJs = (await minify(bundle, { compress: true, mangle: true })).code;

	let out = html
		.replace(/<script src="index\.js"><\/script>/, `<script>${minJs}</script>`)
		.replace('<link rel="icon" href="favicon.png">', `<link rel="icon" href="${faviconUri}">`)
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/\s+/g, ' ')
		.replace(/> </g, '><')
		.trim();

	const ACCEPTED   = require('./scripts/words.js');
	const SOLUTIONS  = require('./scripts/solutions.js');
	const wordList   = Object.keys(ACCEPTED);
	const freqs      = wordList.map(w => ACCEPTED[w]);
	const wordIndex  = new Map(wordList.map((w, i) => [w, i]));
	const solIndices = SOLUTIONS.map(s => wordIndex.get(s) ?? 0xFFFF);
	const wordBytes  = encodeWordFile(wordList, freqs, solIndices);

	fs.rmSync('dist', { recursive: true, force: true });
	fs.mkdirSync('dist');
	fs.writeFileSync('dist/index.html', out);
	fs.writeFileSync('dist/words.bin', wordBytes);

	const kb    = (Buffer.byteLength(out) / 1024).toFixed(1);
	const binKb = (wordBytes.length / 1024).toFixed(1);
	console.log(`dist/index.html — ${kb} KB`);
	console.log(`dist/words.bin  — ${binKb} KB`);
}

module.exports = { build };

if (require.main === module) {
    build().catch(err => { console.error(err); process.exit(1); });
}
