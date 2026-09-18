/**
 * Notes: passport模块控制器
 * Date: 2021-03-15 19:20:00
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 */

const BaseProjectController = require('./base_project_controller.js');
const PassportService = require('../service/passport_service.js');
const contentCheck = require('../../../framework/validate/content_check.js');

class PassportController extends BaseProjectController {

	/** 取得我的学生信息 */
	async getMyDetail() {
		let service = new PassportService();
		return await service.getMyDetail(this._userId);
	}

	/** 获取手机号 */
	async getPhone() {
		let rules = {
			cloudID: 'must|string|min:1|max:200|name=cloudID',
		};
		let input = this.validateData(rules);

		let service = new PassportService();
		return await service.getPhone(input.cloudID);
	}

	/** 注册 */
	async register() {
		let rules = {
			name: 'must|string|min:1|max:30|name=昵称',
			mobile: 'must|mobile|name=手机',
			forms: 'array|name=表单',
			status: 'int|default=1'
		};
		let input = this.validateData(rules);

		await contentCheck.checkTextMultiClient(input);

		let service = new PassportService();
		return await service.register(this._userId, input);
	}

	/** 修改学生资料 */
	async editBase() {
		let rules = {
			name: 'must|string|min:1|max:30|name=昵称',
			mobile: 'must|mobile|name=手机',
			forms: 'array|name=表单',
		};
		let input = this.validateData(rules);

		await contentCheck.checkTextMultiClient(input);

		let service = new PassportService();
		return await service.editBase(this._userId, input);
	}

	/** 修改学生密码 */
	async pwd() {
		let rules = {
			oldPassword: 'string|min:0|max:30|name=旧密码',
			password: 'must|string|min:6|max:30|name=新密码',
			password2: 'must|string|min:6|max:30|name=新密码再次填写',
		};
		let input = this.validateData(rules);
		if (input.password !== input.password2) {
			this.AppError('两次输入的新密码不一致');
		}

		let service = new PassportService();
		return await service.pwd(this._userId, input.oldPassword, input.password);
	}

	/** 登录 */
	async login() {
		let rules = {};
		this.validateData(rules);

		let service = new PassportService();
		return await service.login(this._userId);
	}
}

module.exports = PassportController;
