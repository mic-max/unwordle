const ACCEPTED    = require('./res/words.js');
const SOLUTIONS   = require('./res/solutions.js');

const MISS = 0;
const WRONG_POSITION = 1;
const CORRECT = 2;

const TILE = {
	'⬛': MISS,
	'⬜': MISS,
	'🟨': WRONG_POSITION,
	'🟩': CORRECT,
};

function scoreGuess(guess, answer) {
	const result = [MISS, MISS, MISS, MISS, MISS];
	const answerPool = [...answer];
	
	// Pass 1: correct position
	for (let i = 0; i < 5; i++) {
		if (guess[i] === answer[i]) {
			result[i] = CORRECT;
			answerPool[i] = null;
		}
	}
	
	// Pass 2: wrong position
	for (let i = 0; i < 5; i++) {
		if (result[i] === CORRECT)
			continue;
		const poolIdx = answerPool.indexOf(guess[i]);
		if (poolIdx !== -1) {
			result[i] = WRONG_POSITION;
			answerPool[poolIdx] = null;
		}
	}
	
	return result;
}

function parseWordle(input) {
	const lines = input.trim().split('\n').map(l => l.trim()).filter(Boolean);
	const headerMatch = lines[0].match(/^Wordle\s+([\d,]+)\s+(\d+|X)\/(\d+)(\*?)$/i);
	const day = parseInt(headerMatch[1].replace(/,/g, ''), 10);
	const guesses = lines.slice(1).map(row => [...row].map(tile => TILE[tile]));
	return { day, guesses };
}

function emptyConstraints() {
	return {
		requiredPositions:  {},
		forbiddenPositions: [new Set(), new Set(), new Set(), new Set(), new Set()],
		minCount:           {},
		maxCount:           {},
	};
}

function extractConstraints(guess, score) {
	const minCount = {};
	const hadGray  = {};
	
	for (let i = 0; i < 5; i++) {
		const letter = guess[i];
		if (minCount[letter] === undefined) minCount[letter] = 0;
		if (score[i] === CORRECT || score[i] === WRONG_POSITION) {
			minCount[letter]++;
		} else {
			hadGray[letter] = true;
		}
	}
	
	const requiredPositions  = {};
	const forbiddenPositions = [new Set(), new Set(), new Set(), new Set(), new Set()];
	
	for (let i = 0; i < 5; i++) {
		if (score[i] === CORRECT) {
			requiredPositions[i] = guess[i];
		} else if (score[i] === WRONG_POSITION) {
			forbiddenPositions[i].add(guess[i]);
		}
	}
	
	const maxCount = {};
	for (const letter of Object.keys(minCount)) {
		if (hadGray[letter]) {
			maxCount[letter] = minCount[letter];
		}
	}
	
	return { requiredPositions, forbiddenPositions, minCount, maxCount };
}

function mergeConstraints(a, b) {
	const requiredPositions = Object.assign({}, a.requiredPositions, b.requiredPositions);
	
	const forbiddenPositions = [];
	for (let i = 0; i < 5; i++) {
		forbiddenPositions.push(new Set([...a.forbiddenPositions[i], ...b.forbiddenPositions[i]]));
	}
	
	const allLetters = new Set([...Object.keys(a.minCount), ...Object.keys(b.minCount)]);
	const minCount = {};
	const maxCount = {};
	
	for (const letter of allLetters) {
		minCount[letter] = Math.max(a.minCount[letter] || 0, b.minCount[letter] || 0);
		
		const aMax = a.maxCount[letter] !== undefined ? a.maxCount[letter] : Infinity;
		const bMax = b.maxCount[letter] !== undefined ? b.maxCount[letter] : Infinity;
		const merged = Math.min(aMax, bMax);
		if (merged !== Infinity) maxCount[letter] = merged;
	}
	
	return { requiredPositions, forbiddenPositions, minCount, maxCount };
}

