/**
 * Notes: 服务者首页管理模块
 * Date: 2023-01-15 07:48:00
 * Ver : CCMiniCloud Framework 2.0.8 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 */

const BaseProjectWorkService = require('./base_project_work_service.js');

const timeUtil = require('../../../../framework/utils/time_util.js');
const dataUtil = require('../../../../framework/utils/data_util.js');
const md5Lib = require('../../../../framework/lib/md5_lib.js');
const setupUtil = require('../../../../framework/utils/setup/setup_util.js');
const config = require('../../../../config/config.js');
const constants = require('../../public/constants.js');
const MailVerifyService = require('../mail_verify_service.js');
const cloudUtil = require('../../../../framework/cloud/cloud_util.js');

const MeetModel = require('../../model/meet_model.js');
const MeetService = require('../../service/meet_service.js');

class WorkHomeService extends BaseProjectWorkService {

	_normalizeText(val) {
		if (val === undefined || val === null) return '';
		return String(val).trim();
	}

	_normalizePhone(phone) {
		return this._normalizeText(phone);
	}

	_normalizeOpenId(openId) {
		let cleanOpenId = this._normalizeText(openId);
		if (cleanOpenId.includes('^^^')) {
			cleanOpenId = cleanOpenId.substring(cleanOpenId.indexOf('^^^') + 3);
		}
		while (cleanOpenId && cleanOpenId[0] !== 'o') {
			cleanOpenId = cleanOpenId.substring(1);
		}
		return cleanOpenId;
	}

	async _listTeacherByPhone(phone, fields = '*', onlyActive = false) {
		const normalizedPhone = this._normalizePhone(phone);
		if (!normalizedPhone) return [];

		const orderBy = {
			MEET_EDIT_TIME: 'desc',
			MEET_ADD_TIME: 'desc'
		};

		const phoneWhere = [{ MEET_PHONE: normalizedPhone }];
		const numericPhone = Number(normalizedPhone);
		if (!Number.isNaN(numericPhone)) {
			phoneWhere.push({ MEET_PHONE: numericPhone });
		}

		let where = { or: phoneWhere };
		if (onlyActive) {
			where = {
				and: { MEET_STATUS: MeetModel.STATUS.COMM },
				or: phoneWhere
			};
		}

		let list = await MeetModel.getAll(where, fields, orderBy);
		if (!list || list.length === 0) {
			where = {
				MEET_PHONE: ['like', normalizedPhone]
			};
			if (onlyActive) {
				where = {
					and: {
						MEET_STATUS: MeetModel.STATUS.COMM,
						MEET_PHONE: ['like', normalizedPhone]
					}
				};
			}
			list = await MeetModel.getAll(where, fields, orderBy);
		}

		if (!Array.isArray(list)) {
			list = [];
		}
		return list.filter(item => this._normalizePhone(item.MEET_PHONE) === normalizedPhone);
	}

	async _getTeacherGatePwd() {
		let pwd = '';
		try {
			pwd = await setupUtil.get(constants.SETUP_WORK_TEACHER_PWD);
		} catch (e) {
			pwd = '';
		}
		if (!pwd) pwd = config.WORK_TEACHER_PWD_DEFAULT;
		return this._normalizeText(pwd);
	}

	async _checkTeacherGatePwd(teacherPwd) {
		let pwd = await this._getTeacherGatePwd();
		if (!teacherPwd || this._normalizeText(teacherPwd) !== pwd) {
			this.AppError('教师密码错误');
		}
	}

	/**
	 * 首页数据归集
	 */
	async workHome(meetId) {
		let meetService = new MeetService();
		let dayList = await meetService.getDaysSet(meetId, timeUtil.time('Y-M-D'));
		let dayCnt = dayList.length;

		return { dayCnt };
	}

