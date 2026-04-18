const fs = require('fs');
const { performance } = require('perf_hooks');
const { parseWordle, WordBuffer } = require('./lib.js');

const WORDS_BIN = './dist/words.bin';

console.log(`Reading ${WORDS_BIN}`);
const buf = new WordBuffer(fs.readFileSync(WORDS_BIN));
console.log(`Done — ${buf.wordCount} words, ${buf.solCount} solutions`);

console.log(`Creating a word to index map`);
const wordToIdx = new Map();
for (let i = 0; i < buf.wordCount; i++) wordToIdx.set(buf.word(i), i);
console.log(`Done - ${wordToIdx.size} elements`)

const examples = require('./examples.js');
const { scorecard: example, path: myPath } = examples[examples.length - 1];

console.log(`Running main`);
let { scoredPaths: paths } = main(example);
console.log(`Done - ${paths.length} paths found`);
console.log(paths[0])
console.log(paths[1])
// TODO: do not include the final word indices in the paths[0].path array.

// Save paths as an array of indices into the wordbuffer. 2 bytes per word this way to represent the index instead of 25 bits to represent the word data.
// or even as another bytebuffer since all paths will be the same length/size.
// Or even since I have created pools. I can just concatenate those into one longer list.
// and the paths index is actually the index into those pools. which is going to be smaller. maybe not super small though.
// since its possible that the pools total size sum is still something over 5000...
// if I could guarantee it was going to be under 
// technically 14 bits is all i need to represent a path...
// but this data is not being transmitted to the user over network so its probably better as 16 bit ints into the original wordbuffer obj.

// the paths array could be 17662 elements long. if each path has 3 words.
// and each word is 2 bytes, which is an index into the wordBuffer.
// then we have ~100KB
// so maybe that size savings is worth it, and even becomes a performance boost.
// vs. ~260KB if each letter was saved as 1 byte each. in reality it probably uses 
// much more memory to represent these string arrays in JavaScript.

const myPathIndices = myPath.map(w => wordToIdx.get(w));
console.log(`myPathIndices = [${myPathIndices.join(", ")}]`)
const myPathScore   = buf.scorePath(myPathIndices);
const myPathIndex   = paths.findIndex(({ path }) =>
	path.slice(0, -1).every((wi, i) => wi === myPathIndices[i])
);
// TODO: myPathIndex === -1 would mean something went wrong...
console.log(`Mine: ${myPath.join(' → ')} (score: ${myPathScore.toFixed(2)}, rank: ${myPathIndex === -1 ? 'not found' : '#' + (myPathIndex + 1)})`);

const topPaths = 10;
console.log(`Paths (${paths.length}) - top ${topPaths}:`);
for (const { path, score } of paths.slice(0, topPaths)) {
	const guesses = path.slice(0, -1).map(i => buf.word(i));
	console.log(`  ${guesses.join(' → ')} (score: ${score.toFixed(2)})`);
}

// const guessLength = paths[0].path.slice(0, -1).length;
// for (let pos = 0; pos < guessLength; pos++) {
// 	const wordCounts = {};
// 	for (const { path } of paths) {
// 		const wi = path[pos];
// 		wordCounts[wi] = (wordCounts[wi] ?? 0) + 1;
// 	}
// 	const topWords = Object.entries(wordCounts)
// 		.sort((a, b) => b[1] - a[1])
// 		.slice(0, 10);
// 	console.log(`\nGuess ${pos + 1} - top words:`);
// 	for (const [wi, count] of topWords) {
// 		const pct = (count / paths.length * 100).toFixed(1);
// 		console.log(`  ${buf.word(+wi)} (${pct}%)`);
// 	}
// }

function t(label, since) {
	console.log(`  [${label}] ${(performance.now() - since).toFixed(1)}ms`);
	return performance.now();
}

