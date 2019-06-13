'use strict';

const args = require('minimist')(process.argv.slice(2)),
	fs = require('fs'),
	helper = require('./helper'),
	Mocha = require('mocha'),
	pad = require('pad-left'),
	path = require('path'),
	stripAnsi = require('strip-ansi'),
	wrap = require('word-wrap');

require('colors');

module.exports = class Runner {

	/**
	 * Initialise a Runner
	 *
	 * @param {String|String[]} files File(s) or path(s) containing the files to be used in the test run. Defaults to the third parameter (e.g. `node runner {file/path}`)
	 * @param {String[]} avoided File(s) or path(s) to be excluded from the test run.
	 * @param {Object} [params] Parameters used for the test, including arguments that can be passed to perform specified functions (See readme for structure).
	 */
	constructor (files, avoided, params) {
		// If no files have been supplied, default them to the non-option args (node runner [file/path])
		!files && (files = args._);

		!params.args && (params.args = []);

		// If help options have been requested, print them to the console and exit the process
		if (args.h || args.help || !files[0]) {
			console.log(this._generateHelp(params));
			process.exit(0);
		}

		// Process the provided arguments
		this._processArgs(params);

		// Run any additional set-up before the test run starts
		this._processAfterArgs(params);

		// Create the Mocha instance
		this._resetMocha(params.mochaOpts || {});

		// Loop through the provided test files and populate the mocha instance
		!Array.isArray(files) && (files = [ files ]);
		files.forEach(testPath => {
			// Root path
			let rootPath;
			if (path.isAbsolute(testPath)) {
				rootPath = testPath;
			} else {
				rootPath = path.join(process.cwd(), testPath || '.');
			}

			if (rootPath === process.cwd()) {
				console.log(this._generateHelp(params));
				throw new Error('Error: Test suite or file path required.');
			}

			try {
				const self = this;
				if (fs.statSync(rootPath).isDirectory()) {

					/**
					 * Add the tests to the Mocha instance
					 */
					(function addFiles (dir, path) {
						fs.readdirSync(dir)
							.filter(file => {
								if (!~avoided.indexOf(file)) {
									if (fs.statSync(`${dir}/${file}`).isDirectory()) {
										addFiles(`${dir}/${file}`, (path || '') + file + '/');
									}
									return file.endsWith('.js');
								}
								return false;
							})
							.forEach(file => {
								self.mocha.addFile(`${dir.endsWith('/') ? dir : `${dir}/`}${file}`);
							});
					}(rootPath));
				} else {
					self.mocha.addFile(rootPath);
				}
			} catch (e) {
				throw new Error('Error processing files:\n' + e.message);
			}
		});

		// Store/create the parameters to be used during or after the test run
		this.fails = {};
		this.files = files;
		this.params = params;
		this.passes = {};
		this.slows = {};
		this.pending = {};
		this.total = {};
		this.duration = {};
	}

	/**
	 * Run the supplied tests and returns the results.
	 *
	 * @returns {Promise} The result of the test run
	 */
	run () {
		return new Promise(resolve => {
			this.mocha.run()
				.on('test end', test => this._setDuration(test))
				.on('hook end', hook => this._setDuration(hook))
				.on('pass', test => this._setData([ 'passes', 'slows', 'total' ], test))
				.on('fail', (test, error) => this._setData([ 'fails', 'total' ], test, error))
				.on('pending', test => this._setData([ 'pending', 'total' ], test))
				.on('end', () => {
					// All tests have finished running now, so exit and return the collected data
					return resolve({
						passes: this.passes,
						slows: this.slows,
						failures: this.fails,
						timeTaken: this.duration,
						total: this.total,
						pending: this.pending
					});
				});
		});
	}

	/**
	 * Generates a body to be used in an email report
	 *
	 * @param {String} suiteName Name of the test suite being ran
	 * @param {Object} data Data that was generated from the Mocha test run
	 * @param {Boolean} minimal Generates a minimal report if true
	 *
	 * @returns {String} Body to be used in the report body
	 */
	generateReport (suiteName, data, minimal) {
		const title = this._reportTitle(suiteName, data);

		const failures = data.failures,
			passes = data.passes,
			slows = data.slows,
			skipped = data.pending,
			timeTaken = data.timeTaken,
			total = data.total;

		let failureBody = '';
		let header;

		// If there was only 1 test that was ran, we don't need as detailed of a report
		if (Object.keys(total).length === 1) {
			// Store the key used for this test
			const testKey = Object.keys(total)[0];

			// If no data exists for the values, use an empty array. That way .length calls return expected results
			!passes[testKey] && (passes[testKey] = []);
			!failures[testKey] && (failures[testKey] = []);
			!slows[testKey] && (slows[testKey] = []);
			!skipped[testKey] && (skipped[testKey] = []);

			header = this._reportHeader(total, passes, failures, slows, skipped, timeTaken);

			// If the test had failures, then generate the failure list for it
			if (failures[testKey].length) {
				failureBody += this._testIssues('Failure', failures, testKey);
			}
			if (slows[testKey].length) {
				failureBody += this._testIssues('Slow', slows, testKey);
			}
		} else {
			// There was more than one test ran, so gather data for them all
			let totalFail = 0,
				totalPass = 0,
				totalSkip = 0,
				totalSlow = 0;

			// Loop through all the test files and count how many total passes, failures, and skips there were
			for (let i = 0; i < Object.keys(total).length; i++) {
				for (let j = 0; j < total[Object.keys(total)[i]].length; j++) {
					const test = total[Object.keys(total)[i]][j].test;
					switch (test.state) {
						case 'passed':
							totalPass++;
							test.speed === 'slow' && totalSlow++;
							break;
						case 'failed':
							totalFail++;
							break;
						default:
							totalSkip++;
							break;
					}
				}
			}

			header = this._reportHeader(total, totalPass, totalFail, totalSlow, totalSkip, timeTaken);

			if (minimal !== true){
				// Loop through all the tests and generate detailed reports for them all
				for (let i = 0; i < Object.keys(total).length; i++) {
					const testKey = Object.keys(total)[i];

					// If no data exists for the values, use an empty array. That way .length calls return expected results
					!passes[testKey] && (passes[testKey] = []);
					!failures[testKey] && (failures[testKey] = []);
					!slows[testKey] && (slows[testKey] = []);
					!skipped[testKey] && (skipped[testKey] = []);

					const testCount = passes[testKey].length + failures[testKey].length + skipped[testKey].length;

					failureBody += '‖==============================\n';
					failureBody += `‖ ${testKey}\n`;
					failureBody += '‖==============================\n\n';

					failureBody += `- File       : ${total[testKey][0].test.file || total[testKey][0].test.parent.file}\n`;
					failureBody += `- Passes     : ${passes[testKey].length} (${Math.round((100 / testCount * passes[testKey].length) * 100) / 100}%)\n`;
					failureBody += `- Failures   : ${failures[testKey].length} (${Math.round((100 / testCount * failures[testKey].length) * 100) / 100}%)\n`;
					failureBody += `- Slow       : ${slows[testKey].length} (${Math.round((100 / testCount * slows[testKey].length) * 100) / 100}%)\n`;
					failureBody += `- Skipped    : ${skipped[testKey].length} (${Math.round((100 / testCount * skipped[testKey].length) * 100) / 100}%)\n`;
					failureBody += `- Duration   : ${helper.msToString(timeTaken[testKey]) || +timeTaken[testKey]}\n\n`;

					// If the single test had failures, then generate the failure list for it
					if (failures[testKey].length) {
						failureBody += this._testIssues('Failure', failures, testKey);
					}
					if (slows[testKey].length) {
						failureBody += this._testIssues('Slow', slows, testKey);
					}

					failureBody += '=============================================\n\n';

				}
			} else {
				// Loop through all the tests and generate detailed reports for them all
				for (let i = 0; i < Object.keys(total).length; i++) {
					const testKey = Object.keys(total)[i];

					// If no data exists for the values, use an empty array. That way .length calls return expected results
					!failures[testKey] && (failures[testKey] = []);
					!slows[testKey] && (slows[testKey] = []);

					if (failures[testKey].length || slows[testKey].length) {
						failureBody += '‖==============================\n';
						failureBody += `‖ ${testKey}\n`;
						failureBody += '‖==============================\n\n';
					}

					// If the single test had failures, then generate the failure list for it
					if (failures[testKey].length) {
						failureBody += this._testIssues('Failure', failures, testKey);
					}
					if (slows[testKey].length) {
						failureBody += this._testIssues('Slow', slows, testKey);
					}

				}
			}
		}

		return title + header + failureBody;
	}

	/**
	 * Generates the title for the report
	 *
	 * @param {String} suiteName Name of the test suite being ran
	 * @param {Object} data Data that was generated from the Mocha test run
	 *
	 * @returns {String} Title for the report
	 */
	_reportTitle(suiteName, data) {
		if (!suiteName) {
			throw new Error('No suite name provided for result email.');
		}
		if (!data) {
			throw new Error('No contents provided for result email. Either a complete body, or a data object containing passes, failures, skipped, and timeTaken are required.');
		}

		// Create the title
		// Magic number 12 being the length of 'Test Results', 6 being half of that, and 2 being a space either side.
		const title = '/' + '*'.repeat(Math.max(suiteName.length, 12) + 2) + '\\\n\n  '
			+ suiteName + '\n' + ' '.repeat(((Math.max(suiteName.length, 12) + 2) / 2) - 6) + 'Test Results\n\n'
			+ '\\' + '*'.repeat(Math.max(suiteName.length, 12) + 2) + '/\n\n';

		return title;
	}

	/**
	 * Generates the header for the report
	 *
	 * @param {Object} total Total number of tests run
	 * @param {Number} passes Number of tests that passed
	 * @param {Number} failures Number of tests that failed
	 * @param {Number} slows Number of slow tests
	 * @param {Number} skipped Number of skipped tests
	 * @param {Object} timeTaken Time take for test run to finish in ms
	 *
	 * @returns {String} Header for the report
	 */
	_reportHeader(total, passes, failures, slows, skipped, timeTaken) {
		let header = 'Overview:\n';

		if (Object.keys(total).length === 1) {
			const testKey = Object.keys(total)[0];
			const testCount = passes[testKey].length + failures[testKey].length + skipped[testKey].length;

			header += `- Suite Name : ${testKey}\n`;
			header += `- File       : ${total[testKey][0].test.file || total[testKey][0].test.parent.file}\n`;
			header += `- Failures   : ${failures[testKey].length} (${Math.round((100 / testCount * failures[testKey].length) * 100) / 100}%)\n`;
			header += `- Slows      : ${slows[testKey].length} (${Math.round((100 / testCount * slows[testKey].length) * 100) / 100}%)\n`;
			header += `- Skipped    : ${skipped[testKey].length} (${Math.round((100 / testCount * skipped[testKey].length) * 100) / 100}%)\n`;
			header += `- Duration   : ${helper.msToString(timeTaken.total) || +timeTaken.total || '0ms'}\n`;
			header += `- Start Time : ${new Date(Date.now() - (timeTaken.total || 0))}\n\n`;
		} else {
			const totalCount = passes + failures + skipped;

			header += `- Test Suites Ran : ${Object.keys(total).length}\n`;
			header += `- Total Failures  : ${+failures} (${Math.round((100 / totalCount * failures) * 100) / 100}%)\n`;
			header += `- Total Slows     : ${+slows} (${Math.round((100 / totalCount * slows) * 100) / 100}%)\n`;
			header += `- Total Skipped   : ${+skipped} (${Math.round((100 / totalCount * skipped) * 100) / 100}%)\n`;
			header += `- Total Duration  : ${helper.msToString(timeTaken.total) || +timeTaken.total || '0ms'}\n`;
			header += `- Start Time      : ${new Date(Date.now() - timeTaken.total)}\n\n`;
		}

		return header;
	}
	/**
	 * Generates a helper output for the test runner
	 *
	 * @param {String} issue The issue for reporting, slow or failed
	 * @param {Object} test The failed/slow test object
	 * @param {Key} key The test key
	 *
	 * @returns {String} The slow/failed test details
	 */
	_testIssues(issue, test, key) {
		let testIssue = '';

		testIssue += '|--------------------\n';
		testIssue += `| ${issue}s:\n`;
		testIssue += '|--------------------\n\n';

		for (let i = 0; i <= test[key].length - 1; i++) {
			const failure = test[key][i];
			testIssue += `${issue} ${i + 1}:\n\n`;
			testIssue += `Name     : ${failure.test.title}\n`;
			testIssue += `Duration : ${helper.msToString(+failure.test.duration) || +failure.test.duration}\n`;
			testIssue += issue === 'Slow'
				? '\n'
				: `Error    : ${stripAnsi(failure.error.stack || failure.error.message)}\n\n`;

			i + 1 < test[key].length && (testIssue += '------------------------------\n\n');
		}
		return testIssue;
	}

	/**
	 * Generates a helper output for the test runner
	 *
	 * @param {Object} params Parameters supplied for the test
	 *
	 * @returns {String} The generated helper string
	 */
	_generateHelp (params) {
		// If no parameters have been provided, don't generate a help output
		if (!params) {
			return;
		}

		// Include the default included mocha specific arguments
		params.args.push({
			aliases: [ 't', 'timeout' ],
			description: 'Time in milliseconds to wait before a test is counted as failing (Defaults to 2000)',
			type: 'number'
		});
		params.args.push({
			aliases: [ 's', 'slow' ],
			description: 'Time in milliseconds to wait before a test is counted as slow (Defaults to 75)',
			type: 'number'
		});
		params.args.push({
			aliases: [ 'R', 'reporter' ],
			description: 'Mocha reporter to use (Defaults to spec)',
			type: 'string'
		});
		params.args.push({
			aliases: [ 'u', 'ui' ],
			description: 'Mocha user-interface to use (bdd|tdd|qunit|exports) (Defaults to bdd)',
			type: 'string'
		});

		//
		// Generate the Options string
		//

		const optsArr = [];
		let opts = '',
			optsLen = 0;

		// Loop through the supplied parameters and create the string to use to show the usable arguments
		for (let i = 0; i <= params.args.length - 1; i++) {
			const arr = [];
			// If we weren't given an array, make one
			!Array.isArray(params.args[i].aliases) && (params.args[i].aliases = [ params.args[i].aliases ]);
			// Go through all of the aliases and store them with the correct formatting
			for (let j = 0; j <= params.args[i].aliases.length - 1; j++) {
				arr.push((params.args[i].aliases[j].length === 1 ? '-' : '--') + params.args[i].aliases[j]);
			}
			// Join the aliases together, and comma separate them
			let optsStr = arr.join(', '.grey);
			// If an argument type restriction is specified, add that to the output
			params.args[i].type && (optsStr += ` {${Array.isArray(params.args[i].type) ? params.args[i].type.join('|') : params.args[i].type}}`.cyan);
			// Check if the output is the longest one so far, and if so store its length for padding.
			stripAnsi(optsStr).length > optsLen && (optsLen = stripAnsi(optsStr).length);
			// All done here
			optsArr.push(optsStr);
		}
		// Add the descriptions for each option, with even padding.
		for (let i = 0; i <= optsArr.length - 1; i++) {
			let padSpace = optsLen - stripAnsi(optsArr[i]).length + params.args[i].description.length + 4;

			// If the arg is required or requires another argument, add it to the output
			let reqStr = '';
			if (params.args[i].required) {
				// If it is just requried by itself then just add that, otherwise prettify the other arguments required and list them
				if (params.args[i].required === true) {
					reqStr = ' - Required'.bold;
				} else if (params.args[i].required.requires) {
					const reqArr = [];
					for (let j = 0; j <= params.args[i].required.requires.length - 1; j++) {
						reqArr.push((params.args[i].required.requires[j].length === 1 ? '-' : '--').cyan + params.args[i].required.requires[j].cyan);
					}
					reqStr = ` - Requires ${reqArr.join('/')}`.bold;
					padSpace += reqStr.length;
				}
			}

			// Add the help output to the opts string
			if (!params.args[i].hidden) {
				opts += '\n   ' + optsArr[i] + pad(params.args[i].description + reqStr, padSpace, ' ');
			}
		}

		// Generate the Notes string
		let notes = '';
		if (Array.isArray(params.notes)) {
			// If we have multiple notes, word-wrap them and separate them out
			for (let i = 0; i <= params.notes.length - 1; i++) {
				notes += '\n' + wrap(params.notes[i], { indent: '   ', width: 100 }) + '\n';
			}
		} else if (typeof params.notes === 'string') {
			notes = '\n' + wrap(params.notes, { indent: '   ', width: 100 }) + '\n';
		}

		// Define the title separately, makes it easier to colour the block
		const title = '\n'
			+ '   ┌' + '─'.repeat(params.title.length + 2) + '┐\n'
			+ '   │' + ' '.repeat(params.title.length + 2) + '│\n'
			+ '   │ ' + params.title + ' │\n'
			+ '   │' + ' '.repeat(params.title.length + 2) + '│\n'
			+ '   └' + '─'.repeat(params.title.length + 2) + '┘\n\n';

		// Format the final output string and return it
		return title.cyan
			+ (params.description
				? (`${'Description:\n\n'.bold}   ${params.description}\n\n\n`)
				: '')
			+ (params.usage
				? `${'Usage:'.bold}\n\n   ${params.usage}\n\n\n`
				: '')
			+ (opts
				? `${'Options:'.bold}\n${opts}\n\n\n`
				: '')
			+ (notes
				? 'Notes:\n'.bold + notes + '\n'
				: '');
	}

	/**
	 * Process the provided arguments using the data from the supplied params
	 *
	 * @param {Object} params Parameters to be processed
	 */
	_processArgs (params) {
		let used = [];
		// Loop through all the supplied args
		for (let i = params.args.length - 1; i >= 0; i--) {
			// If there isn't a supplied function, or it isn't required, then there isn't any point processing it
			if (params.args[i].function || params.args[i].required) {
				// If we weren't given an array of aliases, make one
				!Array.isArray(params.args[i].aliases) && (params.args[i].aliases = [ params.args[i].aliases ]);
				// Loop through each of the aliases for the argument
				for (let j = params.args[i].aliases.length - 1; j >= 0; j--) {
					// Check if the argument relating to the alias has been used, and if so call the supplied function with its value
					if (args[params.args[i].aliases[j]]) {
						// Add all the possible combinations for the parameter to the used array
						used = used.concat(params.args[i].aliases);
						typeof params.args[i].function === 'function' && params.args[i].function(args[params.args[i].aliases[j]]);
					}
				}
			}
		}
		// Loop through the args again now they've all been ran to process any required parameters
		for (let i = params.args.length - 1; i >= 0; i--) {
			if (params.args[i].required) {
				// If the argument has not been called, then throw an error
				if (params.args[i].required === true && !params.args[i].aliases.some(v => used.indexOf(v) >= 0)) {
					throw new Error(`Error: ${params.args[i].aliases.join('/')} is a required parameter.`);
				}
				// If the argument has been used, requires another argument to be used with it, and that hasn't been used, throw an error
				if (params.args[i].aliases.some(v => used.indexOf(v) >= 0)
					&& params.args[i].required.requires
					&& !params.args[i].required.requires.some(v => used.indexOf(v) >= 0)) {
					throw new Error(`Error: ${params.args[i].aliases.join('/')} requires the ${params.args[i].required.requires.join('/')} parameter(s) to also be provided.`);
				}
			} else if (!params.args[i].aliases.some(v => used.indexOf(v) >= 0)) {
				// If the argument hasn't been ran, and there is a default function provided, run it
				if (params.args[i].default && typeof params.args[i].default === 'function') {
					params.args[i].default();
				}
			}
		}
	}

	/**
	 * Process the optional 'after args' function if provided
	 *
	 * @param {Object} params    Params object supplied
	 */
	_processAfterArgs (params) {
		if (params.afterArgs && typeof params.afterArgs === 'function') {
			params.afterArgs();
		}
	}

	/**
	 * Reset the Mocha instance used for the tests
	 *
	 * @param {Object} opts Options to pass through to mocha
	 */
	_resetMocha (opts) {
		this.mocha = new Mocha({
			ui:			args.u || args.ui		|| opts.ui			|| 'bdd',
			timeout:	args.t || args.timeout	|| opts.timeout		|| 2000,
			slow:		args.s || args.slow		|| opts.slow		|| 75,
			reporter:	args.R || args.reporter	|| opts.reporter	|| 'spec',
			grep:		args.g || args.grep		|| opts.grep,
			useColors:!(args.C || args.nocolor	|| opts.useColors)
		});
	}

	/**
	 * Loops through the nested parents of a provided test object and returns the title of the root suite
	 *
	 * @param {Object} test Test object returned from Mocha
	 * @return {String} Title of the root suite the test belongs to
	 */
	_getRootTestTitle (test) {
		if (!test) {
			return null;
		}

		if (!test.parent || test.parent.title === '') {
			return test.title;
		} else {
			return this._getRootTestTitle(test.parent);
		}
	}

	/**
	 * Store the duration of a provided test in the local and total duration stores,
	 * so long as the test has a valid duration.
	 *
	 * @param {Object} test Test to store duration for
	 */
	_setDuration (test) {
		const rootTitle = this._getRootTestTitle(test);
		!this.duration.total && (this.duration.total = 0);
		!this.duration[rootTitle] && (this.duration[rootTitle] = 0);

		test.duration && (this.duration.total += test.duration);
		test.duration && (this.duration[rootTitle] += test.duration);
	}

	/**
	 * Set the provided test data in the local store
	 *
	 * @param {String[]} keys Keys of the local stores to use to store the data in
	 * @param {Object} test Test data to store in the specified stores
	 * @param {Object} [error] Error data to store in the specified stores
	 */
	_setData (keys, test, error) {
		const rootTitle = this._getRootTestTitle(test);
		// For some reason mocha doesn't include the stack trace in the error response, so lets add it
		error && (error.stack = test.err.stack);
		keys.forEach(key => {
			if (key === 'slows' && test.speed && test.speed !== 'slow') {
				return;
			}
			this._addData(key, rootTitle, error ? { test, error } : { test });
		});
	}

	/**
	 * Generic function for adding data to a local object with a specified key
	 *
	 * @param {String} obj Name of the object to add the data to
	 * @param {String} key Key to use for the data to be added
	 * @param {any} data The data to add
	 */
	_addData (obj, key, data) {
		// Check if the object exists already, and if not, define it.
		!this[obj][key] && (this[obj][key] = []);
		this[obj][key].push(data);
	}
};
