/**
 * Notes: 学生控制模块
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2022-01-22 10:20:00
 */

const BaseProjectAdminController = require('./base_project_admin_controller.js');
const UserModel = require('../../model/user_model.js');
const AdminUserService = require('../../service/admin/admin_user_service.js');
const timeUtil = require('../../../../framework/utils/time_util.js');

class AdminUserController extends BaseProjectAdminController {

	/** 学生信息 */
	async getUserDetail() {
		await this.isAdmin();

		let rules = {
			id: 'must|id',
		};
		let input = this.validateData(rules);

		let service = new AdminUserService();
		let user = await service.getUser({
			userId: input.id
		});

		if (user) {
			user.USER_HAS_PASSWORD = !!user.USER_PASSWORD;
			delete user.USER_PASSWORD;
			user.USER_ADD_TIME = timeUtil.timestamp2Time(user.USER_ADD_TIME);
			user.USER_LOGIN_TIME = user.USER_LOGIN_TIME ? timeUtil.timestamp2Time(user.USER_LOGIN_TIME) : '未登录';
		}

		return user;
	}

	/** 学生列表 */
	async getUserList() {
		await this.isAdmin();

		let rules = {
			search: 'string|min:1|max:30|name=搜索条件',
			sortType: 'string|name=搜索类型',
			sortVal: 'name=搜索类型值',
			orderBy: 'object|name=排序',
			whereEx: 'object|name=附加查询条件',
			page: 'must|int|default=1',
			size: 'int',
			isTotal: 'bool',
			oldTotal: 'int',
		};
		let input = this.validateData(rules);

		let service = new AdminUserService();
		let result = await service.getUserList(input);

		let list = result.list;
		for (let k = 0; k < list.length; k++) {
			list[k].USER_STATUS_DESC = UserModel.getDesc('STATUS', list[k].USER_STATUS);
			list[k].USER_HAS_PASSWORD = !!list[k].USER_PASSWORD;
			delete list[k].USER_PASSWORD;
			list[k].USER_ADD_TIME = timeUtil.timestamp2Time(list[k].USER_ADD_TIME);
			list[k].USER_LOGIN_TIME = list[k].USER_LOGIN_TIME ? timeUtil.timestamp2Time(list[k].USER_LOGIN_TIME) : '未登录';
		}
		result.list = list;
		return result;
	}

	/** 修改学生密码 */
	async pwdUser() {
		await this.isAdmin();

		let rules = {
			id: 'must|id',
			password: 'must|string|min:6|max:30|name=新密码',
			password2: 'must|string|min:6|max:30|name=新密码再次填写'
		};
		let input = this.validateData(rules);
		if (input.password !== input.password2) {
			this.AppError('两次输入的新密码不一致');
		}

		let service = new AdminUserService();
		return await service.updateUserPassword(input.id, input.password);
	}

	/** 删除学生 */
	async delUser() {
		await this.isAdmin();

		let rules = {
			id: 'must|id',
		};
		let input = this.validateData(rules);

		let title = await UserModel.getOneField({ USER_MINI_OPENID: input.id }, 'USER_NAME');

		let service = new AdminUserService();
		await service.delUser(input.id);

		if (title) {
			this.logUser('删除了学生「' + title + '」');
		}
	}

	async statusUser() {
		await this.isAdmin();

		let rules = {
			id: 'must|id',
			status: 'must|int',
			reason: 'string'
		};
		let input = this.validateData(rules);

		let service = new AdminUserService();
		await service.statusUser(input.id, input.status, input.reason);
	}

	async userDataGet() {
		await this.isAdmin();

		let rules = {
			isDel: 'int|must',
		};
		let input = this.validateData(rules);

		let service = new AdminUserService();
		if (input.isDel === 1) {
			await service.deleteUserDataExcel();
		}
		return await service.getUserDataURL();
	}

	async userDataExport() {
		await this.isAdmin();

		let rules = {
			condition: 'string|name=导出条件',
			fields: 'array',
		};
		let input = this.validateData(rules);

		let service = new AdminUserService();
		return await service.exportUserDataExcel(input.condition, input.fields);
	}

	async userDataDel() {
		await this.isAdmin();
		this.validateData({});

		let service = new AdminUserService();
		return await service.deleteUserDataExcel();
	}
}

module.exports = AdminUserController;