function satisfiesConstraints(word, constraints) {
	for (const [pos, letter] of Object.entries(constraints.requiredPositions)) {
		if (word[pos] !== letter) return false;
	}
	
	for (let i = 0; i < 5; i++) {
		if (constraints.forbiddenPositions[i].has(word[i])) return false;
	}
	
	for (const letter of Object.keys(constraints.minCount)) {
		let count = 0;
		for (const ch of word) if (ch === letter) count++;
		if (count < constraints.minCount[letter]) return false;
		if (constraints.maxCount[letter] !== undefined && count > constraints.maxCount[letter]) return false;
	}
	
	return true;
}

function findValidCandidates(pools, guesses) {
	const valid = pools.map(() => new Set());
	const paths = [];
	
	function dfs(poolIdx, constraints, path) {
		if (poolIdx === pools.length) {
			for (let i = 0; i < path.length; i++) valid[i].add(path[i]);
			paths.push([...path]);
			return;
		}
		for (const candidate of pools[poolIdx]) {
			if (!satisfiesConstraints(candidate, constraints)) continue;
			const next = mergeConstraints(constraints, extractConstraints(candidate, guesses[poolIdx]));
			path.push(candidate);
			dfs(poolIdx + 1, next, path);
			path.pop();
		}
	}
	
	dfs(0, emptyConstraints(), []);
	return {
		pools: pools.map((pool, i) => pool.filter(w => valid[i].has(w))),
		paths,
	};
}

function scorePath(path) {
	let score = 0;
	const weights = [1, 1, .9, .8, .5, .5];
	for (let i = 0; i < path.length; i++) {
		const word = path[i];
		const freq = ACCEPTED[word] || 0;

		score += Math.pow(freq, 2) * weights[i];

		// --- Duplicate letter penalty (comment out this block to disable) ---
		// Words with fewer unique letters are less likely as deliberate guesses,
		// especially early in the game when exploring new letters is valuable.
		// positionWeight: earlier guesses penalised more (guess 1 = 1.0, guess 2 = 0.5, ...)
		const DUPLICATE_PENALTY = 20.0;  // penalty per duplicate letter — increase to strengthen
		const uniqueCount = new Set(word).size;
		const duplicates = 5 - uniqueCount;
		const positionWeight = [1, 0.8, 0.6, 0.2, 0.1, 0.1];
		score -= duplicates * DUPLICATE_PENALTY * positionWeight[i];
		// --- End duplicate letter penalty ---
	}
	return score;
}

