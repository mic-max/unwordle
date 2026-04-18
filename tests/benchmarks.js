const { performance } = require('node:perf_hooks');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const ACCEPTED  = require('../scripts/words.js');
const SOLUTIONS = require('../scripts/solutions.js');
const { scoreGuess, parseWordle, preFilterPools, findValidCandidates } = require('../lib.js');

const EXAMPLE = `
Wordle 1,763 6/6*

⬛⬛⬛⬛⬛
⬛🟨⬛⬛⬛
⬛⬛🟩⬛🟩
⬛🟩🟩⬛🟩
⬛🟩🟩⬛🟩
🟩🟩🟩🟩🟩
`;

function buildPools(example) {
	const { day, guesses } = parseWordle(example);
	const answer = SOLUTIONS[day];
	const scores = {};
	for (const word in ACCEPTED) scores[word] = scoreGuess(word, answer);
	const pools = guesses.map(guess =>
		Object.keys(scores).filter(w => scores[w].every((v, i) => v === guess[i]))
	);
	return { pools, guesses };
}

function bench(fn, runs) {
	const times = [];
	for (let i = 0; i < runs; i++) {
		const t0 = performance.now();
		fn();
		times.push(performance.now() - t0);
	}
	return {
		mean: times.reduce((a, b) => a + b, 0) / times.length,
		min:  Math.min(...times),
		max:  Math.max(...times),
	};
}

test('benchmark: preFilterPools', () => {
	const { pools, guesses } = buildPools(EXAMPLE);
	const MAX_MS = 2000;
	const r = bench(() => preFilterPools(pools, guesses), 5);
	console.log(`  preFilterPools — mean: ${r.mean.toFixed(0)}ms  min: ${r.min.toFixed(0)}ms  max: ${r.max.toFixed(0)}ms`);
	assert.ok(r.mean < MAX_MS, `mean ${r.mean.toFixed(0)}ms exceeded threshold ${MAX_MS}ms`);
});

test('benchmark: findValidCandidates', () => {
	const { pools, guesses } = buildPools(EXAMPLE);
	const prepared = preFilterPools(pools, guesses);
	const MAX_MS = 500000;
	const r = bench(() => findValidCandidates(prepared, guesses), 3);
	console.log(`  findValidCandidates — mean: ${r.mean.toFixed(0)}ms  min: ${r.min.toFixed(0)}ms  max: ${r.max.toFixed(0)}ms`);
	assert.ok(r.mean < MAX_MS, `mean ${r.mean.toFixed(0)}ms exceeded threshold ${MAX_MS}ms`);
});
