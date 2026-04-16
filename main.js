const SOLUTIONS = require('./res/solutions.js')();
const ACCEPTED = require('./res/accepted.js');

const MISS           = 0;
const WRONG_POSITION = 1;
const CORRECT        = 2;

const TILE = {
  '⬛': MISS,           // dark mode miss
  '⬜': MISS,           // light mode miss
  '🟨': WRONG_POSITION,
  '🟩': CORRECT,
};

function parseWordle(input) {
  const lines = input.trim().split('\n').map(l => l.trim()).filter(Boolean);

  // --- Line 1: header ---
  // e.g. "Wordle 1762 4/6*"  or  "Wordle 1762 4/6"
  const headerMatch = lines[0].match(/^Wordle\s+(\d+)\s+(\d+|X)\/(\d+)(\*?)$/i);
  if (!headerMatch) {
    throw new Error(`Unrecognised header line: "${lines[0]}"`);
  }

  const day        = parseInt(headerMatch[1], 10);
  const guessCount = headerMatch[2] === 'X' ? null : parseInt(headerMatch[2], 10); // null = failed
  const maxGuesses = parseInt(headerMatch[3], 10);
  const hardMode   = headerMatch[4] === '*';
  const solved     = headerMatch[2] !== 'X';

  // --- Remaining lines: guess rows ---
  const guesses = lines.slice(1).map((row, rowIndex) => {
    // Split into individual emoji characters (each emoji is one tile)
    const tiles = [...row]; // spread handles multi-byte emoji correctly
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

function prettyPrint(parsed) {
  console.log('=== Wordle Result ===');
  console.log(`Day:        ${parsed.day}`);
  console.log(`Hard Mode:  ${parsed.hardMode ? 'Yes ✱' : 'No'}`);
  console.log(`Solved:     ${parsed.solved ? 'Yes' : 'No (X)'}`);
  if (parsed.solved) {
    console.log(`Guesses:    ${parsed.guessCount} / ${parsed.maxGuesses}`);
  }
  console.log('\nGuess breakdown:');
  parsed.guesses.forEach((row, i) => {
    const tiles = row.map(r => {
      if (r === CORRECT)        return '🟩';
      if (r === WRONG_POSITION) return '🟨';
      return '⬜';
    }).join(' ');
    const labels = row.map(r => {
      if (r === CORRECT)        return 'correct       ';
      if (r === WRONG_POSITION) return 'wrong_position';
      return 'miss          ';
    }).join(' ');
    console.log(`  Guess ${i + 1}: ${tiles}   [ ${labels}]`);
  });
  console.log(`  Word was: ${SOLUTIONS[parsed.day]}`);
}

// ---------------------------------------------------------------------------
// Example input (replace with process.stdin or argv for real use)
// ---------------------------------------------------------------------------
const example = `
Wordle 1762 4/6*

⬛⬛🟨⬛⬛
🟩⬛⬛⬛⬛
🟩🟩⬛⬛⬛
🟩🟩🟩🟩🟩
`;

const parsed = parseWordle(example);
prettyPrint(parsed);

console.log('\nRaw parsed object:');
console.log(JSON.stringify(parsed, null, 2));
