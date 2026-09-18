const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const modulePath = path.join(__dirname, '..', 'project', 'workfit', 'controller', 'passport_controller.js');

function createPassportController() {
	const calls = [];
	class MockPassportService {
		async getMyDetail(userId) {
			calls.push(['getMyDetail', userId]);
			return { userId };
		}
		async getPhone(cloudID) {
			calls.push(['getPhone', cloudID]);
			return '13800138000';
		}
		async register(userId, input) {
			calls.push(['register', userId, input]);
			return { ok: 1 };
		}
		async editBase(userId, input) {
			calls.push(['editBase', userId, input]);
			return { ok: 2 };
		}
		async pwd(userId, oldPassword, password) {
			calls.push(['pwd', userId, oldPassword, password]);
			return { ok: 3 };
		}
		async login(userId) {
			calls.push(['login', userId]);
			return { token: userId };
		}
	}

	const checked = [];
	const PassportController = loadWithMocks(modulePath, {
		'./base_project_controller.js': class BaseProjectController {},
		'../service/passport_service.js': MockPassportService,
		'../../../framework/validate/content_check.js': {
			checkTextMultiClient: async input => checked.push(input)
		}
	});

	return { PassportController, calls, checked };
}

test('PassportController forwards validated inputs to service methods', async () => {
	const { PassportController, calls, checked } = createPassportController();
	const controller = Object.create(PassportController.prototype);
	controller._userId = 'openid-1';
	controller.validateData = rules => {
		if (rules.cloudID) return { cloudID: 'cid' };
		if (rules.status) return { name: '张三', mobile: '138', forms: [], status: 1 };
		if (Object.prototype.hasOwnProperty.call(rules, 'oldPassword')) return { oldPassword: 'old', password: '123456', password2: '123456' };
		return {};
	};
	controller.AppError = msg => {
		throw new Error(msg);
	};

	assert.deepEqual(await controller.getMyDetail(), { userId: 'openid-1' });
	assert.equal(await controller.getPhone(), '13800138000');
	assert.deepEqual(await controller.register(), { ok: 1 });
	assert.deepEqual(await controller.editBase(), { ok: 2 });
	assert.deepEqual(await controller.pwd(), { ok: 3 });
	assert.deepEqual(await controller.login(), { token: 'openid-1' });
	assert.equal(checked.length, 2);
	assert.equal(calls.length, 6);
});

test('PassportController rejects mismatched new passwords', async () => {
	const { PassportController } = createPassportController();
	const controller = Object.create(PassportController.prototype);
	controller._userId = 'openid-2';
	controller.validateData = () => ({ oldPassword: 'old', password: '123456', password2: '654321' });
	controller.AppError = msg => {
		throw new Error(msg);
	};
	await assert.rejects(() => controller.pwd(), /两次输入的新密码不一致/);
});
