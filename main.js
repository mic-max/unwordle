const ACCEPTED  = require('./res/words.js');
const SOLUTIONS = require('./res/solutions.js');

const { scoreGuess, parseWordle, findValidCandidates, scorePath } = require('./lib.js');

function main(example) {
	const parsed = parseWordle(example);
	const answer = SOLUTIONS[parsed.day];

	let scores = {};
	for (let word in ACCEPTED) {
		scores[word] = scoreGuess(word, answer);
	}

	let pools = parsed.guesses.map(guess =>
		Object.keys(scores).filter(word => scores[word].every((v, i) => v === guess[i]))
	);

	const { pools: prunedPools, paths } = findValidCandidates(pools, parsed.guesses);

	for (const [index, pool] of prunedPools.slice(0, -1).entries()) {
		console.log(`Pool ${index + 1} (${pool.length})`);
	}

	const scoredPaths = paths.map(path => ({ path, score: scorePath(path.slice(0, -1), ACCEPTED) }));
	scoredPaths.sort((a, b) => b.score - a.score);
	return scoredPaths;
}

const example = `
Wordle 1,763 4/6*

⬛⬛🟨⬛⬛
🟩⬛⬛⬛🟩
🟩⬛🟩⬛🟩
🟩🟩🟩🟩🟩
`
myPath = ['quest', 'brake', 'bilge']
pinnedWords = {
	// 0: myPath[0],
	// 1: 'crane',
}
paths = main(example);

// --- Pinned word filtering (remove this block to disable) ---
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
