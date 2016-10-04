'use strict';

/**
 * Converts a time in milliseconds to a readable string
 *
 * @author Isaac Whitfield
 *
 * @param ms			the time in millis to convert
 * @returns {string}	a human readable string
 */
module.exports.msToString = function (ms) {
	const millis = ms % 1000;
	ms = (ms - millis) / 1000;
	const secs = ms % 60;
	ms = (ms - secs) / 60;
	const mins = ms % 60;
	const hrs = (ms - mins) / 60;
	return (hrs ? hrs + 'h' : '') + (mins ? mins + 'm' : '') + (secs ? secs + 's ' : '') + (millis && !mins ? millis + 'ms' : '');
};
