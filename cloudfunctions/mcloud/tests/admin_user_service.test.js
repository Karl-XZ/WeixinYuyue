const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const modulePath = path.join(__dirname, '..', 'project', 'workfit', 'service', 'admin', 'admin_user_service.js');

function createAdminUserService(overrides = {}) {
	const userModel = {
		getOne: async () => null,
		getList: async () => ({ list: [] }),
		count: async () => 0,
		edit: async () => {},
		del: async () => {},
		getAll: async () => [],
		STATUS_DESC: { 1: '正常' },
		...overrides.userModel
	};
	const joinModel = {
		STATUS: { SUCC: 1 },
		count: async () => 0,
		del: async () => {},
		...overrides.joinModel
	};

	const AdminUserService = loadWithMocks(modulePath, {
		'./base_project_admin_service.js': class BaseProjectAdminService {
			getProjectId() {
				return 'pid-1';
			}
			fmtOrderBySort(sortVal, defaultSort) {
				return { [sortVal.split('|')[0]]: sortVal.split('|')[1], [defaultSort]: 'desc' };
			}
			AppError(msg) {
				throw new Error(msg);
			}
		},
		'../../../../framework/utils/util.js': {
			isDefined: value => value !== undefined && value !== null
		},
		'../../../../framework/utils/export_util.js': {
			getExportDataURL: async key => `url:${key}`,
			deleteDataExcel: async key => `deleted:${key}`,
			exportDataExcel: async (key, data, title) => ({ key, data, title })
		},
		'../../../../framework/utils/time_util.js': {
			time: () => 123456,
			timestamp2Time: value => `time:${value}`
		},
		'../../model/user_model.js': userModel,
		'../../model/join_model.js': joinModel,
		'../../../../framework/lib/md5_lib.js': {
			md5: value => `md5:${value}`
		}
	});

	return {
		AdminUserService,
		userModel,
		joinModel
	};
}

test('AdminUserService getUser and getUserList build expected queries', async () => {
	const calls = [];
	const { AdminUserService } = createAdminUserService({
		userModel: {
			getOne: async (where, fields) => ({ where, fields }),
			getList: async (where, fields, orderBy) => {
				calls.push({ where, fields, orderBy });
				return { list: [], total: 0 };
			}
		}
	});
	const service = new AdminUserService();
	assert.equal(service._normalizeText(null), '');
	assert.equal(service._normalizeText(' 138 '), '138');
	const user = await service.getUser({ userId: 'openid-1', fields: 'USER_NAME' });
	assert.equal(user.where.USER_MINI_OPENID, 'openid-1');

	await service.getUserList({ search: '张三', page: 1, size: 20 });
	assert.equal(calls[0].where.and._pid, 'pid-1');
	assert.equal(calls[0].where.or.length, 3);

	await service.getUserList({ sortType: 'status', sortVal: 8, page: 1, size: 20 });
	assert.equal(calls[1].where.and.USER_STATUS, 8);

	await service.getUserList({ sortType: 'sort', sortVal: 'USER_LOGIN_TIME|asc', page: 1, size: 20 });
	assert.equal(calls[2].orderBy.USER_LOGIN_TIME, 'asc');

	await service.getUserList({ page: 1, size: 20 });
	assert.equal(calls[3].orderBy.USER_ADD_TIME, 'desc');
});

