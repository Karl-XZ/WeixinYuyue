const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const root = path.join(__dirname, '..', 'project', 'workfit');

function createWorkHomeService({
	meets,
	gatePwd = 'gate',
	getTempFileURLOne = async fileId => `https://temp/${fileId}`,
	insertImpl = null,
	getAllImpl = null
} = {}) {
	let now = 1000;
	const logs = [];
	const state = {
		meets: (meets || [
			{
				_id: 'meet-1',
				MEET_PHONE: '13800138000',
				MEET_PASSWORD: 'md5-pass1',
				MEET_TITLE: 'TeacherA',
				MEET_OBJ: { cover: ['cloud://cover-a'] },
				MEET_LOGIN_TIME: 0,
				MEET_LOGIN_CNT: 1,
				MEET_EDIT_TIME: 2,
				MEET_ADD_TIME: 1,
				MEET_STATUS: 1
			},
			{
				_id: 'meet-disabled',
				MEET_PHONE: '13900139000',
				MEET_PASSWORD: 'md5-oldpass',
				MEET_TITLE: 'TeacherB',
				MEET_OBJ: {},
				MEET_STATUS: 0,
				MEET_EDIT_TIME: 4,
				MEET_ADD_TIME: 3
			}
		]).map(item => JSON.parse(JSON.stringify(item)))
	};

	const cloneMeet = item => item ? JSON.parse(JSON.stringify(item)) : null;

	const WorkHomeService = loadWithMocks(path.join(root, 'service', 'work', 'work_home_service.js'), {
		'./base_project_work_service.js': class BaseProjectWorkService {
			AppError(msg) { throw new Error(msg); }
		},
		'../../../../framework/utils/time_util.js': {
			time: fmt => fmt ? '2026-06-05' : ++now,
			timestamp2Time: ts => `TIME-${ts}`
		},
		'../../../../framework/utils/data_util.js': {
			genRandomString: len => `token-${len}`
		},
		'../../../../framework/lib/md5_lib.js': {
			md5: value => `md5-${value}`
		},
		'../../../../framework/utils/setup/setup_util.js': {
			get: async () => gatePwd
		},
		'../../../../config/config.js': {
			WORK_TEACHER_PWD_DEFAULT: 'default-gate'
		},
		'../../public/constants.js': {
			SETUP_WORK_TEACHER_PWD: 'SETUP_WORK_TEACHER_PWD'
		},
		'../mail_verify_service.js': class MailVerifyService {
			async verifyRegisterCode(email, code) { logs.push(['verifyRegisterCode', email, code]); }
		},
		'../../../../framework/cloud/cloud_util.js': {
			getTempFileURLOne
		},
		'../../model/meet_model.js': {
			STATUS: { COMM: 1 },
			getAll: getAllImpl || (async where => {
				if (where.and && where.and.MEET_STATUS === 1 && Array.isArray(where.or)) {
					return state.meets
						.filter(item => item.MEET_STATUS === 1 && where.or.some(cond => String(item.MEET_PHONE) === String(cond.MEET_PHONE)))
						.map(cloneMeet);
				}
				if (Array.isArray(where.or)) {
					return state.meets
						.filter(item => where.or.some(cond => String(item.MEET_PHONE) === String(cond.MEET_PHONE)))
						.map(cloneMeet);
				}
				if (where.MEET_PHONE && Array.isArray(where.MEET_PHONE)) {
					const likeVal = where.MEET_PHONE[1];
					return state.meets.filter(item => String(item.MEET_PHONE).includes(likeVal)).map(cloneMeet);
				}
				if (where.and && where.and.MEET_PHONE && Array.isArray(where.and.MEET_PHONE)) {
					const likeVal = where.and.MEET_PHONE[1];
					return state.meets
						.filter(item => item.MEET_STATUS === 1 && String(item.MEET_PHONE).includes(likeVal))
						.map(cloneMeet);
				}
				return [];
			}),
			edit: async (id, data) => {
				const item = state.meets.find(entry => entry._id === id);
				Object.assign(item, data);
			},
			insert: insertImpl || (async data => {
				const id = `meet-${state.meets.length + 1}`;
				state.meets.push({ _id: id, ...data });
			}),
			getOne: async where => cloneMeet(state.meets.find(item => item._id === where._id && (!where.MEET_PASSWORD || item.MEET_PASSWORD === where.MEET_PASSWORD)) || null)
		},
		'../../service/meet_service.js': class MeetService {
			async getDaysSet(meetId, day) { logs.push(['getDaysSet', meetId, day]); return ['d1', 'd2']; }
		}
	});

	return { service: new WorkHomeService(), state, logs };
}

