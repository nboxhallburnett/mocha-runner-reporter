const path = require('path');
const Runner = require('../');

const params = {
	title: 'Example test runner',
	usage: 'node runner',
	description: 'Used to make sure this thing works',
	notes: [
		'Why are you reading this?'
	]
};

const runner = new Runner(path.resolve(__dirname, './test.js'), null, params);
runner.run()
	.then(results => {
		const report = runner.generateReport(params.title, results);
		return console.log(report);
	})
	.catch(err => {
		console.error('Uh oh...', err);
	});
