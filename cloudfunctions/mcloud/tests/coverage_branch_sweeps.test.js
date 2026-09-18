const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const root = path.join(__dirname, '..', 'project', 'workfit');

test('controller timeout and email catch branches are covered', async () => {
	const MeetController = loadWithMocks(path.join(root, 'controller', 'meet_controller.js'), {
		'./base_project_controller.js': class BaseProjectController {
			constructor() { this._userId = 'u1'; }
			validateData(rules) { return rules.joinId ? { joinId: 'j1' } : { page: 1, size: 10, day: '2026-06-05' }; }
		},
		'../service/meet_service.js': class MeetService {
			async getMyJoinList() { return { list: [{ JOIN_MEET_DAY: '2026-06-05', JOIN_COMPLETE_END_TIME: '2026-06-05 20:00', JOIN_STATUS: 1, JOIN_IS_CHECKIN: 1, JOIN_ADD_TIME: 123 }] }; }
			async getMyJoinDetail() { return { JOIN_COMPLETE_END_TIME: '2026-06-05 20:00', JOIN_STATUS: 1, JOIN_IS_CHECKIN: 1, JOIN_ADD_TIME: 456, JOIN_CHECKIN_TIME: 789 }; }
		},
		'../model/join_model.js': { getDesc: () => '成功' },
		'../../../framework/utils/time_util.js': {
			time: () => '2026-06-05 10:00',
			fmtDateCHN: day => day,
			week: () => '周五',
			timestamp2Time: ts => `TIME-${ts}`
		}
	});
	const meetController = new MeetController();
	const listRet = await meetController.getMyJoinList();
	assert.equal(listRet.list[0].isTimeout, 0);
	assert.equal(listRet.list[0].JOIN_ADD_TIME, 'TIME-123');
	const detailRet = await meetController.getMyJoinDetail();
	assert.equal(detailRet.isTimeout, 0);
	assert.equal(detailRet.JOIN_STATUS_DESC, '成功');
	assert.equal(detailRet.JOIN_ADD_TIME, 'TIME-456');
	assert.equal(detailRet.JOIN_CHECKIN_TIME, 'TIME-789');

	const WorkHomeController = loadWithMocks(path.join(root, 'controller', 'work', 'work_home_controller.js'), {
		'./base_project_work_controller.js': class BaseProjectWorkController {
			validateData() { return { email: 'a@test.com' }; }
		},
		'../../service/mail_verify_service.js': class MailVerifyService {
			async sendRegisterCode() { throw new Error('mail failed'); }
		}
	});
	await assert.rejects(() => new WorkHomeController().emailSendCode(), /mail failed/);
});

