const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const modulePath = path.join(__dirname, '..', 'project', 'workfit', 'service', 'passport_service.js');

function createPassportService(overrides = {}) {
	const userModel = {
		STATUS: {
			UNCHECK: 0,
			UNUSE: 8
		},
		count: async () => 0,
		insert: async () => {},
		getOne: async () => null,
		edit: async () => {},
		inc: async () => {},
		...overrides.userModel
	};

	const PassportService = loadWithMocks(modulePath, {
		'./base_project_service.js': class BaseProjectService {
			constructor() {
				this._timestamp = 1000;
			}
			AppError(msg) {
				throw new Error(msg);
			}
		},
		'../../../framework/cloud/cloud_base.js': {
			getCloud: () => ({
				getOpenData: async () => ({ list: [] })
			})
		},
		'../model/user_model.js': userModel,
		'../../../framework/utils/data_util.js': {
			dbForms2Obj: forms => ({ fieldCount: forms.length })
		},
		'../../../framework/lib/md5_lib.js': {
			md5: value => `md5:${value}`
		},
		...overrides.mocks
	});

	return {
		PassportService,
		userModel
	};
}

test('PassportService register handles existing openid, duplicate mobile and success', async () => {
	const countCalls = [];
	const insertCalls = [];
	const { PassportService } = createPassportService({
		userModel: {
			count: async where => {
				countCalls.push(where);
				return countCalls.length === 1 ? 1 : 0;
			},
			insert: async data => insertCalls.push(data)
		}
	});
	const service = new PassportService();
	service.login = async userId => ({ token: userId });
	assert.deepEqual(await service.register('openid-1', { mobile: '1', name: 'a', forms: [], status: 1 }), { token: 'openid-1' });
	assert.equal(insertCalls.length, 0);

	const duplicate = createPassportService({
		userModel: {
			count: async where => (where.USER_MINI_OPENID ? 0 : 1)
		}
	});
	const duplicateService = new duplicate.PassportService();
	await assert.rejects(() => duplicateService.register('openid-2', { mobile: '2', name: 'b', forms: [], status: 1 }), /该手机已注册/);

	const success = createPassportService({
		userModel: {
			count: async () => 0,
			insert: async data => insertCalls.push(data)
		}
	});
	const successService = new success.PassportService();
	successService.login = async userId => ({ token: userId });
	const ret = await successService.register('openid-3', { mobile: '3', name: 'c', forms: [{ a: 1 }], status: '1' });
	assert.deepEqual(ret, { token: 'openid-3' });
	assert.equal(insertCalls[0].USER_MINI_OPENID, 'openid-3');
	assert.equal(insertCalls[0].USER_OBJ.fieldCount, 1);
	assert.equal(insertCalls[0].USER_STATUS, 1);
});

test('PassportService getPhone and getMyDetail normalize outputs', async () => {
	const { PassportService } = createPassportService({
		mocks: {
			'../../../framework/cloud/cloud_base.js': {
				getCloud: () => ({
					getOpenData: async () => ({ list: [{ data: { phoneNumber: '13800138000' } }] })
				})
			}
		},
		userModel: {
			getOne: async () => ({
				USER_NAME: '学生',
				USER_PASSWORD: 'hash'
			})
		}
	});
	const service = new PassportService();
	assert.equal(await service.getPhone('cloud-id'), '13800138000');
	const detail = await service.getMyDetail('openid');
	assert.equal(detail.USER_HAS_PASSWORD, true);
	assert.equal(detail.USER_PASSWORD, undefined);
	assert.equal(service._normalizeText(null), '');
	assert.equal(service._normalizeText('  abc  '), 'abc');

	const empty = createPassportService();
	const emptyService = new empty.PassportService();
	assert.equal(await emptyService.getMyDetail('missing'), null);

	const noPhone = createPassportService({
		mocks: {
			'../../../framework/cloud/cloud_base.js': {
				getCloud: () => ({
					getOpenData: async () => ({ list: [] })
				})
			}
		}
	});
	assert.equal(await new noPhone.PassportService().getPhone('cloud-id'), '');
});

test('PassportService editBase validates duplicates and updates status when pending', async () => {
	const editCalls = [];
	const duplicate = createPassportService({
		userModel: {
			count: async () => 1
		}
	});
	await assert.rejects(() => new duplicate.PassportService().editBase('openid', { mobile: '1', name: 'n', forms: [] }), /该手机已注册/);

	const missing = createPassportService({
		userModel: {
			count: async () => 0,
			getOne: async () => null,
			edit: async data => editCalls.push(data)
		}
	});
	assert.equal(await new missing.PassportService().editBase('openid', { mobile: '1', name: 'n', forms: [] }), undefined);
	assert.equal(editCalls.length, 0);

	const pending = createPassportService({
		userModel: {
			count: async () => 0,
			getOne: async () => ({ USER_STATUS: 0 }),
			edit: async (where, data) => editCalls.push({ where, data })
		}
	});
	await new pending.PassportService().editBase('openid', { mobile: '138', name: '学生', forms: [{ x: 1 }] });
	assert.equal(editCalls[0].data.USER_STATUS, 8);
	assert.equal(editCalls[0].data.USER_OBJ.fieldCount, 1);
});

test('PassportService pwd supports first set and existing password checks', async () => {
	const editCalls = [];
	const missing = createPassportService();
	await assert.rejects(() => new missing.PassportService().pwd('openid', '', '123456'), /学生不存在/);

	const wrongOld = createPassportService({
		userModel: {
			getOne: async () => ({ USER_PASSWORD: 'md5:old' })
		}
	});
	await assert.rejects(() => new wrongOld.PassportService().pwd('openid', 'bad', '123456'), /旧密码错误/);

	const firstSet = createPassportService({
		userModel: {
			getOne: async () => ({ USER_PASSWORD: '' }),
			edit: async (where, data) => editCalls.push({ where, data })
		}
	});
	const firstSetRet = await new firstSet.PassportService().pwd('openid', '', '123456');
	assert.equal(firstSetRet.msg, '密码设置成功');

	const changed = createPassportService({
		userModel: {
			getOne: async () => ({ USER_PASSWORD: 'md5:old' }),
			edit: async (where, data) => editCalls.push({ where, data })
		}
	});
	const changedRet = await new changed.PassportService().pwd('openid', 'old', '654321');
	assert.equal(changedRet.msg, '密码修改成功');
	assert.equal(editCalls.at(-1).data.USER_PASSWORD, 'md5:654321');
});

test('PassportService login returns token and updates login stats', async () => {
	const edits = [];
	const incs = [];
	const noUser = createPassportService();
	assert.deepEqual(await new noUser.PassportService().login('openid'), { token: null });

	const yesUser = createPassportService({
		userModel: {
			getOne: async () => ({
				USER_ID: 'u1',
				USER_MINI_OPENID: 'openid',
				USER_NAME: '学生A',
				USER_PIC: 'pic.jpg',
				USER_STATUS: 1,
				USER_SUBSCRIBE: 0
			}),
			edit: async (where, data) => edits.push({ where, data }),
			inc: async (where, field, cnt) => incs.push({ where, field, cnt })
		}
	});
	const ret = await new yesUser.PassportService().login('openid');
	assert.equal(ret.token.id, 'openid');
	assert.equal(ret.token.key, 'u1');
	assert.equal(ret.token.name, '学生A');
	assert.equal(edits[0].data.USER_LOGIN_TIME, 1000);
	assert.equal(incs[0].field, 'USER_LOGIN_CNT');
});
