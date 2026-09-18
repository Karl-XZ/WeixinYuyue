const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const modulePath = path.join(__dirname, '..', 'project', 'workfit', 'service', 'support', 'meet_image_service.js');

test('MeetImageService replaces cloud image ids and preserves other values', async () => {
	const MeetImageService = loadWithMocks(modulePath, {});
	const service = new MeetImageService({
		cloud: {
			getTempFileURL: async ids => ids.map(id => ({ cloudId: id, url: `https://temp/${id}` }))
		},
		data: {
			deepClone: obj => JSON.parse(JSON.stringify(obj))
		}
	});

	assert.deepEqual(await service.replaceCloudImageList(null), []);
	assert.deepEqual(await service.replaceCloudImageList([]), []);
	assert.deepEqual(await service.replaceCloudImageList(['a.jpg']), ['a.jpg']);
	assert.deepEqual(
		await service.replaceCloudImageList(['cloud://a', 'b.jpg']),
		['https://temp/cloud://a', 'b.jpg']
	);
});

test('MeetImageService formats meet object cover and rich text images', async () => {
	const MeetImageService = loadWithMocks(modulePath, {});
	const service = new MeetImageService({
		cloud: {
			getTempFileURL: async ids => ids.map(id => ({ cloudId: id, url: `https://cdn/${id}` }))
		},
		data: {
			deepClone: obj => JSON.parse(JSON.stringify(obj))
		}
	});

	const source = {
		cover: ['cloud://cover'],
		content: [
			{ type: 'text', val: 'hello' },
			{ type: 'img', val: 'cloud://img1' },
			{ type: 'img', val: '/local.png' }
		]
	};
	const result = await service.formatMeetObjImages(source);

	assert.notEqual(result, source);
	assert.deepEqual(result.cover, ['https://cdn/cloud://cover']);
	assert.equal(result.content[0].val, 'hello');
	assert.equal(result.content[1].val, 'https://cdn/cloud://img1');
	assert.equal(result.content[2].val, '/local.png');
});

test('MeetImageService formats meet objects and handles empty input', async () => {
	const MeetImageService = loadWithMocks(modulePath, {});
	const service = new MeetImageService({
		cloud: { getTempFileURL: async () => [] },
		data: { deepClone: obj => JSON.parse(JSON.stringify(obj)) }
	});

	assert.equal(await service.formatMeetObjImages('bad'), 'bad');
	assert.equal(await service.formatMeetImages(null), null);

	const meet = { MEET_OBJ: { cover: ['plain.jpg'], content: [] } };
	const result = await service.formatMeetImages(meet);
	assert.equal(result, meet);
	assert.deepEqual(result.MEET_OBJ.cover, ['plain.jpg']);
	assert.equal(service.hasDisplayCover({ cover: ['plain.jpg'] }), true);
	assert.equal(service.getCoverSrc({ cover: ['plain.jpg'] }), 'plain.jpg');
	assert.equal(service.getCoverSrc({ cover: 'single.jpg' }), 'single.jpg');
	assert.equal(service.getCoverSrc({}), '/images/cover.gif');
});

test('MeetImageService tolerates null temp file responses', async () => {
	const MeetImageService = require(modulePath);
	const service = new MeetImageService({
		cloud: {
			getTempFileURL: async () => null
		},
		data: {
			deepClone: obj => JSON.parse(JSON.stringify(obj))
		}
	});

	const list = await service.replaceCloudImageList(['cloud://cover']);
	assert.deepEqual(list, ['cloud://cover']);

	const obj = await service.formatMeetObjImages({
		content: [{ type: 'img', val: 'cloud://img1' }]
	});
	assert.equal(obj.content[0].val, 'cloud://img1');
});

test('MeetImageService tolerates temp file api errors and keeps original values', async () => {
	const MeetImageService = require(modulePath);
	const service = new MeetImageService({
		cloud: {
			getTempFileURL: async () => {
				throw new Error('temp url failed');
			}
		},
		data: {
			deepClone: obj => JSON.parse(JSON.stringify(obj))
		}
	});

	const list = await service.replaceCloudImageList(['cloud://cover']);
	assert.deepEqual(list, ['cloud://cover']);

	const obj = await service.formatMeetObjImages({
		cover: ['cloud://cover'],
		content: [{ type: 'img', val: 'cloud://img1' }]
	});
	assert.deepEqual(obj.cover, ['cloud://cover']);
	assert.equal(obj.content[0].val, 'cloud://img1');
});

test('MeetImageService builds display object from legacy forms and fallback meet', async () => {
	const MeetImageService = require(modulePath);
	const service = new MeetImageService({
		cloud: { getTempFileURL: async () => [] },
		data: { deepClone: obj => JSON.parse(JSON.stringify(obj)) }
	});

	const legacy = service.buildDisplayObj({
		MEET_OBJ: {},
		MEET_FORMS: [
			{ mark: 'cover', val: ['cloud://cover1'] },
			{ mark: 'desc', val: '简介1' },
			{ mark: 'spec', val: '标签1' },
			{ mark: 'content', val: [{ type: 'text', val: '正文1' }] },
			{ mark: 'location', val: 'A101' }
		]
	}, null, false);
	assert.deepEqual(legacy.cover, ['cloud://cover1']);
	assert.equal(legacy.desc, '简介1');
	assert.equal(legacy.spec, '标签1');
	assert.equal(legacy.location, 'A101');

	const fallback = service.buildDisplayObj({
		MEET_OBJ: {},
		MEET_FORMS: []
	}, {
		MEET_OBJ: {
			cover: ['cloud://cover2'],
			desc: '简介2',
			spec: '标签2',
			content: [{ type: 'text', val: '正文2' }]
		}
	}, true);
	assert.deepEqual(fallback.cover, ['cloud://cover2']);
	assert.equal(fallback.desc, '简介2');
	assert.equal(fallback.spec, '标签2');
	assert.deepEqual(fallback.content, [{ type: 'text', val: '正文2' }]);

	const defaultCover = service.buildDisplayObj({ MEET_OBJ: {}, MEET_FORMS: [] }, null, true);
	assert.deepEqual(defaultCover.cover, ['/images/cover.gif']);

	const preserveCurrent = service.buildDisplayObj({
		MEET_OBJ: {
			desc: 'current-desc',
			spec: 'current-spec',
			location: 'room-1',
			cover: ['current-cover'],
			content: [{ type: 'text', val: 'current' }]
		},
		MEET_FORMS: [{ mark: 'desc', val: 'legacy-desc' }]
	}, {
		MEET_OBJ: {},
		MEET_FORMS: [{ mark: 'cover', val: ['fallback-cover'] }]
	}, false);
	assert.equal(preserveCurrent.desc, 'current-desc');
	assert.equal(preserveCurrent.cover[0], 'current-cover');

	const fromFallbackForms = service.buildDisplayObj({
		MEET_OBJ: null,
		MEET_FORMS: null
	}, {
		MEET_OBJ: null,
		MEET_FORMS: [
			{ mark: 'spec', val: 'fallback-spec' },
			{ mark: 'content', val: [{ type: 'text', val: 'fallback-content' }] }
		]
	}, false);
	assert.equal(fromFallbackForms.spec, 'fallback-spec');
	assert.deepEqual(fromFallbackForms.content, [{ type: 'text', val: 'fallback-content' }]);
});
