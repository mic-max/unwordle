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

function findCandidates(guess, answer) {
	res = []
	for (let accept of ACCEPTED) {
		score = scoreGuess(accept, answer)
		if (!areEqual(score, guess))
			continue
		res.push(accept)
	}
	return res
}

const example = `
Wordle 1762 4/6*

⬛⬛🟨⬛⬛
🟩⬛⬛⬛⬛
🟩🟩⬛⬛⬛
🟩🟩🟩🟩🟩
`;

const areEqual = (a, b) => a.length === b.length && a.every((val, index) => val === b[index]);

const parsed = parseWordle(example);
const answer = SOLUTIONS[parsed.day]

// Compute the score for every single word in ACCEPTED
let scores = {}
for (let accept of ACCEPTED) {
	scores[accept] = scoreGuess(accept, answer)
}

let pools = parsed.guesses
	.slice(0, -1)
	.map(guess => Object.keys(scores)
		.filter(word => scores[word].every((v, i) => v === guess[i])
	))

for (const [index, value] of pools.entries()) {
	console.log(`Pool ${index + 1} (${value.length})`)
}

let firstGuess = []
for (let candidate of pools[0]) {
	if (candidate[2] === "c") {
		firstGuess.push(candidate)
	}
}
console.log(`1st Pool (${firstGuess.length})`)

let secondGuess = []
for (let candidate of pools[1]) {
	if (candidate.startsWith("c")) {
		secondGuess.push(candidate)
	}
}

console.log(`2nd Pool (${secondGuess.length})`)

let thirdGuess = []
for (let candidate of pools[2]) {
	if (candidate.startsWith("cu")) {
		thirdGuess.push(candidate)
	}
}

console.log(`3rd Pool (${thirdGuess.length})`)
