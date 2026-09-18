const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const modulePath = path.join(__dirname, '..', 'project', 'workfit', 'service', 'meet_service.js');

function createMeetService() {
	const MeetService = loadWithMocks(modulePath, {
		'./base_project_service.js': class BaseProjectService {
			AppError(msg) { throw new Error(msg); }
			getProjectId() { return 'workfit'; }
		},
		'../model/meet_model.js': {
			STATUS: { COMM: 1, OVER: 9 },
			getAll: async () => ([
				{
					_id: 'meet-1',
					MEET_TITLE: '老师A',
					MEET_PHONE: '13800000000',
					MEET_FORMS: [],
					MEET_OBJ: {
						cover: ['https://cdn.example.com/cover.jpg']
					}
				}
			])
		},
		'../model/day_model.js': {
			getAll: async () => ([
				{
					day: '2026-06-03',
					times: [{ start: '09:00', status: 1 }]
				}
			]),
			getAllBig: async () => []
		},
		'../model/join_model.js': {
			STATUS: { SUCC: 1, CANCEL: 10, ADMIN_CANCEL: 99 }
		},
		'../../../framework/utils/log_util.js': class LogUtil {
			debug() {}
			error() {}
		},
		'../../../framework/utils/util.js': {},
		'../../../framework/utils/time_util.js': {},
		'../../../framework/utils/data_util.js': {},
		'../public/project_config.js': { MEET_LOG_LEVEL: 'debug' },
		'../../../framework/lib/mail_lib.js': {},
		'../model/user_model.js': {},
		'./support/meet_image_service.js': class MeetImageService {
			buildDisplayObj(meet) {
				return meet.MEET_OBJ || {};
			}
			hasDisplayCover(meetObj = {}) {
				return Array.isArray(meetObj.cover) && meetObj.cover.length > 0;
			}
			async formatMeetObjImages(meetObj = {}) {
				return meetObj;
			}
			getCoverSrc(meetObj = {}, defaultCover = '/images/cover.gif') {
				if (Array.isArray(meetObj.cover) && meetObj.cover.length > 0) return meetObj.cover[0];
				return defaultCover;
			}
		}
	});

	return new MeetService();
}

test('MeetService getMeetListByDay returns calendar pic as string instead of array', async () => {
	const service = createMeetService();
	const list = await service.getMeetListByDay('2026-06-03');

	assert.equal(list.length, 1);
	assert.equal(typeof list[0].pic, 'string');
	assert.equal(Array.isArray(list[0].pic), false);
	assert.equal(list[0].pic, 'https://cdn.example.com/cover.jpg');
	assert.equal(list[0].timeDesc, '09:00');
});

test('MeetService getMeetListByDay falls back to default cover when image formatting fails', async () => {
	const MeetService = loadWithMocks(modulePath, {
		'./base_project_service.js': class BaseProjectService {
			AppError(msg) { throw new Error(msg); }
			getProjectId() { return 'workfit'; }
		},
		'../model/meet_model.js': {
			STATUS: { COMM: 1, OVER: 9 },
			getAll: async () => ([
				{
					_id: 'meet-1',
					MEET_TITLE: '老师A',
					MEET_PHONE: '13800000000',
					MEET_FORMS: [],
					MEET_OBJ: {
						cover: ['cloud://broken-cover']
					}
				}
			]),
			getOne: async () => null
		},
		'../model/day_model.js': {
			getAll: async () => ([
				{
					day: '2026-06-03',
					times: [{ start: '09:00', status: 1 }]
				}
			]),
			getAllBig: async () => []
		},
		'../model/join_model.js': {
			STATUS: { SUCC: 1, CANCEL: 10, ADMIN_CANCEL: 99 }
		},
		'../../../framework/utils/log_util.js': class LogUtil {
			debug() {}
			error() {}
		},
		'../../../framework/utils/util.js': {},
		'../../../framework/utils/time_util.js': {},
		'../../../framework/utils/data_util.js': {},
		'../public/project_config.js': { MEET_LOG_LEVEL: 'debug' },
		'../../../framework/lib/mail_lib.js': {},
		'../model/user_model.js': {},
		'./support/meet_image_service.js': class MeetImageService {
			buildDisplayObj(meet = {}, fallbackMeet = null, applyDefaultCover = true) {
				const obj = meet.MEET_OBJ ? JSON.parse(JSON.stringify(meet.MEET_OBJ)) : {};
				if (applyDefaultCover && (!Array.isArray(obj.cover) || obj.cover.length === 0)) obj.cover = ['/images/cover.gif'];
				return obj;
			}
			hasDisplayCover(meetObj = {}) {
				return Array.isArray(meetObj.cover) && meetObj.cover.length > 0;
			}
			async formatMeetObjImages() {
				throw new Error('temp url failed');
			}
			getCoverSrc(meetObj = {}, defaultCover = '/images/cover.gif') {
				if (Array.isArray(meetObj.cover) && meetObj.cover.length > 0) return meetObj.cover[0];
				return defaultCover;
			}
		}
	});

	const service = new MeetService();
	const list = await service.getMeetListByDay('2026-06-03');

	assert.equal(list.length, 1);
	assert.equal(list[0].pic, 'cloud://broken-cover');
});
