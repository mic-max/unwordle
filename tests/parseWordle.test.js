const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseWordle, MISS, WRONG_POSITION, CORRECT } = require('../lib.js');

const VALID_HARD = `
Wordle 1,763 4/6*

⬛⬛🟨⬛⬛
🟩⬛⬛⬛🟩
🟩⬛🟩⬛🟩
🟩🟩🟩🟩🟩
`;

const VALID_NORMAL = `
Wordle 1762 4/6

⬛⬛🟨⬛⬛
🟩⬛⬛⬛🟩
🟩⬛🟩⬛🟩
🟩🟩🟩🟩🟩
`;

test('parses day number without comma', () => {
	const { day } = parseWordle(VALID_NORMAL);
	assert.equal(day, 1762);
});

test('parses day number with comma', () => {
	const { day } = parseWordle(VALID_HARD);
	assert.equal(day, 1763);
});

test('detects hard mode asterisk', () => {
	const { hardMode } = parseWordle(VALID_HARD);
	assert.equal(hardMode, true);
});

test('detects normal mode (no asterisk)', () => {
	const { hardMode } = parseWordle(VALID_NORMAL);
	assert.equal(hardMode, false);
});

test('parses correct number of guess rows', () => {
	const { guesses } = parseWordle(VALID_HARD);
	assert.equal(guesses.length, 4);
});

test('each guess row has 5 tiles', () => {
	const { guesses } = parseWordle(VALID_HARD);
	for (const row of guesses) assert.equal(row.length, 5);
});

test('maps black square to MISS', () => {
	const { guesses } = parseWordle(VALID_HARD);
	assert.equal(guesses[0][0], MISS);
});

test('maps white square to MISS', () => {
	const input = `Wordle 1 2/6\n⬜⬜⬜⬜⬜\n🟩🟩🟩🟩🟩`;
	const { guesses } = parseWordle(input);
	assert.equal(guesses[0][0], MISS);
});

test('maps yellow square to WRONG_POSITION', () => {
	const { guesses } = parseWordle(VALID_HARD);
	assert.equal(guesses[0][2], WRONG_POSITION);
});

test('maps green square to CORRECT', () => {
	const { guesses } = parseWordle(VALID_HARD);
	assert.equal(guesses[1][0], CORRECT);
});

test('last row is all CORRECT (solve row)', () => {
	const { guesses } = parseWordle(VALID_HARD);
	const last = guesses[guesses.length - 1];
	assert.deepEqual(last, [CORRECT, CORRECT, CORRECT, CORRECT, CORRECT]);
});

test('handles X/6 (failed game)', () => {
	const input = `Wordle 1 X/6\n⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛`;
	const { day, guesses } = parseWordle(input);
	assert.equal(day, 1);
	assert.equal(guesses.length, 2);
});

test('throws on missing header', () => {
	assert.throws(() => parseWordle('not a wordle score'), /Invalid Wordle header/);
});

test('throws on empty input', () => {
	assert.throws(() => parseWordle(''), { name: 'TypeError' });
});
