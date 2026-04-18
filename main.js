const fs = require('fs');
const { scoreGuess, parseWordle, findValidCandidates, preFilterPools, scorePath, decodeWordFile } = require('./lib.js');

const WORDS_BIN = './dist/words.bin';

console.log(`Reading ${WORDS_BIN}`)
const { words, freqs, solutionIndices } = decodeWordFile(fs.readFileSync(WORDS_BIN));
const ACCEPTED  = Object.fromEntries(words.map((w, i) => [w, freqs[i]]));
const SOLUTIONS = solutionIndices.map(idx => idx === 0xFFFF ? null : words[idx]);

console.log("Done")

const examples = require('./examples.js');

function main(example) {
	const parsed = parseWordle(example);
	const answer = SOLUTIONS[parsed.day];
	console.log(parsed, answer)

	let scores = {};
	for (let word in ACCEPTED) {
		scores[word] = scoreGuess(word, answer);
	}

	let pools = parsed.guesses.map(guess =>
		Object.keys(scores).filter(word => scores[word].every((v, i) => v === guess[i]))
	);
	for (const [index, pool] of pools.slice(0, -1).entries()) {
		console.log(`Pool ${index + 1} (${pool.length})`);
	}

	const preparedPools = preFilterPools(pools, parsed.guesses);
	for (const [i, pool] of preparedPools.slice(0, -1).entries())
		console.log(`Pool ${i + 1}: ${pools[i].length} → ${pool.length} after pre-filter`);

	const { pools: prunedPools, paths } = findValidCandidates(preparedPools, parsed.guesses);

	for (const [index, pool] of prunedPools.slice(0, -1).entries()) {
		console.log(`Pool ${index + 1} (${pool.length})`);
	}

	const scoredPaths = paths.map(path => ({ path, score: scorePath(path.slice(0, -1), ACCEPTED) }));
	scoredPaths.sort((a, b) => b.score - a.score);
	return scoredPaths;
}

const { scorecard: example, path: myPath } = examples[examples.length - 1];

// --- Pool 1 size analysis for single-tile first guesses (remove this block to disable) ---
{
	const { day } = parseWordle(example);
	const answer = SOLUTIONS[day];
	const wordScores = {};
	for (const word in ACCEPTED) wordScores[word] = scoreGuess(word, answer);

	function singleTilePoolSize(pos, tileValue) {
		const pattern = [0, 0, 0, 0, 0];
		pattern[pos] = tileValue;
		return Object.keys(wordScores).filter(w =>
			wordScores[w].every((v, i) => v === pattern[i])
		).length;
	}

	const results = [{ label: 'All gray (current)', size: Object.keys(wordScores).filter(w => wordScores[w].every(v => v === 0)).length }];
	for (let pos = 0; pos < 5; pos++)
		results.push({ label: `Yellow at position ${pos + 1}`, size: singleTilePoolSize(pos, 1) });
	for (let pos = 0; pos < 5; pos++)
		results.push({ label: `Green  at position ${pos + 1} (letter '${answer[pos]}')`, size: singleTilePoolSize(pos, 2) });

	results.sort((a, b) => b.size - a.size);
	console.log('Pool 1 sizes by single-tile pattern (largest = most computation):');
	for (const { label, size } of results)
		console.log(`  ${label}: ${size}`);
}
// --- End pool 1 size analysis ---

paths = main(example);

// --- Pinned word filtering (remove this block to disable) ---
pinnedWords = {
	// 0: myPath[0],
	// 1: 'crane',
}
if (Object.keys(pinnedWords).length > 0) {
	const { day, guesses } = parseWordle(example);
	const answer = SOLUTIONS[day];
	for (const [posStr, word] of Object.entries(pinnedWords)) {
		const pos = parseInt(posStr);
		const actual = scoreGuess(word, answer);
		const expected = guesses[pos];
		if (!actual.every((v, i) => v === expected[i])) {
			console.warn(`Pin warning: "${word}" at guess ${pos + 1} does not match the tile pattern for that row — it would score differently against the answer`);
		}
	}
	paths = paths.filter(({ path }) =>
		Object.entries(pinnedWords).every(([posStr, word]) => path[parseInt(posStr)] === word)
	);
	const pinDesc = Object.entries(pinnedWords).map(([p, w]) => `guess ${parseInt(p) + 1}="${w}"`).join(', ');
	console.log(`Pinned ${pinDesc} → ${paths.length} paths remaining`);
}
// --- End pinned word filtering ---

myPathScore = scorePath(myPath, ACCEPTED)
myPathIndex = paths.findIndex(({ path }) => path.slice(0, -1).every((w, i) => w === myPath[i]))
console.log(`Mine: ${myPath.join(' → ')} (score: ${myPathScore.toFixed(2)}, rank: ${myPathIndex === -1 ? 'not found' : '#' + (myPathIndex + 1)})`)

const topPaths = 25;
console.log(`Paths (${paths.length}) - top ${topPaths}:`);
for (const { path, score } of paths.slice(0, topPaths)) {
	const guesses = path.slice(0, -1);
	console.log(`  ${guesses.join(' → ')} (score: ${score.toFixed(2)})`);
};

// TODO: add word frequency information to this too, since a lot of the words are quite rare: talma, tawaf, tazza, twixt, etc.
const guessLength = paths[0].path.slice(0, -1).length;
for (let pos = 0; pos < guessLength; pos++) {
	const wordCounts = {};
	for (const { path } of paths) {
		const word = path[pos];
		wordCounts[word] = (wordCounts[word] ?? 0) + 1;
	}
	const topWords = Object.entries(wordCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10);
	console.log(`\nGuess ${pos + 1} - top words:`);
	for (const [word, count] of topWords) {
		const pct = (count / paths.length * 100).toFixed(1);
		console.log(`  ${word} (${pct}%)`);
	}
}
