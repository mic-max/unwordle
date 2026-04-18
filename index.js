async function loadModule(src) {
	const resp = await fetch(src);
	const text = await resp.text();
	const fn = new Function('module', 'exports', text);
	const mod = { exports: {} };
	fn(mod, mod.exports);
	return mod.exports;
}

let lib, ACCEPTED, SOLUTIONS;

function runAnalysis(example) {
	const { parseWordle, scoreGuess, preFilterPools, findValidCandidates, scorePath } = lib;
	const lines = [];

	const parsed = parseWordle(example);
	if (!parsed.hardMode)
		lines.push('Warning: hard mode (*) not detected — results may be empty or inaccurate.\n');

	const answer = SOLUTIONS[parsed.day];
	if (!answer) throw new Error(`No answer found for day ${parsed.day}`);
	const spoiler = document.getElementById('answer-spoiler');
	spoiler.removeAttribute('open');
	spoiler.style.display = '';
	document.getElementById('answer-summary').textContent = `Day ${parsed.day} — click to reveal answer`;
	document.getElementById('answer-word').textContent = answer;

	const scores = {};
	for (const word in ACCEPTED) scores[word] = scoreGuess(word, answer);

	const pools = parsed.guesses.map(guess =>
		Object.keys(scores).filter(w => scores[w].every((v, i) => v === guess[i]))
	);

	const prepared = preFilterPools(pools, parsed.guesses);
	for (const [i, pool] of prepared.slice(0, -1).entries())
		lines.push(`Pool ${i + 1}: ${pools[i].length} → ${pool.length} words (after pre-filter)`);

	const { paths } = findValidCandidates(prepared, parsed.guesses);

	const scoredPaths = paths
		.map(path => ({ path, score: scorePath(path.slice(0, -1), ACCEPTED) }))
		.sort((a, b) => b.score - a.score);

	lines.push(`\nPaths found: ${scoredPaths.length}`);

	lines.push('\nTop 25 paths:');
	for (const { path, score } of scoredPaths.slice(0, 25))
		lines.push(`  ${path.slice(0, -1).join(' → ')}  (score: ${score.toFixed(2)})`);

	const guessLength = prepared.length - 1;
	for (let pos = 0; pos < guessLength; pos++) {
		const wordCounts = {};
		for (const { path } of scoredPaths)
			wordCounts[path[pos]] = (wordCounts[path[pos]] ?? 0) + 1;
		const top = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
		lines.push(`\nGuess ${pos + 1} — top words:`);
		for (const [word, count] of top)
			lines.push(`  ${word}  (${(count / scoredPaths.length * 100).toFixed(1)}%)`);
	}

	return lines.join('\n');
}

const inputEl  = document.getElementById('input');
const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');
const runBtn   = document.getElementById('run');

runBtn.addEventListener('click', () => {
	statusEl.textContent = 'Computing… this may take several seconds.';
	outputEl.value = '';
	document.getElementById('answer-spoiler').style.display = 'none';
	// setTimeout gives the browser a frame to render the status before the DFS blocks
	setTimeout(() => {
		try {
			outputEl.value = runAnalysis(inputEl.value);
			statusEl.textContent = 'Done.';
		} catch (e) {
			statusEl.textContent = `Error: ${e.message}`;
			console.error(e);
		}
	}, 50);
});

Promise.all([
	loadModule('./lib.js'),
	fetch('./res/words.bin').then(r => r.arrayBuffer()),
]).then(([l, buf]) => {
	lib = l;
	const { words, freqs, solutionIndices } = lib.decodeWordFile(buf);
	ACCEPTED  = Object.fromEntries(words.map((w, i) => [w, freqs[i]]));
	SOLUTIONS = solutionIndices.map(idx => idx === 0xFFFF ? null : words[idx]);
	statusEl.textContent = `Ready — ${words.length} words loaded.`;
	runBtn.disabled = false;
}).catch(e => {
	statusEl.textContent = `Failed to load data: ${e.message}`;
	console.error(e);
});
