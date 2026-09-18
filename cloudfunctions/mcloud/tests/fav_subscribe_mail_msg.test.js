const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const root = path.join(__dirname, '..', 'project', 'workfit');

test('FavService handles toggle, list and delete flows', async () => {
	const state = { favs: [] };
	const FavService = loadWithMocks(path.join(root, 'service', 'fav_service.js'), {
		'./base_project_service.js': class BaseProjectService {},
		'../../../framework/utils/util.js': { isDefined: v => v !== undefined },
		'../model/fav_model.js': {
			count: async where => state.favs.filter(item => item.FAV_OID === where.FAV_OID && item.FAV_USER_ID === where.FAV_USER_ID).length,
			insert: async data => { state.favs.push(data); return 'id-1'; },
			del: async where => {
				const before = state.favs.length;
				state.favs = state.favs.filter(item => !(item.FAV_OID === where.FAV_OID && item.FAV_USER_ID === where.FAV_USER_ID));
				return before - state.favs.length;
			},
			getList: async (where, fields, orderBy, page, size) => ({
				where, fields, orderBy, page, size,
				list: state.favs.filter(item => item.FAV_USER_ID === where.FAV_USER_ID)
			})
		}
	});
	const service = new FavService();
	assert.deepEqual(await service.isFav('u1', 'o1'), { isFav: 0 });
	assert.deepEqual(await service.updateFav('u1', 'o1', 'title', 'news', '/path'), { isFav: 1 });
	assert.deepEqual(await service.isFav('u1', 'o1'), { isFav: 1 });
	assert.deepEqual(await service.updateFav('u1', 'o1', 'title', 'news', '/path'), { isFav: 0 });
	assert.deepEqual(await service.updateFav('u1', 'o2', 'other', 'meet', '/m', false), { isFav: 1 });
	assert.deepEqual(await service.updateFav('u1', 'o2', 'other', 'meet', '/m', false), { isFav: 1 });
	const list = await service.getMyFavList('u1', { search: 'ot', page: 1, size: 10 });
	assert.equal(list.where.FAV_USER_ID, 'u1');
	assert.match(list.where.FAV_TITLE.$regex, /ot/);
	assert.deepEqual(await service.delFav('u1', 'o2'), { effect: 1 });
});

test('FavController validates and formats list data', async () => {
	let updateArgs = null;
	const FavController = loadWithMocks(path.join(root, 'controller', 'fav_controller.js'), {
		'./base_project_controller.js': class BaseProjectController {
			constructor() { this._userId = 'u1'; }
			validateData(rules) {
				if (rules.path) return { oid: 'o1', title: 'title', type: 'news', path: '/x' };
				if (rules.oid && rules.page) return { page: 1, size: 10 };
				return { oid: 'o1' };
			}
		},
		'../service/fav_service.js': class FavService {
			async updateFav(...args) { updateArgs = args; return { ok: 1 }; }
			async isFav(userId, oid) { return { userId, oid, isFav: 1 }; }
			async getMyFavList() {
				return { list: [{ FAV_ADD_TIME: 1234 }] };
			}
		},
		'../../../framework/utils/time_util.js': {
			timestamp2Time: ts => `TIME-${ts}`
		}
	});
	const controller = new FavController();
	assert.deepEqual(await controller.updateFav(), { ok: 1 });
	assert.deepEqual(updateArgs, ['u1', 'o1', 'title', 'news', '/x']);
	assert.deepEqual(await controller.delFav(), { ok: 1 });
	assert.deepEqual(updateArgs, ['u1', 'o1']);
	assert.deepEqual(await controller.isFav(), { userId: 'u1', oid: 'o1', isFav: 1 });
	const list = await controller.getMyFavList();
	assert.equal(list.list[0].FAV_ADD_TIME, 'TIME-1234');
});

