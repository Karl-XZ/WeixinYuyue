const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const root = path.join(__dirname, '..', 'project', 'workfit');

test('AdminMgrService covers empty-field and login-time branches', async () => {
	let timeCounter = 1;
	const state = {
		admins: [
			{ _id: 'mgr-1', ADMIN_NAME: 'mgr1', ADMIN_PASSWORD: 'md5-pass', ADMIN_TYPE: 0, ADMIN_STATUS: 1, ADMIN_LOGIN_CNT: 0, ADMIN_LOGIN_TIME: 0 }
		]
	};
	const logs = [];
	const AdminMgrService = loadWithMocks(path.join(root, 'service', 'admin', 'admin_mgr_service.js'), {
		'./base_project_admin_service.js': class BaseProjectAdminService {
			AppError(msg) { throw new Error(msg); }
			insertLog(...args) { logs.push(args); }
			getProjectId() { return 'workfit'; }
			getAdminId() { return 'self'; }
		},
		'../../../../framework/utils/util.js': { isDefined: value => value !== undefined },
		'../../../../framework/utils/data_util.js': { genRandomString: () => 'token' },
		'../../../../framework/utils/time_util.js': {
			time: () => ++timeCounter,
			timestamp2Time: ts => `TIME-${ts}`
		},
		'../../../../framework/platform/model/admin_model.js': {
			getOne: async where => {
				if (where._id) return state.admins.find(item => item._id === where._id) || null;
				if (where.ADMIN_NAME && where.ADMIN_PASSWORD) return state.admins.find(item => item.ADMIN_NAME === where.ADMIN_NAME && item.ADMIN_PASSWORD === where.ADMIN_PASSWORD) || null;
				if (where.ADMIN_NAME && Array.isArray(where._id)) return state.admins.find(item => item.ADMIN_NAME === where.ADMIN_NAME && item._id !== where._id[1]) || null;
				if (where.ADMIN_NAME) return state.admins.find(item => item.ADMIN_NAME === where.ADMIN_NAME) || null;
				return null;
			},
			edit: async (whereOrId, data) => {
				const id = typeof whereOrId === 'string' ? whereOrId : whereOrId._id;
				Object.assign(state.admins.find(item => item._id === id), data);
			},
			insert: async data => {
				const id = `mgr-${state.admins.length + 1}`;
				state.admins.push({ _id: id, ...data });
				return id;
			},
			del: async () => {},
			getList: async () => ({ list: [] })
		},
		'../../../../framework/platform/model/log_model.js': { TYPE: { SYS: 1, ADMIN: 2 }, del: async () => {}, getList: async () => ({ list: [] }) },
		'../../../../framework/lib/md5_lib.js': { md5: value => `md5-${value}` }
	});
	const service = new AdminMgrService();

	const firstLogin = await service.adminLogin('mgr1', 'pass');
	assert.equal(firstLogin.last, 'TIME-3');
	assert.ok(logs.length > 0);

	const insertRet = await service.insertMgr({ name: 'mgr2', desc: '', phone: '', password: 'secret1' });
	assert.ok(insertRet.id);
	assert.equal(state.admins.find(item => item._id === insertRet.id).ADMIN_DESC, '');
	assert.equal(state.admins.find(item => item._id === insertRet.id).ADMIN_PHONE, '');
	assert.equal(typeof (await service.statusMgr(insertRet.id, 1, 'self')).msg, 'string');
	assert.equal(typeof (await service.editMgr(insertRet.id, { name: 'mgr2x', desc: '', phone: '', password: '' })).msg, 'string');

	state.admins[0].ADMIN_LOGIN_TIME = 9;
	const secondLogin = await service.adminLogin('mgr1', 'pass');
	assert.equal(secondLogin.last, 'TIME-9');

	const AdminMgrServiceTruthyLast = loadWithMocks(path.join(root, 'service', 'admin', 'admin_mgr_service.js'), {
		'./base_project_admin_service.js': class BaseProjectAdminService {
			AppError(msg) { throw new Error(msg); }
			insertLog() {}
			getProjectId() { return 'workfit'; }
			getAdminId() { return 'self'; }
		},
		'../../../../framework/utils/util.js': { isDefined: value => value !== undefined },
		'../../../../framework/utils/data_util.js': { genRandomString: () => 'token' },
		'../../../../framework/utils/time_util.js': {
			time: () => 99,
			timestamp2Time: ts => `TIME-${ts}`
		},
		'../../../../framework/platform/model/admin_model.js': {
			getOne: async () => ({ _id: 'mgr-9', ADMIN_NAME: 'mgr9', ADMIN_PASSWORD: 'md5-pass', ADMIN_TYPE: 0, ADMIN_STATUS: 1, ADMIN_LOGIN_CNT: 1, ADMIN_LOGIN_TIME: 11 }),
			edit: async () => {},
			insert: async () => 'x',
			del: async () => {},
			getList: async () => ({ list: [] })
		},
		'../../../../framework/platform/model/log_model.js': { TYPE: { SYS: 1, ADMIN: 2 }, del: async () => {}, getList: async () => ({ list: [] }) },
		'../../../../framework/lib/md5_lib.js': { md5: value => `md5-${value}` }
	});
	assert.equal((await new AdminMgrServiceTruthyLast().adminLogin('mgr9', 'pass')).last, 'TIME-11');
});

