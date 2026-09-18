const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const root = path.join(__dirname, '..', 'project', 'workfit');

test('AdminHomeController checks admin and forwards to service', async () => {
	const calls = [];
	const AdminHomeController = loadWithMocks(path.join(root, 'controller', 'admin', 'admin_home_controller.js'), {
		'./base_project_admin_controller.js': class BaseProjectAdminController {
			async isAdmin() { calls.push('isAdmin'); }
			validateData(rules) { calls.push(['validateData', rules]); return {}; }
		},
		'../../service/admin/admin_home_service.js': class AdminHomeService {
			async adminHome() { calls.push('adminHome'); return { ok: 1 }; }
			async clearVouchData() { calls.push('clearVouchData'); return { cleared: 1 }; }
		}
	});
	const controller = new AdminHomeController();
	assert.deepEqual(await controller.adminHome(), { ok: 1 });
	assert.deepEqual(await controller.clearVouchData(), { cleared: 1 });
	assert.deepEqual(calls, [
		'isAdmin',
		['validateData', {}],
		'adminHome',
		'isAdmin',
		['validateData', {}],
		'clearVouchData'
	]);
});

test('AdminSetupController validates, checks content and forwards to service', async () => {
	const checks = [];
	const calls = [];
	const AdminSetupController = loadWithMocks(path.join(root, 'controller', 'admin', 'admin_setup_controller.js'), {
		'./base_project_admin_controller.js': class BaseProjectAdminController {
			async isAdmin() { calls.push('isAdmin'); }
			validateData(rules) {
				if (rules.key) return { key: 'k1', content: 'v1' };
				if (rules.id) return { id: 'content-key', content: [{ type: 'text', val: 'x' }] };
				return { path: '/pages/index', sc: 'scene-1' };
			}
		},
		'../../service/admin/admin_setup_service.js': class AdminSetupService {
			async setSetup(key, content) { calls.push(['setSetup', key, content]); }
			async setContentSetup(id, content, mode) { calls.push(['setContentSetup', id, content, mode]); }
			async genMiniQr(path, sc) { calls.push(['genMiniQr', path, sc]); return { url: 'temp-url' }; }
		},
		'../../../../framework/validate/content_check.js': {
			checkTextMultiAdmin: async input => checks.push(input)
		}
	});
	const controller = new AdminSetupController();
	await controller.setSetup();
	await controller.setContentSetup();
	assert.deepEqual(await controller.genMiniQr(), { url: 'temp-url' });
	assert.equal(checks.length, 2);
	assert.deepEqual(calls, [
		'isAdmin',
		['setSetup', 'k1', 'v1'],
		'isAdmin',
		['setContentSetup', 'content-key', [{ type: 'text', val: 'x' }], 'content'],
		'isAdmin',
		['genMiniQr', '/pages/index', 'scene-1']
	]);
});

