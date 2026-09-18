const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const modulePath = path.join(__dirname, '..', 'project', 'workfit', 'service', 'meet_service.js');

function clone(v) {
	return v == null ? v : JSON.parse(JSON.stringify(v));
}

function appError(msg) {
	const err = new Error(msg);
	err.name = 'AppError';
	return err;
}

function matchWhere(row, where) {
	if (!where) return true;
	return Object.entries(where).every(([key, value]) => {
		const cell = row[key];
		if (Array.isArray(value)) {
			const [op, arg1, arg2] = value;
			if (op === 'between') return cell >= arg1 && cell <= arg2;
			if (op === 'in') return arg1.includes(cell);
			if (op === '<=') return cell <= arg1;
			if (op === '>=') return cell >= arg1;
			if (op === '<') return cell < arg1;
			if (op === '>') return cell > arg1;
			if (op === '<>') return cell !== arg1;
			if (op === 'like') return String(cell || '').includes(arg1);
			return false;
		}
		if (value && typeof value === 'object' && value.$regex) {
			return new RegExp(value.$regex.replace(/^\.\*/, ''), value.$options || '').test(cell || '');
		}
		return cell === value;
	});
}

function createMeetService(options = {}) {
	const state = {
		meets: clone(options.meets || [
			{
				_id: 'meet-1',
				_pid: 'workfit',
				MEET_TITLE: '老师A',
				MEET_PHONE: '13800000000',
				MEET_STATUS: 1,
				MEET_CATE_ID: 'c1',
				MEET_CATE_NAME: '咨询',
				MEET_CANCEL_SET: 1,
				MEET_EMAIL: 'teacher@example.com',
				MEET_EMAIL_VERIFIED: 1,
				MEET_OBJ: { cover: ['cloud://cover-1'] },
				MEET_FORMS: [],
				MEET_QR: 'qr-1'
			},
			{
				_id: 'meet-2',
				_pid: 'workfit',
				MEET_TITLE: '老师B',
				MEET_PHONE: '13800000001',
				MEET_STATUS: 9,
				MEET_CATE_ID: 'c2',
				MEET_CATE_NAME: '就业',
				MEET_CANCEL_SET: 0,
				MEET_EMAIL_VERIFIED: 0,
				MEET_OBJ: { cover: ['https://cdn.example.com/cover-2.jpg'] },
				MEET_FORMS: []
			},
			{
				_id: 'meet-fallback-phone',
				_pid: 'workfit',
				MEET_TITLE: '老师旧',
				MEET_PHONE: '13800000099',
				MEET_STATUS: 1,
				MEET_OBJ: { cover: ['https://cdn.example.com/phone.jpg'] },
				MEET_FORMS: []
			},
			{
				_id: 'meet-fallback-title',
				_pid: 'workfit',
				MEET_TITLE: '同名老师',
				MEET_PHONE: '13800000111',
				MEET_STATUS: 1,
				MEET_OBJ: { cover: ['https://cdn.example.com/title.jpg'] },
				MEET_FORMS: []
			}
		]),
		days: clone(options.days || [
			{
				_id: 'day-1',
				DAY_MEET_ID: 'meet-1',
				day: '2026-06-05',
				dayDesc: '周五',
				times: [
					{ mark: 'd202606050900', start: '09:00', end: '10:00', status: 1, isLimit: false, stat: { succCnt: 0 } },
					{ mark: 'd202606051100', start: '11:00', end: '12:00', status: 0, isLimit: false, stat: { succCnt: 0 } },
					{ mark: 'd202606051300', start: '13:00', end: '14:00', status: 1, isLimit: true, limit: 1, stat: { succCnt: 1 } },
					{ mark: 'd202606051500', start: '15:00', end: '16:00', status: 1, isLimit: true, limit: 3, stat: { succCnt: 2 } }
				]
			},
			{
				_id: 'day-2',
				DAY_MEET_ID: 'meet-1',
				day: '2026-06-06',
				dayDesc: '周六',
				times: [
					{ mark: 'd202606060900', start: '09:00', end: '10:00', status: 1, isLimit: false, stat: { succCnt: 0 } }
				]
			},
			{
				_id: 'day-3',
				DAY_MEET_ID: 'meet-2',
				day: '2026-06-05',
				dayDesc: '周五',
				times: [
					{ mark: 'd202606050930', start: '09:30', end: '10:30', status: 1, isLimit: false, stat: { succCnt: 0 } }
				]
			}
		]),
		joins: clone(options.joins || [
			{
				_id: 'join-1',
				JOIN_USER_ID: 'user-1',
				JOIN_MEET_ID: 'meet-1',
				JOIN_MEET_CATE_ID: 'c1',
				JOIN_MEET_TITLE: '老师A',
				JOIN_MEET_DAY: '2026-06-05',
				JOIN_MEET_TIME_START: '09:00',
				JOIN_MEET_TIME_END: '10:00',
				JOIN_MEET_TIME_MARK: 'd202606050900',
				JOIN_STATUS: 1,
				JOIN_IS_CHECKIN: 0,
				JOIN_COMPLETE_END_TIME: '2026-06-05 10:00',
				JOIN_ADD_TIME: 10,
				JOIN_FORMS: [{ title: '姓名', val: '张三' }],
				JOIN_OBJ: { 姓名: '张三' },
				JOIN_CODE: '111111111111111'
			},
			{
				_id: 'join-2',
				JOIN_USER_ID: 'user-1',
				JOIN_MEET_ID: 'meet-1',
				JOIN_MEET_CATE_ID: 'c1',
				JOIN_MEET_TITLE: '老师A',
				JOIN_MEET_DAY: '2026-06-05',
				JOIN_MEET_TIME_START: '15:00',
				JOIN_MEET_TIME_END: '16:00',
				JOIN_MEET_TIME_MARK: 'd202606051500',
				JOIN_STATUS: 10,
				JOIN_IS_CHECKIN: 0,
				JOIN_COMPLETE_END_TIME: '2026-06-05 16:00',
				JOIN_ADD_TIME: 20,
				JOIN_REASON: '取消',
				JOIN_FORMS: [],
				JOIN_OBJ: {},
				JOIN_CODE: '222222222222222'
			},
			{
				_id: 'join-3',
				JOIN_USER_ID: 'user-2',
				JOIN_MEET_ID: 'meet-1',
				JOIN_MEET_CATE_ID: 'c1',
				JOIN_MEET_TITLE: '老师A',
				JOIN_MEET_DAY: '2026-06-05',
				JOIN_MEET_TIME_START: '15:00',
				JOIN_MEET_TIME_END: '16:00',
				JOIN_MEET_TIME_MARK: 'd202606051500',
				JOIN_STATUS: 1,
				JOIN_IS_CHECKIN: 1,
				JOIN_COMPLETE_END_TIME: '2026-06-05 16:00',
				JOIN_ADD_TIME: 30,
				JOIN_CHECKIN_TIME: 88,
				JOIN_FORMS: [],
				JOIN_OBJ: {},
				JOIN_CODE: '333333333333333'
			}
		]),
		users: clone(options.users || [
			{ USER_MINI_OPENID: 'user-1', USER_NAME: '学生甲', USER_MOBILE: '13900000000' }
		]),
		logs: [],
		mails: [],
		replacedLists: []
	};

	let nowCounter = 1000;
	const time2StampMap = new Map(Object.entries(options.time2StampMap || {
		'2026-06-05 09:00:00': 1200,
		'2026-06-05 15:00:00': 1600,
		'2026-06-06 09:00:00': 2200
	}));
	const nowDate = options.nowDate || '2026-06-05';
	const nowDateTime = options.nowDateTime || '2026-06-05 09:30:00';
	const nowDateMinute = options.nowDateMinute || '2026-06-05 09:30';
	const nowNumeric = options.nowNumeric || 1000;

	const MeetService = loadWithMocks(modulePath, {
		'./base_project_service.js': class BaseProjectService {
			AppError(msg) { throw appError(msg); }
			getProjectId() { return 'workfit'; }
			fmtOrderBySort(sortVal, key) { return { [key]: sortVal }; }
		},
		'../../../framework/utils/util.js': {
			isDefined: v => v !== undefined
		},
		'../model/meet_model.js': {
			STATUS: { COMM: 1, OVER: 9 },
			getOne: async where => clone(state.meets.find(item => matchWhere(item, where)) || null),
			getAll: async where => state.meets.filter(item => matchWhere(item, where)).map(clone),
			getList: async (where, fields, orderBy, page, size, isTotal, oldTotal) => ({
				where: clone(where),
				orderBy: clone(orderBy),
				list: state.meets.filter(item => {
					const andOk = !where.and || matchWhere(item, where.and);
					const orOk = !where.or || where.or.some(orWhere => matchWhere(item, orWhere));
					return andOk && orOk;
				}).map(clone)
			}),
			edit: async (where, data) => {
				const row = state.meets.find(item => matchWhere(item, where));
				Object.assign(row, clone(data));
			}
		},
		'../model/join_model.js': {
			STATUS: { SUCC: 1, CANCEL: 10, ADMIN_CANCEL: 99 },
			getOne: async (where, fields, orderBy) => {
				let list = state.joins.filter(item => matchWhere(item, where));
				if (orderBy && orderBy.JOIN_ADD_TIME === 'desc') list = list.sort((a, b) => b.JOIN_ADD_TIME - a.JOIN_ADD_TIME);
				return clone(list[0] || null);
			},
			getAll: async (where, fields, orderBy) => {
				let list = state.joins.filter(item => matchWhere(item, where));
				if (orderBy?.JOIN_ADD_TIME === 'desc') list = list.sort((a, b) => b.JOIN_ADD_TIME - a.JOIN_ADD_TIME);
				if (orderBy?.JOIN_MEET_TIME_START === 'asc') list = list.sort((a, b) => a.JOIN_MEET_TIME_START.localeCompare(b.JOIN_MEET_TIME_START));
				return clone(list);
			},
			getList: async (where, fields, orderBy) => ({
				where: clone(where),
				orderBy: clone(orderBy),
				list: state.joins.filter(item => matchWhere(item, where)).map(clone)
			}),
			count: async where => state.joins.filter(item => matchWhere(item, where)).length,
			groupCount: async where => {
				const matches = state.joins.filter(item => matchWhere(item, where));
				const out = {};
				for (const join of matches) {
					out[`JOIN_STATUS_${join.JOIN_STATUS}`] = (out[`JOIN_STATUS_${join.JOIN_STATUS}`] || 0) + 1;
				}
				return out;
			},
			insert: async data => {
				state.joins.push({ _id: `join-${state.joins.length + 1}`, JOIN_ADD_TIME: ++nowCounter, ...clone(data) });
			},
			del: async where => {
				state.joins = state.joins.filter(item => !matchWhere(item, where));
			}
		},
		'../model/day_model.js': {
			getOne: async where => clone(state.days.find(item => matchWhere(item, where)) || null),
			getAll: async where => state.days.filter(item => matchWhere(item, where)).map(clone),
			getAllBig: async where => state.days.filter(item => matchWhere(item, where)).map(clone),
			edit: async (where, data) => {
				const row = state.days.find(item => matchWhere(item, where));
				for (const [key, value] of Object.entries(data)) {
					if (key.startsWith('times.')) {
						const [, idx, leaf] = key.split('.');
						row.times[Number(idx)][leaf] = clone(value);
					} else {
						row[key] = clone(value);
					}
				}
			}
		},
		'../../../framework/utils/log_util.js': class LogUtil {
			debug(msg) { state.logs.push({ level: 'debug', msg }); }
			error(msg) { state.logs.push({ level: 'error', msg }); }
		},
		'../../../framework/utils/time_util.js': {
			time: fmt => {
				if (fmt === 'Y-M-D') return nowDate;
				if (fmt === 'Y-M-D h:m:s') return nowDateTime;
				if (fmt === 'Y-M-D h:m') return nowDateMinute;
				return nowNumeric + (++nowCounter);
			},
			time2Timestamp: input => time2StampMap.get(input) || 9999,
			fmtDateCHN: day => `中文${day}`
		},
		'../../../framework/utils/data_util.js': {
			deepClone: clone,
			dbForms2Obj: forms => forms.reduce((acc, item) => ({ ...acc, [item.title]: item.val }), {}),
			genRandomIntString: () => '444444444444444'
		},
		'../public/project_config.js': {
			MEET_LOG_LEVEL: 'debug',
			MEET_MAX_JOIN_CNT: 1
		},
		'../../../framework/lib/mail_lib.js': {
			sendMail: async payload => { state.mails.push(payload); }
		},
		'../model/user_model.js': {
			getOne: async where => clone(state.users.find(item => matchWhere(item, where)) || null)
		},
		'./support/meet_image_service.js': class MeetImageService {
			async replaceCloudImageList(list) {
				state.replacedLists.push(clone(list));
				return list.map(item => item.startsWith('cloud://') ? item.replace('cloud://', 'https://temp/') : item);
			}
			async formatMeetObjImages(meetObj = {}) {
				const out = clone(meetObj);
				if (Array.isArray(out.cover)) out.cover = out.cover.map(item => item.startsWith('cloud://') ? item.replace('cloud://', 'https://temp/') : item);
				return out;
			}
			buildDisplayObj(meet = {}, fallbackMeet = null, applyDefaultCover = false) {
				const primary = meet.MEET_OBJ && Object.keys(meet.MEET_OBJ).length ? meet.MEET_OBJ : null;
				const fallback = fallbackMeet?.MEET_OBJ || null;
				const obj = clone(primary || fallback || {});
				if (applyDefaultCover && (!Array.isArray(obj.cover) || obj.cover.length === 0)) obj.cover = ['/images/cover.gif'];
				return obj;
			}
			hasDisplayCover(meetObj = {}) {
				return Array.isArray(meetObj.cover) && meetObj.cover.length > 0;
			}
			getCoverSrc(meetObj = {}, defaultCover = '/images/cover.gif') {
				if (Array.isArray(meetObj.cover) && meetObj.cover.length > 0) return meetObj.cover[0];
				return defaultCover;
			}
		}
	});

	return { service: new MeetService(), state };
}

