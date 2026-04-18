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
	
	for (let i = 0; i < 5; i++) {
		if (guess[i] === answer[i]) {
			result[i] = CORRECT;
			answerPool[i] = null;
		}
	}
	
	for (let i = 0; i < 5; i++) {
		if (result[i] === CORRECT) continue;
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
	if (!headerMatch) throw new Error(`Invalid Wordle header: "${lines[0]}"`);
	const day = parseInt(headerMatch[1].replace(/,/g, ''), 10);
	const hardMode = headerMatch[4] === '*';
	const guesses = lines.slice(1).map(row => [...row].map(tile => TILE[tile]));
	return { day, hardMode, guesses };
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
		if (score[i] === CORRECT || score[i] === WRONG_POSITION) minCount[letter]++;
		else hadGray[letter] = true;
	}
	
	const requiredPositions  = {};
	const forbiddenPositions = [new Set(), new Set(), new Set(), new Set(), new Set()];
	
	for (let i = 0; i < 5; i++) {
		if (score[i] === CORRECT) requiredPositions[i] = guess[i];
		else if (score[i] === WRONG_POSITION) forbiddenPositions[i].add(guess[i]);
	}
	
	const maxCount = {};
	for (const letter of Object.keys(minCount)) {
		if (hadGray[letter]) maxCount[letter] = minCount[letter];
	}
	
	return { requiredPositions, forbiddenPositions, minCount, maxCount };
}

function mergeConstraints(a, b) {
	const requiredPositions = Object.assign({}, a.requiredPositions, b.requiredPositions);
	
	const forbiddenPositions = [];
	for (let i = 0; i < 5; i++)
		forbiddenPositions.push(new Set([...a.forbiddenPositions[i], ...b.forbiddenPositions[i]]));
	
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
	for (const [pos, letter] of Object.entries(constraints.requiredPositions))
		if (word[pos] !== letter) return false;
	
	for (let i = 0; i < 5; i++)
		if (constraints.forbiddenPositions[i].has(word[i])) return false;
	
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

function preFilterPools(pools, guesses) {
	const filtered = pools.map(p => p.slice());
	for (let i = filtered.length - 2; i >= 0; i--) {
		filtered[i] = filtered[i].filter(word => {
			const c = extractConstraints(word, guesses[i]);
			return filtered[i + 1].some(next => satisfiesConstraints(next, c));
		});
	}
	return filtered;
}

function scorePath(path, FREQUENCIES) {
	let score = 0;
	const weights = [1, 1, .9, .8, .5, .5];
	for (let i = 0; i < path.length; i++) {
		const word = path[i];
		const freq = FREQUENCIES[word] || 0;
		score += Math.pow(freq, 2) * weights[i];
		const DUPLICATE_PENALTY = 20.0;
		const uniqueCount = new Set(word).size;
		const duplicates = 5 - uniqueCount;
		const positionWeight = [1, 0.8, 0.6, 0.2, 0.1, 0.1];
		score -= duplicates * DUPLICATE_PENALTY * positionWeight[i];
	}
	return score;
}

// Packs an array of lowercase a-z strings into a Uint8Array using 5 bits per character.
// Allocates one extra padding byte so the decoder can always safely read a 16-bit window
// at the last position without an out-of-bounds access.
function encodeWords(words) {
	const bytes = new Uint8Array(Math.ceil(words.length * 5 * 5 / 8) + 1);
	let bitPos = 0;
	for (const word of words) {
		for (const ch of word) {
			const val     = ch.charCodeAt(0) - 97;
			const byteIdx = bitPos >> 3;
			const bitOff  = bitPos & 7;
			bytes[byteIdx]     |= (val << bitOff) & 0xFF;
			bytes[byteIdx + 1] |= (val >> (8 - bitOff)) & 0xFF;
			bitPos += 5;
		}
	}
	return bytes;
}

// Decodes `count` words from a Uint8Array produced by encodeWords.
function decodeWords(bytes, count) {
	const words = [];
	let bitPos = 0;
	for (let i = 0; i < count; i++) {
		let word = '';
		for (let j = 0; j < 5; j++) {
			const byteIdx = bitPos >> 3;
			const bitOff  = bitPos & 7;
			const val = ((bytes[byteIdx] | (bytes[byteIdx + 1] << 8)) >> bitOff) & 0x1F;
			word += String.fromCharCode(97 + val);
			bitPos += 5;
		}
		words.push(word);
	}
	return words;
}

// Binary file format:
//   [uint16 word_count][uint16 solution_count]
//   [word_count × uint32 entry]    bits 0-24: five 5-bit letters (a=0…z=25), bits 25-31: 7-bit normalised frequency
//   [solution_count × uint16]      word-list index for each day; 0xFFFF = no valid word
// Solution index 0xFFFF means no valid word for that day.

const FREQ_MAX = 6.4; // maximum frequency value in the word list

// Encodes words, their frequencies, and solution indices into the binary file format.
// freqs[i] is the raw frequency value for words[i].
function encodeWordFile(words, freqs, solutionIndices) {
	const out  = new Uint8Array(4 + words.length * 4 + solutionIndices.length * 2);
	const view = new DataView(out.buffer);
	view.setUint16(0, words.length, true);
	view.setUint16(2, solutionIndices.length, true);
	for (let i = 0; i < words.length; i++) {
		const w = words[i];
		const entry =
			(w.charCodeAt(0) - 97)        |
			((w.charCodeAt(1) - 97) << 5)  |
			((w.charCodeAt(2) - 97) << 10) |
			((w.charCodeAt(3) - 97) << 15) |
			((w.charCodeAt(4) - 97) << 20) |
			(Math.round(freqs[i] / FREQ_MAX * 127) << 25);
		view.setUint32(4 + i * 4, entry, true);
	}
	let off = 4 + words.length * 4;
	for (const idx of solutionIndices) {
		view.setUint16(off, idx, true);
		off += 2;
	}
	return out;
}

// Decodes a binary word file into { words, freqs, solutionIndices }.
// Accepts an ArrayBuffer or Uint8Array.
function decodeWordFile(buffer) {
	const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	const view  = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const wordCount = view.getUint16(0, true);
	const solCount  = view.getUint16(2, true);
	const words = [];
	const freqs = [];
	for (let i = 0; i < wordCount; i++) {
		const entry = view.getUint32(4 + i * 4, true);
		words.push(String.fromCharCode(
			97 + ( entry        & 0x1F),
			97 + ((entry >>  5) & 0x1F),
			97 + ((entry >> 10) & 0x1F),
			97 + ((entry >> 15) & 0x1F),
			97 + ((entry >> 20) & 0x1F),
		));
		freqs.push(((entry >> 25) & 0x7F) / 127 * FREQ_MAX);
	}
	const solutionIndices = [];
	let off = 4 + wordCount * 4;
	for (let i = 0; i < solCount; i++) {
		solutionIndices.push(view.getUint16(off, true));
		off += 2;
	}
	return { words, freqs, solutionIndices };
}

module.exports = {
	MISS, WRONG_POSITION, CORRECT,
	scoreGuess,
	parseWordle,
	findValidCandidates,
	preFilterPools,
	scorePath,
	encodeWords,
	decodeWords,
	encodeWordFile,
	decodeWordFile,
};
