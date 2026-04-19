let wordsBin = null, wordsReady = false, parseOk = false;

const inputEl       = document.getElementById('input');
const parseStatusEl = document.getElementById('parse-status');
const statusEl      = document.getElementById('status');
const outputEl      = document.getElementById('output');
const runBtn        = document.getElementById('run');

function updateRunBtn() { runBtn.disabled = !(wordsReady && parseOk); }

inputEl.addEventListener('input', () => {
	const text = inputEl.value.trim();
	if (!text) { parseStatusEl.textContent = ''; parseOk = false; updateRunBtn(); return; }
	try {
		const parsed = parseWordle(text);
		parseStatusEl.textContent = parsed.hardMode ? '✅' : '⚠️';
		parseOk = true;
	} catch { parseStatusEl.textContent = '❌'; parseOk = false; }
	updateRunBtn();
});

let activeWorker = null;

runBtn.addEventListener('click', () => {
	if (activeWorker) activeWorker.terminate();
	parseStatusEl.textContent = '⏳';
	statusEl.textContent = 'Computing… this may take several seconds.';
	outputEl.value = '';
	document.getElementById('answer-spoiler').style.display = 'none';

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
		document.getElementById('answer-summary').textContent = `Day ${r.day} — click to reveal answer`;
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
	activeWorker.postMessage({ wordsBin, example: inputEl.value });
});

function formatResult(r) {
	const lines = [];
	if (!r.hardMode)
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

// Dev examples — delete this block when no longer needed
[
	`Wordle 1,763 4/6*\n\n⬛⬛🟨⬛⬛\n🟩⬛⬛⬛🟩\n🟩⬛🟩⬛🟩\n🟩🟩🟩🟩🟩`,
	`Wordle 1,763 6/6*\n\n⬛⬛⬛⬛⬛\n⬛🟨⬛⬛⬛\n⬛⬛🟩⬛🟩\n⬛🟩🟩⬛🟩\n⬛🟩🟩⬛🟩\n🟩🟩🟩🟩🟩`,
	`Wordle 1,764 4/6*\n\n🟩⬛⬛⬛⬛\n🟩⬛⬛⬛⬛\n🟩🟨⬛⬛⬛\n🟩🟩🟩🟩🟩`,
].forEach((scorecard, i) => {
	const btn = document.createElement('button');
	btn.textContent = `Ex. ${i + 1}`;
	btn.onclick = () => { inputEl.value = scorecard; inputEl.dispatchEvent(new Event('input')); };
	document.getElementById('dev-examples').appendChild(btn);
});

fetch('./words.bin').then(r => r.arrayBuffer()).then(buf => {
	wordsBin = buf;
	wordsReady = true;
	statusEl.textContent = `Ready — ${new WordBuffer(buf).wordCount} words loaded.`;
	updateRunBtn();
}).catch(e => {
	statusEl.textContent = `Failed to load data: ${e.message}`;
	console.error(e);
});