test('MeetService covers helpers, image formatting and day queries', async () => {
	const { service, state } = createMeetService();

	assert.equal(await service._findDisplayFallbackMeet(null), null);
	assert.equal((await service._findDisplayFallbackMeet({ _id: 'meet-x', MEET_PHONE: '13800000099' }))._id, 'meet-fallback-phone');
	assert.equal((await service._findDisplayFallbackMeet({ _id: 'meet-y', MEET_TITLE: '同名老师' }))._id, 'meet-fallback-title');

	assert.deepEqual(await service._replaceCloudImageList(['cloud://a', 'https://b']), ['https://temp/a', 'https://b']);
	assert.deepEqual(await service._formatMeetObjImages({ cover: ['cloud://c'] }), { cover: ['https://temp/c'] });

	const meetNoCover = { _id: 'meet-z', MEET_PHONE: '13800000099', MEET_OBJ: {} };
	await service._formatMeetImages(meetNoCover);
	assert.equal(meetNoCover.MEET_OBJ.cover[0], 'https://cdn.example.com/phone.jpg');

	const originalFormatter = service._meetImageService.formatMeetObjImages;
	service._meetImageService.formatMeetObjImages = async () => { throw new Error('boom'); };
	const brokenMeet = { _id: 'meet-broken', MEET_OBJ: {} };
	await service._formatMeetImages(brokenMeet);
	assert.equal(brokenMeet.MEET_OBJ.cover[0], '/images/cover.gif');
	service._meetImageService.formatMeetObjImages = originalFormatter;

	assert.throws(() => service.AppError('x'), err => err.name === 'AppError');
	service._meetLog({ MEET_TITLE: '课' }, 'func', 'msg');
	assert.equal(state.logs.at(-1).level, 'debug');

	const meetOneDay = await service.getMeetOneDay('meet-1', '2026-06-05', { _id: 'meet-1' });
	assert.equal(meetOneDay.MEET_DAYS_SET.length, 1);
	assert.equal((await service.getDaysSet('meet-1', '2026-06-05', '2026-06-05'))[0]._id, undefined);
	assert.equal((await service.getDaysSet('meet-1', '2026-06-05', '2026-06-06')).length, 2);
	assert.equal((await service.getDaysSet('meet-1', null, '2026-06-05')).length, 1);
	assert.equal((await service.getDaysSet('meet-1', '2026-06-06', null)).length, 1);

	await service.statJoinCnt('meet-1', 'd202606051500');
	const updatedDay = state.days.find(item => item._id === 'day-1');
	assert.deepEqual(updatedDay.times.find(item => item.mark === 'd202606051500').stat, { succCnt: 1, cancelCnt: 1, adminCancelCnt: 0 });
	await service.statJoinCnt('meet-none', 'd202606059999');

	assert.equal(service.getDayByTimeMark('d202606050900'), '2026-06-05');
	assert.equal(service.getDaySetByDay({ MEET_DAYS_SET: meetOneDay.MEET_DAYS_SET }, '2026-06-05').day, '2026-06-05');
	assert.equal(service.getDaySetByTimeMark(meetOneDay, 'd202606050900').day, '2026-06-05');
	assert.equal(service.getTimeSetByTimeMark(meetOneDay, 'd202606050900').start, '09:00');
	assert.equal(service.getTimeSetByTimeMark(meetOneDay, 'missing'), null);
});

