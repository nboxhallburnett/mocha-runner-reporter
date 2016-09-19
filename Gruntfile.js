// Add the files you have worked on to the below array
const files = [
	'index.js',
	'lib/*'
];

module.exports = function (grunt) {
// Project configuration.
	grunt.initConfig({
		jscs: {
			options: {
				config: ".jscsrc",
				fix: true,
			},
			src: files
		},
		jshint: {
			files: files,
			options: {
				esversion: 6,
				node: true,
				'-W030': false // Disable warning for `comparison && doSomething()`
			}
		}
	});

	// Load grunt plugins for modules
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks("grunt-jscs");

	// register tasks
	grunt.registerTask('default', ['jshint', 'jscs']);
};