function main(example) {
	let t0 = performance.now();
	const parsed    = parseWordle(example);
	const answerIdx = buf.solution(parsed.day);
	if (answerIdx === null) throw new Error(`No answer for day ${parsed.day}`);
	console.log(`Day ${parsed.day} — answer: ${buf.word(answerIdx)}`);

	const answerLetters = buf.letters(answerIdx);
	// Pack each 5-tile score into 10 bits (2 bits per tile) for O(1) pool matching
	const scores = new Int32Array(buf.wordCount);
	for (let i = 0; i < buf.wordCount; i++) {
		const s = buf.scoreGuessVs(i, answerLetters);
		scores[i] = s[0] | (s[1] << 2) | (s[2] << 4) | (s[3] << 6) | (s[4] << 8);
	}
	t0 = t('score all words', t0);

	const pools = parsed.guesses.map(guess => {
		const pattern = guess[0] | (guess[1] << 2) | (guess[2] << 4) | (guess[3] << 6) | (guess[4] << 8);
		const pool = [];
		for (let i = 0; i < buf.wordCount; i++)
			if (scores[i] === pattern) pool.push(i);
		return pool;
	});
	for (const [index, pool] of pools.slice(0, -1).entries())
		console.log(`  Pool ${index + 1}: ${pool.length} words`);
	t0 = t('build pools', t0);

	const preparedPools = buf.preFilterPools(pools, parsed.guesses);
	for (const [i, pool] of preparedPools.slice(0, -1).entries())
		console.log(`  Pool ${i + 1}: ${pools[i].length} → ${pool.length} after pre-filter`);
	t0 = t('preFilterPools', t0);

	const { pools: prunedPools, paths } = buf.findValidCandidates(preparedPools, parsed.guesses);
	for (const [index, pool] of prunedPools.slice(0, -1).entries())
		console.log(`  Pool ${index + 1}: ${pool.length} after DFS prune`);
	t0 = t('findValidCandidates', t0);

	const scoredPaths = paths.map(path => ({ path, score: buf.scorePath(path.slice(0, -1)) }));
	scoredPaths.sort((a, b) => b.score - a.score);
	t('score + sort paths', t0);

	return { scoredPaths, answerIdx, scores };
}

// // --- Pool 1 size analysis for single-tile first guesses ---
// {
// 	const { day } = parseWordle(example);
// 	const answerIdx = buf.solution(day);
// 	const scores = Array.from({ length: buf.wordCount }, (_, i) => buf.scoreGuess(i, answerIdx));

// 	function singleTilePoolSize(pos, tileValue) {
// 		const pattern = [0, 0, 0, 0, 0];
// 		pattern[pos] = tileValue;
// 		let count = 0;
// 		for (let i = 0; i < buf.wordCount; i++)
// 			if (scores[i].every((v, j) => v === pattern[j])) count++;
// 		return count;
// 	}

// 	let allGrayCount = 0;
// 	for (let i = 0; i < buf.wordCount; i++)
// 		if (scores[i].every(v => v === 0)) allGrayCount++;

// 	const results = [{ label: 'All gray (current)', size: allGrayCount }];
// 	for (let pos = 0; pos < 5; pos++)
// 		results.push({ label: `Yellow at position ${pos + 1}`, size: singleTilePoolSize(pos, 1) });
// 	for (let pos = 0; pos < 5; pos++)
// 		results.push({ label: `Green  at position ${pos + 1} (letter '${buf.word(answerIdx)[pos]}')`, size: singleTilePoolSize(pos, 2) });

// 	results.sort((a, b) => b.size - a.size);
// 	console.log('Pool 1 sizes by single-tile pattern (largest = most computation):');
// 	for (const { label, size } of results)
// 		console.log(`  ${label}: ${size}`);
// }

// --- Pinned word filtering ---
// const pinnedWords = {
// 	// 0: myPath[0],
// 	// 1: 'crane',
// };
// if (Object.keys(pinnedWords).length > 0) {
// 	const { day, guesses } = parseWordle(example);
// 	const answerIdx = buf.solution(day);
// 	const pinnedIndices = Object.fromEntries(
// 		Object.entries(pinnedWords).map(([p, w]) => [p, wordToIdx.get(w)])
// 	);
// 	for (const [posStr, wi] of Object.entries(pinnedIndices)) {
// 		const pos    = parseInt(posStr);
// 		const actual = buf.scoreGuess(wi, answerIdx);
// 		if (!actual.every((v, i) => v === guesses[pos][i]))
// 			console.warn(`Pin warning: "${pinnedWords[posStr]}" at guess ${pos + 1} does not match the tile pattern`);
// 	}
// 	paths = paths.filter(({ path }) =>
// 		Object.entries(pinnedIndices).every(([posStr, wi]) => path[parseInt(posStr)] === wi)
// 	);
// 	const pinDesc = Object.entries(pinnedWords).map(([p, w]) => `guess ${parseInt(p) + 1}="${w}"`).join(', ');
// 	console.log(`Pinned ${pinDesc} → ${paths.length} paths remaining`);
// }
