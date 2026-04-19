const fs = require('fs');
const { performance } = require('perf_hooks');
const { parseWordle, WordBuffer } = require('./lib.js');

function run() {
const examples = require('./examples.js');
const { scorecard: example, path: myPath } = examples[examples.length - 1];

const memReport = [];

// Start program
let t0 = performance.now();

// Read words from binary file
// TODO: what if I store the wordbuffer as a DAG instead of as an array for memory savings.
const WORDS_BIN = './dist/words.bin';
const buf = new WordBuffer(fs.readFileSync(WORDS_BIN));
t0 = t(`Read ${WORDS_BIN} - ${buf.wordCount} words, ${buf.solCount} solutions`, t0);
trackMem('WordBuffer binary data',    buf.wordCount,         buf._view.byteLength);
trackMem('WordBuffer._lettersFlat',   buf.wordCount * 5,     buf._lettersFlat.byteLength);
trackMem('WordBuffer._uniqueCount',   buf.wordCount,         buf._uniqueCount.byteLength);

// Create word to index mapping
const wordToIdx = new Map();
for (let i = 0; i < buf.wordCount; i++) wordToIdx.set(buf.word(i), i);
t0 = t(`Created Word to ID Mapping`, t0);
// V8 Map: ~56 B per 5-char string key + ~40 B map entry overhead = ~96 B/entry (estimated)
trackMem('wordToIdx Map (est.)',       wordToIdx.size,        wordToIdx.size * 96);

// Parse the pasted wordle scorecard
const parsed = parseWordle(example);
t0 = t('Parsed scorecard', t0);

// Find the wordle answer for the given day
const answerIdx = buf.solution(parsed.day);
if (answerIdx === null) throw new Error(`No answer for day ${parsed.day}`);
t0 = t(`Day ${parsed.day} = ${buf.word(answerIdx)}`, t0);

// Score all words against this days answer
const answerLetters = buf.letters(answerIdx);
const scores = new Int32Array(buf.wordCount);
for (let i = 0; i < buf.wordCount; i++)
    scores[i] = buf.scoreGuessVsPacked(i, answerLetters);
t0 = t('Score all words', t0);
trackMem('scores Int32Array',         scores.length,         scores.byteLength);

// Create pools of possible words for every guess in the given scorecard
const guesses = parsed.guesses.slice(0, -1);
// TODO: consider changing the order of this nested loop (for perf reasons)
const pools = guesses.map(guess => {
    const pattern = guess[0] | (guess[1] << 2) | (guess[2] << 4) | (guess[3] << 6) | (guess[4] << 8);
    const pool = [];
    for (let i = 0; i < buf.wordCount; i++)
        if (scores[i] === pattern) pool.push(i);
    return pool;
});
t0 = t(`Build pools:  [${pools.map(p => p.length).join(', ')}]`, t0);
// JS SMI arrays: ~4 B/element under V8 pointer compression (indices are in SMI range)
trackMem('pools JS arrays (est.)',    pools.reduce((s,p) => s + p.length, 0), pools.reduce((s,p) => s + p.length * 4, 0));

// MORE WORK !!!
const preparedPools = buf.preFilterPools(pools, guesses);
t0 = t(`Filter pools: [${preparedPools.map(p => p.length).join(', ')}]`, t0);
trackMem('preparedPools JS arrays (est.)', preparedPools.reduce((s,p) => s + p.length, 0), preparedPools.reduce((s,p) => s + p.length * 4, 0));
const { pools: prunedPools, dag, guessLen, pathCount } = buf.findValidCandidates(preparedPools, guesses);
t0 = t('findValidCandidates', t0);
{
    const nodeCount = dag.layers.reduce((s, l) => s + l.length, 0);
    const edgeCount = dag.successors.reduce((s, a) => s + a.length, 0);
    trackMem('dag.layers Uint16Array[]',     nodeCount,                      nodeCount * 2);
    trackMem('dag.offsets Uint32Array[]',    nodeCount + dag.offsets.length, (nodeCount + dag.offsets.length) * 4);
    trackMem('dag.successors Uint16Array[]', edgeCount,                      edgeCount * 2);
}

const bestScore = buf.computeDagScores(dag);
t0 = t('computeDagScores', t0);
trackMem('bestScore Float64Array[]', dag.layers.reduce((s, l) => s + l.length, 0), dag.layers.reduce((s, l) => s + l.length, 0) * 8);

const myPathIndices = myPath.map(w => wordToIdx.get(w));
let myPathScoreFloat = 0;
for (let k = 0; k < guessLen; k++) myPathScoreFloat += buf._nodeScore(myPathIndices[k], k);
const myPathScore = Math.round(myPathScoreFloat * 1000);
const myPathRank  = 1 + buf.dagCountAbove(dag, bestScore, myPathScore);
t0 = t('dagCountAbove (myPath rank)', t0);
console.log(`Mine: ${myPath.join(' → ')} (score: ${(myPathScore / 1000).toFixed(2)}, rank: #${myPathRank})`);

const K = 10;
const topPathResults = buf.dagTopK(dag, bestScore, K);
t0 = t(`dagTopK (top ${K})`, t0);
console.log(`Paths (${pathCount}) - top ${K}:`);
for (const { score, path } of topPathResults) {
    const words = Array.from(path, wi => buf.word(wi));
    console.log(`  ${words.join(' → ')} (score: ${(score / 1000).toFixed(2)})`);
}

console.log('\nMemory (structures > 1 KB):');
const nameW = Math.max(...memReport.map(r => r.name.length));
for (const { name, elements, bytes } of memReport) {
	const kb = (bytes / 1024).toFixed(1).padStart(8);
	const el = elements.toLocaleString().padStart(10);
	console.log(`  ${name.padEnd(nameW)}  ${el} elements  ${kb} KB`);
}

// for (let pos = 0; pos < guessLen; pos++) {
// 	const wordCounts = {};
// 	for (let i = 0; i < pathCount; i++) {
// 		const wi = pathData[i * guessLen + pos];
// 		wordCounts[wi] = (wordCounts[wi] ?? 0) + 1;
// 	}
// 	const topWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
// 	console.log(`\nGuess ${pos + 1} - top words:`);
// 	for (const [wi, count] of topWords) {
// 		const pct = (count / pathCount * 100).toFixed(1);
// 		console.log(`  ${buf.word(+wi)} (${pct}%)`);
// 	}
// }

function t(label, since) {
	console.log(`  [${label}] ${(performance.now() - since).toFixed(1)}ms`);
	return performance.now();
}

function trackMem(name, elements, bytes) {
	if (bytes >= 1024) memReport.push({ name, elements, bytes });
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

} // end run()

if (require.main === module) run();
module.exports = { run };