test('AdminMgrController covers login, list formatting and admin actions', async () => {
	const logs = [];
	const checks = [];
	const serviceCalls = [];
	const AdminMgrController = loadWithMocks(path.join(root, 'controller', 'admin', 'admin_mgr_controller.js'), {
		'./base_project_admin_controller.js': class BaseProjectAdminController {
			constructor() {
				this._adminId = 'admin-1';
				this._admin = { ADMIN_PHONE: '13800138000' };
			}
			async isAdmin() { logs.push('isAdmin'); }
			async isSuperAdmin() { logs.push('isSuperAdmin'); }
			validateData(rules) {
				if (rules.name && rules.pwd) return { name: 'admin', pwd: 'secret123' };
				if (rules.id && rules.status) return { id: 'mgr-1', status: 1 };
				if (rules.id && rules.name) return { id: 'mgr-1', name: 'mgruser', desc: 'desc', phone: '13800138001', password: 'newpass1' };
				if (rules.name && rules.desc) return { name: 'mgruser', desc: 'desc', phone: '13800138001', password: 'newpass1' };
				if (rules.oldPassword) return { oldPassword: 'oldpass1', password: 'newpass1', password2: 'newpass1' };
				if (rules.search || rules.whereEx) return { search: 'kw', page: 1, size: 10 };
				if (rules.id) return { id: 'mgr-1' };
				return {};
			}
		},
		'../../service/admin/admin_mgr_service.js': class AdminMgrService {
			async adminLogin(name, pwd) { serviceCalls.push(['adminLogin', name, pwd]); return { token: 't1' }; }
			async delMgr(id, adminId) { serviceCalls.push(['delMgr', id, adminId]); }
			async statusMgr(id, status, phone) { serviceCalls.push(['statusMgr', id, status, phone]); }
			async getMgrList(input) {
				serviceCalls.push(['getMgrList', input]);
				return { list: [{ ADMIN_EDIT_TIME: 1, ADMIN_LOGIN_TIME: 0 }, { ADMIN_EDIT_TIME: 2, ADMIN_LOGIN_TIME: 3 }] };
			}
			async insertMgr(input) { serviceCalls.push(['insertMgr', input]); }
			async editMgr(id, input) { serviceCalls.push(['editMgr', id, input]); }
			async pwdtMgr(id, oldPwd, pwd) { serviceCalls.push(['pwdtMgr', id, oldPwd, pwd]); }
			async getMgrDetail(id) { serviceCalls.push(['getMgrDetail', id]); return { _id: id }; }
			async clearLog() { serviceCalls.push(['clearLog']); return { cleared: 1 }; }
			async getLogList(input) {
				serviceCalls.push(['getLogList', input]);
				return { list: [{ LOG_TYPE: 2, LOG_ADD_TIME: 10 }] };
			}
		},
		'../../../../framework/platform/model/log_model.js': {
			getDesc: (group, value) => `${group}-${value}`
		},
		'../../../../framework/utils/time_util.js': {
			timestamp2Time: ts => `TIME-${ts}`
		},
		'../../../../framework/validate/content_check.js': {
			checkTextMultiAdmin: async input => checks.push(input)
		}
	});
	const controller = new AdminMgrController();
	assert.deepEqual(await controller.adminLogin(), { token: 't1' });
	await controller.delMgr();
	await controller.statusMgr();
	const mgrList = await controller.getMgrList();
	await controller.insertMgr();
	await controller.editMgr();
	await controller.pwdMgr();
	assert.deepEqual(await controller.getMgrDetail(), { _id: 'mgr-1' });
	assert.deepEqual(await controller.clearLog(), { cleared: 1 });
	const logList = await controller.getLogList();

	assert.equal(mgrList.list[0].ADMIN_EDIT_TIME, 'TIME-1');
	assert.equal(mgrList.list[0].ADMIN_LOGIN_TIME, '未登录');
	assert.equal(mgrList.list[1].ADMIN_LOGIN_TIME, 'TIME-3');
	assert.equal(logList.list[0].LOG_TYPE_DESC, 'TYPE-2');
	assert.equal(logList.list[0].LOG_ADD_TIME, 'TIME-10');
	assert.equal(checks.length, 3);
	assert.ok(serviceCalls.some(item => item[0] === 'pwdtMgr'));
});

