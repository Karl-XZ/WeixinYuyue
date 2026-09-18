const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const modulePath = path.join(__dirname, '..', 'project', 'workfit', 'service', 'meet_service.js');

function clone(v) {
	return v == null ? v : JSON.parse(JSON.stringify(v));
}

function createEdgeMeetService({ mailError = null, users = [{ USER_MINI_OPENID: 'user-1', USER_NAME: 'StudentA' }], days = null } = {}) {
	const state = {
		meets: [{
			_id: 'meet-1',
			_pid: 'workfit',
			MEET_TITLE: 'TeacherA',
			MEET_PHONE: '13800000000',
			MEET_STATUS: 1,
			MEET_CATE_ID: 'c1',
			MEET_CATE_NAME: 'cate',
			MEET_CANCEL_SET: 1,
			MEET_EMAIL: 'teacher@example.com',
			MEET_EMAIL_VERIFIED: 1,
			MEET_OBJ: { cover: ['cloud://cover-1'] },
			MEET_FORMS: [],
			MEET_QR: 'qr-1'
		}],
		days: clone(days || [{
			_id: 'day-1',
			DAY_MEET_ID: 'meet-1',
			day: '2026-06-05',
			dayDesc: 'Fri',
			times: [
				{ mark: 'd202606050900', start: '09:00', end: '10:00', status: 1, isLimit: false, stat: { succCnt: 0 } },
				{ mark: 'd202606051100', start: '11:00', end: '12:00', status: 0, isLimit: false, stat: { succCnt: 0 } }
			]
		}]),
		joins: [],
		users: clone(users),
		mails: []
	};

	const matchWhere = (row, where) => Object.entries(where || {}).every(([key, value]) => {
		const cell = row[key];
		if (Array.isArray(value)) {
			const [op, arg1, arg2] = value;
			if (op === 'in') return arg1.includes(cell);
			if (op === '<>') return cell !== arg1;
			if (op === '>=') return cell >= arg1;
			if (op === '<=') return cell <= arg1;
			if (op === 'between') return cell >= arg1 && cell <= arg2;
			return false;
		}
		return cell === value;
	});

	const MeetService = loadWithMocks(modulePath, {
		'./base_project_service.js': class BaseProjectService {
			AppError(msg) { throw new Error(msg); }
			getProjectId() { return 'workfit'; }
			fmtOrderBySort(sortVal, key) { return { [key]: sortVal }; }
		},
		'../../../framework/utils/util.js': { isDefined: v => v !== undefined },
		'../model/meet_model.js': {
			STATUS: { COMM: 1, OVER: 9 },
			getOne: async where => clone(state.meets.find(item => matchWhere(item, where)) || null),
			getAll: async where => state.meets.filter(item => matchWhere(item, where)).map(clone),
			getList: async (where, fields, orderBy) => ({ where: clone(where), orderBy: clone(orderBy), list: state.meets.map(clone) }),
			edit: async (where, data) => Object.assign(state.meets.find(item => matchWhere(item, where)), clone(data))
		},
		'../model/join_model.js': {
			STATUS: { SUCC: 1, CANCEL: 10, ADMIN_CANCEL: 99 },
			getOne: async where => clone(state.joins.find(item => matchWhere(item, where)) || null),
			getAll: async where => state.joins.filter(item => matchWhere(item, where)).map(clone),
			getList: async (where, fields, orderBy) => ({ where: clone(where), orderBy: clone(orderBy), list: state.joins.filter(item => matchWhere(item, where)).map(clone) }),
			count: async where => state.joins.filter(item => matchWhere(item, where)).length,
			groupCount: async where => {
				const ret = {};
				for (const item of state.joins.filter(row => matchWhere(row, where))) {
					ret[`JOIN_STATUS_${item.JOIN_STATUS}`] = (ret[`JOIN_STATUS_${item.JOIN_STATUS}`] || 0) + 1;
				}
				return ret;
			},
			insert: async data => { state.joins.push({ _id: `join-${state.joins.length + 1}`, ...clone(data) }); },
			del: async () => {}
		},
		'../model/day_model.js': {
			getOne: async where => clone(state.days.find(item => matchWhere(item, where)) || null),
			getAll: async where => state.days.filter(item => matchWhere(item, where)).map(clone),
			getAllBig: async where => state.days.filter(item => matchWhere(item, where)).map(clone),
			edit: async (where, data) => {
				const day = state.days.find(item => matchWhere(item, where));
				for (const [key, value] of Object.entries(data)) {
					if (key.startsWith('times.')) {
						const [, idx, leaf] = key.split('.');
						day.times[Number(idx)][leaf] = clone(value);
					} else {
						day[key] = clone(value);
					}
				}
			}
		},
		'../../../framework/utils/log_util.js': class LogUtil { debug() {} error() {} },
		'../../../framework/utils/time_util.js': {
			time: fmt => {
				if (fmt === 'Y-M-D') return '2026-06-05';
				if (fmt === 'Y-M-D h:m:s') return '2026-06-05 09:30:00';
				if (fmt === 'Y-M-D h:m') return '2026-06-05 09:30';
				return 1000;
			},
			time2Timestamp: input => input.includes('09:00') ? 1200 : 1600,
			fmtDateCHN: day => day
		},
		'../../../framework/utils/data_util.js': {
			deepClone: clone,
			dbForms2Obj: forms => forms.reduce((acc, item) => ({ ...acc, [item.title]: item.val }), {}),
			genRandomIntString: () => 'code-x'
		},
		'../public/project_config.js': { MEET_LOG_LEVEL: 'debug', MEET_MAX_JOIN_CNT: 1 },
		'../../../framework/lib/mail_lib.js': {
			sendMail: async payload => {
				if (mailError) throw new Error(mailError);
				state.mails.push(payload);
			}
		},
		'../model/user_model.js': {
			getOne: async where => clone(state.users.find(item => matchWhere(item, where)) || null)
		},
		'./support/meet_image_service.js': class MeetImageService {
			async replaceCloudImageList(list) { return list; }
			async formatMeetObjImages(obj) { return obj; }
			buildDisplayObj(meet = {}, fallbackMeet = null, applyDefaultCover = false) {
				const src = clone(meet.MEET_OBJ || fallbackMeet?.MEET_OBJ || {});
				if (applyDefaultCover && (!Array.isArray(src.cover) || src.cover.length === 0)) src.cover = ['/images/cover.gif'];
				return src;
			}
			hasDisplayCover(meetObj = {}) { return Array.isArray(meetObj.cover) && meetObj.cover.length > 0; }
			getCoverSrc(meetObj = {}, defaultCover = '/images/cover.gif') { return Array.isArray(meetObj.cover) && meetObj.cover.length ? meetObj.cover[0] : defaultCover; }
		}
	});

	return { service: new MeetService(), state };
}

