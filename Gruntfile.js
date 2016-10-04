// Add the files you have worked on to the below array
const files = [
	'index.js',
	'lib/*'
];

module.exports = function (grunt) {
// Project configuration.
	grunt.initConfig({
		eslint: {
			options: {
				configFile: '.eslintrc',
				fix: false
			},
			target: files
		}
	});

	// Load grunt plugins for modules
	grunt.loadNpmTasks('grunt-eslint');

	// register tasks
	grunt.registerTask('default', ['eslint']);
};
