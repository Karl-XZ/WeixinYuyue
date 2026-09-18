const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const root = path.join(__dirname, '..', 'project', 'workfit');

test('AdminSetupService covers setup mutations and mini qr generation', async () => {
	let setCalls = [];
	let richEditorCalls = [];
	let uploadCalls = [];
	const AdminSetupService = loadWithMocks(path.join(root, 'service', 'admin', 'admin_setup_service.js'), {
		'./base_project_admin_service.js': class BaseProjectAdminService {
			constructor() { this._timestamp = 99; }
		},
		'../../../../framework/utils/setup/setup_util.js': {
			set: async (...args) => setCalls.push(args),
			get: async key => key === 'rich-key' ? [{ type: 'image', val: 'old.png' }] : null
		},
		'../../../../framework/cloud/cloud_util.js': {
			handlerCloudFilesByRichEditor: async (oldVal, val) => richEditorCalls.push([oldVal, val]),
			getTempFileURLOne: async fileId => `https://temp/${fileId}`
		},
		'../../../../framework/cloud/cloud_base.js': {
			getCloud: () => ({
				openapi: {
					wxacode: {
						getUnlimited: async payload => ({ buffer: Buffer.from(JSON.stringify(payload)) })
					}
				},
				uploadFile: async payload => {
					uploadCalls.push(payload);
					return { fileID: 'file-1' };
				}
			})
		},
		'../../../../config/config.js': {},
		'../../../../framework/lib/md5_lib.js': { md5: value => `md5-${value}` }
	});
	global.PID = 'workfit';
	const service = new AdminSetupService();
	await service.setSetup('plain-key', 'plain-val', 'string');
	await service.setContentSetup('rich-key', [{ type: 'image', val: 'new.png' }], 'content');
	await service.setContentSetup('empty-key', [{ type: 'text', val: 'v' }], 'content');
	assert.equal(await service.genMiniQr('/pages/home/index', 'scene-x'), 'https://temp/file-1?rd=99');

	const UploadlessService = loadWithMocks(path.join(root, 'service', 'admin', 'admin_setup_service.js'), {
		'./base_project_admin_service.js': class BaseProjectAdminService {
			constructor() { this._timestamp = 1; }
		},
		'../../../../framework/utils/setup/setup_util.js': { set: async () => {}, get: async () => null },
		'../../../../framework/cloud/cloud_util.js': { handlerCloudFilesByRichEditor: async () => {}, getTempFileURLOne: async () => 'x' },
		'../../../../framework/cloud/cloud_base.js': {
			getCloud: () => ({
				openapi: { wxacode: { getUnlimited: async () => ({ buffer: Buffer.from('x') }) } },
				uploadFile: async () => ({})
			})
		},
		'../../../../config/config.js': {},
		'../../../../framework/lib/md5_lib.js': { md5: value => value }
	});
	assert.equal(await new UploadlessService().genMiniQr('pages/home/index', 'qr'), undefined);

	assert.equal(setCalls.length, 3);
	assert.equal(richEditorCalls.length, 1);
	assert.ok(uploadCalls[0].cloudPath.includes('workfit/setup/md5-pages/home/index.png'));
});

