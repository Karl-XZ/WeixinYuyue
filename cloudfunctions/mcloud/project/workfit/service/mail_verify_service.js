/**
 * Notes: 邮箱验证码服务
 * Date: 2026-01-16
 */

const BaseProjectService = require('./base_project_service.js');
const timeUtil = require('../../../framework/utils/time_util.js');
const dataUtil = require('../../../framework/utils/data_util.js');
const md5Lib = require('../../../framework/lib/md5_lib.js');
const MailVerifyModel = require('../model/mail_verify_model.js');
const mailLib = require('../../../framework/lib/mail_lib.js');

class MailVerifyService extends BaseProjectService {

	_checkEmail(email) {
		const e = String(email || '').trim();
		const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
		if (!ok) this.AppError('邮箱格式不正确');
		return e;
	}

	async sendRegisterCode(email) {
		email = this._checkEmail(email);

		// 简单限流：同邮箱 60s 内不重复发
		const last = await MailVerifyModel.getOne(
			{ MV_EMAIL: email, MV_SCENE: 'register' },
			'MV_ADD_TIME',
			{ MV_ADD_TIME: 'desc' }
		);
		if (last && (timeUtil.time() - last.MV_ADD_TIME) < 60 * 1000) {
			this.AppError('发送过于频繁，请稍后再试');
		}

		const code = dataUtil.genRandomIntString(6);
		const codeMd5 = md5Lib.md5(code);
		const now = timeUtil.time();
		const expire = now + 30 * 60 * 1000; // 30分钟

		await MailVerifyModel.insert({
			MV_EMAIL: email,
			MV_SCENE: 'register',
			MV_CODE_MD5: codeMd5,
			MV_EXPIRE_TIME: expire,
			MV_USED: 0,
			MV_ADD_TIME: now,
		});

		try {
			await mailLib.sendMail({
				to: email,
				subject: '教师注册邮箱验证码',
				text: `你的验证码是：${code}\n30分钟内有效。如果不是你本人操作，请忽略。`,
			});
		} catch (e) {
			console.error('[sendRegisterCode] sendMail error=', e);
			// 让前端直接看到真实错误原因（比如 EAUTH / ETIMEDOUT）
			this.AppError('邮件发送失败：' + (e && e.message ? e.message : 'unknown'));
		}

		return { ok: 1, expireSeconds: 30 * 60 };
	}

	async verifyRegisterCode(email, code) {
		email = this._checkEmail(email);
		const c = String(code || '').trim();
		if (!/^\d{6}$/.test(c)) this.AppError('验证码格式不正确');

		const now = timeUtil.time();
		const rec = await MailVerifyModel.getOne(
			{
				MV_EMAIL: email,
				MV_SCENE: 'register',
				MV_USED: 0,
				MV_EXPIRE_TIME: ['>=', now]
			},
			'*',
			{ MV_ADD_TIME: 'desc' }
		);

		if (!rec) this.AppError('验证码已过期或不存在');
		if (md5Lib.md5(c) !== rec.MV_CODE_MD5) this.AppError('验证码错误');

		await MailVerifyModel.edit(rec._id, { MV_USED: 1 });
		return { ok: 1 };
	}

}

module.exports = MailVerifyService;
