/**
 * Notes: 服务者管理模块业务逻辑
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2022-01-14 07:48:00 
 */

const BaseBiz = require('../../../comm/biz/base_biz.js');
const cloudHelper = require('../../../helper/cloud_helper.js'); 
const cacheHelper = require('../../../helper/cache_helper.js');
const pageHelper = require('../../../helper/page_helper.js');
const constants = require('../../../comm/constants.js');
const setting = require('../../../setting/setting.js');

class WorkBiz extends BaseBiz {

	static _normalizeText(val) {
		if (val === undefined || val === null) return '';
		return String(val).trim();
	}

	static async workLogin(that, phone, pwd, teacherPwd) {
		phone = this._normalizeText(phone);
		teacherPwd = this._normalizeText(teacherPwd);

		if (phone.length != 11) {
			wx.showToast({
				title: '手机号输入错误',
				icon: 'none'
			});
			return;
		}

		if (pwd.length < 5 || pwd.length > 30) {
			wx.showToast({
				title: '密码输入错误(5-30位)',
				icon: 'none'
			});
			return;
		}

		if (!teacherPwd || teacherPwd.length < 1 || teacherPwd.length > 30) {
			wx.showToast({
				title: '请输入教师密码',
				icon: 'none'
			});
			return;
		}

		let params = {
			phone,
			pwd,
			teacherPwd
		};
		let opt = {
			title: '登录中'
		};

		try {
			await cloudHelper.callCloudSumbit('work/login', params, opt).then(async res => {
				if (res && res.data && res.data.name)
					cacheHelper.set(constants.CACHE_WORK, res.data, constants.WORK_TOKEN_EXPIRE);

				wx.reLaunch({
					url: pageHelper.fmtURLByPID('/pages/work/index/home/work_home'),
				});
			});
		} catch (e) {
			console.log(e);
		}

	}


	// 教师自助注册
	static async workRegister(that, name, phone, pwd, teacherPwd, email, emailCode) {
		name = this._normalizeText(name);
		phone = this._normalizeText(phone);
		teacherPwd = this._normalizeText(teacherPwd);
		email = this._normalizeText(email);
		emailCode = this._normalizeText(emailCode);

		if (!name || name.length < 1 || name.length > 30) {
			wx.showToast({ title: '姓名输入错误', icon: 'none' });
			return;
		}
		if (phone.length != 11) {
			wx.showToast({ title: '手机号输入错误', icon: 'none' });
			return;
		}
		if (pwd.length < 5 || pwd.length > 30) {
			wx.showToast({ title: '密码输入错误(5-30位)', icon: 'none' });
			return;
		}
		if (!teacherPwd || teacherPwd.length < 1 || teacherPwd.length > 30) {
			wx.showToast({ title: '请输入教师密码', icon: 'none' });
			return;
		}
		if (!email || email.length < 5 || email.length > 80) {
			wx.showToast({ title: '请输入正确的邮箱', icon: 'none' });
			return;
		}
		if (!emailCode || emailCode.length !== 6) {
			wx.showToast({ title: '请输入6位验证码', icon: 'none' });
			return;
		}

		let params = {
			name,
			phone,
			pwd,
			teacherPwd,
			email,
			emailCode
		};
		let opt = { title: '注册中' };

		try {
			await cloudHelper.callCloudSumbit('work/register', params, opt).then(async res => {
				if (res && res.data && res.data.name)
					cacheHelper.set(constants.CACHE_WORK, res.data, constants.WORK_TOKEN_EXPIRE);

				wx.reLaunch({
					url: pageHelper.fmtURLByPID('/pages/work/index/home/work_home'),
				});
			});
		} catch (e) {
			console.log(e);
		}
	}


	/**
	 * 清空管理员登录
	 */
	static clearWorkToken() {
		cacheHelper.remove(constants.CACHE_WORK);
	}

	/**
	 * 获取管理员信息
	 */
	static getWorkToken() {
		return cacheHelper.get(constants.CACHE_WORK);
	}


	static getWorkName() {
		let work = cacheHelper.get(constants.CACHE_WORK);
		if (!work) return '';
		return work.name;
	} 

	static getWorkId() {
		let token = cacheHelper.get(constants.CACHE_WORK);
		if (!token) return '';
		return token.id || '';
	}


	//  登录状态判定
	static isWork(that) {
		wx.setNavigationBarColor({ //顶部
			backgroundColor: '#1C9399',
			frontColor: '#ffffff',
		});

		if (setting.IS_SUB) wx.hideHomeButton();

		let work = cacheHelper.get(constants.CACHE_WORK);
		if (!work) {
			return wx.showModal({
				title: '',
				content: '登录已过期，请重新登录',
				showCancel: false,
				confirmText: '确定',
				success: res => {
					wx.reLaunch({
						url: pageHelper.fmtURLByPID('/pages/work/index/login/work_login'),
					});
					return false;
				}
			});

		}

		that.setData({
			isWork: true,
		});
		return true;
	}

}


WorkBiz.CHECK_FORM_MGR_PWD = {
	oldPassword: 'formOldPassword|must|string|min:6|max:30|name=旧密码',
	password: 'formPassword|must|string|min:6|max:30|name=新密码',
	password2: 'formPassword2|must|string|min:6|max:30|name=新密码再次填写',
};



module.exports = WorkBiz;