test('AdminMgrService covers auth, listing and mutation branches', async () => {
	const logs = [];
	let timeCounter = 100;
	const state = {
		admins: [
			{ _id: 'self', ADMIN_NAME: 'selfadmin', ADMIN_PASSWORD: 'md5-oldpass', ADMIN_TYPE: 1, ADMIN_STATUS: 1, ADMIN_LOGIN_CNT: 2, ADMIN_LOGIN_TIME: 0 },
			{ _id: 'mgr-1', ADMIN_NAME: 'mgr1', ADMIN_PASSWORD: 'md5-oldpass', ADMIN_TYPE: 0, ADMIN_STATUS: 1, ADMIN_LOGIN_CNT: 0, ADMIN_LOGIN_TIME: 5 }
		],
		logs: [{ LOG_TYPE: 1, LOG_ADD_TIME: 9 }]
	};

	const clone = item => item ? { ...item } : null;
	const AdminMgrService = loadWithMocks(path.join(root, 'service', 'admin', 'admin_mgr_service.js'), {
		'./base_project_admin_service.js': class BaseProjectAdminService {
			AppError(msg) { throw new Error(msg); }
			insertLog(...args) { logs.push(args); }
			getProjectId() { return 'workfit'; }
			getAdminId() { return 'self'; }
		},
		'../../../../framework/utils/util.js': { isDefined: value => value !== undefined },
		'../../../../framework/utils/data_util.js': { genRandomString: len => `token-${len}` },
		'../../../../framework/utils/time_util.js': {
			time: () => ++timeCounter,
			timestamp2Time: ts => `TIME-${ts}`
		},
		'../../../../framework/platform/model/admin_model.js': {
			getOne: async where => {
				if (where.ADMIN_NAME && where._id && Array.isArray(where._id)) {
					return clone(state.admins.find(item => item.ADMIN_NAME === where.ADMIN_NAME && item._id !== where._id[1]) || null);
				}
				if (where._id) return clone(state.admins.find(item => item._id === where._id) || null);
				if (where.ADMIN_NAME && where.ADMIN_PASSWORD) {
					return clone(state.admins.find(item => item.ADMIN_NAME === where.ADMIN_NAME && item.ADMIN_PASSWORD === where.ADMIN_PASSWORD && item.ADMIN_STATUS === where.ADMIN_STATUS) || null);
				}
				if (where.ADMIN_NAME) return clone(state.admins.find(item => item.ADMIN_NAME === where.ADMIN_NAME) || null);
				return null;
			},
			edit: async (whereOrId, data) => {
				const admin = typeof whereOrId === 'string'
					? state.admins.find(item => item._id === whereOrId)
					: state.admins.find(item => item._id === whereOrId._id);
				Object.assign(admin, data);
			},
			insert: async data => {
				state.admins.push({ _id: 'mgr-new', ...data });
				return 'mgr-new';
			},
			del: async where => {
				state.admins = state.admins.filter(item => item._id !== where._id);
			},
			getList: async (where, fields, orderBy, page, size, isTotal, oldTotal) => ({ where, fields, orderBy, page, size, isTotal, oldTotal, list: state.admins.slice(0, 1).map(clone) })
		},
		'../../../../framework/platform/model/log_model.js': {
			TYPE: { SYS: 1, ADMIN: 2 },
			del: async () => { state.logs = []; },
			getList: async (where, fields, orderBy, page, size) => ({ where, fields, orderBy, page, size, list: [{ LOG_TYPE: 1, LOG_ADD_TIME: 7 }] })
		},
		'../../../../framework/lib/md5_lib.js': { md5: value => `md5-${value}` }
	});
	const service = new AdminMgrService();

	await assert.rejects(() => service.adminLogin(' missing ', 'badpass'));
	const loginRet = await service.adminLogin(' mgr1 ', 'oldpass');
	assert.equal(loginRet.token, 'token-32');
	assert.equal(loginRet.last, 'TIME-5');
	assert.equal(loginRet.cnt, 0);
	assert.equal(state.admins.find(item => item._id === 'mgr-1').ADMIN_LOGIN_CNT, 1);

	await service.clearLog();
	assert.equal(state.logs.length, 0);

	const logSearch = await service.getLogList({ search: 'kw', page: 1, size: 10 });
	assert.ok(logSearch.where.or);
	const logSort = await service.getLogList({ sortType: 'type', sortVal: 3, page: 1, size: 10 });
	assert.equal(logSort.where.LOG_TYPE, 3);

	const mgrSearch = await service.getMgrList({ search: 'kw', page: 1, size: 10 });
	assert.equal(mgrSearch.where.and._pid, 'workfit');
	const mgrStatus = await service.getMgrList({ sortType: 'status', sortVal: 1, page: 1, size: 10 });
	assert.equal(mgrStatus.where.and.ADMIN_STATUS, 1);
	const mgrType = await service.getMgrList({ sortType: 'type', sortVal: 0, page: 1, size: 10 });
	assert.equal(mgrType.where.and.ADMIN_TYPE, 0);

	await assert.rejects(() => service.delMgr('self', 'self'));
	await assert.rejects(() => service.delMgr('none', 'self'));
	await assert.rejects(() => service.delMgr('self', 'other'));
	assert.deepEqual(await service.delMgr('mgr-1', 'self'), { msg: '删除成功' });

	await assert.rejects(() => service.insertMgr({ name: '   ', desc: '', phone: '', password: 'secret1' }));
	await assert.rejects(() => service.insertMgr({ name: 'newone', desc: '', phone: '', password: '123' }));
	await assert.rejects(() => service.insertMgr({ name: 'selfadmin', desc: '', phone: '', password: 'secret1' }));
	assert.deepEqual(await service.insertMgr({ name: ' newone ', desc: ' desc ', phone: ' 13800138000 ', password: 'secret1' }), { id: 'mgr-new', msg: '添加成功' });

	await assert.rejects(() => service.statusMgr('self', 0, 'self'));
	await assert.rejects(() => service.statusMgr('none', 0, 'self'));
	await assert.rejects(() => service.statusMgr('self', 0, 'other'));
	assert.deepEqual(await service.statusMgr('mgr-new', 0, 'self'), { msg: '停用成功' });
	assert.equal(state.admins.find(item => item._id === 'mgr-new').ADMIN_STATUS, 0);

	assert.equal(await service.getMgrDetail('none'), null);
	assert.equal((await service.getMgrDetail('mgr-new'))._id, 'mgr-new');

	await assert.rejects(() => service.editMgr('none', { name: 'x', desc: '', phone: '', password: '' }));
	await assert.rejects(() => service.editMgr('mgr-new', { name: '   ', desc: '', phone: '', password: '' }));
	state.admins.push({ _id: 'other', ADMIN_NAME: 'dupName' });
	await assert.rejects(() => service.editMgr('mgr-new', { name: 'dupName', desc: '', phone: '', password: '' }));
	state.admins = state.admins.filter(item => item._id !== 'other');
	assert.deepEqual(await service.editMgr('mgr-new', { name: ' edited ', desc: ' d ', phone: ' 13900139000 ', password: 'newpass1' }), { msg: '修改成功' });
	assert.equal(state.admins.find(item => item._id === 'mgr-new').ADMIN_PASSWORD, 'md5-newpass1');

	await assert.rejects(() => service.pwdtMgr('mgr-new', '', 'newpass1'));
	await assert.rejects(() => service.pwdtMgr('mgr-new', 'oldpass', '123'));
	await assert.rejects(() => service.pwdtMgr('none', 'oldpass', 'newpass1'));
	await assert.rejects(() => service.pwdtMgr('mgr-new', 'badold', 'newpass1'));
	state.admins.find(item => item._id === 'mgr-new').ADMIN_PASSWORD = 'md5-oldpass2';
	assert.deepEqual(await service.pwdtMgr('mgr-new', 'oldpass2', 'newpass2'), { msg: '密码修改成功' });
	assert.equal(state.admins.find(item => item._id === 'mgr-new').ADMIN_PASSWORD, 'md5-newpass2');
	assert.ok(logs.length > 0);
});

