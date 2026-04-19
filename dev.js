const { build } = require('./build.js')
const chokidar = require('chokidar')
const { spawn } = require('child_process')

const SOURCES = ['index.html', 'style.css', 'index.js', 'lib.js', 'worker.js', 'scripts/words.js', 'scripts/solutions.js', 'favicon.png', 'examples.js']

build().then(() => {
	spawn('npx', ['serve', 'dist', '-p', '3000'], { stdio: 'inherit', shell: true })
	chokidar.watch(SOURCES).on('change', file => {
		console.log(`Changed: ${file} — rebuilding...`)
		build().catch(console.error)
	})
}).catch(err => { console.error(err); process.exit(1) })