test('fav/home/mail/news/subscribe branch gaps are covered', async () => {
	const FavService = loadWithMocks(path.join(root, 'service', 'fav_service.js'), {
		'./base_project_service.js': class BaseProjectService {},
		'../../../framework/utils/util.js': { isDefined: v => v !== undefined },
		'../model/fav_model.js': {
			count: async () => 1,
			insert: async () => 'x',
			del: async () => 1,
			getList: async where => ({ where, list: [] })
		}
	});
	assert.deepEqual(await new FavService().updateFav('u', 'o', 't', 'n', '/p', false), { isFav: 1 });

	let setupVal = {};
	const HomeService = loadWithMocks(path.join(root, 'service', 'home_service.js'), {
		'./base_project_service.js': class BaseProjectService {},
		'../../../framework/utils/setup/setup_util.js': { get: async () => setupVal },
		'../public/constants.js': { SETUP_HOME_VOUCH_KEY: 'key' },
		'../model/news_model.js': { getAll: async () => [] },
		'./support/news_image_service.js': class NewsImageService { async formatNews(news) { return news; } getCoverSrc() { return 'x'; } }
	});
	const homeService = new HomeService();
	assert.deepEqual(await homeService.getSetup('k'), {});
	assert.deepEqual(await homeService.getHomeList(), []);

	let now = 100000;
	const MailVerifyService = loadWithMocks(path.join(root, 'service', 'mail_verify_service.js'), {
		'./base_project_service.js': class BaseProjectService { AppError(msg) { throw new Error(msg); } },
		'../../../framework/utils/time_util.js': { time: () => now },
		'../../../framework/utils/data_util.js': { genRandomIntString: () => '123456' },
		'../../../framework/lib/md5_lib.js': { md5: v => `md5-${v}` },
		'../model/mail_verify_model.js': {
			getOne: async where => {
				if (where.MV_USED === 0 && where.MV_EXPIRE_TIME) {
					return { _id: 'mv-1', MV_CODE_MD5: 'md5-123456', MV_EXPIRE_TIME: now + 1000, MV_USED: 0 };
				}
				return null;
			},
			insert: async () => 'mv-1',
			edit: async () => {}
		},
		'../../../framework/lib/mail_lib.js': { sendMail: async () => { throw new Error('EAUTH'); } }
	});
	const mailService = new MailVerifyService();
	await assert.rejects(() => mailService.sendRegisterCode());
	await assert.rejects(() => mailService.sendRegisterCode('a@test.com'), /EAUTH/);
	await assert.rejects(() => mailService.verifyRegisterCode('a@test.com', ''));
	await assert.rejects(() => mailService.verifyRegisterCode('a@test.com', '654321'));

	const NewsService = loadWithMocks(path.join(root, 'service', 'news_service.js'), {
		'./base_project_service.js': class BaseProjectService { getProjectId() { return 'workfit'; } fmtOrderBySort(sortVal, key) { return { [key]: sortVal }; } },
		'../../../framework/utils/util.js': { isDefined: v => v !== undefined },
		'../model/news_model.js': {
			getOne: async where => where._id === 'none' ? null : { _id: 'news-1', NEWS_PIC: [], NEWS_STATUS: 1 },
			getList: async (where, fields, orderBy) => ({ where, orderBy, list: [{ NEWS_PIC: [] }] })
		},
		'./support/news_image_service.js': class NewsImageService { async formatNews(news) { news.touched = 1; return news; } }
	});
	const newsService = new NewsService();
	assert.equal(await newsService.viewNews('none'), null);
	assert.equal((await newsService.viewNews('news-1')).touched, 1);
	assert.equal((await newsService.getNewsList({ search: 'x', page: 1, size: 10 })).where.or.length, 1);
	assert.deepEqual((await newsService.getNewsList({ sortType: 'sort', sortVal: 'desc', page: 1, size: 10 })).orderBy, { NEWS_ADD_TIME: 'desc' });
	assert.equal((await newsService.getNewsList({ cateId: 'c1', sortType: 'cateId', sortVal: 'c2', page: 1, size: 10 })).where.and.NEWS_CATE_ID, 'c2');

	let userEdited = 0;
	let meetEdited = 0;
	const SubscribeService = loadWithMocks(path.join(root, 'service', 'subscribe_service.js'), {
		'./base_project_service.js': class BaseProjectService {},
		'../../../framework/utils/time_util.js': { time: () => 100000 },
		'../../../config/config.js': { SUBSCRIBE_VALID_DAYS: 7 },
		'../model/user_model.js': {
			getOne: async where => where.USER_MINI_OPENID === 'missing' ? null : ({ USER_SUBSCRIBE: {} }),
			edit: async () => { userEdited++; }
		},
		'../model/meet_model.js': {
			STATUS: { COMM: 1 },
			getOne: async where => where._id === 'none' ? null : ({ MEET_SUBSCRIBE: {} }),
			edit: async () => { meetEdited++; }
		}
	});
	assert.deepEqual(SubscribeService.getNeedIds({ a: { valid: 1 } }, ['a']), ['a']);
	assert.deepEqual(SubscribeService.getNeedIds({ a: { valid: 1, time: -999999999 } }, ['a']), ['a']);
	assert.deepEqual(SubscribeService.getNeedIds({ a: { valid: 1, time: 1 } }, ['a']), []);
	assert.deepEqual(SubscribeService.getNeedIds({}, []), []);
	const subscribeService = new SubscribeService();
	assert.deepEqual(await subscribeService.report('openid', [], false), { result: 'ok' });
	assert.deepEqual(await subscribeService.report('openid', ['tpl'], true, ''), { result: 'ok' });
	assert.deepEqual(await subscribeService.report('missing', ['tpl'], false), { result: 'ok' });
	assert.deepEqual(await subscribeService.report('openid', ['tpl'], true, 'none'), { result: 'ok' });
	assert.equal(userEdited, 0);
	assert.equal(meetEdited, 1);
});