test('AdminNewsController covers CRUD and formatter branches', async () => {
	const checks = [];
	const serviceCalls = [];
	const logMessages = [];
	const AdminNewsController = loadWithMocks(path.join(root, 'controller', 'admin', 'admin_news_controller.js'), {
		'./base_project_admin_controller.js': class BaseProjectAdminController {
			async isAdmin() {}
			logNews(msg) { logMessages.push(msg); }
			validateData(rules) {
				if (rules.sort) return { id: 'news-1', sort: 9 };
				if (rules.vouch !== undefined) return { id: 'news-1', vouch: 1 };
				if (rules.status !== undefined) return { id: 'news-1', status: 1 };
				if (rules.search || rules.whereEx) return { search: 'kw', page: 1 };
				if (rules.content) return { id: 'news-1', content: [{ type: 'text', val: 'body' }] };
				if (rules.title && !rules.id) return { title: '公告标题', cateId: 'c1', cateName: '公告', order: 1, desc: 'desc', forms: [] };
				if (rules.title && rules.id) return { id: 'news-1', title: '公告标题', cateId: 'c1', cateName: '公告', order: 1, desc: 'desc', forms: [] };
				if (rules.imgList) return { id: 'news-1', imgList: ['a'] };
				if (rules.hasImageForms) return { id: 'news-1', hasImageForms: ['f1'] };
				return { id: 'news-1' };
			}
		},
		'../../service/admin/admin_news_service.js': class AdminNewsService {
			async sortNews(id, sort) { serviceCalls.push(['sortNews', id, sort]); }
			async vouchNews(id, vouch) { serviceCalls.push(['vouchNews', id, vouch]); }
			async statusNews(id, status) { serviceCalls.push(['statusNews', id, status]); }
			async getAdminNewsList(input) {
				serviceCalls.push(['getAdminNewsList', input]);
				return {
					list: [
						{ NEWS_ADD_TIME: 1, NEWS_EDIT_TIME: 2, NEWS_OBJ: { desc: 'remove', keep: 1 } },
						{ NEWS_ADD_TIME: 3, NEWS_EDIT_TIME: 4, NEWS_OBJ: null }
					]
				};
			}
			async updateNewsContent(input) { serviceCalls.push(['updateNewsContent', input]); return { updated: 1 }; }
			async insertNews(input) { serviceCalls.push(['insertNews', input]); return { id: 'news-1' }; }
			async getNewsDetail(id) { serviceCalls.push(['getNewsDetail', id]); return { _id: id }; }
			editNews(input) { serviceCalls.push(['editNews', input]); return { edited: 1 }; }
			async delNews(id) { serviceCalls.push(['delNews', id]); }
			async updateNewsPic(input) { serviceCalls.push(['updateNewsPic', input]); return ['url-1']; }
			async updateNewsForms(input) { serviceCalls.push(['updateNewsForms', input]); return ['url-2']; }
		},
		'../../../../framework/utils/time_util.js': {
			timestamp2Time: (ts, fmt) => `TIME-${ts}-${fmt || ''}`
		},
		'../../../../framework/validate/content_check.js': {
			checkTextMultiAdmin: async input => checks.push(input)
		},
		'../../model/news_model.js': {
			getOneField: async () => '旧标题'
		}
	});
	const controller = new AdminNewsController();
	await controller.sortNews();
	await controller.vouchNews();
	await controller.statusNews();
	const list = await controller.getAdminNewsList();
	assert.equal(list.list[0].NEWS_ADD_TIME, 'TIME-1-Y-M-D h:m');
	assert.equal('desc' in list.list[0].NEWS_OBJ, false);
	assert.deepEqual(await controller.updateNewsContent(), { updated: 1 });
	assert.deepEqual(await controller.insertNews(), { id: 'news-1' });
	assert.deepEqual(await controller.getNewsDetail(), { _id: 'news-1' });
	assert.deepEqual(await controller.editNews(), { edited: 1 });
	await controller.delNews();
	assert.deepEqual(await controller.updateNewsPic(), ['url-1']);
	assert.deepEqual(await controller.updateNewsForms(), ['url-2']);
	assert.ok(logMessages.length >= 2);
	assert.ok(checks.length >= 4);
});

