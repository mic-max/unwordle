const ACCEPTED = require('./res/accepted.js');
const SOLUTIONS = require('./res/solutions.js');

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
	const headerMatch = lines[0].match(/^Wordle\s+(\d+)\s+(\d+|X)\/(\d+)(\*?)$/i);
	const day = parseInt(headerMatch[1], 10);
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

const example = `
Wordle 1762 4/6*

⬛⬛🟨⬛⬛
🟩⬛⬛⬛⬛
🟩🟩⬛⬛⬛
🟩🟩🟩🟩🟩
`;

const parsed = parseWordle(example);
const answer = SOLUTIONS[parsed.day];

// Compute the score for every single word in ACCEPTED
let scores = {};
for (let accept of ACCEPTED) {
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

// Hide the solve row from output (it is always just the answer)
for (const [index, pool] of prunedPools.slice(0, -1).entries()) {
	console.log(`Pool ${index + 1} (${pool.length}):`, pool);
}

// Each path is a complete valid hard-mode sequence; drop the solve row (last entry)
for (const path of paths) {
    console.log(' ', path.slice(0, -1).join(' → '));
}
console.log(`\nPaths (${paths.length}):`);
