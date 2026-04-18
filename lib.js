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
		forbiddenPositions: [0, 0, 0, 0, 0],  // bitmask per position: bit l set = letter l forbidden
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
	const forbiddenPositions = [0, 0, 0, 0, 0];

	for (let i = 0; i < 5; i++) {
		if (score[i] === CORRECT) requiredPositions[i] = guess[i];
		else if (score[i] === WRONG_POSITION) forbiddenPositions[i] |= 1 << (guess[i].charCodeAt(0) - 97);
	}
	
	const maxCount = {};
	for (const letter of Object.keys(minCount)) {
		if (hadGray[letter]) maxCount[letter] = minCount[letter];
	}
	
	return { requiredPositions, forbiddenPositions, minCount, maxCount };
}

function mergeConstraints(a, b) {
	const requiredPositions = Object.assign({}, a.requiredPositions, b.requiredPositions);

	const forbiddenPositions = [
		a.forbiddenPositions[0] | b.forbiddenPositions[0],
		a.forbiddenPositions[1] | b.forbiddenPositions[1],
		a.forbiddenPositions[2] | b.forbiddenPositions[2],
		a.forbiddenPositions[3] | b.forbiddenPositions[3],
		a.forbiddenPositions[4] | b.forbiddenPositions[4],
	];

	const minCount = {};
	const maxCount = {};
	for (const letter of Object.keys(a.minCount)) {
		minCount[letter] = Math.max(a.minCount[letter] || 0, b.minCount[letter] || 0);
		const aMax = a.maxCount[letter] !== undefined ? a.maxCount[letter] : Infinity;
		const bMax = b.maxCount[letter] !== undefined ? b.maxCount[letter] : Infinity;
		const merged = Math.min(aMax, bMax);
		if (merged !== Infinity) maxCount[letter] = merged;
	}
	for (const letter of Object.keys(b.minCount)) {
		if (letter in minCount) continue;
		minCount[letter] = b.minCount[letter] || 0;
		const bMax = b.maxCount[letter] !== undefined ? b.maxCount[letter] : Infinity;
		if (bMax !== Infinity) maxCount[letter] = bMax;
	}

	return { requiredPositions, forbiddenPositions, minCount, maxCount };
}

