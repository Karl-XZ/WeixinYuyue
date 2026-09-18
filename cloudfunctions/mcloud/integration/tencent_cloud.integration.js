const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { loadRealEnv } = require('../tests/helpers/load_real_env.js');

const cloudRoot = path.resolve(__dirname, '..');
const appRoot = path.resolve(cloudRoot, '..', '..');
const config = require(path.join(cloudRoot, 'config', 'config.js'));
const envStatus = loadRealEnv(cloudRoot);

if (!envStatus.ok) {
	test('integration env file exists', { skip: true }, () => {});
} else {
	global.PID = 'ONE';

	const cloud = require('wx-server-sdk');
	cloud.init({
		env: config.CLOUD_ID
	});
	const db = cloud.database();

	const PassportService = require(path.join(cloudRoot, 'project', 'workfit', 'service', 'passport_service.js'));
	const AdminHomeService = require(path.join(cloudRoot, 'project', 'workfit', 'service', 'admin', 'admin_home_service.js'));
	const cloudUtil = require(path.join(cloudRoot, 'framework', 'cloud', 'cloud_util.js'));
	const MeetImageService = require(path.join(cloudRoot, 'project', 'workfit', 'service', 'support', 'meet_image_service.js'));
	const UserModel = require(path.join(cloudRoot, 'project', 'workfit', 'model', 'user_model.js'));
	const md5Lib = require(path.join(cloudRoot, 'framework', 'lib', 'md5_lib.js'));

	test('real cloud database is reachable and collections contain expected data', async () => {
		const [adminRet, meetRet, newsRet] = await Promise.all([
			db.collection('bx_admin').limit(1).get(),
			db.collection('bx_meet').limit(1).get(),
			db.collection('bx_news').limit(1).get()
		]);

		assert.ok(Array.isArray(adminRet.data));
		assert.ok(Array.isArray(meetRet.data));
		assert.ok(Array.isArray(newsRet.data));
		assert.ok(adminRet.data.length >= 1, 'bx_admin should have at least one row');
		assert.ok(meetRet.data.length >= 1, 'bx_meet should have at least one row');
		assert.ok(newsRet.data.length >= 1, 'bx_news should have at least one row');
	});

	test('real cloud storage upload, temp url, and delete work', async () => {
		const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sWwaP8AAAAASUVORK5CYII=';
		const fileBuffer = Buffer.from(pngBase64, 'base64');
		const cloudPath = `integration-tests/${Date.now()}-pixel.png`;

		const uploadRet = await cloud.uploadFile({
			cloudPath,
			fileContent: fileBuffer
		});
		assert.ok(uploadRet.fileID, 'upload should return fileID');

		const tempUrl = await cloudUtil.getTempFileURLOne(uploadRet.fileID);
		assert.match(tempUrl, /^https?:\/\//, 'temp url should be http(s)');

		const listRet = await cloudUtil.getTempFileURL([uploadRet.fileID]);
		assert.equal(listRet.length, 1);
		assert.equal(listRet[0].cloudId, uploadRet.fileID);
		assert.match(listRet[0].url, /^https?:\/\//);

		await cloud.deleteFile({
			fileList: [uploadRet.fileID]
		});
	});

	test('real admin home summary matches live database counts', async () => {
		const [userCnt, newsCnt, meetCnt, joinCnt] = await Promise.all([
			db.collection('bx_user').where({ _pid: 'ONE' }).count(),
			db.collection('bx_news').where({ _pid: 'ONE' }).count(),
			db.collection('bx_meet').where({ _pid: 'ONE' }).count(),
			db.collection('bx_join').where({ _pid: 'ONE' }).count()
		]);

		const service = new AdminHomeService();
		const result = await service.adminHome();
		const summaryMap = Object.fromEntries(result.summary.map(item => [item.title, item.cnt]));

		assert.equal(summaryMap['学生总数'], userCnt.total);
		assert.equal(summaryMap['公告总数'], newsCnt.total);
		assert.equal(summaryMap['老师总数'], meetCnt.total);
		assert.equal(summaryMap['预约总数'], joinCnt.total);
	});

	test('real meet image formatter converts live cloud file ids to temp urls', async () => {
		const ret = await db.collection('bx_meet')
			.where({
				MEET_STATUS: 1
			})
			.field({
				MEET_TITLE: true,
				MEET_OBJ: true
			})
			.limit(20)
			.get();

		const liveMeet = ret.data.find(item => item.MEET_OBJ && Array.isArray(item.MEET_OBJ.cover) && item.MEET_OBJ.cover.some(val => typeof val === 'string' && val.startsWith('cloud://')));
		assert.ok(liveMeet, 'should find at least one live meet with cloud cover');

		const service = new MeetImageService();
		const formatted = await service.formatMeetObjImages(liveMeet.MEET_OBJ);
		assert.ok(Array.isArray(formatted.cover) && formatted.cover.length > 0);
		assert.match(formatted.cover[0], /^https?:\/\//);
	});

	test('simulated cloud login context works with temporary real user record', async () => {
		const openId = `integration-openid-${Date.now()}`;
		const userId = `ITEST-${Date.now()}`;
		const userData = {
			USER_ID: userId,
			USER_MINI_OPENID: openId,
			USER_NAME: '集成测试学生',
			USER_MOBILE: '13900000001',
			USER_PASSWORD: md5Lib.md5('123456'),
			USER_SUBSCRIBE: {},
			USER_STATUS: 1,
			USER_FORMS: [],
			USER_OBJ: {},
			USER_LOGIN_CNT: 0,
			USER_ADD_TIME: Date.now(),
			USER_EDIT_TIME: Date.now()
		};

		let insertedId = '';
		try {
			const insertRet = await UserModel.insert(userData);
			insertedId = insertRet._id || '';

			const service = new PassportService();
			const detail = await service.getMyDetail(openId);
			assert.equal(detail.USER_NAME, '集成测试学生');
			assert.equal(detail.USER_HAS_PASSWORD, true);
			assert.equal(detail.USER_PASSWORD, undefined);

			const loginRet = await service.login(openId);
			assert.equal(loginRet.token.id, openId);
			assert.equal(loginRet.token.name, '集成测试学生');

			await new Promise(resolve => setTimeout(resolve, 800));
			const fresh = await db.collection('bx_user').where({ USER_MINI_OPENID: openId, _pid: 'ONE' }).limit(1).get();
			assert.equal(fresh.data.length, 1);
			assert.ok(Number(fresh.data[0].USER_LOGIN_CNT) >= 1);
			assert.ok(Number(fresh.data[0].USER_LOGIN_TIME) > 0);
		} finally {
			await UserModel.del({ USER_MINI_OPENID: openId });
			if (insertedId) {
				const exists = await db.collection('bx_user').where({ _id: insertedId }).limit(1).get();
				assert.equal(exists.data.length, 0);
			}
		}
	});

	test('project docs were generated and are readable', async () => {
		const doc1 = path.join(appRoot, 'docs', 'workfit-功能全量说明.md');
		const doc2 = path.join(appRoot, 'docs', 'workfit-自动化测试说明.md');
		assert.ok(fs.existsSync(doc1));
		assert.ok(fs.existsSync(doc2));
		assert.match(fs.readFileSync(doc1, 'utf8'), /功能全量说明/);
		assert.match(fs.readFileSync(doc2, 'utf8'), /自动化测试说明/);
	});
}