test('WorkHomeService covers normalization, gate password, login, register and password update', async () => {
	const { service, state, logs } = createWorkHomeService();

	assert.equal(service._normalizeText('  abc  '), 'abc');
	assert.equal(service._normalizeText(null), '');
	assert.equal(service._normalizeOpenId('xxx^^^oOpenId'), 'oOpenId');
	assert.equal(service._normalizeOpenId('123oOpenId'), 'oOpenId');

	const listed = await service._listTeacherByPhone('13800138000', '*', true);
	assert.equal(listed.length, 1);
	assert.equal((await service._listTeacherByPhone('', '*', true)).length, 0);
	assert.equal((await service._listTeacherByPhone('13800138', '*', true)).length, 0);
	assert.equal(await service._getTeacherGatePwd(), 'gate');

	const { service: defaultGateService } = createWorkHomeService({ gatePwd: '' });
	assert.equal(await defaultGateService._getTeacherGatePwd(), 'default-gate');

	await assert.rejects(() => service._checkTeacherGatePwd('bad'));
	await service._checkTeacherGatePwd(' gate ');

	assert.deepEqual(await service.workHome('meet-1'), { dayCnt: 2 });
	await assert.rejects(() => service.workLogin('13800138000', 'pass1', 'oOpenId', 'bad'));
	await assert.rejects(() => service.workLogin('13800138000', 'badpass', 'oOpenId', 'gate'));

	const loginRet = await service.workLogin('13800138000', 'pass1', 'xxx^^^oOpenId', 'gate');
	assert.equal(loginRet.id, 'meet-1');
	assert.equal(loginRet.token, 'token-32');
	assert.equal(loginRet.last, '尚未登录');
	assert.equal(loginRet.pic, 'https://temp/cloud://cover-a');
	assert.equal(state.meets.find(item => item._id === 'meet-1').MEET_MINI_OPENID, 'oOpenId');

	const { service: noTempService } = createWorkHomeService({
		getTempFileURLOne: async () => ''
	});
	const noTempLogin = await noTempService.workLogin('13800138000', 'pass1', 'oOpenId4', 'gate');
	assert.equal(noTempLogin.pic, 'cloud://cover-a');

	await assert.rejects(() => service.workRegister({ phone: '13800138000', password: 'pass1', name: 'TeacherA', email: 'a@test.com', emailCode: '123456' }, 'oOpenId', 'gate'));
	const reactivated = await service.workRegister({ phone: '13900139000', password: 'newpass', name: 'TeacherB', email: 'b@test.com', emailCode: '123456' }, 'oOpenId2', 'gate');
	assert.equal(reactivated.id, 'meet-disabled');
	assert.equal(state.meets.find(item => item._id === 'meet-disabled').MEET_STATUS, 1);

	state.meets.find(item => item._id === 'meet-disabled').MEET_STATUS = 0;
	const reactivatedNoName = await service.workRegister({ phone: '13900139000', password: 'newpass2', name: '', email: 'b2@test.com', emailCode: '123456' }, 'oOpenId2b', 'gate');
	assert.equal(reactivatedNoName.id, 'meet-disabled');
	assert.ok(state.meets.find(item => item._id === 'meet-disabled').MEET_TITLE.length > 0);

	const newRegister = await service.workRegister({ phone: '13700137000', password: 'pass2', name: 'TeacherC', email: 'c@test.com', emailCode: '654321' }, 'oOpenId3', 'gate');
	assert.equal(newRegister.token, 'token-32');
	assert.ok(state.meets.some(item => item.MEET_PHONE === '13700137000'));

	const noNameRegister = await service.workRegister({ phone: '13600136000', password: 'pass3', name: '', email: 'd@test.com', emailCode: '654321' }, 'oOpenId5', 'gate');
	assert.equal(noNameRegister.token, 'token-32');
	assert.ok(state.meets.some(item => item.MEET_PHONE === '13600136000' && typeof item.MEET_TITLE === 'string' && item.MEET_TITLE.length > 0));

	await assert.rejects(() => service.pwdWork('meet-1', 'badold', 'newpass1'));
	await service.pwdWork('meet-1', 'pass1', 'newpass1');
	assert.equal(state.meets.find(item => item._id === 'meet-1').MEET_PASSWORD, 'md5-newpass1');
	assert.ok(logs.some(item => Array.isArray(item) && item[0] === 'verifyRegisterCode'));
});

