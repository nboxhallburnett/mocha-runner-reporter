const assert = require('assert');

describe('Example tests', function () {

	it('should pass this test', async () => {
		assert.ok(true);
	});

	it('should fail this one', async () => {
		assert.fail(':(');
	});

	// eslint-disable-next-line mocha/no-skipped-tests
	it.skip('should skip this one', async () => {
		assert.fail(':(');
	});

	it('should pass again now', async () => {
		assert.ok(true);
	});

});
