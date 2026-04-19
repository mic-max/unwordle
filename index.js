let wordsBin = null, wordsReady = false, parseOk = false;

const inputEl       = document.getElementById('input');
const parseStatusEl = document.getElementById('parse-status');
const statusEl      = document.getElementById('status');
const outputEl      = document.getElementById('output');
const runBtn        = document.getElementById('run');
const dayInputEl    = document.getElementById('day-input');
const answerInputEl = document.getElementById('answer-input');

function activeMode() {
	return document.querySelector('input[name="input-mode"]:checked').value;
}

function updateRunBtn() { runBtn.disabled = !(wordsReady && parseOk); }

// --- Grid ---

const ROW_STATES   = ['unused', 'miss', 'incorrect_pos', 'correct'];
const ROW_LABELS   = { unused: 'Unused', miss: 'All miss', incorrect_pos: 'All yellow', correct: 'All green ✓' };
const TILE_MISS    = 0, TILE_YELLOW = 1, TILE_GREEN = 2;

function buildGrid() {
	const gridEl = document.getElementById('grid');
	for (let r = 0; r < 6; r++) {
		const row = document.createElement('div');
		row.className = 'grid-row';
		row.dataset.row   = r;
		row.dataset.state = 'unused';

		for (let c = 0; c < 5; c++) {
			const tile = document.createElement('button');
			tile.className    = 'tile';
			tile.dataset.state = TILE_MISS;
			tile.addEventListener('click', () => {
				tile.dataset.state = (((+tile.dataset.state) + 1) % 3).toString();
				onGridChange();
			});
			row.appendChild(tile);
		}

		const rowBtn = document.createElement('button');
		rowBtn.className   = 'row-btn';
		rowBtn.textContent = ROW_LABELS['unused'];
		rowBtn.addEventListener('click', () => {
			const cur  = ROW_STATES.indexOf(row.dataset.state);
			const next = ROW_STATES[(cur + 1) % ROW_STATES.length];
			applyRowState(r, next);
			onGridChange();
		});
		row.appendChild(rowBtn);

		gridEl.appendChild(row);
	}
}

function applyRowState(rowIdx, state) {
	const row     = document.querySelector(`.grid-row[data-row="${rowIdx}"]`);
	const rowBtn  = row.querySelector('.row-btn');
	const tiles   = [...row.querySelectorAll('.tile')];
	const tileVal = state === 'miss' ? TILE_MISS : state === 'incorrect_pos' ? TILE_YELLOW : state === 'correct' ? TILE_GREEN : TILE_MISS;

	row.dataset.state  = state;
	rowBtn.textContent = ROW_LABELS[state];

	if (state !== 'unused') {
		tiles.forEach(t => { t.dataset.state = tileVal; });
	} else {
		tiles.forEach(t => { t.dataset.state = TILE_MISS; });
	}

	// Setting a row to correct locks all subsequent rows as unused
	if (state === 'correct') {
		for (let r = rowIdx + 1; r < 6; r++) applyRowState(r, 'unused');
	}
}

function parseWordleFromGrid() {
	const guesses = [];
	for (let r = 0; r < 6; r++) {
		const row = document.querySelector(`.grid-row[data-row="${r}"]`);
		if (row.dataset.state === 'unused') continue;
		guesses.push([...row.querySelectorAll('.tile')].map(t => +t.dataset.state));
	}
	if (guesses.length === 0) throw new Error('No active rows — activate at least two rows');
	if (guesses.length < 2)   throw new Error('Need at least two rows (one guess + answer row)');
	return { guesses, solved: guesses.at(-1).every(v => v === TILE_GREEN) };
}

// --- Validation ---

function updateParseOk() {
	const mode = activeMode();
	try {
		if (mode === 'paste') {
			const text = inputEl.value.trim();
			if (!text) { parseStatusEl.textContent = ''; parseOk = false; updateRunBtn(); return; }
			const parsed = parseWordle(text);
			parseStatusEl.textContent = parsed.hardMode ? '✅' : '⚠️';
		} else if (mode === 'grid-day') {
			parseWordleFromGrid();
			const day = dayInputEl.value.trim();
			if (!day) throw new Error('Day number required');
			const d = parseInt(day, 10);
			if (isNaN(d) || d < 0 || d > 1780) throw new Error('Day out of range (0–1780)');
			parseStatusEl.textContent = '✅';
		} else {
			parseWordleFromGrid();
			const ans = answerInputEl.value.trim().toLowerCase();
			if (ans.length !== 5 || !/^[a-z]+$/.test(ans)) throw new Error('Answer must be exactly 5 letters');
			parseStatusEl.textContent = '✅';
		}
		parseOk = true;
	} catch {
		parseStatusEl.textContent = '❌';
		parseOk = false;
	}
	updateRunBtn();
}