test('SubscribeService handles need ids and report flows', async () => {
	let userEdited = null;
	let meetEdited = null;
	const SubscribeService = loadWithMocks(path.join(root, 'service', 'subscribe_service.js'), {
		'./base_project_service.js': class BaseProjectService {},
		'../../../framework/utils/time_util.js': { time: () => 100000 },
		'../../../config/config.js': { SUBSCRIBE_VALID_DAYS: 7 },
		'../model/user_model.js': {
			getOne: async where => where.USER_MINI_OPENID === 'missing' ? null : ({ USER_SUBSCRIBE: { tplOld: { valid: 0, time: 1 } } }),
			edit: async (where, data) => { userEdited = { where, data }; }
		},
		'../model/meet_model.js': {
			STATUS: { COMM: 1 },
			getOne: async where => where._id === 'meet-1' ? ({ MEET_SUBSCRIBE: { tplMeet: { valid: 1, time: 2 } } }) : ({ MEET_SUBSCRIBE: undefined }),
			edit: async (where, data) => { meetEdited = { where, data }; }
		}
	});

	const service = new SubscribeService();
	assert.deepEqual(SubscribeService._uniq(), []);
	assert.deepEqual(SubscribeService._uniq(['a', '', 'a', 'PLEASE_SET', 'b']), ['a', 'b']);
	assert.deepEqual(SubscribeService.getNeedIds(null, ['a', null]), ['a']);
	assert.deepEqual(SubscribeService.getNeedIds({}, ['a']), ['a']);
	assert.deepEqual(SubscribeService.getNeedIds({ a: { valid: 1, time: 100000 } }, ['a']), []);
	assert.deepEqual(SubscribeService.getNeedIds({ a: { valid: 0, time: 100000 } }, ['a']), ['a']);
	assert.deepEqual(SubscribeService.getNeedIds({ a: { valid: 1 } }, ['a']), ['a']);

	assert.deepEqual(await service.report('openid-1', ['tpl1', 'tpl1', 'PLEASE_SET'], false, ''), { result: 'ok' });
	assert.deepEqual(userEdited.where, { USER_MINI_OPENID: 'openid-1' });
	assert.equal(userEdited.data.USER_SUBSCRIBE.tpl1.valid, 1);

	assert.deepEqual(await service.report('openid-2', ['tpl2'], true, 'meet-1'), { result: 'ok' });
	assert.deepEqual(meetEdited.where, { _id: 'meet-1' });
	assert.equal(meetEdited.data.MEET_SUBSCRIBE.tpl2.time, 100000);

	assert.deepEqual(await service.report('openid-3', ['tpl3'], true), { result: 'ok' });
	assert.deepEqual(meetEdited.where, { MEET_MINI_OPENID: 'openid-3', MEET_STATUS: 1 });
	assert.equal(meetEdited.data.MEET_SUBSCRIBE.tpl3.valid, 1);

	assert.deepEqual(await service.report('missing', ['tpl4'], false), { result: 'ok' });

	const SubscribeServiceUserDefault = loadWithMocks(path.join(root, 'service', 'subscribe_service.js'), {
		'./base_project_service.js': class BaseProjectService {},
		'../../../framework/utils/time_util.js': { time: () => 100000 },
		'../../../config/config.js': { SUBSCRIBE_VALID_DAYS: 7 },
		'../model/user_model.js': {
			getOne: async () => ({}),
			edit: async (where, data) => { userEdited = { where, data }; }
		},
		'../model/meet_model.js': {
			STATUS: { COMM: 1 },
			getOne: async () => null,
			edit: async () => {}
		}
	});
	await new SubscribeServiceUserDefault().report('openid-5', ['tpl5'], false);
	assert.equal(userEdited.data.USER_SUBSCRIBE.tpl5.valid, 1);

	const SubscribeServiceDefaultTtl = loadWithMocks(path.join(root, 'service', 'subscribe_service.js'), {
		'./base_project_service.js': class BaseProjectService {},
		'../../../framework/utils/time_util.js': { time: () => 100000 },
		'../../../config/config.js': {},
		'../model/user_model.js': { getOne: async () => null, edit: async () => {} },
		'../model/meet_model.js': { STATUS: { COMM: 1 }, getOne: async () => null, edit: async () => {} }
	});
	assert.deepEqual(SubscribeServiceDefaultTtl.getNeedIds({ a: { valid: 1, time: 1 } }, ['a']), []);
});