	// 登录
	async workLogin(phone, password, openId, teacherPwd) {
		phone = this._normalizePhone(phone);
		await this._checkTeacherGatePwd(teacherPwd);

		let cleanOpenId = this._normalizeOpenId(openId);
		console.log('[workLogin] 原始openId:', openId, ', 清理后:', cleanOpenId);

		const passwordMd5 = md5Lib.md5(password);
		const fields = 'MEET_PHONE,MEET_PASSWORD,MEET_ID,MEET_TITLE,MEET_OBJ,MEET_LOGIN_TIME,MEET_LOGIN_CNT,MEET_EDIT_TIME,MEET_ADD_TIME';
		const meetList = await this._listTeacherByPhone(phone, fields, true);
		const meet = meetList.find(item => String(item.MEET_PASSWORD || '') === passwordMd5);
		if (!meet) {
			this.AppError('该账号不存在或者密码错误');
		}

		if (meetList.length > 1) {
			console.warn('[workLogin] 检测到重复教师手机号记录:', phone, '匹配数量=', meetList.length, '当前使用记录=', meet._id);
		}

		let cnt = Number(meet.MEET_LOGIN_CNT || 0);

		let token = dataUtil.genRandomString(32);
		let tokenTime = timeUtil.time();
		let data = {
			MEET_MINI_OPENID: cleanOpenId,
			MEET_TOKEN: token,
			MEET_TOKEN_TIME: tokenTime,
			MEET_LOGIN_TIME: timeUtil.time(),
			MEET_LOGIN_CNT: cnt + 1
		};
		await MeetModel.edit(meet._id, data);

		let name = meet.MEET_TITLE;
		let id = meet._id;
		let last = (!meet.MEET_LOGIN_TIME) ? '尚未登录' : timeUtil.timestamp2Time(meet.MEET_LOGIN_TIME);
		let pic = '';
		if (meet.MEET_OBJ && meet.MEET_OBJ.cover && meet.MEET_OBJ.cover.length > 0) {
			pic = meet.MEET_OBJ.cover[0];
			if (typeof pic === 'string' && pic.indexOf('cloud://') === 0) {
				pic = await cloudUtil.getTempFileURLOne(pic) || pic;
			}
		}

		return {
			id,
			token,
			name,
			last,
			cnt,
			pic
		};
	}

	// 自助注册（教师端）
	async workRegister({ phone, password, name, email, emailCode }, openId, teacherPwd) {
		phone = this._normalizePhone(phone);
		name = this._normalizeText(name);
		email = this._normalizeText(email);
		await this._checkTeacherGatePwd(teacherPwd);

		const verifySvc = new MailVerifyService();
		await verifySvc.verifyRegisterCode(email, emailCode);

		let existList = await this._listTeacherByPhone(phone, '_id,MEET_STATUS');
		let exist = existList.length > 0 ? existList[0] : null;
		if (exist) {
			// 若账号被停用/关闭，允许重新激活并重置密码完成自助注册
			if (exist.MEET_STATUS != MeetModel.STATUS.COMM) {
				let now = timeUtil.time();
				let data = {
					MEET_ADMIN_ID: 'SELF_REGISTER',
					MEET_TITLE: name || ('教师' + String(phone).substr(-4)),
					MEET_CATE_ID: '1',
					MEET_CATE_NAME: '咨询预约',
					MEET_PHONE: phone,
					MEET_PASSWORD: md5Lib.md5(password),
					MEET_EMAIL: email,
					MEET_EMAIL_VERIFIED: 1,
					MEET_EMAIL_VERIFY_TIME: now,
					MEET_STATUS: MeetModel.STATUS.COMM,
					MEET_EDIT_TIME: now,
				};
				await MeetModel.edit(exist._id, data);
				return await this.workLogin(phone, password, openId, teacherPwd);
			}
			this.AppError('该手机号已注册，请直接登录');
		}

		let now = timeUtil.time();
		let data = {
			MEET_ADMIN_ID: 'SELF_REGISTER',
			MEET_TITLE: name || ('教师' + String(phone).substr(-4)),
			MEET_CATE_ID: '1',
			MEET_CATE_NAME: '咨询预约',
			MEET_PHONE: phone,
			MEET_PASSWORD: md5Lib.md5(password),
			MEET_EMAIL: email,
			MEET_EMAIL_VERIFIED: 1,
			MEET_EMAIL_VERIFY_TIME: now,
			MEET_STATUS: MeetModel.STATUS.COMM,
			MEET_ADD_TIME: now,
			MEET_EDIT_TIME: now,
		};

		try {
			await MeetModel.insert(data);
		} catch (e) {
			let msg = '';
			if (e && e.message) {
				msg = String(e.message);
			}
			if (msg.toLowerCase().includes('duplicate') || msg.includes('唯一') || msg.includes('unique')) {
				this.AppError('该手机号已注册，请直接登录');
			}
			throw e;
		}

		return await this.workLogin(phone, password, openId, teacherPwd);
	}

	/** 修改自身密码 */
		async pwdWork(workId, oldPassword, password) {
			let where = {
				_id: workId,
				MEET_PASSWORD: md5Lib.md5(oldPassword),
			};
		let work = await MeetModel.getOne(where);
		if (!work) {
			this.AppError('旧密码错误');
		}

		let data = {
			MEET_PASSWORD: md5Lib.md5(password),
		};
		return await MeetModel.edit(workId, data);
	}
}

module.exports = WorkHomeService;