test('MeetService edge branches are covered', async () => {
	const { service, state } = createEdgeMeetService();
	assert.equal(await service._formatMeetImages(null), null);

	await service.statJoinCnt('meet-1', 'd202606050900');
	assert.deepEqual(state.days[0].times[0].stat, { succCnt: 0, cancelCnt: 0, adminCancelCnt: 0 });
	await service.statJoinCnt('meet-1', 'd202606051500');

	assert.equal(service.getDaySetByDay({ MEET_DAYS_SET: [] }, '2026-06-05'), null);
	assert.equal(service.getDaySetByTimeMark({ MEET_DAYS_SET: [] }, 'd202606050900'), null);
	assert.equal(service.getTimeSetByTimeMark({ MEET_DAYS_SET: [] }, 'd202606050900'), null);

	const originalGetDay = service.getDaySetByTimeMark.bind(service);
	service.getDaySetByTimeMark = () => null;
	await assert.rejects(() => service.join('user-1', 'meet-1', 'd202606050900', [[{ title: 'Name', val: 'A' }]]));
	service.getDaySetByTimeMark = originalGetDay;

	const { service: joinMailErr, state: joinState } = createEdgeMeetService({ users: [], mailError: 'mail failed' });
	joinMailErr.checkMeetRules = async () => {};
	await joinMailErr.join('user-1', 'meet-1', 'd202606050900', [[{ title: 'Name', val: 'A' }]]);
	assert.equal(joinState.mails.length, 0);

	const { service: joinNoFormsSvc, state: joinNoFormsState } = createEdgeMeetService();
	joinNoFormsSvc.checkMeetRules = async () => {};
	await joinNoFormsSvc.join('user-1', 'meet-1', 'd202606050900', '');
	assert.equal(joinNoFormsState.joins.length, 0);

	const { service: joinEmptyFormsSvc, state: joinEmptyFormsState } = createEdgeMeetService();
	joinEmptyFormsSvc.checkMeetRules = async () => {};
	await joinEmptyFormsSvc.join('user-1', 'meet-1', 'd202606050900', []);
	assert.equal(joinEmptyFormsState.mails.length, 1);
	assert.match(joinEmptyFormsState.mails[0].text, /1/);

	const { service: viewSvc } = createEdgeMeetService({
		days: [{
			_id: 'day-1',
			DAY_MEET_ID: 'meet-1',
			day: '2026-06-05',
			dayDesc: 'Fri',
			times: [{ mark: 'd202606051100', start: '11:00', end: '12:00', status: 0, isLimit: false, stat: { succCnt: 0 } }]
		}]
	});
	const viewed = await viewSvc.viewMeet('meet-1');
	assert.equal(viewed.MEET_DAYS_SET[0].times.length, 0);

	const { service: emptyTimesViewSvc } = createEdgeMeetService({
		days: [{
			_id: 'day-empty',
			DAY_MEET_ID: 'meet-1',
			day: '2026-06-05',
			dayDesc: 'Fri',
			times: []
		}]
	});
	const emptyTimesViewed = await emptyTimesViewSvc.viewMeet('meet-1');
	assert.equal(emptyTimesViewed.MEET_DAYS_SET[0].times.length, 0);

	assert.deepEqual(await service.getUsefulTimesByDaysSet('meet-1', '2026-06-30'), []);
	const listCateEmpty = await service.getMeetList({ sortType: 'cateId', sortVal: '', page: 1, size: 10 });
	assert.equal(listCateEmpty.where.and.MEET_CATE_ID, undefined);

	service.checkMeetTimeControll = async () => {};
	service.checkMeetEndSet = async () => {};
	service.checkMeetLimitSet = async () => {};
	await service.checkMeetRules('user-1', 'meet-1', 'd202606050900', [[{ title: 'Name', val: 'A' }]]);

	const { service: namedStudentSvc, state: namedState } = createEdgeMeetService({
		users: [{ USER_MINI_OPENID: 'user-1', USER_NAME: 'NamedStudent' }]
	});
	namedStudentSvc.checkMeetRules = async () => {};
	await namedStudentSvc.join('user-1', 'meet-1', 'd202606050900', [[{ title: 'Name', val: 'A' }]]);
	assert.match(namedState.mails[0].text, /NamedStudent/);

	const { service: pastDaySvc } = createEdgeMeetService({
		days: [{
			_id: 'day-old',
			DAY_MEET_ID: 'meet-1',
			day: '2026-06-04',
			dayDesc: 'Thu',
			times: [{ mark: 'd202606040900', start: '09:00', end: '10:00', status: 1, isLimit: false, stat: { succCnt: 0 } }]
		}]
	});
	const pastViewed = await pastDaySvc.viewMeet('meet-1');
	assert.equal(pastViewed.MEET_DAYS_SET.length, 0);

	const { service: viewThrowSvc } = createEdgeMeetService();
	viewThrowSvc.checkMeetEndSet = async () => { throw new Error('boom'); };
	await assert.rejects(() => viewThrowSvc.viewMeet('meet-1'), /boom/);

	const { service: usefulSvc } = createEdgeMeetService({
		days: [
			{ _id: 'day-0', DAY_MEET_ID: 'meet-1', day: '2026-06-04', dayDesc: 'Thu', times: [{ mark: 'd202606040900', start: '09:00', end: '10:00', status: 1, isLimit: false, stat: { succCnt: 0 } }] },
			{ _id: 'day-1', DAY_MEET_ID: 'meet-1', day: '2026-06-05', dayDesc: 'Fri', times: [{ mark: 'd202606050900', start: '09:00', end: '10:00', status: 1, isLimit: false, stat: { succCnt: 0 } }] }
		]
	});
	assert.equal((await usefulSvc.getUsefulTimesByDaysSet('meet-1', '2026-06-05')).length, 1);

	const { service: emptyUsefulSvc } = createEdgeMeetService({
		days: [
			{ _id: 'day-0', DAY_MEET_ID: 'meet-1', day: '2026-06-04', dayDesc: 'Thu', times: [{ mark: 'd202606040900', start: '09:00', end: '10:00', status: 1, isLimit: false, stat: { succCnt: 0 } }] },
			{ _id: 'day-1', DAY_MEET_ID: 'meet-1', day: '2026-06-05', dayDesc: 'Fri', times: [] }
		]
	});
	assert.deepEqual(await emptyUsefulSvc.getUsefulTimesByDaysSet('meet-1', '2026-06-05'), []);

	const listCateAssigned = await service.getMeetList({ cateId: 'c1', page: 1, size: 10 });
	assert.equal(listCateAssigned.where.and.MEET_CATE_ID, 'c1');
	const listCateZero = await service.getMeetList({ cateId: '0', page: 1, size: 10 });
	assert.equal(listCateZero.where.and.MEET_CATE_ID, undefined);
	const listCateMissing = await service.getMeetList({ page: 1, size: 10 });
	assert.equal(listCateMissing.where.and.MEET_CATE_ID, undefined);
});