test('WorkHomeController covers login, register, home and password flows', async () => {
	const calls = [];
	const WorkHomeController = loadWithMocks(path.join(root, 'controller', 'work', 'work_home_controller.js'), {
		'./base_project_work_controller.js': class BaseProjectWorkController {
			constructor() {
				this._workId = 'meet-1';
				this._openId = 'openid-1';
			}
			async isWork() { calls.push('isWork'); }
			validateData(rules) {
				if (rules.phone && rules.pwd) return { phone: '13800138000', pwd: 'secret123', teacherPwd: 'gate' };
				if (rules.name) return { name: '教师甲', phone: '13800138001', pwd: 'secret123', teacherPwd: 'gate', email: 't@test.com', emailCode: '123456' };
				if (rules.email && !rules.teacherPwd) return { email: 't@test.com' };
				if (rules.oldPassword) return { oldPassword: 'oldpass1', password: 'newpass1', password2: 'newpass1' };
				return {};
			}
		},
		'../../service/work/work_home_service.js': class WorkHomeService {
			async workHome(workId) { calls.push(['workHome', workId]); return { workId }; }
			async workLogin(phone, pwd, openId, teacherPwd) { calls.push(['workLogin', phone, pwd, openId, teacherPwd]); return { token: 'w1' }; }
			async workRegister(payload, openId, teacherPwd) { calls.push(['workRegister', payload, openId, teacherPwd]); return { id: 'm1' }; }
			async pwdWork(workId, oldPwd, pwd) { calls.push(['pwdWork', workId, oldPwd, pwd]); }
		},
		'../../service/mail_verify_service.js': class MailVerifyService {
			async sendRegisterCode(email) { calls.push(['sendRegisterCode', email]); return { ok: 1 }; }
		}
	});
	const controller = new WorkHomeController();
	assert.deepEqual(await controller.workHome(), { workId: 'meet-1' });
	assert.deepEqual(await controller.workLogin(), { token: 'w1' });
	assert.deepEqual(await controller.workRegister(), { id: 'm1' });
	assert.deepEqual(await controller.emailSendCode(), { ok: 1 });
	await controller.pwdWork();
	assert.ok(calls.some(item => Array.isArray(item) && item[0] === 'pwdWork'));
});