test('AdminUserService status and password update validate record existence', async () => {
	const edits = [];
	const missing = createAdminUserService();
	await assert.rejects(() => new missing.AdminUserService().statusUser('id', 1), /学生不存在/);
	await assert.rejects(() => new missing.AdminUserService().updateUserPassword('id', '123456'), /学生不存在/);

	const success = createAdminUserService({
		userModel: {
			getOne: async () => ({ USER_NAME: '学生A' }),
			edit: async (where, data) => edits.push({ where, data })
		}
	});
	const service = new success.AdminUserService();
	const statusRet = await service.statusUser('openid', 9, '违规');
	assert.match(statusRet.msg, /成功/);
	assert.equal(edits[0].data.USER_CHECK_REASON, '违规');

	const pwdRet = await service.updateUserPassword('openid', '123456');
	assert.equal(pwdRet.msg, '学生密码修改成功');
	assert.equal(edits[1].data.USER_PASSWORD, 'md5:123456');

	const fallback = createAdminUserService({
		userModel: {
			getOne: async () => ({ USER_NAME: '' }),
			edit: async () => {}
		}
	});
	const fallbackRet = await new fallback.AdminUserService().updateUserPassword('openid', '123456');
	assert.equal(fallbackRet.name, '');
});

test('AdminUserService delete user enforces outstanding appointment rule', async () => {
	const deleted = [];
	const missing = createAdminUserService();
	await assert.rejects(() => new missing.AdminUserService().delUser('id'), /学生不存在/);

	const blocked = createAdminUserService({
		userModel: {
			getOne: async () => ({ USER_MINI_OPENID: 'openid' })
		},
		joinModel: {
			STATUS: { SUCC: 1 },
			count: async () => 2
		}
	});
	await assert.rejects(() => new blocked.AdminUserService().delUser('openid'), /还有预约记录/);

	const success = createAdminUserService({
		userModel: {
			getOne: async () => ({ USER_MINI_OPENID: 'openid' }),
			del: async where => deleted.push({ model: 'user', where })
		},
		joinModel: {
			STATUS: { SUCC: 1 },
			count: async () => 0,
			del: async where => deleted.push({ model: 'join', where })
		}
	});
	const ret = await new success.AdminUserService().delUser('openid');
	assert.equal(ret.msg, '删除成功');
	assert.equal(deleted.length, 2);
});

test('AdminUserService export helpers return expected values', async () => {
	const empty = createAdminUserService();
	const service = new empty.AdminUserService();
	assert.equal(await service.getUserDataURL(), 'url:EXPORT_USER_DATA');
	assert.equal(await service.deleteUserDataExcel(), 'deleted:EXPORT_USER_DATA');

	await assert.rejects(() => service.exportUserDataExcel('%E0%A4%A', null), /没有数据可导出/);

	const success = createAdminUserService({
		userModel: {
			getAll: async () => ([
				{
					USER_NAME: '学生A',
					USER_MOBILE: '13800138000',
					USER_STATUS: 1,
					USER_LOGIN_CNT: 3,
					USER_LOGIN_TIME: 200,
					USER_ADD_TIME: 100,
					USER_FORMS: [{ title: '学院', val: '计算机' }]
				},
				{
					USER_NAME: '',
					USER_MOBILE: '',
					USER_STATUS: 999,
					USER_LOGIN_CNT: 0,
					USER_LOGIN_TIME: 0,
					USER_ADD_TIME: 0,
					USER_FORMS: [{ title: '备注', val: '' }]
				}
			]),
			STATUS_DESC: { 1: '正常' }
		}
	});
	const ret = await new success.AdminUserService().exportUserDataExcel(encodeURIComponent(JSON.stringify({ a: 1 })));
	assert.equal(ret.key, 'EXPORT_USER_DATA');
	assert.equal(ret.data[0]['学生名称'], '学生A');
	assert.equal(ret.data[0]['学院'], '计算机');
	assert.equal(ret.data[1]['学生名称'], '');
	assert.equal(ret.data[1]['状态'], '未知');
	assert.equal(ret.data[1]['最近登录'], '');

	const fallbackStatus = createAdminUserService({
		userModel: {
			getOne: async () => ({ USER_NAME: '学生B' }),
			edit: async () => {}
		}
	});
	const fallbackStatusRet = await new fallbackStatus.AdminUserService().statusUser('openid', 999);
	assert.match(fallbackStatusRet.msg, /未知状态/);
});