test('AdminNewsService covers CRUD, formatting and recommendation branches', async () => {
	let timeCounter = 200;
	const state = {
		items: [
			{ _id: 'news-1', NEWS_TITLE: '旧公告', NEWS_CATE_ID: 'c1', NEWS_VOUCH: 0, NEWS_STATUS: 1, NEWS_FORMS: [] }
		]
	};
	const AdminNewsService = loadWithMocks(path.join(root, 'service', 'admin', 'admin_news_service.js'), {
		'./base_project_admin_service.js': class BaseProjectAdminService {
			AppError(msg) { throw new Error(msg); }
			getProjectId() { return 'workfit'; }
			fmtOrderBySort(sortVal, fallbackKey) { return { [fallbackKey]: sortVal }; }
			async genDetailQr(type, id) { return id === 'news-qr' ? 'qr-url' : ''; }
		},
		'../admin/admin_home_service.js': class AdminHomeService {},
		'../../../../framework/utils/data_util.js': {},
		'../../../../framework/utils/util.js': { isDefined: value => value !== undefined },
		'../../../../framework/utils/time_util.js': { time: () => ++timeCounter },
		'../../../../framework/cloud/cloud_util.js': {},
		'../../model/news_model.js': {
			getOne: async where => state.items.find(item => item._id === where._id) || null,
			insert: async data => {
				const id = `news-${state.items.length + 1}`;
				state.items.push({ _id: id, ...data });
				return id;
			},
			del: async where => { state.items = state.items.filter(item => item._id !== where._id); },
			edit: async (where, data) => {
				const item = state.items.find(entry => entry._id === where._id);
				Object.assign(item, data);
			},
			editForms: async (id, formsKey, objKey, forms) => {
				const item = state.items.find(entry => entry._id === id);
				item[formsKey] = forms;
				item[objKey] = { touched: 1 };
			},
			getList: async (where, fields, orderBy, page, size, isTotal, oldTotal) => ({ where, fields, orderBy, page, size, isTotal, oldTotal, list: state.items })
		}
	});
	const service = new AdminNewsService();

	await assert.rejects(() => service.vouchNewsSetup('none', 1));
	state.items.push({ _id: 'news-qr', NEWS_TITLE: '带二维码' });
	assert.deepEqual(await service.vouchNewsSetup('news-qr', 1), { msg: '设置成功' });
	assert.equal(state.items.find(item => item._id === 'news-qr').NEWS_QR, 'qr-url');

	await assert.rejects(() => service.insertNews({ title: ' ', cateId: 'c1' }));
	await assert.rejects(() => service.insertNews({ title: '公告', cateId: '' }));
	const insertRet = await service.insertNews({ title: '公告A', cateId: 'c1', cateName: '公告', order: 1, desc: 'desc', forms: ['f1'] });
	assert.equal(insertRet.msg, '添加成功');

	await assert.rejects(() => service.delNews('none'));
	assert.deepEqual(await service.delNews('news-1'), { msg: '删除成功' });
	assert.equal(await service.getNewsDetail('none'), null);
	assert.equal((await service.getNewsDetail(insertRet.id))._id, insertRet.id);

	await service.updateNewsForms({ id: insertRet.id, hasImageForms: ['img1'] });
	assert.deepEqual(state.items.find(item => item._id === insertRet.id).NEWS_FORMS, ['img1']);

	await assert.rejects(() => service.updateNewsContent({ id: 'none', content: [] }));
	await assert.rejects(() => service.updateNewsContent({ id: insertRet.id, content: 'bad' }));
	const contentRet = await service.updateNewsContent({ id: insertRet.id, content: [{ type: 'image', val: 'a.png' }, { type: 'text', val: 'x' }] });
	assert.deepEqual(contentRet, { urls: ['a.png'], msg: '内容更新成功' });

	await assert.rejects(() => service.updateNewsPic({ id: 'none', imgList: [] }));
	await assert.rejects(() => service.updateNewsPic({ id: insertRet.id, imgList: 'bad' }));
	const picRet = await service.updateNewsPic({ id: insertRet.id, imgList: ['a.png'] });
	assert.deepEqual(picRet, { urls: ['a.png'], msg: '图片更新成功' });

	await assert.rejects(() => service.editNews({ id: 'none', title: 'x', cateId: 'c1' }));
	await assert.rejects(() => service.editNews({ id: insertRet.id, title: ' ', cateId: 'c1' }));
	await assert.rejects(() => service.editNews({ id: insertRet.id, title: '公告', cateId: '' }));
	assert.deepEqual(await service.editNews({ id: insertRet.id, title: '改后公告', cateId: 'c2', cateName: '通知', order: 3, desc: 'd2', forms: [] }), { msg: '更新成功' });

	const searchList = await service.getAdminNewsList({ search: '改后', page: 1, size: 10 });
	assert.ok(searchList.where.or);
	const cateList = await service.getAdminNewsList({ sortType: 'cateId', sortVal: 'c2', page: 1, size: 10 });
	assert.equal(cateList.where.and.NEWS_CATE_ID, 'c2');
	const statusList = await service.getAdminNewsList({ sortType: 'status', sortVal: 1, page: 1, size: 10 });
	assert.equal(statusList.where.and.NEWS_STATUS, 1);
	const vouchList = await service.getAdminNewsList({ sortType: 'vouch', sortVal: 1, page: 1, size: 10 });
	assert.equal(vouchList.where.and.NEWS_VOUCH, 1);
	const topList = await service.getAdminNewsList({ sortType: 'top', sortVal: 1, page: 1, size: 10 });
	assert.equal(topList.where.and.NEWS_ORDER, 0);
	const sortList = await service.getAdminNewsList({ sortType: 'sort', sortVal: 'desc', page: 1, size: 10 });
	assert.deepEqual(sortList.orderBy, { NEWS_ADD_TIME: 'desc' });

	await assert.rejects(() => service.statusNews('none', 0));
	assert.deepEqual(await service.statusNews(insertRet.id, 0), { msg: '停用成功' });
	await assert.rejects(() => service.sortNews('none', 5));
	assert.deepEqual(await service.sortNews(insertRet.id, 5), { msg: '排序设置成功' });
	await assert.rejects(() => service.vouchNews('none', 1));
	assert.equal((await service.vouchNews(insertRet.id, 1)).msg.includes('首页'), true);
	assert.equal((await service.vouchNews(insertRet.id, 0)).msg.includes('取消'), true);
});

test('WorkMeetService can be instantiated', async () => {
	const WorkMeetService = loadWithMocks(path.join(root, 'service', 'work', 'work_meet_service.js'), {
		'./base_project_work_service.js': class BaseProjectWorkService {}
	});
	assert.ok(new WorkMeetService() instanceof WorkMeetService);
});
