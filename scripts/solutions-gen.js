const fs    = require('fs');
const path  = require('path');
const https = require('https');

const SOLUTIONS  = require('./solutions.js');
const START_DATE = new Date('2021-06-19T00:00:00Z');

function addDays(date, days) {
	const d = new Date(date);
	d.setUTCDate(d.getUTCDate() + days);
	return d;
}

function formatDate(date) {
	return date.toISOString().slice(0, 10);
}

function fetchJson(url) {
	return new Promise((resolve, reject) => {
		https.get(url, res => {
			let data = '';
			res.on('data', chunk => data += chunk);
			res.on('end', () => {
				if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
				try { resolve(JSON.parse(data)); }
				catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
			});
		}).on('error', reject);
	});
}

async function main() {
	const solutions = [...SOLUTIONS];
	const today   = new Date();
	today.setUTCHours(0, 0, 0, 0);
	const cutoff  = addDays(today, 14);

	let idx     = solutions.length;
	let fetched = 0;

	while (true) {
		const date = addDays(START_DATE, idx);
		if (date > cutoff) {
			console.log(`Reached 14-day future limit (${formatDate(date)}), stopping.`);
			break;
		}

		const url = `https://www.nytimes.com/svc/wordle/v2/${formatDate(date)}.json`;
		try {
			const json = await fetchJson(url);
			if (!json.solution || typeof json.solution !== 'string') {
				console.log(`\nNo solution field for ${formatDate(date)}, stopping.`);
				break;
			}
			solutions.push(json.solution.toLowerCase());
			fetched++;
			process.stdout.write(`\r${fetched} fetched (${formatDate(date)})...`);
		} catch (e) {
			console.log(`\nError for ${formatDate(date)}: ${e.message}, stopping.`);
			break;
		}

		idx++;
	}

	if (fetched === 0) {
		console.log('No new solutions found.');
		return;
	}

	process.stdout.write('\n');
	const body = solutions.map(w => `  "${w}"`).join(',\n');
	fs.writeFileSync(path.join(__dirname, 'solutions.js'), `module.exports = [\n${body}\n];\n`);
	console.log(`Wrote ${solutions.length} total solutions (${fetched} new) to solutions.js`);
}

module.exports = { generateSolutions: main };

if (require.main === module) main().catch(err => { console.error(err); process.exit(1); });
