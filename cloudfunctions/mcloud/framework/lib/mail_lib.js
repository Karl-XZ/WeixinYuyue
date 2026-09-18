/**
 * Notes: 邮件发送库
 * Date: 2026-01-16
 */

const nodemailer = require('nodemailer');

let _transporter = null;

function _getTransporter() {
	if (_transporter) return _transporter;

	const host = process.env.SMTP_HOST || 'smtp.163.com';
	const port = Number(process.env.SMTP_PORT || 465);
	const secure = String(process.env.SMTP_SECURE || 'true') === 'true';
	const user = process.env.SMTP_USER || 'your_email@163.com';
	const pass = process.env.SMTP_PASS || 'your_smtp_auth_code_here';

	if (!host || !user || !pass) {
		throw new Error('SMTP env missing: SMTP_HOST/SMTP_USER/SMTP_PASS');
	}

	_transporter = nodemailer.createTransport({
		host,
		port,
		secure,
		auth: { user, pass },
	});

	return _transporter;
}

async function sendMail({ to, subject, text, html }) {
	try {
		console.log('[mail_lib] 开始发送邮件, to:', to, ', subject:', subject);
		const transporter = _getTransporter();
		const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'your_email@163.com';

		const info = await transporter.sendMail({
			from,
			to,
			subject,
			text,
			html,
		});

		console.log('[mail_lib] 邮件发送成功, messageId:', info.messageId);
		return info;
	} catch (error) {
		console.error('[mail_lib] 邮件发送失败:', error);
		console.error('[mail_lib] 错误代码:', error.code);
		console.error('[mail_lib] 错误信息:', error.message);
		throw error;
	}
}

module.exports = { sendMail };