test('AdminNewsService covers qr and missing-record branches', async () => {
	let timeCounter = 10;
	const items = [{ _id: 'news-1', NEWS_TITLE: 'n1' }];
	let qrEdit = null;
	const AdminNewsService = loadWithMocks(path.join(root, 'service', 'admin', 'admin_news_service.js'), {
		'./base_project_admin_service.js': class BaseProjectAdminService {
			AppError(msg) { throw new Error(msg); }
			getProjectId() { return 'workfit'; }
			fmtOrderBySort(sortVal, key) { return { [key]: sortVal }; }
			async genDetailQr() { return 'qr-news'; }
		},
		'../admin/admin_home_service.js': class AdminHomeService {},
		'../../../../framework/utils/data_util.js': {},
		'../../../../framework/utils/util.js': { isDefined: value => value !== undefined },
		'../../../../framework/utils/time_util.js': { time: () => ++timeCounter },
		'../../../../framework/cloud/cloud_util.js': {},
		'../../model/news_model.js': {
			getOne: async where => items.find(item => item._id === where._id) || null,
			insert: async data => {
				const id = `news-${items.length + 1}`;
				items.push({ _id: id, ...data });
				return id;
			},
			del: async () => {},
			edit: async (where, data) => { qrEdit = { where, data }; },
			editForms: async () => {},
			getList: async () => ({ list: items })
		}
	});
	const service = new AdminNewsService();
	const inserted = await service.insertNews({ title: 'title', cateId: 'c1' });
	assert.equal(inserted.id, 'news-2');
	assert.equal(typeof (await service.vouchNewsSetup('news-1', 1)).msg, 'string');
	assert.equal(typeof (await service.statusNews('news-1', 1)).msg, 'string');
	assert.equal(typeof (await service.statusNews('news-1', 0)).msg, 'string');
	await service.vouchNews('news-1', 1);
	assert.deepEqual(qrEdit, { where: { _id: 'news-1' }, data: { NEWS_QR: 'qr-news' } });
	assert.equal(typeof (await service.sortNews('news-1', 0)).msg, 'string');
	await assert.rejects(() => service.vouchNews('missing', 1));
});

