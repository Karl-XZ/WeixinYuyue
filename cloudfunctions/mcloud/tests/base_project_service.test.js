const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const modulePath = path.join(__dirname, '..', 'project', 'workfit', 'service', 'base_project_service.js');

function createBaseProjectService(overrides = {}) {
	const adminCalls = { edit: [], insert: [] };
	const newsInsert = [];
	const meetInsert = [];
	const dbCreates = [];
	const exists = overrides.exists || {};

	const BaseProjectService = loadWithMocks(modulePath, {
		'../../../framework/database/db_util.js': {
			isExistCollection: async name => !!exists[name],
			createCollection: async name => dbCreates.push(name)
		},
		'../../../framework/utils/util.js': {
			getProjectId: () => 'pid-1'
		},
		'../../../framework/platform/model/admin_model.js': {
			getOne: async where => {
				if (where.ADMIN_TYPE === 1) return overrides.superAdmin || null;
				if (where.ADMIN_NAME === 'admin') return overrides.existAdmin || null;
				return null;
			},
			edit: async (id, data) => adminCalls.edit.push({ id, data }),
			insert: async data => adminCalls.insert.push(data)
		},
		'../model/news_model.js': {
			count: async () => overrides.newsCount || 0,
			insert: async data => newsInsert.push(data)
		},
		'../model/meet_model.js': {
			count: async () => overrides.meetCount || 0,
			insert: async data => meetInsert.push(data)
		},
		'../../../framework/platform/service/base_service.js': class BaseService {
			AppError(msg) {
				throw new Error(msg);
			}
		}
	});

	return {
		BaseProjectService,
		adminCalls,
		newsInsert,
		meetInsert,
		dbCreates
	};
}

test('BaseProjectService getProjectId and ensure default super admin branches', async () => {
	const existingSuper = createBaseProjectService({ superAdmin: { _id: 's1' } });
	const service1 = new existingSuper.BaseProjectService();
	assert.equal(service1.getProjectId(), 'pid-1');
	await service1._ensureDefaultSuperAdmin();
	assert.equal(existingSuper.adminCalls.edit.length, 0);

	const existingAdmin = createBaseProjectService({ existAdmin: { _id: 'a1' } });
	await new existingAdmin.BaseProjectService()._ensureDefaultSuperAdmin();
	assert.equal(existingAdmin.adminCalls.edit[0].id, 'a1');

	const insertAdmin = createBaseProjectService();
	await new insertAdmin.BaseProjectService()._ensureDefaultSuperAdmin();
	assert.equal(insertAdmin.adminCalls.insert[0].ADMIN_NAME, 'admin');
});

test('BaseProjectService initSetup handles installed and first-install flows', async () => {
	const installed = createBaseProjectService({
		exists: { bx_setup_workfit: true }
	});
	let ensured = 0;
	const installedService = new installed.BaseProjectService();
	installedService._ensureDefaultSuperAdmin = async () => {
		ensured++;
	};
	await installedService.initSetup();
	assert.equal(ensured, 1);
	assert.equal(installed.dbCreates.length, 0);

	const fresh = createBaseProjectService({
		exists: {
			bx_admin: true,
			bx_news: true,
			bx_meet: true
		},
		newsCount: 0,
		meetCount: 0
	});
	let ensuredFresh = 0;
	const freshService = new fresh.BaseProjectService();
	freshService._ensureDefaultSuperAdmin = async () => {
		ensuredFresh++;
	};
	await freshService.initSetup();
	assert.ok(fresh.dbCreates.includes('bx_setup'));
	assert.ok(fresh.dbCreates.includes('bx_user'));
	assert.equal(ensuredFresh, 1);
	assert.equal(fresh.newsInsert.length, 1);
	assert.equal(fresh.newsInsert[0].NEWS_CATE_NAME, '公告');
	assert.equal(fresh.meetInsert.length, 3);
	assert.equal(fresh.meetInsert[0].MEET_JOIN_FORMS.length, 2);
});
