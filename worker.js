// WordBuffer, parseWordle, and analyzeWordle are injected as globals by build.js (lib.js).
self.onmessage = function(e) {
	try {
		const { wordsBin, mode } = e.data;
		const buf = new WordBuffer(wordsBin);
		let answer, guesses, extra = {};

		if (mode === 'paste') {
			const parsed    = parseWordle(e.data.example);
			const answerIdx = buf.solution(parsed.day);
			if (answerIdx === null) throw new Error(`No answer for day ${parsed.day}`);
			answer  = buf.word(answerIdx);
			guesses = parsed.guesses;
			extra   = { day: parsed.day, hardMode: parsed.hardMode, solved: parsed.solved };
		} else if (mode === 'grid-day') {
			const answerIdx = buf.solution(e.data.day);
			if (answerIdx === null) throw new Error(`No answer for day ${e.data.day}`);
			answer  = buf.word(answerIdx);
			guesses = e.data.guesses;
			extra   = { day: e.data.day, hardMode: true };
		} else if (mode === 'grid-answer') {
			answer  = e.data.answer;
			guesses = e.data.guesses;
			extra   = { hardMode: true };
		} else {
			throw new Error(`Unknown mode: ${mode}`);
		}

		const result = analyzeWordle(buf, answer, guesses);
		self.postMessage({ result: { ...result, ...extra } });
	} catch (err) {
		self.postMessage({ error: err.message });
	}
};