test('AdminMeetService covers optional phone/password/day and status branches', async () => {
	let now = 1;
	const state = {
		meets: [{ _id: 'meet-1', MEET_TITLE: 'A', MEET_STATUS: 1, MEET_VOUCH: 0, MEET_ORDER: 1, MEET_CATE_ID: 'c1', MEET_CATE_NAME: 'cate', MEET_DAYS: [], MEET_FORMS: [], MEET_JOIN_FORMS: [], MEET_EDIT_TIME: 1, MEET_ADD_TIME: 1 }],
		days: [{ _id: 'day-1', DAY_MEET_ID: 'meet-1', day: '2026-06-05', times: [], dayDesc: 'Fri' }],
		joins: [{ _id: 'join-1', JOIN_ID: 'J1', JOIN_CODE: 'code1', JOIN_USER_ID: 'u1', JOIN_MEET_ID: 'meet-1', JOIN_MEET_TITLE: 'A', JOIN_MEET_DAY: '2026-06-05', JOIN_MEET_TIME_MARK: 'm1', JOIN_MEET_TIME_START: '09:00', JOIN_MEET_TIME_END: '10:00', JOIN_FORMS: [{ title: '', val: 'skip' }, { title: 'Name', val: '' }], JOIN_STATUS: 123, JOIN_IS_CHECKIN: 0, JOIN_CHECKIN_TIME: 0, JOIN_ADD_TIME: 5, JOIN_REASON: '' }],
		temps: []
	};
	let editFormsArgs = null;
	let dayInsertCnt = 0;
	const AdminMeetService = loadWithMocks(path.join(root, 'service', 'admin', 'admin_meet_service.js'), {
		'./base_project_admin_service.js': class BaseProjectAdminService {
			AppError(msg) { throw new Error(msg); }
			async genDetailQr() { return ''; }
			getProjectId() { return 'workfit'; }
			getAdminId() { return 'a1'; }
			fmtOrderBySort(sortVal, key) { return { [key]: sortVal }; }
		},
		'../meet_service.js': class MeetService { async getDaysSet() { return []; } },
		'../admin/admin_home_service.js': class AdminHomeService {},
		'../../../../framework/utils/data_util.js': {},
		'../../../../framework/utils/time_util.js': { time: fmt => fmt === 'Y-M-D-h-m-s' ? '2026-06-05-10-00-00' : ++now, timestamp2Time: ts => `TIME-${ts}` },
		'../../../../framework/utils/setup/setup_util.js': {},
		'../../../../framework/utils/util.js': { isDefined: value => value !== undefined },
		'../../../../framework/cloud/cloud_util.js': {},
		'../../../../framework/cloud/cloud_base.js': {},
		'../../../../framework/lib/md5_lib.js': { md5: value => `md5-${value}` },
		'../../model/meet_model.js': {
			STATUS: { COMM: 1, OVER: 9 },
			STATUS_DESC: { 1: 'ok', 9: 'over' },
			getOne: async where => state.meets.find(item => item._id === where._id) || null,
			edit: async (whereOrId, data) => {
				const id = typeof whereOrId === 'string' ? whereOrId : whereOrId._id;
				Object.assign(state.meets.find(item => item._id === id), data);
			},
			insert: async data => {
				const id = `meet-${state.meets.length + 1}`;
				state.meets.push({ _id: id, ...data });
				return id;
			},
			del: async () => {},
			editForms: async (...args) => { editFormsArgs = args; },
			getList: async (where, fields, orderBy) => ({ where, orderBy, list: state.meets })
		},
		'../../model/join_model.js': {
			STATUS: { SUCC: 1, CANCEL: 10, ADMIN_CANCEL: 99 },
			STATUS_DESC: { 1: 'succ', 10: 'cancel', 99: 'admin-cancel' },
			getOne: async where => state.joins.find(item => item._id === where._id) || null,
			getAll: async () => state.joins,
			getList: async (where, fields, orderBy) => ({ where, orderBy, list: state.joins }),
			count: async () => 0,
			edit: async () => {},
			del: async () => {}
		},
		'../../model/day_model.js': {
			getAllBig: async () => state.days,
			getOne: async () => state.days[0],
			edit: async () => {},
			insert: async () => { dayInsertCnt++; },
			del: async () => {}
		},
		'../../model/temp_model.js': { getOne: async () => null, insert: async () => 'temp-1', edit: async () => {}, del: async () => {}, getAll: async () => [] },
		'../../../../framework/utils/export_util.js': {
			getExportDataURL: async () => ({}),
			deleteDataExcel: async () => ({}),
			exportDataExcel: async (key, data, title) => ({ key, data, title })
		}
	});

	const service = new AdminMeetService();
	await service.updateMeetForms({ id: 'meet-1', hasImageForms: [{ title: 'cover', val: 'x' }] });
	assert.deepEqual(editFormsArgs, ['meet-1', 'MEET_FORMS', 'MEET_OBJ', [{ title: 'cover', val: 'x' }]]);
	await service.cancelJoinByTimeMark('meet-1', 'm1', '');

	const insertedNoCreds = await service.insertMeet('admin-1', { title: 'B', cateId: 'c2', cateName: 'cate2', order: 0, cancelSet: 0, daysSet: [], forms: [], joinForms: [] });
	assert.equal(state.meets.find(item => item._id === insertedNoCreds.id).MEET_PHONE, undefined);
	assert.equal(state.meets.find(item => item._id === insertedNoCreds.id).MEET_PASSWORD, undefined);

	const insertedDefaults = await service.insertMeet('admin-1', { title: 'D', cateId: 'c4' });
	assert.equal(state.meets.find(item => item._id === insertedDefaults.id).MEET_CATE_NAME, '');
	assert.deepEqual(state.meets.find(item => item._id === insertedDefaults.id).MEET_FORMS, []);
	assert.deepEqual(state.meets.find(item => item._id === insertedDefaults.id).MEET_JOIN_FORMS, []);

	const insertedWithCreds = await service.insertMeet('admin-1', {
		title: 'C',
		cateId: 'c3',
		cateName: 'cate3',
		order: 2,
		cancelSet: 1,
		daysSet: [{ day: '2026-06-06', times: [], dayDesc: 'Sat' }],
		phone: '18800000000',
		password: 'teacher-pass',
		forms: [],
		joinForms: []
	});
	assert.equal(state.meets.find(item => item._id === insertedWithCreds.id).MEET_PHONE, '18800000000');
	assert.equal(state.meets.find(item => item._id === insertedWithCreds.id).MEET_PASSWORD, 'md5-teacher-pass');
	assert.equal(typeof dayInsertCnt, 'number');

	await service.editMeet({
		id: 'meet-1',
		title: 'A3',
		cateId: 'c1',
		cateName: 'cate',
		order: 3,
		cancelSet: 1,
		daysSet: [{ day: '2026-06-07', times: [], dayDesc: 'Sun' }],
		phone: '19900000000',
		password: 'edit-pass',
		forms: [],
		joinForms: []
	});
	assert.equal(state.meets.find(item => item._id === 'meet-1').MEET_PHONE, '19900000000');
	assert.equal(state.meets.find(item => item._id === 'meet-1').MEET_PASSWORD, 'md5-edit-pass');
	await service.editMeet({ id: 'meet-1', title: 'A4', cateId: 'c1', daysSet: [{ day: '2026-06-08', dayDesc: 'Mon' }] });
	assert.equal(state.meets.find(item => item._id === 'meet-1').MEET_CATE_NAME, '');
	assert.deepEqual(state.meets.find(item => item._id === 'meet-1').MEET_FORMS, []);
	assert.deepEqual(state.meets.find(item => item._id === 'meet-1').MEET_JOIN_FORMS, []);

	const joinStatusWhere = await service.getJoinList({ meetId: 'meet-1', mark: 'm1', sortType: 'status', sortVal: 1, page: 1, size: 10 });
	assert.equal(joinStatusWhere.where.JOIN_STATUS, 1);
	const joinCancelWhere = await service.getJoinList({ meetId: 'meet-1', mark: 'm1', sortType: 'status', sortVal: 1099, page: 1, size: 10 });
	assert.deepEqual(joinCancelWhere.where.JOIN_STATUS, ['in', [10, 99]]);
	const joinCheckinWhere = await service.getJoinList({ meetId: 'meet-1', mark: 'm1', sortType: 'checkin', sortVal: 0, page: 1, size: 10 });
	assert.equal(joinCheckinWhere.where.JOIN_STATUS, 1);
	assert.equal(joinCheckinWhere.where.JOIN_IS_CHECKIN, 0);
	const joinCheckedWhere = await service.getJoinList({ meetId: 'meet-1', mark: 'm1', sortType: 'checkin', sortVal: 1, page: 1, size: 10 });
	assert.equal(joinCheckedWhere.where.JOIN_IS_CHECKIN, 1);

	const adminSearchList = await service.getAdminMeetList({ search: 'A', page: 1, size: 10 });
	assert.ok(adminSearchList.where.MEET_TITLE.$regex.includes('A'));
	const adminPlainList = await service.getAdminMeetList({ page: 1, size: 10 });
	assert.deepEqual(adminPlainList.where, {});
	const adminStatusList = await service.getAdminMeetList({ sortType: 'status', sortVal: 1, page: 1, size: 10 });
	assert.equal(adminStatusList.where.MEET_STATUS, 1);
	const adminCateList = await service.getAdminMeetList({ sortType: 'cateId', sortVal: 'c1', page: 1, size: 10 });
	assert.equal(adminCateList.where.MEET_CATE_ID, 'c1');
	const adminSortList = await service.getAdminMeetList({ sortType: 'sort', sortVal: 'view', page: 1, size: 10 });
	assert.equal(adminSortList.orderBy.MEET_VIEW_CNT, 'desc');

	const exported = await service.exportJoinDataExcel({ meetId: 'meet-1', startDay: '2026-06-01', endDay: '2026-06-30', status: 1 });
	assert.equal(exported.key, 'EXPORT_JOIN_DATA');
	assert.equal(exported.data.length, 1);
	assert.equal(exported.data[0].Name, undefined);
	assert.ok(Object.values(exported.data[0]).includes('code1'));

	assert.match((await service.statusJoin('join-1', 1)).msg, /succ/);
	assert.match((await service.statusJoin('join-1', 404)).msg, /未知状态/);
	assert.match((await service.statusMeet('meet-1', 1)).msg, /ok/);
	assert.match((await service.statusMeet('meet-1', 404)).msg, /未知状态/);
});