test('msg/image/base-admin branch gaps are covered', async () => {
	let sent = [];
	const MsgService = loadWithMocks(path.join(root, 'service', 'msg_service.js'), {
		'./base_project_service.js': class BaseProjectService {},
		'../../../framework/utils/util.js': {},
		'../../../framework/utils/time_util.js': { time: () => 999 },
		'../../../framework/lib/mini_lib.js': { sendMiniOnceTempMsg: async (...args) => { sent.push(args); } },
		'../../../config/config.js': {
			SUBSCRIBE_TPL_STUDENT_APPT_SUCC: '',
			SUBSCRIBE_TPL_STUDENT_APPT_CANCEL: '',
			SUBSCRIBE_TPL_TEACHER_NEW_APPT: ''
		},
		'../model/user_model.js': { getOne: async () => null, edit: async () => {} },
		'../model/meet_model.js': { getOne: async () => null, edit: async () => {} }
	});
	const msgService = new MsgService();
	await msgService.apptSucc('', 't', 'd');
	await msgService.apptSucc('abc123', 't', 'd');
	await msgService.apptCancel('abc123', 't');
	await msgService.teacherNewAppt('', 't');
	await msgService.teacherNewAppt('abc123', 't', '', 1, 'm', '');
	assert.equal(sent.length, 0);

	const MeetImageService = loadWithMocks(path.join(root, 'service', 'support', 'meet_image_service.js'), {});
	const meetImageSvc = new MeetImageService();
	assert.equal(meetImageSvc._getFormValue(null, 'cover'), undefined);
	assert.equal(meetImageSvc._getFormValue([{ mark: 'cover', val: [] }], ''), undefined);
	const display = meetImageSvc.buildDisplayObj(
		{ MEET_OBJ: {}, MEET_FORMS: [{ mark: 'desc', val: '文本' }, { mark: 'cover', val: ['x'] }] },
		{ MEET_OBJ: { desc: '回退', cover: ['y'] }, MEET_FORMS: [] },
		false
	);
	assert.equal(display.desc, '文本');
	assert.equal(display.cover[0], 'x');

	const NewsImageService = loadWithMocks(path.join(root, 'service', 'support', 'news_image_service.js'), {});
	const newsImageSvc = new NewsImageService();
	assert.equal(newsImageSvc.getCoverSrc({ NEWS_PIC: '  /x.jpg  ' }), '/x.jpg');
	assert.equal(newsImageSvc.getCoverSrc({}), '/images/cover.gif');
	assert.deepEqual(await newsImageSvc.replaceCloudImageList(null), []);
	assert.deepEqual(await newsImageSvc.replaceCloudImageList([]), []);

	const BaseProjectAdminService = loadWithMocks(path.join(root, 'service', 'admin', 'base_project_admin_service.js'), {
		'../base_project_service.js': class BaseProjectService {},
		'../../../../framework/cloud/cloud_base.js': { getCloud: () => ({ openapi: { wxacode: { getUnlimited: async () => ({ buffer: Buffer.from('x') }) } }, uploadFile: async () => null }) },
		'../../../../framework/cloud/cloud_util.js': { getTempFileURLOne: async () => 'temp-url' },
		'../../../../framework/lib/md5_lib.js': { md5: v => v }
	});
	assert.equal(await new BaseProjectAdminService().genDetailQr('a', 'b'), undefined);
});