test('WorkMeetController covers edit and join management flows', async () => {
	const calls = [];
	const WorkMeetController = loadWithMocks(path.join(root, 'controller', 'work', 'work_meet_controller.js'), {
		'./base_project_work_controller.js': class BaseProjectWorkController {
			constructor() { this._workId = 'meet-1'; }
			async isWork() { calls.push('isWork'); }
			validateData(rules) {
				if (rules.title) return { id: 'meet-x', title: '课程', cateId: 'c1', cateName: '咨询', order: 1, cancelSet: 1, daysSet: [], phone: '13800138000', password: 'secret123', forms: [], joinForms: [] };
				if (rules.hasImageForms) return { id: 'meet-x', hasImageForms: ['f1'] };
				if (rules.name && rules.times) return { name: '模板', times: ['09:00'] };
				if (rules.id && rules.isLimit !== undefined) return { id: 'temp-1', isLimit: true, limit: 2 };
				if (rules.meetId && rules.timeMark) return { meetId: 'meet-x', timeMark: 'tm1', reason: 'r1' };
				if (rules.search || rules.mark) return { search: '张', meetId: 'meet-x', mark: 'tm1', page: 1, size: 10 };
				if (rules.meetId && rules.start) return { meetId: 'meet-x', start: '2026-06-01', end: '2026-06-30' };
				if (rules.joinId && rules.flag !== undefined) return { joinId: 'join-1', flag: 1 };
				if (rules.meetId && rules.code) return { meetId: 'meet-x', code: '123456789012345' };
				if (rules.joinId && rules.status !== undefined) return { joinId: 'join-1', status: 10, reason: '取消' };
				if (rules.joinId) return { joinId: 'join-1' };
				return { id: 'meet-x' };
			}
		},
		'../../service/admin/admin_meet_service.js': class AdminMeetService {
			async getMeetDetail(id) { calls.push(['getMeetDetail', id]); return { _id: id }; }
			editMeet(input) { calls.push(['editMeet', input]); return { edited: 1 }; }
			async updateMeetForms(input) { calls.push(['updateMeetForms', input]); return ['url']; }
			async insertMeetTemp(input, workId) { calls.push(['insertMeetTemp', input, workId]); return { id: 'temp-1' }; }
			editMeetTemp(input, workId) { calls.push(['editMeetTemp', input, workId]); return { edited: 1 }; }
			async getMeetTempList(workId) { calls.push(['getMeetTempList', workId]); return [{ _id: 'temp-1' }]; }
			async delMeetTemp(id, workId) { calls.push(['delMeetTemp', id, workId]); }
			async cancelJoinByTimeMark(meetId, timeMark, reason) { calls.push(['cancelJoinByTimeMark', meetId, timeMark, reason]); return { cancelled: 1 }; }
			async getJoinList(input) {
				calls.push(['getJoinList', input]);
				return { list: [{ JOIN_ADD_TIME: 1, JOIN_CHECKIN_TIME: 2, JOIN_FORMS: [{ val: '张三' }] }] };
			}
			async getDayList(workId, start, end) { calls.push(['getDayList', workId, start, end]); return ['d1']; }
			async checkinJoin(joinId, flag) { calls.push(['checkinJoin', joinId, flag]); }
			async scanJoin(workId, code) { calls.push(['scanJoin', workId, code]); }
			async statusJoin(joinId, status, reason) { calls.push(['statusJoin', joinId, status, reason]); return { ok: 1 }; }
			async delJoin(joinId) { calls.push(['delJoin', joinId]); return { deleted: 1 }; }
		},
		'../../../../framework/utils/time_util.js': {
			timestamp2Time: ts => `TIME-${ts}`
		},
		'../../../../framework/utils/data_util.js': {
			splitTextByKey: (val, key) => [val, key]
		}
	});
	const controller = new WorkMeetController();
	assert.deepEqual(await controller.getMeetDetail(), { _id: 'meet-1' });
	assert.deepEqual(await controller.editMeet(), { edited: 1 });
	assert.deepEqual(await controller.updateMeetForms(), ['url']);
	assert.deepEqual(await controller.insertMeetTemp(), { id: 'temp-1' });
	assert.deepEqual(await controller.editMeetTemp(), { edited: 1 });
	assert.deepEqual(await controller.getMeetTempList(), [{ _id: 'temp-1' }]);
	await controller.delMeetTemp();
	assert.deepEqual(await controller.cancelJoinByTimeMark(), { cancelled: 1 });
	const joinList = await controller.getJoinList();
	assert.equal(joinList.list[0].JOIN_ADD_TIME, 'TIME-1');
	assert.deepEqual(joinList.list[0].JOIN_FORMS[0].valArr, ['张三', '张']);
	assert.deepEqual(await controller.getDayList(), ['d1']);
	await controller.checkinJoin();
	await controller.scanJoin();
	assert.deepEqual(await controller.statusJoin(), { ok: 1 });
	assert.deepEqual(await controller.delJoin(), { deleted: 1 });
	assert.ok(calls.some(item => Array.isArray(item) && item[0] === 'scanJoin'));
});