function onGridChange() {
	if (activeMode() !== 'paste') updateParseOk();
}

inputEl.addEventListener('input', () => {
	if (activeMode() === 'paste') updateParseOk();
});

document.querySelectorAll('input[name="input-mode"]').forEach(radio => {
	radio.addEventListener('change', updateParseOk);
});

dayInputEl.addEventListener('input', () => {
	if (activeMode() === 'grid-day') updateParseOk();
});

answerInputEl.addEventListener('input', () => {
	if (activeMode() === 'grid-answer') updateParseOk();
});

// --- Run ---

let activeWorker = null;

runBtn.addEventListener('click', () => {
	if (activeWorker) activeWorker.terminate();
	parseStatusEl.textContent = '⏳';
	statusEl.textContent = 'Computing… this may take several seconds.';
	outputEl.value = '';
	document.getElementById('answer-spoiler').style.display = 'none';

	const mode = activeMode();
	let msg;
	try {
		if (mode === 'paste') {
			msg = { wordsBin, mode: 'paste', example: inputEl.value };
		} else if (mode === 'grid-day') {
			const { guesses } = parseWordleFromGrid();
			msg = { wordsBin, mode: 'grid-day', day: parseInt(dayInputEl.value, 10), guesses };
		} else {
			const { guesses } = parseWordleFromGrid();
			msg = { wordsBin, mode: 'grid-answer', answer: answerInputEl.value.trim().toLowerCase(), guesses };
		}
	} catch (e) {
		statusEl.textContent = `Error: ${e.message}`;
		parseStatusEl.textContent = '❌';
		return;
	}

	activeWorker = new Worker('./worker.js');
	activeWorker.onmessage = ({ data }) => {
		activeWorker = null;
		if (data.error) {
			statusEl.textContent = `Error: ${data.error}`;
			parseStatusEl.textContent = '❌';
			return;
		}
		const r = data.result;
		const spoiler = document.getElementById('answer-spoiler');
		spoiler.removeAttribute('open');
		spoiler.style.display = '';
		document.getElementById('answer-summary').textContent =
			r.day != null ? `Day ${r.day} — click to reveal answer` : 'Click to reveal answer';
		document.getElementById('answer-word').textContent = r.answer;
		outputEl.value = formatResult(r);
		statusEl.textContent = 'Done.';
		parseStatusEl.textContent = '✅';
	};
	activeWorker.onerror = (e) => {
		activeWorker = null;
		statusEl.textContent = `Worker error: ${e.message}`;
		parseStatusEl.textContent = '❌';
	};
	activeWorker.postMessage(msg);
});

// --- Output formatting ---

function formatResult(r) {
	const lines = [];
	if (r.day != null) lines.push(`Day ${r.day}`);
	if (!r.hardMode && r.day != null)
		lines.push('Warning: hard mode (*) not detected — results may be empty or inaccurate.\n');
	lines.push(`Paths found: ${r.pathCount.toLocaleString()}\n`);
	lines.push(`Top ${r.topPaths.length} paths:`);
	for (const { score, words } of r.topPaths)
		lines.push(`  ${words.join(' → ')}  (score: ${(score / 1000).toFixed(2)})`);
	for (let pos = 0; pos < r.guessLen; pos++) {
		lines.push(`\nGuess ${pos + 1} — top words:`);
		for (const { word, pct } of r.perPosition[pos])
			lines.push(`  ${word}  (${pct.toFixed(1)}%)`);
	}
	return lines.join('\n');
}

// --- Dev examples ---

devExamples.forEach(({ scorecard }, i) => {
	const btn = document.createElement('button');
	btn.textContent = `Ex. ${i + 1}`;
	btn.onclick = () => {
		document.querySelector('input[name="input-mode"][value="paste"]').checked = true;
		inputEl.value = scorecard;
		updateParseOk();
	};
	document.getElementById('dev-examples').appendChild(btn);
});

// --- Init ---

buildGrid();

fetch('./words.bin').then(r => r.arrayBuffer()).then(buf => {
	wordsBin = buf;
	wordsReady = true;
	statusEl.textContent = `Ready — ${new WordBuffer(buf).wordCount} words loaded.`;
	updateRunBtn();
}).catch(e => {
	statusEl.textContent = `Failed to load data: ${e.message}`;
	console.error(e);
});
