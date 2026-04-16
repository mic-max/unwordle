const SOLUTIONS = require('./res/solutions.js');
const ACCEPTED  = require('./res/accepted.js');

const MISS           = 0;
const WRONG_POSITION = 1;
const CORRECT        = 2;

const TILE = {
  '⬛': MISS,   // dark mode miss
  '⬜': MISS,   // light mode miss
  '🟨': WRONG_POSITION,
  '🟩': CORRECT,
};

// ---------------------------------------------------------------------------
// Wordle scoring: given a guess and the answer, return a 5-element tile array.
// Two-pass to handle duplicate letters correctly.
// ---------------------------------------------------------------------------
function scoreTiles(guess, answer) {
  const result     = [MISS, MISS, MISS, MISS, MISS];
  const answerPool = [...answer];

  // Pass 1: correct positions
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) {
      result[i]     = CORRECT;
      answerPool[i] = null;
    }
  }

  // Pass 2: wrong positions
  for (let i = 0; i < 5; i++) {
    if (result[i] === CORRECT) continue;
    const poolIdx = answerPool.indexOf(guess[i]);
    if (poolIdx !== -1) {
      result[i]           = WRONG_POSITION;
      answerPool[poolIdx] = null;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Extract constraints from a tile row + the known answer.
//
// Returns a constraints object:
//   requiredPositions[i]   = letter that must be at position i (from greens)
//   forbiddenPositions[i]  = set of letters that must NOT be at position i
//   minCount[letter]       = minimum number of times letter appears in answer
//   maxCount[letter]       = maximum number of times letter appears in answer
//
// The tile pattern tells us what score a candidate MUST produce, so we derive
// the rules by reading how Wordle's scoring algorithm would have assigned them.
//
// Letter count bounds:
//   minCount = number of GREEN + YELLOW tiles for that letter in this row
//   maxCount = minCount if any tile for that letter is GRAY (Wordle ran out),
//              otherwise 5 - sum(minCount of all other letters)  [word length cap]
// ---------------------------------------------------------------------------
function extractConstraints(tiles, answer) {
  const requiredPositions  = {};  // position -> letter
  const forbiddenPositions = Array.from({ length: 5 }, () => new Set());
  const minCount = {};
  const maxCount = {};

  // Tally GREEN and YELLOW per letter, note GRAY
  const tilesByLetter = {};
  for (let i = 0; i < 5; i++) {
    const letter = answer[i]; // we know the answer, so we know which letter scored
    // Wait — we don't know the guess letter, only the answer letter at position i.
    // We need to read constraints from the CANDIDATE's perspective, not the answer's.
    // So we defer to applyConstraints which works from the candidate pool.
  }

  // Actually: constraints are extracted from what we can deduce about the
  // *guess* from the tile pattern + answer. We do this by iterating over
  // what scoreTiles would have produced for each possible guess letter.
  //
  // But we don't know the guess — that's what we're trying to find.
  // What we CAN do is extract constraints on the answer structure that any
  // valid guess must satisfy in the NEXT row (hard mode forward propagation).
  //
  // We derive constraints on what the *answer* must look like, which any
  // future guess candidate must be consistent with.

  // Simulate scoring in reverse: given the answer and the tile pattern,
  // what can we say about the guess?
  // GREEN at position i: guess[i] === answer[i]
  // YELLOW at position i: guess[i] is in the answer but NOT at position i
  // GRAY at position i: the answer has no more of guess[i] beyond what greens/yellows claimed

  // Since we're filtering *future* guess candidates, we express constraints
  // as: "the next guess must respect what this row revealed about the answer."
  // These are answer-structure constraints, not guess-structure constraints.

  // Step 1: required positions from greens
  for (let i = 0; i < 5; i++) {
    if (tiles[i] === CORRECT) {
      requiredPositions[i] = answer[i];
    }
  }

  // Step 2: for each letter in the answer, determine min/max count
  // by simulating what a guess that produced these tiles would have seen.
  // We walk through the answer letters and their tile scores.
  const letters = new Set([...answer]);
  for (const letter of letters) {
    // Find all positions in the answer where this letter appears
    const answerPositions = [];
    for (let i = 0; i < 5; i++) {
      if (answer[i] === letter) answerPositions.push(i);
    }

    // Greens for this letter: positions where tile === CORRECT and answer[i] === letter
    const greenCount = answerPositions.filter(i => tiles[i] === CORRECT).length;

    // The remaining answer positions for this letter are not green — meaning
    // the guess did NOT place this letter correctly there.
    // We can infer min from greens alone (we definitely know those exist).
    // yellows from a guess tell us more, but we're extracting from the answer side.

    // From the answer's perspective:
    //   minCount = number of this letter in the answer (we know the answer!)
    //   maxCount = same (we know the answer exactly)
    // But that's cheating — we're supposed to use this for filtering candidates
    // for the *next guess*, not for knowing the answer.

    // The correct framing: constraints flow forward to filter the NEXT ROW'S candidates.
    // For that, we need to know what the tile pattern revealed to the guesser.
    // That requires knowing the guess. We don't.
    //
    // SOLUTION: we extract constraints lazily — per candidate in the pool.
    // See applyConstraints below, which takes a known guess word + tile pattern.
  }

  return { requiredPositions, forbiddenPositions, minCount, maxCount };
}

// ---------------------------------------------------------------------------
// Extract constraints from a KNOWN guess word + its tile pattern.
// This is what we use once we've narrowed a row to a single candidate,
// or to propagate the tightest possible constraints forward/backward.
//
// For forward propagation from row N to row N+1:
//   - GREEN at i:   next guess must have guess[i] at position i
//   - YELLOW at i:  next guess must contain guess[i] somewhere, but NOT at i
//   - GRAY at i:    next guess must not contain guess[i] more than already confirmed
// ---------------------------------------------------------------------------
function extractConstraintsFromGuess(guess, tiles) {
  const requiredPositions  = {};        // position -> letter  (from greens)
  const forbiddenPositions = Array.from({ length: 5 }, () => new Set()); // pos -> Set<letter>
  const minCount = {};                  // letter -> min occurrences in answer
  const maxCount = {};                  // letter -> max occurrences in answer

  // Count how many times each letter appears as GREEN or YELLOW (confirmed present)
  // and whether it ever appears as GRAY (upper bound hit)
  const confirmedCount = {};  // letter -> count of green+yellow
  const hitGray        = {};  // letter -> boolean

  for (let i = 0; i < 5; i++) {
    const letter = guess[i];
    confirmedCount[letter] = confirmedCount[letter] || 0;
    if (tiles[i] === CORRECT || tiles[i] === WRONG_POSITION) {
      confirmedCount[letter]++;
    } else {
      // GRAY: Wordle ran out of this letter
      hitGray[letter] = true;
    }
  }

  // Build min/max counts
  for (const letter of Object.keys(confirmedCount)) {
    minCount[letter] = confirmedCount[letter];
    maxCount[letter] = hitGray[letter]
      ? confirmedCount[letter]           // exactly this many
      : 5;                               // upper bound is word length (will be tightened below)
  }

  // Tighten maxCount for uncapped letters using word-length constraint:
  // sum of all minCounts <= 5, so maxCount[L] <= 5 - sum(minCount[x] for x != L)
  const totalMin = Object.values(minCount).reduce((a, b) => a + b, 0);
  for (const letter of Object.keys(maxCount)) {
    if (!hitGray[letter]) {
      const otherMins = totalMin - minCount[letter];
      maxCount[letter] = Math.min(maxCount[letter], 5 - otherMins);
    }
  }

  // Required positions from greens
  for (let i = 0; i < 5; i++) {
    if (tiles[i] === CORRECT) {
      requiredPositions[i] = guess[i];
    }
  }

  // Forbidden positions from yellows (must not re-use same position) and
  // grays where minCount > 0 (letter exists but not here)
  for (let i = 0; i < 5; i++) {
    const letter = guess[i];
    if (tiles[i] === WRONG_POSITION) {
      forbiddenPositions[i].add(letter);
    }
    if (tiles[i] === MISS && minCount[letter] > 0) {
      // Letter exists in word but not at this position (was consumed by earlier green/yellow)
      forbiddenPositions[i].add(letter);
    }
  }

  return { requiredPositions, forbiddenPositions, minCount, maxCount };
}

// ---------------------------------------------------------------------------
// Apply a constraints object to filter a candidate pool.
// Returns only words that satisfy all constraints.
// ---------------------------------------------------------------------------
function applyConstraints(candidates, constraints) {
  const { requiredPositions, forbiddenPositions, minCount, maxCount } = constraints;

  return candidates.filter(word => {
    // Check required positions (greens must be honoured)
    for (const [pos, letter] of Object.entries(requiredPositions)) {
      if (word[pos] !== letter) return false;
    }

    // Check forbidden positions (yellows and bounded grays)
    for (let i = 0; i < 5; i++) {
      if (forbiddenPositions[i].has(word[i])) return false;
    }

    // Check letter count bounds
    for (const [letter, min] of Object.entries(minCount)) {
      const count = word.split('').filter(l => l === letter).length;
      if (count < min) return false;
      const max = maxCount[letter] ?? 5;
      if (count > max) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Merge two constraint objects (union of knowledge from multiple rows).
// Takes the strictest (highest min, lowest max, union of forbidden positions,
// union of required positions).
// ---------------------------------------------------------------------------
function mergeConstraints(a, b) {
  const requiredPositions  = { ...a.requiredPositions, ...b.requiredPositions };
  const forbiddenPositions = Array.from({ length: 5 }, (_, i) => {
    return new Set([...a.forbiddenPositions[i], ...b.forbiddenPositions[i]]);
  });

  const allLetters = new Set([
    ...Object.keys(a.minCount),
    ...Object.keys(b.minCount),
  ]);

  const minCount = {};
  const maxCount = {};
  for (const letter of allLetters) {
    minCount[letter] = Math.max(a.minCount[letter] ?? 0, b.minCount[letter] ?? 0);
    maxCount[letter] = Math.min(a.maxCount[letter] ?? 5, b.maxCount[letter] ?? 5);
  }

  return { requiredPositions, forbiddenPositions, minCount, maxCount };
}

// ---------------------------------------------------------------------------
// Given a candidate pool, derive the tightest constraints that are consistent
// across ALL candidates (intersection of constraints).
// Used for backward propagation: if every candidate for row N+1 contains
// letter X at position Y, that letter was forced there — which tells us
// something about what row N's guess must have been.
// ---------------------------------------------------------------------------
function extractSharedConstraints(candidates) {
  if (candidates.length === 0) return null;

  // For each position, find letters that appear in ALL candidates
  const requiredPositions = {};
  for (let i = 0; i < 5; i++) {
    const lettersAtPos = candidates.map(w => w[i]);
    const allSame = lettersAtPos.every(l => l === lettersAtPos[0]);
    if (allSame) requiredPositions[i] = lettersAtPos[0];
  }

  // For each letter, find the min count across all candidates (guaranteed present at least that many times)
  // and the max count (no candidate has more than this many)
  const allLetters = new Set(candidates.flatMap(w => [...w]));
  const minCount   = {};
  const maxCount   = {};
  for (const letter of allLetters) {
    const counts = candidates.map(w => w.split('').filter(l => l === letter).length);
    minCount[letter] = Math.min(...counts);
    maxCount[letter] = Math.max(...counts);
  }

  // Letters that don't appear in ANY candidate have maxCount = 0
  // (we can't know this from allLetters alone, but the filter handles it implicitly)

  // Forbidden positions: if NO candidate has letter X at position i, it's forbidden
  const forbiddenPositions = Array.from({ length: 5 }, (_, i) => {
    const lettersPresent = new Set(candidates.map(w => w[i]));
    // We can't assert forbidden from shared constraints alone without knowing
    // which letters were guessed — leave empty, forward pass handles this
    return new Set();
  });

  return { requiredPositions, forbiddenPositions, minCount, maxCount };
}

// ---------------------------------------------------------------------------
// Given a tile row and the answer, find every accepted word that would
// produce exactly that tile pattern.
// ---------------------------------------------------------------------------
function findCandidates(tiles, answer) {
  return ACCEPTED.filter(word => {
    const scored = scoreTiles(word, answer);
    return scored.every((t, i) => t === tiles[i]);
  });
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------
function parseWordle(input) {
  const lines = input.trim().split('\n').map(l => l.trim()).filter(Boolean);

  const headerMatch = lines[0].match(/^Wordle\s+(\d+)\s+(\d+|X)\/(\d+)(\*?)$/i);
  if (!headerMatch) throw new Error(`Unrecognised header line: "${lines[0]}"`);

  const day        = parseInt(headerMatch[1], 10);
  const guessCount = headerMatch[2] === 'X' ? null : parseInt(headerMatch[2], 10);
  const maxGuesses = parseInt(headerMatch[3], 10);
  const hardMode   = headerMatch[4] === '*';
  const solved     = headerMatch[2] !== 'X';

  const guesses = lines.slice(1).map((row, rowIndex) => {
    const tiles = [...row];
    if (tiles.length !== 5) {
      throw new Error(`Row ${rowIndex + 1} has ${tiles.length} tiles, expected 5: "${row}"`);
    }
    return tiles.map(tile => {
      const result = TILE[tile];
      if (result === undefined) throw new Error(`Unknown tile character: "${tile}" in row ${rowIndex + 1}`);
      return result;
    });
  });

  return { day, guessCount, maxGuesses, hardMode, solved, guesses };
}

// ---------------------------------------------------------------------------
// Inference with constraint propagation
//
// Algorithm:
//   1. Build initial candidate pool per row via scoreTiles matching
//   2. If hard mode: run forward+backward passes until no pool shrinks
//      Forward:  constraints extracted from row N filter row N+1's pool
//      Backward: shared constraints across all of row N+1's candidates
//                flow back to filter row N's pool
// ---------------------------------------------------------------------------
function inferGuesses(parsed) {
  const answer = SOLUTIONS[parsed.day];
  if (!answer) {
    throw new Error(`No solution found for day ${parsed.day} (solutions array has ${SOLUTIONS.length} entries)`);
  }

  // Step 1: initial pools from tile matching
  let pools = parsed.guesses.map(tiles => findCandidates(tiles, answer));

  if (!parsed.hardMode) {
    return {
      answer,
      rows: parsed.guesses.map((tiles, i) => ({
        tiles,
        candidates: pools[i],
        propagated: false,
      })),
    };
  }

  // Step 2: constraint propagation (hard mode only)
  // Iterate forward and backward passes until convergence (no pool size changes)
  let changed = true;
  while (changed) {
    changed = false;
    const prevSizes = pools.map(p => p.length);

    // --- Forward pass: row N's constraints filter row N+1 ---
    for (let i = 0; i < pools.length - 1; i++) {
      // If pool[i] has collapsed to one word, we know the exact guess — extract precisely
      // Otherwise extract shared constraints across all candidates (weakest safe assumption)
      // NOTE: This might be possible if you had a guess that has all the same letters as the actual word. and no other possible word does.
      // like 
    //   weird, wired, wider
    // if the answer was wider and we guessed wired or weird then we would have enough information to make the pool of size 1?
      let constraints;
      if (pools[i].length === 1) {
        constraints = extractConstraintsFromGuess(pools[i][0], parsed.guesses[i]);
      } else {
        // Build the intersection of constraints that ALL candidates in pool[i] would produce
        // against the answer — i.e. only propagate what we're certain of
        const sharedFromPool = extractSharedConstraints(pools[i]);
        // Also add known constraints from the tile pattern + answer positions
        // (greens are always certain regardless of which word was guessed)
        const greenConstraints = {
          requiredPositions: {},
          forbiddenPositions: Array.from({ length: 5 }, () => new Set()),
          minCount: {},
          maxCount: {},
        };
        for (let pos = 0; pos < 5; pos++) {
          if (parsed.guesses[i][pos] === CORRECT) {
            greenConstraints.requiredPositions[pos] = answer[pos];
          }
        }
        constraints = mergeConstraints(sharedFromPool ?? greenConstraints, greenConstraints);
      }
      pools[i + 1] = applyConstraints(pools[i + 1], constraints);
    }

    // --- Backward pass: row N+1's shared constraints filter row N ---
    for (let i = pools.length - 1; i > 0; i--) {
      const shared = extractSharedConstraints(pools[i]);
      if (shared) {
        pools[i - 1] = applyConstraints(pools[i - 1], shared);
      }
    }

    // Check if anything changed
    pools.forEach((p, i) => { if (p.length !== prevSizes[i]) changed = true; });
  }

  return {
    answer,
    rows: parsed.guesses.map((tiles, i) => ({
      tiles,
      candidates: pools[i],
      propagated: true,
    })),
  };
}

// ---------------------------------------------------------------------------
// Pretty print
// ---------------------------------------------------------------------------
function tileEmoji(r) {
  if (r === CORRECT)        return '🟩';
  if (r === WRONG_POSITION) return '🟨';
  return '⬜';
}

function prettyPrint(parsed, inferred) {
  console.log('=== Wordle Result ===');
  console.log(`Day:        ${parsed.day}`);
  console.log(`Answer:     ${inferred.answer.toUpperCase()}`);
  console.log(`Hard Mode:  ${parsed.hardMode ? 'Yes ✱' : 'No'}`);
  console.log(`Solved:     ${parsed.solved ? 'Yes' : 'No (X)'}`);
  if (parsed.solved) {
    console.log(`Guesses:    ${parsed.guessCount} / ${parsed.maxGuesses}`);
  }

  console.log('\nInferred guesses:');
  inferred.rows.forEach(({ tiles, candidates }, i) => {
    const emoji = tiles.map(tileEmoji).join(' ');
    const tag   = candidates.length === 1 ? '✓' : `${candidates.length} candidates`;
    if (candidates.length === 1) {
      console.log(`  Guess ${i + 1}: ${emoji}  →  ${candidates[0].toUpperCase()}  [certain]`);
    } else if (candidates.length === 0) {
      console.log(`  Guess ${i + 1}: ${emoji}  →  (no match — word list may be incomplete)`);
    } else if (candidates.length <= 8) {
      const words = candidates.map(w => w.toUpperCase()).join(', ');
      console.log(`  Guess ${i + 1}: ${emoji}  →  ${candidates.length} candidates: ${words}`);
    } else {
      console.log(`  Guess ${i + 1}: ${emoji}  →  ${candidates.length} candidates`);
    }
  });
}

// ---------------------------------------------------------------------------
// Example
// ---------------------------------------------------------------------------
const example = `
Wordle 1762 4/6*

⬛⬛🟨⬛⬛
🟩⬛⬛⬛⬛
🟩🟩⬛⬛⬛
🟩🟩🟩🟩🟩
`;

const parsed   = parseWordle(example);
const inferred = inferGuesses(parsed);
prettyPrint(parsed, inferred);
