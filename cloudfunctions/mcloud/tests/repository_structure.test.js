const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..', '..', '..');
const appJsonPath = path.join(rootDir, 'miniprogram', 'app.json');
const routePath = path.join(rootDir, 'cloudfunctions', 'mcloud', 'project', 'workfit', 'public', 'route.js');
const projectSettingPath = path.join(rootDir, 'miniprogram', 'projects', 'workfit', 'public', 'project_setting.js');

test('app.json pages all have js/json/wxml files', () => {
	const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
	for (const page of appJson.pages) {
		const base = path.join(rootDir, 'miniprogram', page);
		assert.ok(fs.existsSync(base + '.js'), `${page}.js should exist`);
		assert.ok(fs.existsSync(base + '.json'), `${page}.json should exist`);
		assert.ok(fs.existsSync(base + '.wxml'), `${page}.wxml should exist`);
	}
});

test('route config points to existing controller files and methods', () => {
	const routes = require(routePath);
	for (const [route, target] of Object.entries(routes)) {
		const [controllerSpec] = target.split('#');
		const [controllerRelPath, methodName] = controllerSpec.split('@');
		const controllerPath = path.join(rootDir, 'cloudfunctions', 'mcloud', 'project', 'workfit', 'controller', `${controllerRelPath}.js`);
		assert.ok(fs.existsSync(controllerPath), `${route} controller file should exist`);

		const content = fs.readFileSync(controllerPath, 'utf8');
		const methodPattern = new RegExp(`(?:async\\s+)?${methodName}\\s*\\(`);
		assert.match(content, methodPattern, `${route} should implement ${methodName}`);
	}
});

test('project setting keeps公告名称 and required location field', () => {
	const projectSetting = require(projectSettingPath);
	assert.equal(projectSetting.NEWS_NAME, '公告');
	assert.equal(projectSetting.NEWS_CATE[0].title, '公告');

	const locationField = projectSetting.MEET_FIELDS.find(item => item.mark === 'location');
	assert.ok(locationField, 'location field should exist');
	assert.equal(locationField.must, true);
});