test('WorkHomeService handles insert duplicate and passthrough insert errors', async () => {
	const { service } = createWorkHomeService({
		meets: [],
		insertImpl: async data => {
			if (data.MEET_PHONE === 'duplicate') throw new Error('duplicate key');
			throw new Error('boom');
		}
	});

	await assert.rejects(() => service.workRegister({ phone: 'duplicate', password: 'pass4', name: '', email: 'e@test.com', emailCode: '123456' }, 'oOpenId6', 'gate'));
	await assert.rejects(() => service.workRegister({ phone: 'boom', password: 'pass4', name: '', email: 'e@test.com', emailCode: '123456' }, 'oOpenId6', 'gate'), /boom/);
});

test('WorkHomeService filters fuzzy phone matches and handles empty stored password', async () => {
	const { service, state } = createWorkHomeService({
		meets: [
			{ _id: 'm1', MEET_PHONE: '18800001234', MEET_PASSWORD: '', MEET_TITLE: 'TeacherX', MEET_OBJ: {}, MEET_LOGIN_TIME: 0, MEET_LOGIN_CNT: 0, MEET_EDIT_TIME: 2, MEET_ADD_TIME: 1, MEET_STATUS: 1 },
			{ _id: 'm2', MEET_PHONE: '18800009999', MEET_PASSWORD: 'md5-pass1', MEET_TITLE: 'TeacherY', MEET_OBJ: {}, MEET_LOGIN_TIME: 0, MEET_LOGIN_CNT: 0, MEET_EDIT_TIME: 3, MEET_ADD_TIME: 2, MEET_STATUS: 1 }
		]
	});
	const fuzzy = await service._listTeacherByPhone('1880000', '*', true);
	assert.equal(fuzzy.length, 0);
	await assert.rejects(() => service.workLogin('18800001234', 'pass1', 'oOpenId', 'gate'));
	assert.equal(state.meets.length, 2);
});

test('WorkHomeService handles null teacher list and chinese duplicate insert errors', async () => {
	const { service } = createWorkHomeService({
		meets: [],
		getAllImpl: async () => null,
		insertImpl: async data => {
			if (data.MEET_PHONE === 'zh-duplicate') throw new Error('唯一索引冲突');
			if (data.MEET_PHONE === 'no-message') throw {};
			return 'ok';
		}
	});

	assert.deepEqual(await service._listTeacherByPhone('13800138000', '*', true), []);
	await assert.rejects(() => service.workRegister({ phone: 'zh-duplicate', password: 'pass5', name: '', email: 'z@test.com', emailCode: '123456' }, 'oOpenId7', 'gate'));
	await assert.rejects(() => service.workRegister({ phone: 'no-message', password: 'pass5', name: '', email: 'z@test.com', emailCode: '123456' }, 'oOpenId8', 'gate'));
});