function satisfiesConstraints(word, constraints) {
	for (const [pos, letter] of Object.entries(constraints.requiredPositions))
		if (word[pos] !== letter) return false;

	for (let i = 0; i < 5; i++)
		if (constraints.forbiddenPositions[i] & (1 << (word[i].charCodeAt(0) - 97))) return false;

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

// Wraps a words.bin ArrayBuffer/Uint8Array and exposes all algorithm operations on
// raw word indices.  String decoding (.word(i)) is deferred to display time only.
class WordBuffer {
	constructor(buffer) {
		const bytes    = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
		this._view     = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
		this.wordCount = this._view.getUint16(0, true);
		this.solCount  = this._view.getUint16(2, true);
		this._solBase  = 4 + this.wordCount * 4;

		// Precompute all letter values into a flat Uint8Array so letters(i) is a
		// zero-copy subarray view rather than a bit-unpack on every call.
		this._lettersFlat = new Uint8Array(this.wordCount * 5);
		for (let i = 0; i < this.wordCount; i++) {
			const e = this._view.getUint32(4 + i * 4, true);
			const base = i * 5;
			this._lettersFlat[base]     =  e        & 0x1F;
			this._lettersFlat[base + 1] = (e >>  5) & 0x1F;
			this._lettersFlat[base + 2] = (e >> 10) & 0x1F;
			this._lettersFlat[base + 3] = (e >> 15) & 0x1F;
			this._lettersFlat[base + 4] = (e >> 20) & 0x1F;
		}
	}

	// Raw uint32 entry: bits 0-24 = five 5-bit letters, bits 25-31 = 7-bit frequency
	entry(i) { return this._view.getUint32(4 + i * 4, true); }

	// Five letter values (0=a … 25=z) for word i — zero-copy view into _lettersFlat
	letters(i) { return this._lettersFlat.subarray(i * 5, i * 5 + 5); }

	// Normalised frequency for word i
	freq(i) { return ((this.entry(i) >> 25) & 0x7F) / 127 * FREQ_MAX; }

	// Decode word i to a string — call only for display
	word(i) {
		const e = this.entry(i);
		return String.fromCharCode(
			97 + ( e        & 0x1F), 97 + ((e >>  5) & 0x1F),
			97 + ((e >> 10) & 0x1F), 97 + ((e >> 15) & 0x1F),
			97 + ((e >> 20) & 0x1F),
		);
	}

	// Word index for the given Wordle day, or null for placeholder days
	solution(day) {
		const idx = this._view.getUint16(this._solBase + day * 2, true);
		return idx === 0xFFFF ? null : idx;
	}

	// Score guess word index against pre-computed answer letters array
	scoreGuessVs(guessIdx, al) {
		const gl     = this.letters(guessIdx);
		const result = [MISS, MISS, MISS, MISS, MISS];
		const pool   = al.slice();
		for (let i = 0; i < 5; i++)
			if (gl[i] === al[i]) { result[i] = CORRECT; pool[i] = -1; }
		for (let i = 0; i < 5; i++) {
			if (result[i] === CORRECT) continue;
			const j = pool.indexOf(gl[i]);
			if (j !== -1) { result[i] = WRONG_POSITION; pool[j] = -1; }
		}
		return result;
	}

	// Score guess word index against answer word index
	scoreGuess(guessIdx, answerIdx) {
		return this.scoreGuessVs(guessIdx, this.letters(answerIdx));
	}

	// Score a path of word indices using their encoded frequencies
	scorePath(path) {
		let score = 0;
		const weights    = [1, 1, .9, .8, .5, .5];
		const posWeights = [1, 0.8, 0.6, 0.2, 0.1, 0.1];
		for (let i = 0; i < path.length; i++) {
			const f  = this.freq(path[i]);
			const ls = this.letters(path[i]);
			score += f * f * weights[i];
			const uniq = new Set([ls[0], ls[1], ls[2], ls[3], ls[4]]);
			score -= (5 - uniq.size) * 20.0 * posWeights[i];
		}
		return score;
	}

	// --- constraint helpers (integer letter values as keys, not chars) ---

	_extractConstraints(letters, score) {
		const minCount = {}, hadGray = {};
		for (let i = 0; i < 5; i++) {
			const l = letters[i];
			if (minCount[l] === undefined) minCount[l] = 0;
			if (score[i] === CORRECT || score[i] === WRONG_POSITION) minCount[l]++;
			else hadGray[l] = true;
		}
		const requiredPositions  = {};
		const forbiddenPositions = [0, 0, 0, 0, 0];
		for (let i = 0; i < 5; i++) {
			if (score[i] === CORRECT)             requiredPositions[i]    = letters[i];
			else if (score[i] === WRONG_POSITION) forbiddenPositions[i] |= 1 << letters[i];
		}
		const maxCount = {};
		for (const l of Object.keys(minCount))
			if (hadGray[l]) maxCount[l] = minCount[l];
		return { requiredPositions, forbiddenPositions, minCount, maxCount };
	}

	_satisfiesConstraints(letters, constraints) {
		for (const [pos, l] of Object.entries(constraints.requiredPositions))
			if (letters[+pos] !== l) return false;
		for (let i = 0; i < 5; i++)
			if (constraints.forbiddenPositions[i] & (1 << letters[i])) return false;
		for (const lStr of Object.keys(constraints.minCount)) {
			const l = +lStr;
			let count = 0;
			for (const letter of letters) if (letter === l) count++;
			if (count < constraints.minCount[lStr]) return false;
			if (constraints.maxCount[lStr] !== undefined && count > constraints.maxCount[lStr]) return false;
		}
		return true;
	}

	// --- pool filtering and DFS (pools are arrays of word indices) ---

	preFilterPools(pools, guesses) {
		const filtered = pools.map(p => p.slice());
		for (let i = filtered.length - 2; i >= 0; i--) {
			filtered[i] = filtered[i].filter(wi => {
				const c = this._extractConstraints(this.letters(wi), guesses[i]);
				return filtered[i + 1].some(ni => this._satisfiesConstraints(this.letters(ni), c));
			});
		}
		return filtered;
	}

	findValidCandidates(pools, guesses) {
		const valid = pools.map(() => new Set());
		const paths = [];
		const dfs   = (poolIdx, constraints, path) => {
			if (poolIdx === pools.length) {
				for (let i = 0; i < path.length; i++) valid[i].add(path[i]);
				paths.push([...path]);
				return;
			}
			for (const wi of pools[poolIdx]) {
				const letters = this.letters(wi);
				if (!this._satisfiesConstraints(letters, constraints)) continue;
				path.push(wi);
				dfs(poolIdx + 1,
					mergeConstraints(constraints, this._extractConstraints(letters, guesses[poolIdx])),
					path);
				path.pop();
			}
		};
		dfs(0, emptyConstraints(), []);
		return { pools: pools.map((pool, i) => pool.filter(w => valid[i].has(w))), paths };
	}
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
	WordBuffer,
};
