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
	let millis = ms % 1000;
	ms = (ms - millis) / 1000;
	let secs = ms % 60;
	ms = (ms - secs) / 60;
	let mins = ms % 60;
	let hrs = (ms - mins) / 60;
	return (hrs ? hrs + 'h' : '') + (mins ? mins + 'm' : '') + (secs ? secs + 's ' : '') + (millis && !mins ? millis + 'ms' : '');
};
