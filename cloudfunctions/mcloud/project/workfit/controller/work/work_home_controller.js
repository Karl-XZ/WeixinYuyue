/**
 * Notes:服务者首页控制器模块
 * Ver : CCMiniCloud Framework 2.0.3 ALL RIGHTS RESERVED BY cclinuX0730 (wechat)
 * Date: 2023-01-16 19:20:00 
 */

const BaseProjectWorkController = require('./base_project_work_controller.js');
const WorkHomeService = require('../../service/work/work_home_service.js');
const MailVerifyService = require('../../service/mail_verify_service.js');

class WorkHomeController extends BaseProjectWorkController {

	// 首页 
	async workHome() {
		await this.isWork();

		// 数据校验
		let rules = {

		};

		// 取得数据
		let input = this.validateData(rules);

		let service = new WorkHomeService();
		return await service.workHome(this._workId);
	}


	// 登录  
	async workLogin() {

		// 数据校验
		let rules = {
			phone: 'string|must|mobile|name=手机',
			pwd: 'string|must|min:6|max:30|name=密码',
			teacherPwd: 'string|must|min:1|max:30|name=教师密码',
		};

		// 取得数据
		let input = this.validateData(rules);

		let service = new WorkHomeService();
		return await service.workLogin(input.phone, input.pwd, this._openId, input.teacherPwd);
	}


	// 教师自助注册（需要输入教师密码）
	async workRegister() {
		let rules = {
			name: 'string|must|min:1|max:30|name=姓名',
			phone: 'string|must|mobile|name=手机',
			pwd: 'string|must|min:6|max:30|name=密码',
			teacherPwd: 'string|must|min:1|max:30|name=教师密码',
			email: 'string|must|min:5|max:80|name=邮箱',
			emailCode: 'string|must|min:6|max:6|name=邮箱验证码',
		};

		let input = this.validateData(rules);

		let service = new WorkHomeService();
		return await service.workRegister({
			phone: input.phone,
			password: input.pwd,
			name: input.name,
			email: input.email,
			emailCode: input.emailCode
		}, this._openId, input.teacherPwd);
	}

	// 发送邮箱验证码
	async emailSendCode() {
		try {
			console.log('[emailSendCode] 开始执行');
			let rules = {
				email: 'string|must|min:5|max:80|name=邮箱'
			};
			let input = this.validateData(rules);
			console.log('[emailSendCode] 邮箱:', input.email);

			let svc = new MailVerifyService();
			let result = await svc.sendRegisterCode(input.email);
			console.log('[emailSendCode] 发送成功');
			return result;
		} catch (e) {
			console.error('[emailSendCode] 错误:', e);
			throw e;
		}
	}


	/** 修改自己的密码 */
	async pwdWork() {
		await this.isWork();

		// 数据校验
		let rules = {
			oldPassword: 'must|string|min:6|max:30|name=旧密码',
			password: 'must|string|min:6|max:30|name=新密码',
			password2: 'must|string|min:6|max:30|name=新密码再次填写',

		};

		// 取得数据
		let input = this.validateData(rules);

		let service = new WorkHomeService();
		await service.pwdWork(this._workId, input.oldPassword, input.password);
	}


}

module.exports = WorkHomeController;