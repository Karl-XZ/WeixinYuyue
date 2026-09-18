const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const modulePath = path.join(__dirname, '..', 'project', 'workfit', 'controller', 'admin', 'admin_user_controller.js');

function createAdminUserController() {
	const serviceCalls = [];
	class MockAdminUserService {
		async getUser(input) {
			serviceCalls.push(['getUser', input]);
			return {
				USER_PASSWORD: 'hash',
				USER_ADD_TIME: 100,
				USER_LOGIN_TIME: 200
			};
		}
		async getUserList(input) {
			serviceCalls.push(['getUserList', input]);
			return {
				list: [
					{ USER_STATUS: 1, USER_PASSWORD: 'hash', USER_ADD_TIME: 100, USER_LOGIN_TIME: 0 }
				]
			};
		}
		async updateUserPassword(id, password) {
			serviceCalls.push(['updateUserPassword', id, password]);
			return { ok: 1 };
		}
		async delUser(id) {
			serviceCalls.push(['delUser', id]);
		}
		async statusUser(id, status, reason) {
			serviceCalls.push(['statusUser', id, status, reason]);
		}
		async deleteUserDataExcel() {
			serviceCalls.push(['deleteUserDataExcel']);
			return { deleted: 1 };
		}
		async getUserDataURL() {
			serviceCalls.push(['getUserDataURL']);
			return 'url';
		}
		async exportUserDataExcel(condition, fields) {
			serviceCalls.push(['exportUserDataExcel', condition, fields]);
			return { exported: 1 };
		}
	}

	const AdminUserController = loadWithMocks(modulePath, {
		'./base_project_admin_controller.js': class BaseProjectAdminController {},
		'../../model/user_model.js': {
			getDesc: () => '正常',
			getOneField: async () => '学生A'
		},
		'../../service/admin/admin_user_service.js': MockAdminUserService,
		'../../../../framework/utils/time_util.js': {
			timestamp2Time: value => `time:${value}`
		}
	});

	return { AdminUserController, serviceCalls };
}

test('AdminUserController transforms detail/list data and forwards service calls', async () => {
	const { AdminUserController, serviceCalls } = createAdminUserController();
	const controller = Object.create(AdminUserController.prototype);
	controller.isAdmin = async () => {};
	controller.validateData = rules => {
		if (rules.page) return { page: 1, size: 20 };
		if (rules.password2) return { id: 'u1', password: '123456', password2: '123456' };
		if (rules.status && rules.reason !== undefined) return { id: 'u1', status: 9, reason: '原因' };
		if (rules.isDel) return { isDel: 1 };
		if (rules.fields) return { condition: 'c1', fields: ['a'] };
		return { id: 'u1' };
	};
	controller.logUser = msg => serviceCalls.push(['logUser', msg]);
	controller.AppError = msg => {
		 throw new Error(msg);
	};

	const detail = await controller.getUserDetail();
	assert.equal(detail.USER_HAS_PASSWORD, true);
	assert.equal(detail.USER_PASSWORD, undefined);
	assert.equal(detail.USER_ADD_TIME, 'time:100');

	const list = await controller.getUserList();
	assert.equal(list.list[0].USER_STATUS_DESC, '正常');
	assert.equal(list.list[0].USER_LOGIN_TIME, '未登录');

	assert.deepEqual(await controller.pwdUser(), { ok: 1 });
	await controller.delUser();
	await controller.statusUser();
	assert.equal(await controller.userDataGet(), 'url');
	assert.deepEqual(await controller.userDataExport(), { exported: 1 });
	assert.deepEqual(await controller.userDataDel(), { deleted: 1 });
	assert.ok(serviceCalls.find(item => item[0] === 'logUser'));
});

test('AdminUserController rejects mismatched passwords', async () => {
	const { AdminUserController } = createAdminUserController();
	const controller = Object.create(AdminUserController.prototype);
	controller.isAdmin = async () => {};
	controller.validateData = () => ({ id: 'u1', password: '123456', password2: '654321' });
	controller.AppError = msg => {
		throw new Error(msg);
	};
	await assert.rejects(() => controller.pwdUser(), /两次输入的新密码不一致/);
});

test('AdminUserController handles empty login times and skip-delete export cleanup branch', async () => {
	const { AdminUserController } = createAdminUserController();
	const controller = Object.create(AdminUserController.prototype);
	let step = 0;
	controller.isAdmin = async () => {};
	controller.validateData = rules => {
		if (rules.page) return { page: 1, size: 20 };
		if (rules.isDel) return { isDel: 0 };
		return { id: 'u1' };
	};
	controller.logUser = () => {
		step++;
	};
	controller.AppError = msg => {
		throw new Error(msg);
	};

	const detail = await controller.getUserDetail();
	assert.equal(detail.USER_LOGIN_TIME, 'time:200');
	const result = await controller.userDataGet();
	assert.equal(result, 'url');
	assert.equal(step, 0);
});

test('AdminUserController formats detail not-login text and list login time text', async () => {
	const serviceCalls = [];
	class MockAdminUserService {
		async getUser() {
			return {
				USER_PASSWORD: '',
				USER_ADD_TIME: 100,
				USER_LOGIN_TIME: 0
			};
		}
		async getUserList() {
			return {
				list: [
					{ USER_STATUS: 1, USER_PASSWORD: '', USER_ADD_TIME: 100, USER_LOGIN_TIME: 300 }
				]
			};
		}
	}

	const Controller = loadWithMocks(modulePath, {
		'./base_project_admin_controller.js': class BaseProjectAdminController {},
		'../../model/user_model.js': {
			getDesc: () => '正常',
			getOneField: async () => ''
		},
		'../../service/admin/admin_user_service.js': MockAdminUserService,
		'../../../../framework/utils/time_util.js': {
			timestamp2Time: value => `time:${value}`
		}
	});
	const controller = Object.create(Controller.prototype);
	controller.isAdmin = async () => {};
	controller.validateData = rules => (rules.page ? { page: 1, size: 20 } : { id: 'u1' });

	const detail = await controller.getUserDetail();
	const list = await controller.getUserList();
	assert.equal(detail.USER_LOGIN_TIME, '未登录');
	assert.equal(list.list[0].USER_LOGIN_TIME, 'time:300');
	assert.equal(serviceCalls.length, 0);
});