test('MailVerifyService validates email, throttles, sends and verifies codes', async () => {
	const records = [];
	let usedEdited = null;
	let sentMail = null;
	let now = 100000;
	const MailVerifyService = loadWithMocks(path.join(root, 'service', 'mail_verify_service.js'), {
		'./base_project_service.js': class BaseProjectService {
			AppError(msg) { throw new Error(msg); }
		},
		'../../../framework/utils/time_util.js': { time: () => now },
		'../../../framework/utils/data_util.js': { genRandomIntString: () => '123456' },
		'../../../framework/lib/md5_lib.js': { md5: v => `md5-${v}` },
		'../model/mail_verify_model.js': {
			getOne: async where => {
				if (where.MV_USED === 0 && where.MV_EXPIRE_TIME) {
					return records.find(r => r.MV_EMAIL === where.MV_EMAIL && r.MV_USED === 0 && r.MV_EXPIRE_TIME >= now) || null;
				}
				return records.filter(r => r.MV_EMAIL === where.MV_EMAIL && r.MV_SCENE === 'register').sort((a, b) => b.MV_ADD_TIME - a.MV_ADD_TIME)[0] || null;
			},
			insert: async data => { records.push(data); return 'mv-1'; },
			edit: async (id, data) => { usedEdited = { id, data }; }
		},
		'../../../framework/lib/mail_lib.js': {
			sendMail: async data => { sentMail = data; }
		}
	});
	const service = new MailVerifyService();
	await assert.rejects(() => service.sendRegisterCode('bad-email'), /邮箱格式不正确/);
	assert.deepEqual(await service.sendRegisterCode('a@test.com'), { ok: 1, expireSeconds: 1800 });
	assert.equal(sentMail.to, 'a@test.com');
	assert.equal(records[0].MV_CODE_MD5, 'md5-123456');
	await assert.rejects(() => service.sendRegisterCode('a@test.com'), /发送过于频繁/);

	now += 61000;
	await assert.rejects(() => service.verifyRegisterCode('missing@test.com', '123456'), /验证码已过期或不存在/);
	await assert.rejects(() => service.verifyRegisterCode('a@test.com', '654321'), /验证码错误/);
	records[0]._id = 'mv-1';
	assert.deepEqual(await service.verifyRegisterCode('a@test.com', '123456'), { ok: 1 });
	assert.deepEqual(usedEdited, { id: 'mv-1', data: { MV_USED: 1 } });

	const MailVerifyServiceUnknown = loadWithMocks(path.join(root, 'service', 'mail_verify_service.js'), {
		'./base_project_service.js': class BaseProjectService {
			AppError(msg) { throw new Error(msg); }
		},
		'../../../framework/utils/time_util.js': { time: () => 1 },
		'../../../framework/utils/data_util.js': { genRandomIntString: () => '123456' },
		'../../../framework/lib/md5_lib.js': { md5: v => `md5-${v}` },
		'../model/mail_verify_model.js': {
			getOne: async () => null,
			insert: async () => 'mv-2',
			edit: async () => {}
		},
		'../../../framework/lib/mail_lib.js': {
			sendMail: async () => { throw {}; }
		}
	});
	await assert.rejects(() => new MailVerifyServiceUnknown().sendRegisterCode('x@test.com'), /unknown/);
});

