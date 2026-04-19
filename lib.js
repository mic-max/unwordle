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
    // TODO: must be 2 to 6 guesses.
    // must be solved (no X/6)
    // each guess must include 5 emojis, those emojis must validly map to a
    //   miss, wrong position, or a correct.
    // 
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
		this._uniqueCount = new Uint8Array(this.wordCount);
		this._pool        = new Uint8Array(5); // scratch for scoreGuessVsPacked
		for (let i = 0; i < this.wordCount; i++) {
			const e = this._view.getUint32(4 + i * 4, true);
			const base = i * 5;
			this._lettersFlat[base]     =  e        & 0x1F;
			this._lettersFlat[base + 1] = (e >>  5) & 0x1F;
			this._lettersFlat[base + 2] = (e >> 10) & 0x1F;
			this._lettersFlat[base + 3] = (e >> 15) & 0x1F;
			this._lettersFlat[base + 4] = (e >> 20) & 0x1F;
			// popcount of unique letters via bitmask (max 5 bits set)
			let bits = (1 << this._lettersFlat[base])     | (1 << this._lettersFlat[base + 1]) |
			           (1 << this._lettersFlat[base + 2]) | (1 << this._lettersFlat[base + 3]) |
			           (1 << this._lettersFlat[base + 4]);
			let n = 0;
			while (bits) { n++; bits &= bits - 1; }
			this._uniqueCount[i] = n;
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

	// Allocation-free version of scoreGuessVs — returns the 10-bit packed int directly.
	// Uses this._pool as scratch; 255 is the consumed-position sentinel (letters are 0–25).
	scoreGuessVsPacked(guessIdx, al) {
		const gl   = this.letters(guessIdx);
		const pool = this._pool;
		pool[0] = al[0]; pool[1] = al[1]; pool[2] = al[2]; pool[3] = al[3]; pool[4] = al[4];
		let result = 0, greenMask = 0;
		for (let i = 0; i < 5; i++) {
			if (gl[i] === al[i]) { greenMask |= 1 << i; result |= 2 << (i * 2); pool[i] = 255; }
		}
		for (let i = 0; i < 5; i++) {
			if (greenMask & (1 << i)) continue;
			const l = gl[i];
			for (let j = 0; j < 5; j++) {
				if (pool[j] === l) { result |= 1 << (i * 2); pool[j] = 255; break; }
			}
		}
		return result;
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

	// Score a path of word indices — returns score × 1000 as an integer
	scorePath(path) {
		let score = 0;
		const weights    = [1, 1, .9, .8, .5, .5];
		const posWeights = [1, 0.8, 0.6, 0.2, 0.1, 0.1];
		for (let i = 0; i < path.length; i++) {
			const f = this.freq(path[i]);
			score += f * f * weights[i];
			score -= (5 - this._uniqueCount[path[i]]) * 20.0 * posWeights[i];
		}
		return Math.round(score * 1000);
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
		const guessLen = pools.length;
		const valid    = pools.map(() => new Set());
		const edgeSets = Array.from({ length: guessLen - 1 }, () => new Set());
		let pathCount  = 0;
		const path     = [];

		// Mutable constraint state — never reallocated during search
		const required  = new Int8Array(5).fill(-1);  // -1 = no requirement
		const forbidden = new Uint32Array(5);          // bitmask: bit l = letter l forbidden
		const minCount  = new Uint8Array(26);
		const maxCount  = new Int8Array(26).fill(-1);  // -1 = no limit

		// Flat undo log: interleaved (slot, prevValue) pairs written on apply, read in
		// reverse on restore.  slot encoding: 0-4 = required, 5-9 = forbidden,
		// 10-35 = minCount[slot-10], 36-61 = maxCount[slot-36]
		const undoLog = new Int32Array(500);
		let logPtr = 0;

		// Reusable scratch buffers — never allocated inside the hot loop
		const _tempMin = new Uint8Array(26);
		const _counts  = new Uint8Array(26);

		const satisfies = (letters) => {
			for (let i = 0; i < 5; i++) {
				if (required[i] !== -1 && letters[i] !== required[i]) return false;
				if (forbidden[i] & (1 << letters[i])) return false;
			}
			_counts[letters[0]]++; _counts[letters[1]]++; _counts[letters[2]]++;
			_counts[letters[3]]++; _counts[letters[4]]++;
			let ok = true;
			for (let l = 0; l < 26; l++) {
				if (minCount[l] > 0 && _counts[l] < minCount[l]) { ok = false; break; }
				if (maxCount[l] !== -1 && _counts[l] > maxCount[l]) { ok = false; break; }
			}
			_counts[letters[0]]--; _counts[letters[1]]--; _counts[letters[2]]--;
			_counts[letters[3]]--; _counts[letters[4]]--;
			return ok;
		};

		const applyGuess = (letters, score) => {
			const mark = logPtr;
			let touchedBits = 0, grayBits = 0;
			for (let i = 0; i < 5; i++) {
				const l = letters[i];
				touchedBits |= 1 << l;
				if (score[i] === CORRECT || score[i] === WRONG_POSITION) _tempMin[l]++;
				else grayBits |= 1 << l;
			}
			for (let i = 0; i < 5; i++) {
				if (score[i] === CORRECT && required[i] !== letters[i]) {
					undoLog[logPtr++] = i; undoLog[logPtr++] = required[i];
					required[i] = letters[i];
				} else if (score[i] === WRONG_POSITION) {
					const bit = 1 << letters[i];
					if (!(forbidden[i] & bit)) {
						undoLog[logPtr++] = 5 + i; undoLog[logPtr++] = forbidden[i];
						forbidden[i] |= bit;
					}
				}
			}
			for (let l = 0; l < 26; l++) {
				if (!((touchedBits >> l) & 1)) continue;
				const tm = _tempMin[l];
				_tempMin[l] = 0;
				if (tm > minCount[l]) {
					undoLog[logPtr++] = 10 + l; undoLog[logPtr++] = minCount[l];
					minCount[l] = tm;
				}
				if ((grayBits >> l) & 1 && (maxCount[l] === -1 || tm < maxCount[l])) {
					undoLog[logPtr++] = 36 + l; undoLog[logPtr++] = maxCount[l];
					maxCount[l] = tm;
				}
			}
			return mark;
		};

		const undoTo = (mark) => {
			while (logPtr > mark) {
				logPtr -= 2;
				const slot = undoLog[logPtr], prev = undoLog[logPtr + 1];
				if      (slot <  5) required[slot]       = prev;
				else if (slot < 10) forbidden[slot - 5]  = prev;
				else if (slot < 36) minCount[slot - 10]  = prev;
				else                maxCount[slot - 36]  = prev;
			}
		};

		const dfs = (poolIdx) => {
			if (poolIdx === guessLen) {
				for (let i = 0; i < guessLen; i++) valid[i].add(path[i]);
				for (let i = 0; i < guessLen - 1; i++)
					edgeSets[i].add(path[i] * 65536 + path[i + 1]);
				pathCount++;
				return;
			}
			for (const wi of pools[poolIdx]) {
				const letters = this.letters(wi);
				if (!satisfies(letters)) continue;
				const mark = applyGuess(letters, guesses[poolIdx]);
				path.push(wi);
				dfs(poolIdx + 1);
				path.pop();
				undoTo(mark);
			}
		};

		dfs(0);

		// Sorted node lists per layer (word indices into WordBuffer)
		const layers = valid.map(s => Uint16Array.from([...s].sort((a, b) => a - b)));

		// CSR adjacency lists per layer transition k → k+1.
		// Successors stored as local positions (indices into layers[k+1]) for O(1) DP access.
		const dagOffsets    = [];
		const dagSuccessors = [];
		for (let k = 0; k < guessLen - 1; k++) {
			const nodes     = layers[k];
			const nextNodes = layers[k + 1];
			const nodePos   = new Map(Array.from(nodes,     (wi, j) => [wi, j]));
			const nextPos   = new Map(Array.from(nextNodes, (wi, j) => [wi, j]));
			const edges     = [...edgeSets[k]].sort((a, b) => a - b);
			const offsets   = new Uint32Array(nodes.length + 1);
			const succ      = new Uint16Array(edges.length);
			for (const e of edges) offsets[nodePos.get((e / 65536) | 0) + 1]++;
			for (let j = 0; j < nodes.length; j++) offsets[j + 1] += offsets[j];
			for (let j = 0; j < edges.length; j++) succ[j] = nextPos.get(edges[j] & 0xFFFF);
			dagOffsets.push(offsets);
			dagSuccessors.push(succ);
		}

		return {
			pools: pools.map((pool, i) => pool.filter(w => valid[i].has(w))),
			dag: { layers, offsets: dagOffsets, successors: dagSuccessors },
			guessLen,
			pathCount,
		};
	}

	// Score contribution of a single word at a given guess layer (raw float, not ×1000)
	_nodeScore(wi, layerIdx) {
		const weights    = [1, 1, .9, .8, .5, .5];
		const posWeights = [1, 0.8, 0.6, 0.2, 0.1, 0.1];
		const f = this.freq(wi);
		return f * f * weights[layerIdx] - (5 - this._uniqueCount[wi]) * 20.0 * posWeights[layerIdx];
	}

	// Backward DP: best[k][j] = max total path score (float) achievable from layer-k local node j
	computeDagScores(dag) {
		const { layers, offsets, successors } = dag;
		const guessLen = layers.length;
		const best = layers.map((nodes, k) => {
			const a = new Float64Array(nodes.length);
			for (let j = 0; j < nodes.length; j++) a[j] = this._nodeScore(nodes[j], k);
			return a;
		});
		for (let k = guessLen - 2; k >= 0; k--) {
			const nb = best[k + 1];
			for (let j = 0; j < layers[k].length; j++) {
				let mx = -Infinity;
				for (let e = offsets[k][j]; e < offsets[k][j + 1]; e++) {
					if (nb[successors[k][e]] > mx) mx = nb[successors[k][e]];
				}
				best[k][j] += mx;
			}
		}
		return best;
	}

	// Top-K complete paths by score using branch-and-bound DFS with DP upper-bound pruning.
	// Returns array of { score (int ×1000), path (Uint16Array of word indices) }, sorted descending.
	dagTopK(dag, best, k) {
		const { layers, offsets, successors } = dag;
		const guessLen = layers.length;
		const results  = [];
		let kthBest    = -Infinity;
		const pathBuf  = new Uint16Array(guessLen);

		const dfs = (layerIdx, parentLocalIdx, scoreSoFar) => {
			const baseEdge  = layerIdx === 0 ? 0 : offsets[layerIdx - 1][parentLocalIdx];
			const edgeCount = layerIdx === 0 ? layers[0].length
				: offsets[layerIdx - 1][parentLocalIdx + 1] - baseEdge;

			for (let ci = 0; ci < edgeCount; ci++) {
				const j  = layerIdx === 0 ? ci : successors[layerIdx - 1][baseEdge + ci];
				const wi = layers[layerIdx][j];
				const ns = this._nodeScore(wi, layerIdx);
				if ((scoreSoFar + best[layerIdx][j]) * 1000 <= kthBest) continue;
				pathBuf[layerIdx] = wi;
				if (layerIdx === guessLen - 1) {
					const score = Math.round((scoreSoFar + ns) * 1000);
					if (results.length < k || score > kthBest) {
						results.push({ score, path: pathBuf.slice() });
						results.sort((a, b) => b.score - a.score);
						if (results.length > k) results.pop();
						if (results.length === k) kthBest = results[k - 1].score;
					}
				} else {
					dfs(layerIdx + 1, j, scoreSoFar + ns);
				}
			}
		};

		dfs(0, 0, 0);
		return results;
	}

	// Forward+backward DP: returns per-node path-through counts for each layer.
	// pathsThrough[k][j] = number of complete paths passing through layer-k local node j.
	dagPathCounts(dag) {
		const { layers, offsets, successors } = dag;
		const guessLen = layers.length;
		const toCounts   = layers.map(nodes => new Float64Array(nodes.length));
		const fromCounts = layers.map(nodes => new Float64Array(nodes.length));
		toCounts[0].fill(1);
		for (let k = 0; k < guessLen - 1; k++)
			for (let j = 0; j < layers[k].length; j++) {
				const tc = toCounts[k][j];
				if (tc === 0) continue;
				for (let e = offsets[k][j]; e < offsets[k][j + 1]; e++)
					toCounts[k + 1][successors[k][e]] += tc;
			}
		fromCounts[guessLen - 1].fill(1);
		for (let k = guessLen - 2; k >= 0; k--)
			for (let j = 0; j < layers[k].length; j++) {
				let fc = 0;
				for (let e = offsets[k][j]; e < offsets[k][j + 1]; e++)
					fc += fromCounts[k + 1][successors[k][e]];
				fromCounts[k][j] = fc;
			}
		return layers.map((nodes, k) => {
			const out = new Float64Array(nodes.length);
			for (let j = 0; j < nodes.length; j++) out[j] = toCounts[k][j] * fromCounts[k][j];
			return out;
		});
	}

	// Count paths with integer score (×1000) strictly greater than threshold.
	// Uses DP upper-bound pruning so only promising branches are explored.
	dagCountAbove(dag, best, threshold) {
		const { layers, offsets, successors } = dag;
		const guessLen = layers.length;
		let count = 0;

		const dfs = (layerIdx, parentLocalIdx, scoreSoFar) => {
			const baseEdge  = layerIdx === 0 ? 0 : offsets[layerIdx - 1][parentLocalIdx];
			const edgeCount = layerIdx === 0 ? layers[0].length
				: offsets[layerIdx - 1][parentLocalIdx + 1] - baseEdge;

			for (let ci = 0; ci < edgeCount; ci++) {
				const j  = layerIdx === 0 ? ci : successors[layerIdx - 1][baseEdge + ci];
				const wi = layers[layerIdx][j];
				const ns = this._nodeScore(wi, layerIdx);
				if ((scoreSoFar + best[layerIdx][j]) * 1000 < threshold) continue;
				if (layerIdx === guessLen - 1) {
					if (Math.round((scoreSoFar + ns) * 1000) > threshold) count++;
				} else {
					dfs(layerIdx + 1, j, scoreSoFar + ns);
				}
			}
		};

		dfs(0, 0, 0);
		return count;
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

// Sort `order` (Uint32Array of indices) descending by `scores` (Int32Array).
// Uses 4-pass LSD radix sort. XORing with 0x80000000 flips the sign bit so the
// two's-complement Int32 values compare correctly as Uint32 (negatives sort low).
function radixSortDescByInt32(order, scores) {
	const n    = order.length;
	const keys = new Uint32Array(n);
	for (let i = 0; i < n; i++) keys[i] = (scores[i] ^ 0x80000000) >>> 0;

	const out = new Uint32Array(n);
	const cnt = new Uint32Array(256);
	const pfx = new Uint32Array(257);

	for (let pass = 0; pass < 4; pass++) {
		const shift = pass * 8;
		cnt.fill(0);
		for (let i = 0; i < n; i++) cnt[(keys[order[i]] >>> shift) & 0xFF]++;
		pfx[0] = 0;
		for (let b = 0; b < 256; b++) pfx[b + 1] = pfx[b] + cnt[b];
		for (let i = 0; i < n; i++) {
			const b = (keys[order[i]] >>> shift) & 0xFF;
			out[pfx[b]++] = order[i];
		}
		order.set(out);
	}

	// LSD radix sort produces ascending order — reverse for descending
	for (let i = 0, j = n - 1; i < j; i++, j--) {
		const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
	}
}

// Runs the full analysis pipeline. Returns a JSON-serializable result safe to postMessage
// from a Web Worker. K controls how many top paths to include (default 25).
function analyzeWordle(buf, example, K = 25) {
	const parsed    = parseWordle(example);
	const answerIdx = buf.solution(parsed.day);
	if (answerIdx === null) throw new Error(`No answer for day ${parsed.day}`);

	const answerLetters = buf.letters(answerIdx);
	const scores = new Int32Array(buf.wordCount);
	for (let i = 0; i < buf.wordCount; i++)
		scores[i] = buf.scoreGuessVsPacked(i, answerLetters);

	const guesses = parsed.guesses.slice(0, -1);
	const pools = guesses.map(guess => {
		const pattern = guess[0] | (guess[1] << 2) | (guess[2] << 4) | (guess[3] << 6) | (guess[4] << 8);
		const pool = [];
		for (let i = 0; i < buf.wordCount; i++)
			if (scores[i] === pattern) pool.push(i);
		return pool;
	});

	const prepared   = buf.preFilterPools(pools, guesses);
	const { dag, guessLen, pathCount } = buf.findValidCandidates(prepared, guesses);
	const best       = buf.computeDagScores(dag);
	const pathCounts = buf.dagPathCounts(dag);

	const topPaths = buf.dagTopK(dag, best, K).map(({ score, path }) => ({
		score,
		words: Array.from(path, wi => buf.word(wi)),
	}));

	const perPosition = dag.layers.map((nodes, k) => {
		const counts = pathCounts[k];
		return Array.from(nodes, (wi, j) => ({ word: buf.word(wi), count: counts[j] }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 10)
			.map(({ word, count }) => ({ word, pct: count / pathCount * 100 }));
	});

	return {
		day: parsed.day,
		answer: buf.word(answerIdx),
		hardMode: parsed.hardMode,
		guessLen,
		pathCount,
		topPaths,
		perPosition,
	};
}

if (typeof module !== 'undefined') module.exports = {
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
	radixSortDescByInt32,
	analyzeWordle,
};