test('MeetService covers rules, join flow and cancel flow', async () => {
	const { service, state } = createMeetService();

	let delegated = false;
	const originalCheckMeetRules = service.checkMeetRules.bind(service);
	service.checkMeetRules = async () => { delegated = true; };
	await service.beforeJoin('user-1', 'meet-1', 'd202606050900');
	assert.equal(delegated, true);
	service.checkMeetRules = originalCheckMeetRules;

	await assert.rejects(() => service.checkMeetTimeControll(null, 'd202606050900'));
	const meet = await service.getMeetOneDay('meet-1', '2026-06-05', { _id: 'meet-1' });
	await assert.rejects(() => service.checkMeetTimeControll(meet, 'd202606059999'));
	await assert.rejects(() => service.checkMeetTimeControll(meet, 'd202606051100'));
	await assert.rejects(() => service.checkMeetTimeControll(meet, 'd202606051300'));
	await assert.rejects(() => service.checkMeetTimeControll(meet, 'd202606051500', 2));
	await service.checkMeetTimeControll(meet, 'd202606050900');

	await assert.rejects(() => service.checkMeetRules('user-1', 'none', 'd202606050900'));
	await service.checkMeetRules('user-new', 'meet-1', 'd202606060900');

	await assert.rejects(() => service.checkMeetLimitSet('user-1', null, 'd202606050900', 1));
	await assert.rejects(() => service.checkMeetLimitSet('user-1', meet, 'd202606050900', 1));
	const meet0606 = await service.getMeetOneDay('meet-1', '2026-06-06', { _id: 'meet-1' });
	await service.checkMeetLimitSet('user-new', meet0606, 'd202606060900', 1);

	const expired = createMeetService({ nowDateTime: '2026-06-05 17:00:00', nowDateMinute: '2026-06-05 17:00' }).service;
	const expiredMeet = await expired.getMeetOneDay('meet-1', '2026-06-05', { _id: 'meet-1' });
	await assert.rejects(() => expired.checkMeetEndSet(expiredMeet, 'd202606050900'));
	await assert.rejects(() => service.checkMeetEndSet(null, 'd202606050900'));
	await service.checkMeetEndSet(meet, 'd202606050900');

	await assert.rejects(() => service.join('user-1', 'none', 'd202606050900', [[{ title: '姓名', val: 'A' }]]));
	await assert.rejects(() => service.join('user-1', 'meet-1', 'd202606059999', [[{ title: '姓名', val: 'A' }]]));

	const badGetTime = service.getTimeSetByTimeMark.bind(service);
	service.getTimeSetByTimeMark = () => null;
	await assert.rejects(() => service.join('user-1', 'meet-1', 'd202606050900', [[{ title: '姓名', val: 'A' }]]));
	service.getTimeSetByTimeMark = badGetTime;

	service.checkMeetRules = async () => {};
	const joinRet = await service.join('user-1', 'meet-1', 'd202606050900', [[{ title: '姓名', val: '李四' }], [{ title: '姓名', val: '王五' }]]);
	assert.deepEqual(joinRet, { result: 'ok' });
	assert.equal(state.joins.filter(item => item.JOIN_CODE === '444444444444444').length, 2);
	assert.equal(state.mails.length, 1);
	assert.ok(state.mails[0].subject.includes('老师A'));

	const { service: noMailService, state: noMailState } = createMeetService({
		meets: [{ _id: 'meet-1', MEET_TITLE: '老师A', MEET_PHONE: '13800000000', MEET_STATUS: 1, MEET_CATE_ID: 'c1', MEET_CATE_NAME: '咨询', MEET_CANCEL_SET: 1, MEET_EMAIL_VERIFIED: 0, MEET_OBJ: { cover: ['cloud://cover-1'] } }]
	});
	noMailService.checkMeetRules = async () => {};
	await noMailService.join('user-1', 'meet-1', 'd202606050900', [[{ title: '姓名', val: '李四' }]]);
	assert.equal(noMailState.mails.length, 0);

	await assert.rejects(() => service.cancelMyJoin('user-1', 'missing'));

	const { service: cancelNoMeet } = createMeetService({
		joins: [{ _id: 'join-x', JOIN_USER_ID: 'user-1', JOIN_MEET_ID: 'meet-x', JOIN_MEET_DAY: '2026-06-05', JOIN_MEET_TIME_MARK: 'd202606050900', JOIN_STATUS: 1, JOIN_IS_CHECKIN: 0 }]
	});
	await assert.rejects(() => cancelNoMeet.cancelMyJoin('user-1', 'join-x'));

	const { service: cancelNoTime, state: cancelNoTimeState } = createMeetService();
	cancelNoTimeState.days[0].times = [];
	await assert.rejects(() => cancelNoTime.cancelMyJoin('user-1', 'join-1'));

	const { service: cancelForbidden, state: cancelForbiddenState } = createMeetService();
	cancelForbiddenState.meets.find(item => item._id === 'meet-1').MEET_CANCEL_SET = 0;
	await assert.rejects(() => cancelForbidden.cancelMyJoin('user-1', 'join-1'));

	const { service: cancelStarted, state: cancelStartedState } = createMeetService({
		nowNumeric: 5000,
		time2StampMap: { '2026-06-05 09:00:00': 1000, '2026-06-05 15:00:00': 1600, '2026-06-06 09:00:00': 2200 }
	});
	cancelStartedState.meets.find(item => item._id === 'meet-1').MEET_CANCEL_SET = 2;
	await assert.rejects(() => cancelStarted.cancelMyJoin('user-1', 'join-1'));

	await service.cancelMyJoin('user-1', 'join-1');
	assert.equal(state.joins.some(item => item._id === 'join-1'), false);
});

