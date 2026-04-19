// WordBuffer and analyzeWordle are injected as globals by build.js (lib.js IIFE).
self.onmessage = function(e) {
	try {
		const buf    = new WordBuffer(e.data.wordsBin);
		const result = analyzeWordle(buf, e.data.example);
		self.postMessage({ result });
	} catch (err) {
		self.postMessage({ error: err.message });
	}
};
