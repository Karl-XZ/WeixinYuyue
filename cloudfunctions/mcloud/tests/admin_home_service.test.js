const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const modulePath = path.join(__dirname, '..', 'project', 'workfit', 'service', 'admin', 'admin_home_service.js');

function createAdminHomeService(overrides = {}) {
	const meetModel = {
		count: async () => 0,
		edit: async () => {},
		...overrides.meetModel
	};
	const joinModel = {
		count: async () => 0,
		...overrides.joinModel
	};

	const AdminHomeService = loadWithMocks(modulePath, {
		'./base_project_admin_service.js': class BaseProjectAdminService {},
		'../../model/user_model.js': { count: async () => 0, ...overrides.userModel },
		'../../model/meet_model.js': meetModel,
		'../../model/news_model.js': { count: async () => 0, edit: async () => {}, ...overrides.newsModel },
		'../../model/join_model.js': joinModel,
		'../../public/constants.js': { SETUP_HOME_VOUCH_KEY: 'HOME_VOUCH' },
		'../../../../framework/utils/setup/setup_util.js': {
			remove: async () => {},
			get: async () => [],
			set: async (key, value) => ({ key, value }),
			...overrides.setupUtil
		}
	});

	return { AdminHomeService };
}

test('AdminHomeService adminHome returns summary cards', async () => {
	const { AdminHomeService } = createAdminHomeService({
		userModel: { count: async () => 10 },
		newsModel: { count: async () => 3 },
		meetModel: { count: async () => 5 },
		joinModel: { count: async () => 12 }
	});
	const service = new AdminHomeService();
	const result = await service.adminHome();
	assert.equal(result.summary[0].cnt, 10);
	assert.equal(result.summary[1].cnt, 3);
	assert.equal(result.summary[2].cnt, 5);
	assert.equal(result.summary[3].cnt, 12);
	assert.equal(await service.clearUserData('u1'), undefined);
});

test('AdminHomeService vouch helpers clear, update and delete entries', async () => {
	const newsEdits = [];
	const meetEdits = [];
	const setCalls = [];
	let currentList = [{ id: 'n1', ext: '#鏃у€?' }, { id: 'n3', ext: '#淇濈暀' }];
	const { AdminHomeService } = createAdminHomeService({
		newsModel: { count: async () => 0, edit: async (where, data) => newsEdits.push({ where, data }) },
		meetModel: { count: async () => 0, edit: async (where, data) => meetEdits.push({ where, data }) },
		setupUtil: {
			remove: async key => `removed:${key}`,
			get: async () => currentList,
			set: async (key, value, scene) => {
				currentList = value;
				setCalls.push({ key, value, scene });
				return { key, value, scene };
			}
		}
	});
	const service = new AdminHomeService();
	await service.clearVouchData();
	assert.equal(newsEdits.length, 1);
	assert.equal(meetEdits.length, 1);

	await service.updateHomeVouch({ id: 'n1', ext: '鍏憡' });
	assert.equal(setCalls[0].value[0].ext, '#鍏憡');

	await service.updateHomeVouch({ id: 'n2', ext: '' });
	assert.equal(setCalls[1].value[0].id, 'n2');

	currentList = null;
	await service.updateHomeVouch({ id: 'n4', ext: '鏂伴」' });
	assert.equal(setCalls[2].value[0].id, 'n4');

	await service.delHomeVouch('n1');
	assert.equal(setCalls[3].value.find(item => item.id === 'n1'), undefined);
	assert.equal(setCalls[3].value.find(item => item.id === 'n4').id, 'n4');

	const empty = createAdminHomeService({
		setupUtil: {
			get: async () => ({}),
			set: async () => {
				throw new Error('should not call');
			}
		}
	});
	await new empty.AdminHomeService().delHomeVouch('missing');
});
