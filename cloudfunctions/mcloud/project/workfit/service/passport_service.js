/**
 * Notes: passport模块业务逻辑
 * Date: 2020-10-14 07:48:00
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 */

const BaseProjectService = require('./base_project_service.js');
const cloudBase = require('../../../framework/cloud/cloud_base.js');
const UserModel = require('../model/user_model.js');
const dataUtil = require('../../../framework/utils/data_util.js');
const md5Lib = require('../../../framework/lib/md5_lib.js');

class PassportService extends BaseProjectService {

	_normalizeText(value) {
		if (value === undefined || value === null) return '';
		return String(value).trim();
	}

	// 注册
	async register(userId, {
		mobile,
		name,
		forms,
		status
	}) {
		let where = {
			USER_MINI_OPENID: userId
		};
		let cnt = await UserModel.count(where);
		if (cnt > 0) {
			return await this.login(userId);
		}

		where = {
			USER_MOBILE: mobile
		};
		cnt = await UserModel.count(where);
		if (cnt > 0) this.AppError('该手机已注册');

		let data = {
			USER_MINI_OPENID: userId,
			USER_MOBILE: mobile,
			USER_NAME: name,
			USER_OBJ: dataUtil.dbForms2Obj(forms),
			USER_FORMS: forms,
			USER_STATUS: Number(status)
		};
		await UserModel.insert(data);

		return await this.login(userId);
	}

	/** 获取手机号 */
	async getPhone(cloudID) {
		let cloud = cloudBase.getCloud();
		let res = await cloud.getOpenData({
			list: [cloudID],
		});
		if (res && res.list && res.list[0] && res.list[0].data) {
			return res.list[0].data.phoneNumber;
		}
		return '';
	}

	/** 取得我的学生信息 */
	async getMyDetail(userId) {
		let where = {
			USER_MINI_OPENID: userId
		};
		let fields = 'USER_MOBILE,USER_NAME,USER_FORMS,USER_OBJ,USER_STATUS,USER_CHECK_REASON,USER_PASSWORD';
		let user = await UserModel.getOne(where, fields);
		if (!user) return null;

		user.USER_HAS_PASSWORD = !!user.USER_PASSWORD;
		delete user.USER_PASSWORD;
		return user;
	}

	/** 修改学生资料 */
	async editBase(userId, {
		mobile,
		name,
		forms
	}) {
		let whereMobile = {
			USER_MOBILE: mobile,
			USER_MINI_OPENID: ['<>', userId]
		};
		let cnt = await UserModel.count(whereMobile);
		if (cnt > 0) this.AppError('该手机已注册');

		let where = {
			USER_MINI_OPENID: userId
		};

		let user = await UserModel.getOne(where);
		if (!user) return;

		let data = {
			USER_MOBILE: mobile,
			USER_NAME: name,
			USER_OBJ: dataUtil.dbForms2Obj(forms),
			USER_FORMS: forms,
		};

		if (user.USER_STATUS == UserModel.STATUS.UNCHECK) {
			data.USER_STATUS = UserModel.STATUS.UNUSE;
		}

		await UserModel.edit(where, data);
	}

	/** 修改学生密码 */
	async pwd(userId, oldPassword, password) {
		let where = {
			USER_MINI_OPENID: userId
		};
		let user = await UserModel.getOne(where, 'USER_PASSWORD');
		if (!user) {
			this.AppError('学生不存在');
		}

		let oldPwdMd5 = md5Lib.md5(this._normalizeText(oldPassword));
		let hasPassword = !!this._normalizeText(user.USER_PASSWORD);
		if (hasPassword && oldPwdMd5 !== user.USER_PASSWORD) {
			this.AppError('旧密码错误');
		}

		let data = {
			USER_PASSWORD: md5Lib.md5(password),
			USER_EDIT_TIME: this._timestamp
		};
		await UserModel.edit(where, data);

		return {
			msg: hasPassword ? '密码修改成功' : '密码设置成功'
		};
	}

	/** 登录 */
	async login(userId) {
		let where = {
			USER_MINI_OPENID: userId
		};
		let fields = 'USER_ID,USER_MINI_OPENID,USER_NAME,USER_PIC,USER_STATUS,USER_SUBSCRIBE';
		let user = await UserModel.getOne(where, fields);
		let token = {};
		if (user) {
			token.id = user.USER_MINI_OPENID;
			token.key = user.USER_ID;
			token.name = user.USER_NAME;
			token.pic = user.USER_PIC;
			token.status = user.USER_STATUS;

			let dataUpdate = {
				USER_LOGIN_TIME: this._timestamp
			};
			UserModel.edit(where, dataUpdate);
			UserModel.inc(where, 'USER_LOGIN_CNT', 1);
		} else {
			token = null;
		}

		return {
			token
		};
	}
}

module.exports = PassportService;