test('MeetController covers list transforms, joins and date helpers', async () => {
	const calls = [];
	const MeetController = loadWithMocks(path.join(root, 'controller', 'meet_controller.js'), {
		'./base_project_controller.js': class BaseProjectController {
			constructor() { this._userId = 'user-1'; }
			validateData(rules) {
				if (rules.day) return { day: '2026-06-05' };
				if (rules.cateId || rules.page) return { search: '张', page: 1, size: 10 };
				if (rules.joinId) return { joinId: 'join-1' };
				if (rules.meetId && rules.timeMark && rules.formsList) return { meetId: 'meet-1', timeMark: 'tm1', formsList: [{ k: 1 }] };
				if (rules.meetId && rules.timeMark) return { meetId: 'meet-1', timeMark: 'tm1' };
				if (rules.id) return { id: 'meet-1' };
				return {};
			}
		},
		'../service/meet_service.js': class MeetService {
			async getMeetListByDay(day) { calls.push(['getMeetListByDay', day]); return [{ pic: 'p1' }]; }
			async getHasDaysFromDay(day) { calls.push(['getHasDaysFromDay', day]); return ['2026-06-05']; }
			async getMeetList() {
				calls.push(['getMeetList']);
				return { list: [{ MEET_DAYS: ['2026-06-05', '2026-06-06'] }] };
			}
			async getMyJoinList() {
				calls.push(['getMyJoinList']);
				return { list: [{ JOIN_MEET_DAY: '2026-06-05', JOIN_COMPLETE_END_TIME: '2026-06-05 08:00', JOIN_STATUS: 1, JOIN_IS_CHECKIN: 0, JOIN_ADD_TIME: 1 }] };
			}
			async getMyJoinSomeday(userId, day) { calls.push(['getMyJoinSomeday', userId, day]); return [{ day }]; }
			async getMyJoinDetail(userId, joinId) {
				calls.push(['getMyJoinDetail', userId, joinId]);
				return { JOIN_COMPLETE_END_TIME: '2026-06-05 08:00', JOIN_STATUS: 1, JOIN_IS_CHECKIN: 0, JOIN_ADD_TIME: 1, JOIN_CHECKIN_TIME: 2 };
			}
			async cancelMyJoin(userId, joinId) { calls.push(['cancelMyJoin', userId, joinId]); return { cancelled: 1 }; }
			async detailForJoin(userId, meetId, timeMark) { calls.push(['detailForJoin', userId, meetId, timeMark]); return { _id: meetId, timeMark }; }
			async viewMeet(id) { calls.push(['viewMeet', id]); return { _id: id }; }
			async beforeJoin(userId, meetId, timeMark) { calls.push(['beforeJoin', userId, meetId, timeMark]); return { ok: 1 }; }
			async join(userId, meetId, timeMark, formsList) { calls.push(['join', userId, meetId, timeMark, formsList]); return { id: 'join-1' }; }
		},
		'../service/support/meet_image_service.js': class MeetImageService {
			getCoverSrc(obj) { return obj.cover || 'default.png'; }
		},
		'../../../framework/utils/time_util.js': {
			time: fmt => fmt === 'Y-M-D h:m' ? '2026-06-05 09:00' : '2026-06-05',
			fmtDateCHN: day => `CHN-${day}`,
			week: day => `WEEK-${day}`,
			timestamp2Time: ts => `TIME-${ts}`
		},
		'../model/join_model.js': {
			getDesc: (group, status) => `${group}-${status}`
		}
	});
	const controller = new MeetController();
	const transformed = controller.transMeetList([{ _id: 'm1', MEET_TITLE: '课程', MEET_OBJ: { desc: '简介', cover: 'cover.png' }, openRule: '3天可预约' }]);
	assert.deepEqual(transformed[0], { type: 'meet', id: 'm1', title: '课程', desc: '简介', ext: '3天可预约', pic: 'cover.png' });
	assert.deepEqual(await controller.getMeetListByDay(), [{ pic: 'p1' }]);
	assert.deepEqual(await controller.getHasDaysFromDay(), ['2026-06-05']);
	const meetList = await controller.getMeetList();
	assert.equal(meetList.list[0].openRule, '2天可预约');
	const myJoinList = await controller.getMyJoinList();
	assert.equal(myJoinList.list[0].JOIN_MEET_DAY, 'CHN-2026-06-05 (WEEK-2026-06-05)');
	assert.equal(myJoinList.list[0].isTimeout, 1);
	assert.deepEqual(await controller.getMyJoinSomeday(), [{ day: '2026-06-05' }]);
	const detail = await controller.getMyJoinDetail();
	assert.equal(detail.JOIN_STATUS_DESC, 'STATUS-1');
	assert.equal(detail.isTimeout, 1);
	assert.deepEqual(await controller.cancelMyJoin(), { cancelled: 1 });
	assert.deepEqual(await controller.detailForJoin(), { _id: 'meet-1', timeMark: 'tm1' });
	assert.deepEqual(await controller.viewMeet(), { _id: 'meet-1' });
	assert.deepEqual(await controller.beforeJoin(), { ok: 1 });
	assert.deepEqual(await controller.join(), { id: 'join-1' });
	assert.equal(controller._getLeaveDay(['2026-06-04', '2026-06-05', '2026-06-06']), 2);
});