test('work home and admin optional branches are covered', async () => {
	let now = 1;
	let setupThrows = true;
	const state = {
		meets: [
			{ _id: 'm1', MEET_PHONE: '123', MEET_PASSWORD: 'md5-p', MEET_TITLE: 'T', MEET_OBJ: { cover: ['/plain.jpg'] }, MEET_STATUS: 1, MEET_LOGIN_CNT: 0, MEET_LOGIN_TIME: 0 },
			{ _id: 'm2', MEET_PHONE: 123, MEET_PASSWORD: 'md5-p', MEET_TITLE: 'T2', MEET_OBJ: {}, MEET_STATUS: 1, MEET_LOGIN_CNT: 0, MEET_LOGIN_TIME: 0 }
		]
	};
	const WorkHomeService = loadWithMocks(path.join(root, 'service', 'work', 'work_home_service.js'), {
		'./base_project_work_service.js': class BaseProjectWorkService { AppError(msg) { throw new Error(msg); } },
		'../../../../framework/utils/time_util.js': { time: fmt => fmt ? '2026-06-05' : ++now, timestamp2Time: ts => `TIME-${ts}` },
		'../../../../framework/utils/data_util.js': { genRandomString: () => 'tok' },
		'../../../../framework/lib/md5_lib.js': { md5: v => `md5-${v}` },
		'../../../../framework/utils/setup/setup_util.js': { get: async () => { if (setupThrows) throw new Error('x'); return 'gate'; } },
		'../../../../config/config.js': { WORK_TEACHER_PWD_DEFAULT: 'default' },
		'../../public/constants.js': { SETUP_WORK_TEACHER_PWD: 'x' },
		'../mail_verify_service.js': class MailVerifyService { async verifyRegisterCode() {} },
		'../../../../framework/cloud/cloud_util.js': { getTempFileURLOne: async () => null },
		'../../model/meet_model.js': {
			STATUS: { COMM: 1 },
			getAll: async where => {
				if (where.or) return state.meets;
				if (where.and?.MEET_PHONE) return state.meets;
				if (where.MEET_PHONE) return state.meets;
				return [];
			},
			edit: async (id, data) => Object.assign(state.meets.find(item => item._id === id), data),
			insert: async data => { if (data.MEET_PHONE === 'dupe') throw new Error('unique bad'); if (data.MEET_PHONE === 'boom') throw new Error('boom'); },
			getOne: async where => state.meets.find(item => item._id === where._id && item.MEET_PASSWORD === where.MEET_PASSWORD) || null
		},
		'../../service/meet_service.js': class MeetService { async getDaysSet() { return []; } }
	});
	const workService = new WorkHomeService();
	assert.equal(workService._normalizeText(null), '');
	assert.deepEqual(await workService._listTeacherByPhone(''), []);
	assert.equal(await workService._getTeacherGatePwd(), 'default');
	setupThrows = false;
	const login = await workService.workLogin('123', 'p', 'xxxoOpenId', 'gate');
	assert.equal(login.pic, '/plain.jpg');
	await assert.rejects(() => workService.workRegister({ phone: 'dupe', password: 'p', name: '', email: 'a', emailCode: '1' }, 'o', 'gate'));
	await assert.rejects(() => workService.workRegister({ phone: 'boom', password: 'p', name: '', email: 'a', emailCode: '1' }, 'o', 'gate'));

	const AdminMgrService = loadWithMocks(path.join(root, 'service', 'admin', 'admin_mgr_service.js'), {
		'./base_project_admin_service.js': class BaseProjectAdminService { AppError(msg) { throw new Error(msg); } insertLog() {} getAdminId() { return 'self'; } getProjectId() { return 'workfit'; } },
		'../../../../framework/utils/util.js': { isDefined: v => v !== undefined },
		'../../../../framework/utils/data_util.js': { genRandomString: () => 'token' },
		'../../../../framework/utils/time_util.js': { time: () => 1, timestamp2Time: () => 't' },
		'../../../../framework/platform/model/admin_model.js': { getOne: async where => where._id ? { _id: where._id, ADMIN_NAME: 'x', ADMIN_PASSWORD: 'md5-p', ADMIN_STATUS: 1 } : null, edit: async () => {}, insert: async () => 'id', del: async () => {}, getList: async () => ({ list: [] }) },
		'../../../../framework/platform/model/log_model.js': { TYPE: { SYS: 1, ADMIN: 2 }, del: async () => {}, getList: async () => ({ list: [] }) },
		'../../../../framework/lib/md5_lib.js': { md5: v => `md5-${v}` }
	});
	assert.equal(new AdminMgrService()._normalizeText(undefined), '');

	const AdminNewsService = loadWithMocks(path.join(root, 'service', 'admin', 'admin_news_service.js'), {
		'./base_project_admin_service.js': class BaseProjectAdminService { AppError(msg) { throw new Error(msg); } fmtOrderBySort(sortVal, key) { return { [key]: sortVal }; } async genDetailQr() { return ''; } },
		'../admin/admin_home_service.js': class AdminHomeService {},
		'../../../../framework/utils/data_util.js': {},
		'../../../../framework/utils/util.js': { isDefined: v => v !== undefined },
		'../../../../framework/utils/time_util.js': { time: () => 1 },
		'../../../../framework/cloud/cloud_util.js': {},
		'../../model/news_model.js': { getOne: async where => ({ _id: where._id }), insert: async () => 'id', del: async () => {}, edit: async () => {}, editForms: async () => {}, getList: async (where, fields, orderBy) => ({ where, orderBy, list: [] }) }
	});
	const adminNews = new AdminNewsService();
	assert.deepEqual(await adminNews.insertNews({ title: 't', cateId: 'c1' }), { id: 'id', msg: '添加成功' });
	assert.deepEqual(await adminNews.editNews({ id: 'x', title: 't', cateId: 'c1' }), { msg: '更新成功' });
	assert.deepEqual(await adminNews.vouchNews('x', 1), { msg: '设置为首页推荐成功' });

	const AdminMeetService = loadWithMocks(path.join(root, 'service', 'admin', 'admin_meet_service.js'), {
		'./base_project_admin_service.js': class BaseProjectAdminService { AppError(msg) { throw new Error(msg); } async genDetailQr() { return ''; } getProjectId() { return 'workfit'; } getAdminId() { return 'a1'; } fmtOrderBySort(sortVal, key) { return { [key]: sortVal }; } },
		'../meet_service.js': class MeetService { async getDaysSet() { return []; } },
		'../admin/admin_home_service.js': class AdminHomeService {},
		'../../../../framework/utils/data_util.js': {},
		'../../../../framework/utils/time_util.js': { time: () => 1, timestamp2Time: ts => `TIME-${ts}` },
		'../../../../framework/utils/setup/setup_util.js': {},
		'../../../../framework/utils/util.js': { isDefined: v => v !== undefined },
		'../../../../framework/cloud/cloud_util.js': {},
		'../../../../framework/cloud/cloud_base.js': {},
		'../../../../framework/lib/md5_lib.js': { md5: v => `md5-${v}` },
		'../../model/meet_model.js': { STATUS: { COMM: 1, OVER: 9 }, STATUS_DESC: { 1: '启用', 9: '结束' }, getOne: async where => ({ _id: where._id, MEET_TITLE: 'x', MEET_STATUS: 1 }), edit: async () => {}, insert: async () => 'm1', del: async () => {}, editForms: async () => {}, getList: async (where, fields, orderBy) => ({ where, orderBy, list: [] }) },
		'../../model/join_model.js': { STATUS: { SUCC: 1, CANCEL: 10, ADMIN_CANCEL: 99 }, STATUS_DESC: { 1: '成功', 10: '取消', 99: '后台取消' }, getOne: async () => ({ _id: 'j1', JOIN_STATUS: 1 }), getAll: async () => [], getList: async (where, fields, orderBy) => ({ where, orderBy, list: [] }), count: async () => 0, edit: async () => {}, del: async () => {}, groupCount: async () => ({}) },
		'../../model/day_model.js': { getAllBig: async () => [], getOne: async () => null, edit: async () => {}, insert: async () => {}, del: async () => {} },
		'../../model/temp_model.js': { getOne: async () => ({ _id: 't1', TEMP_MEET_ID: 'admin' }), insert: async () => 't1', edit: async () => {}, del: async () => {}, getAll: async () => [] },
		'../../../../framework/utils/export_util.js': { getExportDataURL: async () => ({}), deleteDataExcel: async () => ({}), exportDataExcel: async () => ({}) }
	});
	const adminMeet = new AdminMeetService();
	assert.deepEqual((await adminMeet.getAdminMeetList({ page: 1, size: 10 })).orderBy, { MEET_ORDER: 'asc', MEET_ADD_TIME: 'desc' });
	assert.ok((await adminMeet.getAdminMeetList({ search: 'x', page: 1, size: 10 })).where.MEET_TITLE.$regex.includes('x'));
	assert.deepEqual((await adminMeet.getJoinList({ meetId: 'm1', mark: 'mk', page: 1, size: 10 })).orderBy, { JOIN_ADD_TIME: 'desc' });
});