test('MsgService sends student and teacher subscribe messages and invalidates subscription flags', async () => {
	let sent = [];
	let userEdited = [];
	let meetEdited = [];
	const MsgService = loadWithMocks(path.join(root, 'service', 'msg_service.js'), {
		'./base_project_service.js': class BaseProjectService {},
		'../../../framework/utils/util.js': {},
		'../../../framework/utils/time_util.js': { time: () => 8888 },
		'../../../framework/lib/mini_lib.js': {
			sendMiniOnceTempMsg: async (body, tag) => { sent.push({ body, tag }); }
		},
		'../../../config/config.js': {
			SUBSCRIBE_TPL_STUDENT_APPT_SUCC: 'tpl-student-succ',
			SUBSCRIBE_TPL_STUDENT_APPT_CANCEL: 'tpl-student-cancel',
			SUBSCRIBE_TPL_TEACHER_NEW_APPT: 'tpl-teacher'
		},
		'../model/user_model.js': {
			getOne: async () => ({ USER_SUBSCRIBE: {} }),
			edit: async (where, data) => { userEdited.push({ where, data }); }
		},
		'../model/meet_model.js': {
			getOne: async () => ({ MEET_SUBSCRIBE: {} }),
			edit: async (where, data) => { meetEdited.push({ where, data }); }
		}
	});
	const service = new MsgService();

	await service.apptSucc('xxx^^^oStudent1', 'title', '2026-06-05 09:00', 'note');
	await service.apptCancel('abc^^^oStudent2', '2026-06-06 10:00', 'reason');
	await service.teacherNewAppt('ooo^^^oTeacher1', '2026-06-07 11:00', 'student', 2, 'new appt', 'meet-1');

	assert.equal(sent.length, 3);
	assert.equal(sent[0].tag, 'apptSucc');
	assert.equal(sent[0].body.touser, 'oStudent1');
	assert.equal(sent[1].tag, 'apptCancel');
	assert.equal(sent[1].body.touser, 'oStudent2');
	assert.equal(sent[2].tag, 'teacherNewAppt');
	assert.equal(sent[2].body.touser, 'oTeacher1');
	assert.equal(userEdited.length, 2);
	assert.equal(meetEdited.length, 1);
	assert.equal(meetEdited[0].data.MEET_SUBSCRIBE['tpl-teacher'].valid, 0);

	const MsgServiceCatch = loadWithMocks(path.join(root, 'service', 'msg_service.js'), {
		'./base_project_service.js': class BaseProjectService {},
		'../../../framework/utils/util.js': {},
		'../../../framework/utils/time_util.js': { time: () => 9999 },
		'../../../framework/lib/mini_lib.js': {
			sendMiniOnceTempMsg: async () => {}
		},
		'../../../config/config.js': {
			SUBSCRIBE_TPL_STUDENT_APPT_SUCC: 'tpl-student-succ',
			SUBSCRIBE_TPL_STUDENT_APPT_CANCEL: 'tpl-student-cancel',
			SUBSCRIBE_TPL_TEACHER_NEW_APPT: 'tpl-teacher'
		},
		'../model/user_model.js': {
			getOne: async () => ({}),
			edit: async () => { throw new Error('edit-user-fail'); }
		},
		'../model/meet_model.js': {
			getOne: async () => ({}),
			edit: async () => { throw new Error('edit-meet-fail'); }
		}
	});
	const catchSvc = new MsgServiceCatch();
	await catchSvc.apptSucc('oStudent3', '', '2026-06-08 09:00', '');
	await catchSvc.apptCancel('oStudent4', '2026-06-08 10:00', '');
	await catchSvc.teacherNewAppt('oTeacher2', '2026-06-08 11:00', '', 1, '', 'meet-2');

	const MsgServiceMissing = loadWithMocks(path.join(root, 'service', 'msg_service.js'), {
		'./base_project_service.js': class BaseProjectService {},
		'../../../framework/utils/util.js': {},
		'../../../framework/utils/time_util.js': { time: () => 1 },
		'../../../framework/lib/mini_lib.js': { sendMiniOnceTempMsg: async () => {} },
		'../../../config/config.js': {
			SUBSCRIBE_TPL_STUDENT_APPT_SUCC: 'tpl-student-succ',
			SUBSCRIBE_TPL_STUDENT_APPT_CANCEL: 'tpl-student-cancel',
			SUBSCRIBE_TPL_TEACHER_NEW_APPT: 'tpl-teacher'
		},
		'../model/user_model.js': {
			getOne: async () => null,
			edit: async () => {}
		},
		'../model/meet_model.js': {
			getOne: async () => null,
			edit: async () => {}
		}
	});
	const missingSvc = new MsgServiceMissing();
	await missingSvc.apptSucc('oStudent5', 'title', '2026-06-08 12:00', 'desc');
	await missingSvc.apptCancel('oStudent6', '2026-06-08 13:00', 'desc');
	await missingSvc.teacherNewAppt('oTeacher3', '2026-06-08 14:00', 'student', 1, 'title', 'meet-3');
});
