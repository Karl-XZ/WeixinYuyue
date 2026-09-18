const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const root = path.join(__dirname, '..', 'project', 'workfit');

test('public config exports expected constants', async () => {
	const constants = require(path.join(root, 'public', 'constants.js'));
	const projectConfig = require(path.join(root, 'public', 'project_config.js'));
	assert.equal(constants.SETUP_HOME_VOUCH_KEY, 'SETUP_HOME_VOUCH_KEY');
	assert.equal(constants.SETUP_WORK_TEACHER_PWD, 'SETUP_WORK_TEACHER_PWD');
	assert.equal(projectConfig.CACHE_CALENDAR_TIME, 60 * 30);
	assert.equal(projectConfig.MEET_MAX_JOIN_CNT, 1);
});

test('project models expose collection names, prefixes and key enums', async () => {
	const baseModelPath = path.join(root, 'model', 'base_project_model.js');
	const BaseProjectModel = loadWithMocks(baseModelPath, {
		'../../../framework/platform/model/base_model.js': class BaseModel {
			static C(name) { return `bx_${name}`; }
		}
	});
	assert.ok(new BaseProjectModel() instanceof BaseProjectModel);

	const mocks = {
		'./base_project_model.js': class MockBaseProjectModel {
			static C(name) { return `bx_${name}`; }
			static getDesc(group, value) {
				const map = this[`${group}_DESC`];
				return map ? map[value] : undefined;
			}
		}
	};
	const DayModel = loadWithMocks(path.join(root, 'model', 'day_model.js'), mocks);
	const MeetModel = loadWithMocks(path.join(root, 'model', 'meet_model.js'), mocks);
	const NewsModel = loadWithMocks(path.join(root, 'model', 'news_model.js'), mocks);
	const UserModel = loadWithMocks(path.join(root, 'model', 'user_model.js'), mocks);
	const FavModel = loadWithMocks(path.join(root, 'model', 'fav_model.js'), mocks);
	const JoinModel = loadWithMocks(path.join(root, 'model', 'join_model.js'), mocks);
	const MailVerifyModel = loadWithMocks(path.join(root, 'model', 'mail_verify_model.js'), mocks);
	const TempModel = loadWithMocks(path.join(root, 'model', 'temp_model.js'), mocks);

	assert.equal(DayModel.CL, 'bx_day');
	assert.equal(DayModel.FIELD_PREFIX, 'DAY_');
	assert.equal(MeetModel.CL, 'bx_meet');
	assert.equal(MeetModel.STATUS.COMM, 1);
	assert.equal(typeof MeetModel.STATUS_DESC.CLOSE, 'string');
	assert.ok(MeetModel.STATUS_DESC.CLOSE.length > 0);
	assert.equal(MeetModel.NAME, '教师');
	assert.equal(NewsModel.CL, 'bx_news');
	assert.equal(NewsModel.FIELD_PREFIX, 'NEWS_');
	assert.equal(UserModel.CL, 'bx_user');
	assert.equal(UserModel.STATUS.COMM, 1);
	assert.equal(FavModel.CL, 'bx_fav');
	assert.equal(JoinModel.CL, 'bx_join');
	assert.equal(MailVerifyModel.CL, 'bx_mail_verify');
	assert.equal(TempModel.CL, 'bx_temp');
	assert.ok(JoinModel.STATUS_DESC.SUCC);
});
