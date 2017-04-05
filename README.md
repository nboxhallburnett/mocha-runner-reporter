mocha-runner-reporter
===========
- [Description](#description)
- [Usage](#usage)
- [Structure](#structure)
  + [Constructor parameters](#constructor-parameters)
  + [Email Reporter data](#email-reporter-data)
- [Report Generation](#report-generation)

### Description ###

test-runner is a util which lets you easily run a set of mocha tests programatically, and report the results.

The test runner automatically generates `-h | --help` parameter helper outputs using the data provided during setup. The generated help output displays each available argument that can be used with the test suite, along with any provided typing and description for the options, as well as provided usage descriptions or notes.

Test runs return a Promise containing the results to allow you to easily perform custom reporting alongside (or instead of) the built in reporting tool.

Also included is a Promise-based wrapper around [nodemailer](https://www.npmjs.com/package/nodemailer), which allows for simplified setup and use for sending email reports for completed test runs.

### Usage ###

```
> node run.js --your arguments --go --here
```

```javascript
const Runner = require('mocha-runner-reporter');
const Reporter = Runner.Reporter; // Optional

const params = {...};     // See Structure
const reportData = {...}; // See Structure

const runner = new Runner(test-files, ignored-files, params);

runner.run()
    .then(results => {
        // Optional custom reporting using the raw data
        const report = runner.generateReport(params.title, results);

        // Optional reporting using the generated report
        const reporter = new Reporter(reportData.provider, reportData.email, reportData.password, reportData.alias);
        return reporter.sendEmail(reportData.recipients, reportData.subject, report);
    })
    ...
```


### Structure ###

This section covers the structure of the required data for the runner and reporter.

#### Constructor parameters

The test runner's constructor takes the following parameters object format

```javascript
const params = {
    title: 'Example title',             // Title of the test suite
    usage: 'node example [options]'     // [Optional] Instructions for the usage of the suite
    description: 'Example description', // [Optional] Description of the test suite
    notes: ['note1', 'note2'],          // [Optional] Notes about the test suite
    args: [                             // Array of arguments the test suite takes
        {
            aliases: ['example'],       // Array of aliases the arg takes
            description: 'example',     // Description of the argument
            type: 'string',             // [Optional] Type of data the argument takes
            required: (true || {}),     // [Optional] Specify whether an argument is required
            hidden: true,               // [Optional] Hide the parameter from the help output
            function: value => {        // Function to perform using the provided data
                doSomething(value);
            },
            default: () => {            // [Optional] Function to fun if the argument is not provided
                defaultTheData();
            }
        }
    ],
    mochaOpts: {                        // [Optional] Mocha options to pass through (overridden by supplied arguments)
        timeout: 20000,
        ui: 'tdd'
    },
    afterArgs: () => {}                 // [Optional] Function to perform after processing arguments
};
```
For example:
```javascript
const params = {
    title: 'Test Runner Tester',
    usage: 'node runner [suite/test] [options]',
    description: 'Tests the thing which tests the tests.',
    notes: [
        'Foo bar baz',
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco'
    ],
    args: [
        {
            aliases: ['run', 'runner'],
            description: 'Does a thing',
            type: 'string',
            required: {
                requires: ['r', 'report']
            }
            function: value => {
                config.option = value;
            }
        },
        {
            aliases: ['n', 'num', 'number'],
            description: 'Does a different thing',
            type: 'number',
            required: true,
            function: value => {
                if (value === something) {
                    doSomething();
                } else {
                    doSomethingElse();
                }
            }
        },
        {
            aliases: ['r', 'report'],
            description: 'Send an email report from the test run to the provided email addresses (comma separated list)',
            type: 'string[]',
            function: value => {
                reportData.recipients = value.split(',');
            },
            default: () => {
                reportData.recipients = 'test@example.com';
            }
        }
    ],
    afterArgs: () => {
        if (!config.option && config.somethingFromAnArg !== 'something') {
            // More Validation
        }
	}
};
```
Which generates a helper output for the test suite

```
> node run.js -h

┌────────────────────┐
│                    │
│ Test Runner Tester │
│                    │
└────────────────────┘


Description:

   Tests the thing which tests the tests.


Usage:

   node runner [suite/test] [options]


Options:

   --run, --runner {string}        Does a thing - Requires -r/--report
   -n, --num, --number {number}    Does a different thing - Required
   -r, --report {string[]}         Send an email report from the test run to the provided email addresses (comma separated list)
   -t, --timeout {number}          Time in milliseconds to wait before a test is counted as failing (Defaults to 300000)
   -s, --slow {number}             Time in milliseconds to wait before a test is counted as slow (Defaults to 10000)
   -R, --reporter {string}         Mocha reporter to use (Defaults to spec)


Notes:

   Foo bar baz

   Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore
   et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco
```
#### Email Reporter data

The test runner also includes an optional promise based wrapper around nodemailer, which also simplifies the setup and sending of emails.
To use the reporter, you need to have the following data (not required to be in an object as per the [usage](#usage) section)

```javascript
const reportData = {
    provider: 'gmail',            // See here for supported providers - https://github.com/nodemailer/nodemailer-wellknown#supported-services
    email: 'exmaple@gmail.com',   // The email address to send from
    password: '<password>',       // Password for the above email address
    alias: 'Test Reporter',       // [Optional] Alias to use for the sent email
    recipients: [],               // Array of recipients to use for the sent report
    subject: 'Test Results'       // Subject to use for the email
};
```

### Report Generation ###

The runner will also let you generate a report from the data gathered during the test run. The report can be generated by using the `.generateReport()` function of the runner.

```javascript
runner.run().then(results => {
    const report = runner.generateReport(params.title, results);
    console.log(report);
});
```

```
/********************\

  Test Runner Tester
     Test Results

\********************/

Overview:
- Test Suites Ran : 2
- Total Passes    : 8 (72.72%)
- Total Failures  : 3 (27.27%)
- Total Skipped   : 0 (0%)
- Total Duration  : 1m25s
- Start Time      : Mon Sep 19 2016 10:08:06 GMT+0100 (BST)

‖==============================
‖ Example Test
‖==============================

- File       : /path/to/some/file.js
- Passes     : 0 (0%)
- Failures   : 1 (100%)
- Skipped    : 0 (0%)
- Duration   : 0ms

|--------------------
| Failures:
|--------------------

Failure 1:

Name     : "before all" hook: Early failure
Duration : NaN
Error    : RuntimeError
     (UnknownError:13) An unknown server-side error occurred while processing the command.
     Problem: unknown error: cannot determine loading statusfrom disconnected: received Inspector.detached event

     Callstack:
     -> url("https://test.example.com")


     at /path/to/some/file.js:12:34
     at ...

=============================================

‖==============================
‖ Another Example Test
‖==============================

- File       : /path/to/other/file.js
- Passes     : 8 (80%)
- Failures   : 2 (20%)
- Skipped    : 0 (0%)
- Duration   : 1m25s

|--------------------
| Failures:
|--------------------

Failure 1:

Name     : should fail
Duration : 832ms
Error    : expected 'Something' to equal 'Something Else'

     at /path/to/other/file.js:12:34
     at ...

------------------------------

Failure 2:

Name     : should also fail
Duration : 4s 652ms
Error    : RuntimeError
     (NoSuchWindow:23) A request to switch to a different window could not be satisfied because the window could not be found.
     Problem: no such window: target window already closed from unknown error: web view not found

     Callstack:
     -> url("https://test.example.com/profile")

     at /path/to/other/file.js:56:10
     at ...

=============================================
```