test('MeetService covers view, detail, day list and list queries', async () => {
	const { service, state } = createMeetService();
	state.joins.find(item => item._id === 'join-1').JOIN_ADD_TIME = 999;

	assert.equal(await service.viewMeet('none'), null);
	const viewed = await service.viewMeet('meet-1');
	assert.equal(viewed.MEET_TITLE, '老师A');
	assert.equal(viewed.MEET_OBJ.cover[0], 'https://temp/cover-1');
	assert.equal(viewed.MEET_DAYS_SET.length, 2);
	assert.equal(viewed.MEET_DAYS_SET[0].times.some(item => item.status === 0), false);
	assert.equal(viewed.MEET_DAYS_SET[0].times.find(item => item.mark === 'd202606051300').error, '预约已满');

	const expiredView = createMeetService({ nowDateTime: '2026-06-05 23:00:00' }).service;
	const expiredRet = await expiredView.viewMeet('meet-1');
	assert.equal(expiredRet.MEET_DAYS_SET[0].times.find(item => item.mark === 'd202606050900').error, '预约结束');

	assert.equal(await service.detailForJoin('user-1', 'none', 'd202606050900'), null);
	const detail = await service.detailForJoin('user-1', 'meet-1', 'd202606050900');
	assert.ok(detail.dayDesc.includes('09:00'));
	assert.equal(detail.myForms[0].title, '姓名');

	const { service: detailEmptyService } = createMeetService({ joins: [] });
	const detailEmpty = await detailEmptyService.detailForJoin('user-1', 'meet-1', 'd202606050900');
	assert.deepEqual(detailEmpty.myForms, []);

	assert.equal((await service.getUsefulTimesByDaysSet('meet-1', '2026-06-05')).length, 3);
	assert.equal((await service.getMeetListByDay('2026-06-05')).length >= 1, true);
	assert.deepEqual(await service.getHasDaysFromDay('2026-06-05'), ['2026-06-05', '2026-06-06', '2026-06-05']);

	const listDefault = await service.getMeetList({ page: 1, size: 10 });
	assert.equal(listDefault.list.length >= 2, true);
	const listSearch = await service.getMeetList({ search: '老师', page: 1, size: 10 });
	assert.ok(Array.isArray(listSearch.where.or));
	const listSort = await service.getMeetList({ sortType: 'sort', sortVal: 'desc', page: 1, size: 10 });
	assert.deepEqual(listSort.orderBy, { NEWS_ADD_TIME: 'desc' });
	const listCate = await service.getMeetList({ sortType: 'cateId', sortVal: 'c1', page: 1, size: 10 });
	assert.equal(listCate.where.and.MEET_CATE_ID, 'c1');
});