function main(example) {
	const parsed = parseWordle(example);
	const answer = SOLUTIONS[parsed.day];
	
	// Compute the score for every single word in ACCEPTED
	let scores = {};
	for (let accept in ACCEPTED) {
		scores[accept] = scoreGuess(accept, answer);
	}
	
	// Build pools for ALL guesses including the solve row (all-greens).
	// The solve row always has pool = [answer], which anchors the DFS and ensures
	// the penultimate pool is filtered to only candidates whose constraints allow
	// the answer as a valid continuation.
	let pools = parsed.guesses.map(guess =>
		Object.keys(scores).filter(word => scores[word].every((v, i) => v === guess[i]))
	);
	
	const { pools: prunedPools, paths } = findValidCandidates(pools, parsed.guesses);
	
	for (const [index, pool] of prunedPools.slice(0, -1).entries()) {
		console.log(`Pool ${index + 1} (${pool.length})`);
	}
	
	// Score each path once, then sort. Each path ends with the solve row; drop it before scoring.
	const scoredPaths = paths.map(path => ({ path, score: scorePath(path.slice(0, -1)) }));
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
myPath = ['quest', 'brake', 'bilge'] // 4.27, 3.95, 2.67
pinnedWords = {
	// 0: myPath[0],  // guess 1 is known to be 'trace'
	// 1: 'crane',  // guess 2 is known to be 'crane'
}

// assume that the grey tiles were awarded to common letters?

// const example = `
// Wordle 1762 4/6*

// ⬛⬛🟨⬛⬛
// 🟩⬛⬛⬛⬛
// 🟩🟩⬛⬛⬛
// 🟩🟩🟩🟩🟩
// `;
// myPath = ['fecal', 'cronk', 'cuspy']

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

myPathScore = scorePath(myPath)
myPathIndex = paths.findIndex(({ path }) => path.slice(0, -1).every((w, i) => w === myPath[i]))
console.log(`Mine: ${myPath.join(' → ')} (score: ${myPathScore.toFixed(2)}, rank: ${myPathIndex === -1 ? 'not found' : '#' + (myPathIndex + 1)})`)

const topPaths = 25;
console.log(`Paths (${paths.length}) - top ${topPaths}:`);
for (const { path, score } of paths.slice(0, topPaths)) {
	const guesses = path.slice(0, -1);
	console.log(`  ${guesses.join(' → ')} (score: ${score.toFixed(2)})`);
};

// --- Top 10 words by path presence (remove this block to disable) ---
{
	const wordCounts = {};
	for (const { path } of paths) {
		const guesses = path.slice(0, -1);
		for (const word of new Set(guesses)) {
			wordCounts[word] = (wordCounts[word] ?? 0) + 1;
		}
	}
	const topWords = Object.entries(wordCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10);
	console.log('\nTop 10 words by path presence:');
	for (const [word, count] of topWords) {
		const pct = (count / paths.length * 100).toFixed(1);
		console.log(`  ${word} (${pct}% of paths, ${count}/${paths.length})`);
	}
}
// --- End top 10 words by path presence ---

// --- Top 10 words per guess position (remove this block to disable) ---
{
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
}
// --- End top 10 words per guess position ---

// --- Words appearing in multiple positions (remove this block to disable) ---
{
	const wordPositions = {};
	for (const { path } of paths) {
		const guesses = path.slice(0, -1);
		for (let pos = 0; pos < guesses.length; pos++) {
			const word = guesses[pos];
			if (!wordPositions[word]) wordPositions[word] = new Set();
			wordPositions[word].add(pos);
		}
	}
	const multiPos = Object.entries(wordPositions)
		.filter(([, positions]) => positions.size > 1)
		.sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
	console.log(`\nWords appearing in multiple positions (${multiPos.length} words):`);
	for (const [word, positions] of multiPos) {
		const posLabels = [...positions].sort().map(p => `guess ${p + 1}`).join(', ');
		console.log(`  ${word} → ${posLabels}`);
	}
}
// --- End words appearing in multiple positions ---

// const starterCounts = {};
// for (const { path } of paths) {
// 	const first = path[0];
// 	starterCounts[first] = (starterCounts[first] ?? 0) + 1;
// }
// const topStarters = Object.entries(starterCounts)
// 	.sort((a, b) => b[1] - a[1])
// 	.slice(0, 10);

// 	// --- Top 10 by total score (remove this block to disable) ---
// {
// 	const starterScores = {};
// 	for (const { path, score } of paths) {
// 		const first = path[0];
// 		starterScores[first] = (starterScores[first] ?? 0) + score;
// 	}
// 	const topByScore = Object.entries(starterScores)
// 		.sort((a, b) => b[1] - a[1])
// 		.slice(0, 10);
// 	console.log('\nTop 10 starter words by total path score:');
// 	for (const [word, total] of topByScore) {
// 		console.log(' ', word, `(total: ${total.toFixed(2)}, paths: ${starterCounts[word]})`);
// 	}
// }
// // --- End top 10 by total score ---

// // --- Top 10 by average path score (remove this block to disable) ---
// {
// 	const starterScores = {};
// 	for (const { path, score } of paths) {
// 		const first = path[0];
// 		if (!starterScores[first]) starterScores[first] = { total: 0, count: 0 };
// 		starterScores[first].total += score;
// 		starterScores[first].count++;
// 	}
// 	const topByAvg = Object.entries(starterScores)
// 		.map(([word, { total, count }]) => [word, total / count, count])
// 		.sort((a, b) => b[1] - a[1])
// 		.slice(0, 10);
// 	console.log('\nTop 10 starter words by average path score:');
// 	for (const [word, avg, count] of topByAvg) {
// 		console.log(' ', word, `(avg: ${avg.toFixed(2)}, paths: ${count})`);
// 	}
// }
// // --- End top 10 by average path score ---

// console.log('\nTop 10 starter words by path count:');
// for (const [word, count] of topStarters) {
// 	console.log(' ', word, `(${count} paths)`);
// };
