const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const root = path.join(__dirname, '..', 'project', 'workfit');

test('Base project controllers and services delegate correctly', async () => {
	let initSetupCount = 0;
	let workCheckedToken = '';

	const BaseProjectController = loadWithMocks(path.join(root, 'controller', 'base_project_controller.js'), {
		'../../../framework/platform/controller/base_controller.js': class BaseController {},
		'../service/base_project_service.js': class BaseProjectService {
			async initSetup() { initSetupCount += 1; }
		}
	});
	const baseController = new BaseProjectController();
	await baseController.initSetup();

	const BaseProjectAdminController = loadWithMocks(path.join(root, 'controller', 'admin', 'base_project_admin_controller.js'), {
		'../../../../framework/platform/controller/base_admin_controller.js': class BaseAdminController {},
		'../../service/base_project_service.js': class BaseProjectService {
			async initSetup() { initSetupCount += 1; }
		}
	});
	const adminController = new BaseProjectAdminController();
	await adminController.initSetup();

	const BaseProjectWorkController = loadWithMocks(path.join(root, 'controller', 'work', 'base_project_work_controller.js'), {
		'../../../../framework/platform/controller/base_controller.js': class BaseController {
			constructor() {
				this._token = 'work-token';
			}
		},
		'../../service/work/base_project_work_service.js': class BaseWorkService {
			async isWork(token) {
				workCheckedToken = token;
				return { _id: 'meet-1', MEET_TITLE: '老师A' };
			}
		},
		'../../service/base_project_service.js': class BaseProjectService {
			async initSetup() { initSetupCount += 1; }
		},
		'../../../../framework/utils/time_util.js': {
			time: () => 1234567890
		}
	});
	const workController = new BaseProjectWorkController();
	assert.equal(workController._timestamp, 1234567890);
	await workController.initSetup();
	await workController.isWork();
	assert.equal(workCheckedToken, 'work-token');
	assert.equal(workController._workId, 'meet-1');
	assert.equal(workController._work.MEET_TITLE, '老师A');

	assert.equal(initSetupCount, 3);
});

test('HomeController validates setup input and loads home list', async () => {
	let setupKey = '';
	let homeListCalled = 0;

	const HomeController = loadWithMocks(path.join(root, 'controller', 'home_controller.js'), {
		'./base_project_controller.js': class BaseProjectController {
			validateData(rules) {
				assert.equal(rules.key, 'must|string|name=KEY');
				return { key: 'SETUP_KEY' };
			}
		},
		'../service/home_service.js': class HomeService {
			async getSetup(key) { setupKey = key; return 'value'; }
			async getHomeList() { homeListCalled += 1; return [{ id: 1 }]; }
		}
	});

	const controller = new HomeController();
	assert.equal(await controller.getSetup(), 'value');
	assert.equal(setupKey, 'SETUP_KEY');
	assert.deepEqual(await controller.getHomeList(), [{ id: 1 }]);
	assert.equal(homeListCalled, 1);
});

test('CheckController validates and forwards image check', async () => {
	let seenImg = null;
	let seenType = null;

	const CheckController = loadWithMocks(path.join(root, 'controller', 'check_controller.js'), {
		'./base_project_controller.js': class BaseProjectController {
			validateData(rules) {
				assert.equal(rules.mine, 'must|default=jpg');
				return { img: 'base64-data', mine: 'png' };
			}
		},
		'../../framework/validate/content_check.js': {
			checkImg: async (img, type) => {
				seenImg = img;
				seenType = type;
				return { ok: true };
			}
		}
	});

	const controller = new CheckController();
	assert.deepEqual(await controller.checkImg(), { ok: true });
	assert.equal(seenImg, 'base64-data');
	assert.equal(seenType, 'jpg');
});

test('SubscribeController validates and forwards report params', async () => {
	let reportArgs = null;
	const SubscribeController = loadWithMocks(path.join(root, 'controller', 'subscribe_controller.js'), {
		'./base_project_controller.js': class BaseProjectController {
			constructor() {
				this._openId = 'openid-1';
			}
			validateData(rules) {
				assert.equal(rules.tmplIds, 'array|must|name=模板ID');
				return { tmplIds: ['a', 'b'], isWork: 1, meetId: 'meet-1' };
			}
		},
		'../service/subscribe_service.js': class SubscribeService {
			async report(...args) {
				reportArgs = args;
				return { result: 'ok' };
			}
		}
	});
	const controller = new SubscribeController();
	assert.deepEqual(await controller.report(), { result: 'ok' });
	assert.deepEqual(reportArgs, ['openid-1', ['a', 'b'], true, 'meet-1']);
});

test('MyController can be instantiated', async () => {
	const MyController = loadWithMocks(path.join(root, 'controller', 'my_controller.js'), {
		'./base_project_controller.js': class BaseProjectController {}
	});
	const controller = new MyController();
	assert.ok(controller instanceof MyController);
});

test('BaseProjectAdminService generates detail QR and BaseProjectWorkService validates tokens', async () => {
	let uploaded = null;
	const BaseProjectAdminService = loadWithMocks(path.join(root, 'service', 'admin', 'base_project_admin_service.js'), {
		'../../../../framework/platform/service/base_admin_service.js': class BaseAdminService {},
		'../../../../framework/utils/util.js': { getProjectId: () => 'workfit' },
		'../../../../framework/cloud/cloud_base.js': {
			getCloud: () => ({
				openapi: {
					wxacode: {
						getUnlimited: async ({ scene, page }) => {
							assert.equal(scene, 'id-1');
							assert.match(page, /projects\/workfit\/pages\/news\/detail\/news_detail/);
							return { buffer: Buffer.from('png') };
						}
					}
				},
				uploadFile: async args => {
					uploaded = args;
					return { fileID: 'cloud://qr' };
				}
			})
		}
	});
	const adminService = new BaseProjectAdminService();
	assert.equal(await adminService.genDetailQr('news', 'id-1'), 'cloud://qr');
	assert.match(uploaded.cloudPath, /workfit\/news\/id-1\/qr\.png/);

	let appError = null;
	const BaseProjectWorkService = loadWithMocks(path.join(root, 'service', 'work', 'base_project_work_service.js'), {
		'../../../../framework/platform/service/base_service.js': class BaseService {
			AppError(msg, code) {
				appError = { msg, code };
				throw new Error(msg);
			}
		},
		'../../../../framework/utils/time_util.js': { time: () => 1000 },
		'../../../../framework/core/app_code.js': { WORK_ERROR: 'WORK_ERROR' },
		'../../../../config/config.js': { WORK_LOGIN_EXPIRE: 10 },
		'../../model/meet_model.js': {
			STATUS: { COMM: 1 },
			getOne: async where => {
				if (where.MEET_TOKEN === 'ok') return { _id: 'meet-1', MEET_TITLE: '老师A' };
				return null;
			}
		}
	});
	const workService = new BaseProjectWorkService();
	assert.deepEqual(await workService.isWork('ok'), { _id: 'meet-1', MEET_TITLE: '老师A' });
	await assert.rejects(() => workService.isWork('bad'), /登录已过期，请重新登录/);
	assert.deepEqual(appError, { msg: '登录已过期，请重新登录', code: 'WORK_ERROR' });
});