test('MeetService covers my join detail, list filters and someday list', async () => {
	const { service } = createMeetService();

	const detail = await service.getMyJoinDetail('user-1', 'join-2');
	assert.equal(detail.JOIN_REASON, '取消');

	assert.ok((await service.getMyJoinList('user-1', { search: '老师', page: 1, size: 10 })).where.JOIN_MEET_TITLE);
	assert.equal((await service.getMyJoinList('user-1', { sortType: 'cateId', sortVal: 'c1', page: 1, size: 10 })).where.JOIN_MEET_CATE_ID, 'c1');
	assert.equal((await service.getMyJoinList('user-1', { sortType: 'use', page: 1, size: 10 })).where.JOIN_STATUS, 1);
	assert.equal((await service.getMyJoinList('user-1', { sortType: 'check', page: 1, size: 10 })).where.JOIN_IS_CHECKIN, 1);
	assert.equal((await service.getMyJoinList('user-1', { sortType: 'timeout', page: 1, size: 10 })).where.JOIN_IS_CHECKIN, 0);
	assert.equal((await service.getMyJoinList('user-1', { sortType: 'succ', page: 1, size: 10 })).where.JOIN_STATUS, 1);
	assert.deepEqual((await service.getMyJoinList('user-1', { sortType: 'cancel', page: 1, size: 10 })).where.JOIN_STATUS, ['in', [10, 99]]);
	assert.equal((await service.getMyJoinSomeday('user-1', '2026-06-05')).length, 2);
});
