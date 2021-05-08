'use strict';

const nodemailer = require('nodemailer'),
	smtpTransport = require('nodemailer-smtp-transport');

/**
 * Wrapper around nodmailer to send emails as promises
 */
module.exports = class Reporter {

	/**
	 * Initialise a Reporter
	 *
	 * @param {String|Object} provider Provider of the email account to send from (e.g. gmail, hotmail, icloud. see full list at nodemailer-wellknown#supported-services)
	 * @param {String} user Email address to send the result emails from.
	 * @param {String} pass Password for the email address used to send the result emails.
	 * @param {String} [name] Alias name to use for the email address.
	 */
	constructor (provider, user, pass, name) {
		// Only the runner is definitely required, so throw an error if it wasn't supplied
		if (!provider || !user || !pass) {
			throw new Error('Provider, Email, and Password are all required fields');
		}

		// Store provider, email, and alias for later use
		this.provider = provider;
		this.email = user;
		this.name = typeof (name) === 'string' ? name : null;

		this.reporter = nodemailer.createTransport(smtpTransport({
			service: provider,
			secure: true,
			auth: { user, pass }
		}));
	}

	/**
	 * Send an email.
	 *
	 * @param {String|String[]} recipients of email addresses to send the email to
	 * @param {String} subject Subjust to use for the email
	 * @param {String} text Contents to use for the body of the email
	 *
	 * @return {Promise} The state of the email sending attempt.
	 */
	sendEmail (recipients, subject, text) {
		return new Promise((resolve, reject) => {
			// Handle missing parameters
			if (!recipients || (typeof (recipients !== 'string') && !(recipients instanceof Array))) {
				return reject('No recipients provided for the result email');
			}
			if (!text) {
				return reject('No contents provided for result email.');
			}

			// Format the recipients for sending
			if (recipients instanceof Array) {
				recipients = recipients.join(', ');
			}

			// Set the data to be used for the sent email
			const opts = {
				from: this.name ? `${this.name} <${this.email}>` : this.email,
				to: recipients,
				subject,
				text
			};

			// Send the email
			this.reporter.sendMail(opts, (err, response) => {
				if (err) {
					return reject(err);
				}
				return resolve(response);
			});
		});
	}
};
