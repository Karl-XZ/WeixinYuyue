const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const root = path.join(__dirname, '..', 'project', 'workfit');

function clone(v) {
	return v == null ? v : JSON.parse(JSON.stringify(v));
}

function matchWhere(row, where) {
	if (!where) return true;
	return Object.entries(where).every(([key, value]) => {
		const cell = row[key];
		if (Array.isArray(value)) {
			const [op, arg1, arg2] = value;
			if (op === 'between') return cell >= arg1 && cell <= arg2;
			if (op === 'in') return arg1.includes(cell);
			if (op === '<') return cell < arg1;
			if (op === '!=') return cell !== arg1;
			return false;
		}
		if (value && typeof value === 'object' && value.$regex) {
			return new RegExp(value.$regex.replace(/^\.\*/, ''), value.$options || '').test(cell || '');
		}
		return cell === value;
	});
}

function okMsg(ret, expected) {
	assert.equal(typeof ret?.msg, 'string');
	assert.ok(ret.msg.length > 0);
	if (expected) assert.equal(ret.msg, expected);
}

test('AdminMeetService covers CRUD, temp and export flows', async () => {
	let now = 1000;
	const state = {
		meets: [
			{ _id: 'meet-1', MEET_TITLE: '课程A', MEET_STATUS: 1, MEET_VOUCH: 0, MEET_ORDER: 1, MEET_CATE_ID: 'c1', MEET_CATE_NAME: '咨询', MEET_DAYS: [], MEET_FORMS: [], MEET_JOIN_FORMS: [], MEET_EDIT_TIME: 1, MEET_ADD_TIME: 1 },
			{ _id: 'meet-over', MEET_TITLE: '课程B', MEET_STATUS: 9, MEET_VOUCH: 0, MEET_ORDER: 2, MEET_CATE_ID: 'c2', MEET_CATE_NAME: '就业', MEET_DAYS: [], MEET_FORMS: [], MEET_JOIN_FORMS: [], MEET_EDIT_TIME: 2, MEET_ADD_TIME: 2 }
		],
		days: [
			{ _id: 'day-1', DAY_MEET_ID: 'meet-1', day: '2026-06-05', times: [{ mark: 'd202606050900', start: '09:00', end: '10:00', status: 1, stat: { succCnt: 1 } }], dayDesc: '周五' }
		],
		joins: [
			{ _id: 'join-1', JOIN_ID: 'J1', JOIN_MEET_ID: 'meet-1', JOIN_MEET_TITLE: '课程A', JOIN_MEET_DAY: '2026-06-05', JOIN_MEET_TIME_START: '09:00', JOIN_MEET_TIME_END: '10:00', JOIN_MEET_TIME_MARK: 'd202606050900', JOIN_USER_ID: 'u1', JOIN_STATUS: 1, JOIN_IS_CHECKIN: 0, JOIN_CODE: '123456789012345', JOIN_FORMS: [{ title: '姓名', val: '张三' }], JOIN_ADD_TIME: 10, JOIN_CHECKIN_TIME: 0 },
			{ _id: 'join-cancel', JOIN_ID: 'J2', JOIN_MEET_ID: 'meet-1', JOIN_MEET_TITLE: '课程A', JOIN_MEET_DAY: '2026-06-05', JOIN_MEET_TIME_START: '10:00', JOIN_MEET_TIME_END: '11:00', JOIN_MEET_TIME_MARK: 'd202606051000', JOIN_USER_ID: 'u2', JOIN_STATUS: 10, JOIN_IS_CHECKIN: 0, JOIN_CODE: '999999999999999', JOIN_FORMS: [], JOIN_ADD_TIME: 11, JOIN_CHECKIN_TIME: 0, JOIN_REASON: '取消' }
		],
		temps: [
			{ _id: 'temp-1', TEMP_MEET_ID: 'admin', TEMP_NAME: '模板A', TEMP_TIMES: ['09:00'], TEMP_ADD_TIME: 1, TEMP_EDIT_TIME: 1 }
		]
	};

	const serviceClass = loadWithMocks(path.join(root, 'service', 'admin', 'admin_meet_service.js'), {
		'./base_project_admin_service.js': class BaseProjectAdminService {
			AppError(msg) { throw new Error(msg); }
			async genDetailQr(type, id) { return id === 'meet-qr' || id === 'meet-1' ? 'qr-url' : ''; }
			getProjectId() { return 'workfit'; }
			getAdminId() { return 'admin-1'; }
			fmtOrderBySort(sortVal, key) { return { [key]: sortVal }; }
		},
		'../meet_service.js': class MeetService {
			async getDaysSet(meetId, startDay) {
				return state.days.filter(item => item.DAY_MEET_ID === meetId && item.day >= startDay).map(item => ({
					day: item.day,
					times: clone(item.times),
					dayDesc: item.dayDesc
				}));
			}
		},
		'../admin/admin_home_service.js': class AdminHomeService {},
		'../../../../framework/utils/data_util.js': {},
		'../../../../framework/utils/time_util.js': {
			time: fmt => fmt === 'Y-M-D' ? '2026-06-05' : (fmt === 'Y-M-D-h-m-s' ? '2026-06-05-10-00-00' : ++now),
			timestamp2Time: ts => `TIME-${ts}`
		},
		'../../../../framework/utils/setup/setup_util.js': {},
		'../../../../framework/utils/util.js': { isDefined: v => v !== undefined },
		'../../../../framework/cloud/cloud_util.js': {},
		'../../../../framework/cloud/cloud_base.js': {},
		'../../../../framework/lib/md5_lib.js': { md5: value => `md5-${value}` },
		'../../model/meet_model.js': {
			STATUS: { COMM: 1, OVER: 9 },
			STATUS_DESC: { 1: '启用', 9: '结束', 10: '关闭' },
			getOne: async where => clone(state.meets.find(item => matchWhere(item, where)) || null),
			edit: async (whereOrId, data) => {
				const where = typeof whereOrId === 'string' ? { _id: whereOrId } : whereOrId;
				const row = state.meets.find(item => matchWhere(item, where));
				Object.assign(row, clone(data));
			},
			insert: async data => {
				const id = `meet-${state.meets.length + 1}`;
				state.meets.push({ _id: id, ...clone(data) });
				return id;
			},
			del: async where => { state.meets = state.meets.filter(item => !matchWhere(item, where)); },
			editForms: async (id, formsKey, objKey, hasImageForms) => {
				const row = state.meets.find(item => item._id === id);
				row[formsKey] = clone(hasImageForms);
				row[objKey] = { touched: 1 };
			},
			getList: async (where, fields, orderBy) => ({ where: clone(where), orderBy: clone(orderBy), list: state.meets.filter(item => matchWhere(item, where.and || where)).map(clone) })
		},
		'../../model/join_model.js': {
			STATUS: { SUCC: 1, CANCEL: 10, ADMIN_CANCEL: 99 },
			STATUS_DESC: { 1: '成功', 10: '取消', 99: '系统取消' },
			getOne: async where => clone(state.joins.find(item => matchWhere(item, where)) || null),
			getAll: async where => state.joins.filter(item => matchWhere(item, where)).map(clone),
			getList: async where => ({ where: clone(where), list: state.joins.filter(item => matchWhere(item, where)).map(clone) }),
			count: async where => state.joins.filter(item => matchWhere(item, where)).length,
			edit: async (whereOrId, data) => {
				const where = typeof whereOrId === 'string' ? { _id: whereOrId } : whereOrId;
				const row = state.joins.find(item => matchWhere(item, where));
				Object.assign(row, clone(data));
			},
			del: async where => { state.joins = state.joins.filter(item => !matchWhere(item, where)); }
		},
		'../../model/day_model.js': {
			getAllBig: async where => state.days.filter(item => matchWhere(item, where)).map(clone),
			getOne: async where => clone(state.days.find(item => matchWhere(item, where)) || null),
			edit: async (where, data) => {
				const row = state.days.find(item => matchWhere(item, where));
				Object.assign(row, clone(data));
			},
			insert: async data => {
				state.days.push({ _id: `day-${state.days.length + 1}`, ...clone(data) });
			},
			del: async where => { state.days = state.days.filter(item => !matchWhere(item, where)); }
		},
		'../../model/temp_model.js': {
			getOne: async where => clone(state.temps.find(item => matchWhere(item, where)) || null),
			insert: async data => {
				const id = `temp-${state.temps.length + 1}`;
				state.temps.push({ _id: id, ...clone(data) });
				return id;
			},
			edit: async (where, data) => {
				const row = state.temps.find(item => matchWhere(item, where));
				Object.assign(row, clone(data));
			},
			del: async where => { state.temps = state.temps.filter(item => !matchWhere(item, where)); },
			getAll: async where => state.temps.filter(item => matchWhere(item, where)).map(clone)
		},
		'../../../../framework/utils/export_util.js': {
			getExportDataURL: async key => ({ key, url: 'export-url' }),
			deleteDataExcel: async key => ({ key, deleted: 1 }),
			exportDataExcel: async (key, data, title) => ({ key, data, title })
		}
	});

	const service = new serviceClass();

	await assert.rejects(() => service.vouchMeetSetup('none', 1));
	state.meets.push({ _id: 'meet-qr', MEET_TITLE: '课程QR', MEET_STATUS: 1 });
	okMsg(await service.vouchMeetSetup('meet-qr', 1), '设置成功');
	assert.equal(state.meets.find(item => item._id === 'meet-qr').MEET_QR, 'qr-url');

	assert.equal((await service.getDayList('meet-1', '2026-06-01', '2026-06-30')).length, 1);
	assert.deepEqual(await service.statJoinCntByMeet('meet-1'), { totalCnt: 2, succCnt: 1, checkinCnt: 0, cancelCnt: 1 });

	await assert.rejects(() => service.checkinJoin('none', 1));
	await assert.rejects(() => service.checkinJoin('join-cancel', 1));
	okMsg(await service.checkinJoin('join-1', 1), '签到成功');
	assert.equal(state.joins.find(item => item._id === 'join-1').JOIN_IS_CHECKIN, 1);
	okMsg(await service.checkinJoin('join-1', 0), '取消签到成功');

	await assert.rejects(() => service.scanJoin('meet-1', 'bad'));
	await assert.rejects(() => service.scanJoin('meet-1', '999999999999999'));
	state.joins.find(item => item._id === 'join-1').JOIN_IS_CHECKIN = 1;
	await assert.rejects(() => service.scanJoin('meet-1', '123456789012345'));
	state.joins.find(item => item._id === 'join-1').JOIN_IS_CHECKIN = 0;
	const scanRet = await service.scanJoin('meet-1', '123456789012345');
	okMsg(scanRet, '签到成功');
	assert.equal(scanRet.join.JOIN_ID, 'J1');

	assert.equal(service.checkHasJoinCnt(null), false);
	assert.equal(service.checkHasJoinCnt([{ stat: { succCnt: 0 } }, { stat: { succCnt: 1 } }]), true);
	const modDays = service.getCanModifyDaysSet([{ day: '2026-06-04', times: [{ stat: { succCnt: 1 } }] }, { day: '2026-06-05', times: [{ stat: { succCnt: 0 } }] }]);
	assert.equal(modDays[0].hasJoin, undefined);
	assert.equal(modDays[1].hasJoin, false);

	await assert.rejects(() => service.cancelJoinByTimeMark('meet-1', 'd202606051100'));
	state.joins.push({ _id: 'join-3', JOIN_MEET_ID: 'meet-1', JOIN_MEET_TIME_MARK: 'd202606051100', JOIN_STATUS: 1 });
	const cancelRet = await service.cancelJoinByTimeMark('meet-1', 'd202606051100', '系统取消');
	assert.equal(cancelRet.cancelCnt, 1);
	assert.ok(cancelRet.msg.includes('1'));
	assert.equal(state.joins.find(item => item._id === 'join-3').JOIN_STATUS, 99);

	await assert.rejects(() => service.updateMeetForms({ id: 'none', hasImageForms: [] }));
	okMsg(await service.updateMeetForms({ id: 'meet-1', hasImageForms: ['img1'] }), '表单信息更新成功');
	assert.deepEqual(state.meets.find(item => item._id === 'meet-1').MEET_FORMS, ['img1']);

	await assert.rejects(() => service.insertMeet('admin-1', { title: '', cateId: 'c1' }));
	await assert.rejects(() => service.insertMeet('admin-1', { title: '课程', cateId: '' }));
	const inserted = await service.insertMeet('admin-1', { title: '课程新', cateId: 'c9', cateName: '新类', order: 8, cancelSet: 2, daysSet: [{ day: '2026-06-06', times: [], dayDesc: '' }], phone: '13800138000', password: 'secret', forms: ['f1'], joinForms: ['j1'] });
	okMsg(inserted, '添加成功');
	assert.equal(state.meets.find(item => item._id === inserted.id).MEET_PASSWORD, 'md5-secret');

	await assert.rejects(() => service.setDays('none', { daysSet: [] }));
	await assert.rejects(() => service.setDays('meet-1', { daysSet: 'bad' }));
	okMsg(await service.setDays('meet-1', { daysSet: [{ day: '2026-06-05', times: [{ mark: 'x' }], dayDesc: '今天' }, { day: '2026-06-07', times: [{ mark: 'y' }], dayDesc: '周日' }] }), '排期设置成功');
	assert.ok(state.days.some(item => item.day === '2026-06-07'));

	await assert.rejects(() => service.delMeet('none'));
	state.joins.push({ _id: 'join-succ-delete', JOIN_MEET_ID: 'meet-over', JOIN_STATUS: 1 });
	await assert.rejects(() => service.delMeet('meet-over'));
	state.joins = state.joins.filter(item => item._id !== 'join-succ-delete');
	okMsg(await service.delMeet('meet-over'), '删除成功');
	assert.equal(state.meets.some(item => item._id === 'meet-over'), false);

	assert.equal(await service.getMeetDetail('none'), null);
	assert.ok((await service.getMeetDetail('meet-1')).MEET_DAYS_SET);
	okMsg(await service._editDays('meet-1', '2026-06-05', [{ day: '2026-06-04', times: [] }, { day: '2026-06-05', times: [{ mark: 'a' }], dayDesc: '今天' }, { day: '2026-06-08', times: [{ mark: 'b' }], dayDesc: '后天' }]), '日期设置更新成功');
	assert.ok(state.days.some(item => item.day === '2026-06-08'));

	await assert.rejects(() => service.editMeet({ id: 'none', title: 'x', cateId: 'c1' }));
	await assert.rejects(() => service.editMeet({ id: 'meet-1', title: '', cateId: 'c1' }));
	await assert.rejects(() => service.editMeet({ id: 'meet-1', title: '课程A', cateId: '' }));
	okMsg(await service.editMeet({ id: 'meet-1', title: '课程A改', cateId: 'c1', cateName: '咨询', order: 3, cancelSet: 2, daysSet: [{ day: '2026-06-09', times: [], dayDesc: '' }], phone: '13900139000', password: 'newpass', forms: [], joinForms: [] }), '更新成功');
	assert.equal(state.meets.find(item => item._id === 'meet-1').MEET_PASSWORD, 'md5-newpass');

	assert.ok((await service.getJoinList({ search: '张', meetId: 'meet-1', mark: 'd202606050900', page: 1, size: 10 })).where['JOIN_FORMS.val']);
	assert.deepEqual((await service.getJoinList({ sortType: 'status', sortVal: 1099, meetId: 'meet-1', mark: 'd202606050900', page: 1, size: 10 })).where.JOIN_STATUS, ['in', [10, 99]]);
	assert.equal((await service.getJoinList({ sortType: 'checkin', sortVal: 1, meetId: 'meet-1', mark: 'd202606050900', page: 1, size: 10 })).where.JOIN_IS_CHECKIN, 1);

	assert.ok((await service.getAdminMeetList({ search: '课', page: 1, size: 10 })).where.MEET_TITLE);
	assert.equal((await service.getAdminMeetList({ sortType: 'status', sortVal: 1, page: 1, size: 10 })).where.MEET_STATUS, 1);
	assert.equal((await service.getAdminMeetList({ sortType: 'cateId', sortVal: 'c1', page: 1, size: 10 })).where.MEET_CATE_ID, 'c1');
	assert.deepEqual((await service.getAdminMeetList({ sortType: 'sort', sortVal: 'view', page: 1, size: 10 })).orderBy, { MEET_VIEW_CNT: 'desc', MEET_ADD_TIME: 'desc' });

	await assert.rejects(() => service.delJoin('none'));
	okMsg(await service.delJoin('join-cancel'), '删除成功');
	assert.equal(state.joins.some(item => item._id === 'join-cancel'), false);

	await assert.rejects(() => service.statusJoin('none', 1));
	const statusJoinRet = await service.statusJoin('join-1', 99, '后台取消');
	assert.ok(statusJoinRet.msg.includes('成功'));
	assert.equal(state.joins.find(item => item._id === 'join-1').JOIN_IS_CHECKIN, 0);
	assert.equal(state.joins.find(item => item._id === 'join-1').JOIN_REASON, '后台取消');

	await assert.rejects(() => service.statusMeet('none', 1));
	assert.ok((await service.statusMeet('meet-1', 9)).msg.includes('成功'));
	await assert.rejects(() => service.sortMeet('none', 1));
	okMsg(await service.sortMeet('meet-1', 7), '排序设置成功');
	await assert.rejects(() => service.vouchMeet('none', 1));
	assert.ok((await service.vouchMeet('meet-1', 1)).msg.includes('成功'));
	assert.ok((await service.vouchMeet('meet-1', 0)).msg.includes('成功'));

	await assert.rejects(() => service.insertMeetTemp({ name: '', times: [] }));
	await assert.rejects(() => service.insertMeetTemp({ name: '模板', times: [] }));
	await assert.rejects(() => service.insertMeetTemp({ name: '模板A', times: ['09:00'] }));
	const tempInsert = await service.insertMeetTemp({ name: '模板B', times: ['10:00'] });
	okMsg(tempInsert, '模板添加成功');
	await assert.rejects(() => service.editMeetTemp({ id: 'none', name: 'x', times: [] }));
	state.temps.push({ _id: 'temp-dup', TEMP_MEET_ID: 'admin', TEMP_NAME: '重复名', TEMP_TIMES: [] });
	await assert.rejects(() => service.editMeetTemp({ id: 'temp-1', name: '重复名', times: [] }));
	okMsg(await service.editMeetTemp({ id: 'temp-1', name: '模板A改', times: ['11:00'] }), '模板更新成功');
	await assert.rejects(() => service.delMeetTemp('none'));
	okMsg(await service.delMeetTemp('temp-1'), '模板删除成功');
	assert.ok(Array.isArray(await service.getMeetTempList()));

	assert.deepEqual(await service.getJoinDataURL(), { key: 'EXPORT_JOIN_DATA', url: 'export-url' });
	assert.deepEqual(await service.deleteJoinDataExcel(), { key: 'EXPORT_JOIN_DATA', deleted: 1 });
	await assert.rejects(() => service.exportJoinDataExcel({ meetId: 'none', startDay: '2026-01-01', endDay: '2026-01-02', status: 1 }));
	state.joins.push({ _id: 'join-export', JOIN_ID: 'JX', JOIN_CODE: 'code-x', JOIN_USER_ID: 'ux', JOIN_MEET_ID: 'meet-1', JOIN_MEET_TITLE: '课程A', JOIN_MEET_DAY: '2026-06-05', JOIN_MEET_TIME_START: '09:00', JOIN_MEET_TIME_END: '10:00', JOIN_FORMS: [{ title: '姓名', val: '李四' }], JOIN_STATUS: 1, JOIN_IS_CHECKIN: 1, JOIN_CHECKIN_TIME: 88, JOIN_ADD_TIME: 77, JOIN_REASON: '' });
	const exported = await service.exportJoinDataExcel({ meetId: 'meet-1', startDay: '2026-06-01', endDay: '2026-06-30', status: 1 });
	assert.equal(exported.key, 'EXPORT_JOIN_DATA');
	assert.ok(exported.data.length >= 1);
	assert.ok(exported.title.includes('2026-06-05-10-00-00'));
});