test('AdminMeetController covers admin meet flows and result formatting', async () => {
	const calls = [];
	const checks = [];
	const logs = [];
	const AdminMeetController = loadWithMocks(path.join(root, 'controller', 'admin', 'admin_meet_controller.js'), {
		'./base_project_admin_controller.js': class BaseProjectAdminController {
			constructor() { this._adminId = 'admin-1'; }
			async isAdmin() {}
			logOther(msg) { logs.push(msg); }
			validateData(rules) {
				if (rules.meetId && rules.start) return { meetId: 'meet-1', start: '2026-06-01', end: '2026-06-30' };
				if (rules.joinId && rules.flag !== undefined) return { joinId: 'join-1', flag: 1 };
				if (rules.meetId && rules.code) return { meetId: 'meet-1', code: '123456789012345' };
				if (rules.meetId && rules.sort !== undefined) return { meetId: 'meet-1', sort: 7 };
				if (rules.id && rules.vouch !== undefined) return { id: 'meet-1', vouch: 1 };
				if (rules.meetId && rules.status !== undefined) return { meetId: 'meet-1', status: 9 };
				if (rules.joinId && rules.status !== undefined) return { joinId: 'join-1', status: 10, reason: '取消' };
				if (rules.joinId) return { joinId: 'join-1' };
				if (rules.search || rules.whereEx) return { search: '张', page: 1, size: 10, meetId: 'meet-1', mark: 'tm1' };
				if (rules.title && !rules.id) return { title: '课程', cateId: 'c1', cateName: '咨询', order: 1, cancelSet: 1, daysSet: [], phone: '13800138000', password: 'secret123', forms: [], joinForms: [] };
				if (rules.id && rules.daysSet) return { id: 'meet-1', daysSet: [] };
				if (rules.title && rules.id) return { id: 'meet-1', title: '课程', cateId: 'c1', cateName: '咨询', order: 1, cancelSet: 1, daysSet: [], phone: '13800138000', password: 'secret123', forms: [], joinForms: [] };
				if (rules.id && rules.hasImageForms) return { id: 'meet-1', hasImageForms: ['f1'] };
				if (rules.meetId && rules.timeMark) return { meetId: 'meet-1', timeMark: 'tm1', reason: 'r1' };
				if (rules.name && rules.times) return { name: '模板', times: ['09:00'] };
				if (rules.id && rules.isLimit !== undefined) return { id: 'temp-1', isLimit: true, limit: 2 };
				if (rules.isDel !== undefined) return { isDel: 1 };
				if (rules.startDay) return { meetId: 'meet-1', startDay: '2026-06-01', endDay: '2026-06-30', status: 1 };
				if (rules.id) return { id: 'meet-1' };
				return {};
			}
		},
		'../../service/admin/admin_meet_service.js': class AdminMeetService {
			async getDayList(meetId, start, end) { calls.push(['getDayList', meetId, start, end]); return ['d1']; }
			async checkinJoin(joinId, flag) { calls.push(['checkinJoin', joinId, flag]); }
			async scanJoin(meetId, code) { calls.push(['scanJoin', meetId, code]); }
			async sortMeet(meetId, sort) { calls.push(['sortMeet', meetId, sort]); }
			async vouchMeet(id, vouch) { calls.push(['vouchMeet', id, vouch]); }
			async statusMeet(meetId, status) { calls.push(['statusMeet', meetId, status]); }
			async statusJoin(joinId, status, reason) { calls.push(['statusJoin', joinId, status, reason]); return { ok: 1 }; }
			async delJoin(joinId) { calls.push(['delJoin', joinId]); return { deleted: 1 }; }
			async getAdminMeetList() {
				calls.push(['getAdminMeetList']);
				return { list: [{ MEET_ADD_TIME: 1, MEET_EDIT_TIME: 2, MEET_DAYS: ['2026-06-05', '2026-06-06'] }] };
			}
			async getJoinList(input) {
				calls.push(['getJoinList', input]);
				return { list: [{ JOIN_ADD_TIME: 1, JOIN_CHECKIN_TIME: 2, JOIN_FORMS: [{ val: '张三' }] }] };
			}
			async insertMeet(adminId, input) { calls.push(['insertMeet', adminId, input]); return { id: 'meet-1' }; }
			async setDays(id, input) { calls.push(['setDays', id, input]); return { ok: 1 }; }
			async getMeetDetail(id) { calls.push(['getMeetDetail', id]); return { _id: id }; }
			editMeet(input) { calls.push(['editMeet', input]); return { edited: 1 }; }
			async updateMeetForms(input) { calls.push(['updateMeetForms', input]); return ['url']; }
			async delMeet(id) { calls.push(['delMeet', id]); }
			async cancelJoinByTimeMark(meetId, timeMark, reason) { calls.push(['cancelJoinByTimeMark', meetId, timeMark, reason]); return { cancelled: 1 }; }
			async insertMeetTemp(input) { calls.push(['insertMeetTemp', input]); return { id: 'temp-1' }; }
			editMeetTemp(input) { calls.push(['editMeetTemp', input]); return { edited: 1 }; }
			async getMeetTempList() { calls.push(['getMeetTempList']); return [{ _id: 'temp-1' }]; }
			async delMeetTemp(id) { calls.push(['delMeetTemp', id]); }
			async deleteJoinDataExcel() { calls.push(['deleteJoinDataExcel']); return { deleted: 1 }; }
			async getJoinDataURL() { calls.push(['getJoinDataURL']); return { url: 'excel-url' }; }
			async exportJoinDataExcel(input) { calls.push(['exportJoinDataExcel', input]); return { file: 'excel' }; }
		},
		'../../../../framework/utils/time_util.js': {
			time: () => '2026-06-05',
			timestamp2Time: ts => `TIME-${ts}`
		},
		'../../../../framework/utils/data_util.js': {
			splitTextByKey: (val, key) => [val, key]
		},
		'../../model/meet_model.js': {
			getOneField: async () => '课程',
			getDesc: (group, status) => `${group}-${status}`
		},
		'../../../../framework/validate/content_check.js': {
			checkTextMultiAdmin: async input => checks.push(input)
		}
	});
	const controller = new AdminMeetController();
	assert.equal(controller._getLeaveDay(['2026-06-04', '2026-06-05']), 1);
	assert.deepEqual(await controller.getDayList(), ['d1']);
	await controller.checkinJoin();
	await controller.scanJoin();
	await controller.sortMeet();
	await controller.vouchMeet();
	await controller.statusMeet();
	assert.deepEqual(await controller.statusJoin(), { ok: 1 });
	assert.deepEqual(await controller.delJoin(), { deleted: 1 });
	const meetList = await controller.getAdminMeetList();
	assert.equal(meetList.list[0].leaveDay, 2);
	assert.equal(meetList.list[0].MEET_ADD_TIME, 'TIME-1');
	const joinList = await controller.getJoinList();
	assert.deepEqual(joinList.list[0].JOIN_FORMS[0].valArr, ['张三', '张']);
	assert.deepEqual(await controller.insertMeet(), { id: 'meet-1' });
	assert.deepEqual(await controller.setDays(), { ok: 1 });
	assert.deepEqual(await controller.getMeetDetail(), { _id: 'meet-1' });
	assert.deepEqual(await controller.editMeet(), { edited: 1 });
	assert.deepEqual(await controller.updateMeetForms(), ['url']);
	await controller.delMeet();
	assert.deepEqual(await controller.cancelJoinByTimeMark(), { cancelled: 1 });
	assert.deepEqual(await controller.insertMeetTemp(), { id: 'temp-1' });
	assert.deepEqual(await controller.editMeetTemp(), { edited: 1 });
	assert.deepEqual(await controller.getMeetTempList(), [{ _id: 'temp-1' }]);
	await controller.delMeetTemp();
	assert.deepEqual(await controller.joinDataGet(), { url: 'excel-url' });
	assert.deepEqual(await controller.joinDataExport(), { file: 'excel' });
	assert.deepEqual(await controller.joinDataDel(), { deleted: 1 });
	assert.ok(checks.length >= 4);
	assert.ok(logs.length >= 2);
});
