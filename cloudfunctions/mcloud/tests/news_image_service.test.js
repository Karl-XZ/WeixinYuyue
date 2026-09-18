const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const modulePath = path.join(__dirname, '..', 'project', 'workfit', 'service', 'support', 'news_image_service.js');

test('NewsImageService replaces cover cloud ids with temp urls', async () => {
	const NewsImageService = loadWithMocks(modulePath, {});
	const service = new NewsImageService({
		cloud: {
			getTempFileURL: async ids => ids.map(id => ({ cloudId: id, url: `https://cdn/${id}` }))
		},
		data: {
			deepClone: obj => JSON.parse(JSON.stringify(obj))
		}
	});

	const news = {
		NEWS_PIC: ['cloud://cover1']
	};
	await service.formatNews(news);

	assert.deepEqual(news.NEWS_PIC, ['https://cdn/cloud://cover1']);
	assert.equal(service.getCoverSrc(news), 'https://cdn/cloud://cover1');
});

test('NewsImageService converts cloud content images and tolerates temp api errors', async () => {
	const NewsImageService = require(modulePath);
	const service = new NewsImageService({
		cloud: {
			getTempFileURL: async ids => {
				if (ids.includes('cloud://boom')) throw new Error('temp failed');
				return ids.map(id => ({ cloudId: id, url: `https://cdn/${id}` }));
			}
		},
		data: {
			deepClone: obj => JSON.parse(JSON.stringify(obj))
		}
	});

	const okNews = {
		NEWS_CONTENT: [
			{ type: 'text', val: 'hello' },
			{ type: 'img', val: 'cloud://img1' },
			{ type: 'image', val: 'cloud://img2' }
		]
	};
	await service.formatNews(okNews);
	assert.equal(okNews.NEWS_CONTENT[1].val, 'https://cdn/cloud://img1');
	assert.equal(okNews.NEWS_CONTENT[2].val, 'https://cdn/cloud://img2');

	const failNews = {
		NEWS_PIC: ['cloud://boom'],
		NEWS_CONTENT: [{ type: 'img', val: 'cloud://boom' }]
	};
	await service.formatNews(failNews);
	assert.deepEqual(failNews.NEWS_PIC, ['cloud://boom']);
	assert.equal(failNews.NEWS_CONTENT[0].val, 'cloud://boom');

	assert.equal(await service.formatNews(null), null);
	assert.deepEqual(await service.replaceCloudImageList(['plain.jpg']), ['plain.jpg']);
	assert.equal(service.getCoverSrc({ NEWS_PIC: '  /x.jpg  ' }), '/x.jpg');
});

test('NewsImageService normalizes string cover into array before temp url conversion', async () => {
	const NewsImageService = require(modulePath);
	const service = new NewsImageService({
		cloud: {
			getTempFileURL: async ids => ids.map(id => ({ cloudId: id, url: `https://cdn/${id}` }))
		},
		data: {
			deepClone: obj => JSON.parse(JSON.stringify(obj))
		}
	});

	const news = {
		NEWS_PIC: ' cloud://cover-string '
	};
	await service.formatNews(news);
	assert.deepEqual(news.NEWS_PIC, ['https://cdn/cloud://cover-string']);
});
