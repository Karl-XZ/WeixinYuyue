const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const root = path.join(__dirname, '..', 'project', 'workfit');

test('HomeService getSetup returns setup value and getHomeList normalizes non-array config', async () => {
	let setupVal = {};
	let tempCalls = [];
	const HomeService = loadWithMocks(path.join(root, 'service', 'home_service.js'), {
		'./base_project_service.js': class BaseProjectService {},
		'../../../framework/utils/setup/setup_util.js': {
			get: async key => key === 'plain' ? 'value' : setupVal
		},
		'../public/constants.js': {
			SETUP_HOME_VOUCH_KEY: 'SETUP_HOME_VOUCH'
		},
		'../model/news_model.js': {
			getAll: async () => ([
				{
					_id: 'news-1',
					NEWS_CATE_NAME: 'notice',
					NEWS_TITLE: 'title',
					NEWS_DESC: 'desc',
					NEWS_PIC: ['cloud://cover1']
				}
			])
		},
		'./support/news_image_service.js': class NewsImageService {
			async replaceCloudImageList(list) {
				tempCalls.push(list);
				return list.map(item => item.replace('cloud://', 'https://cdn/cloud://'));
			}
			async formatNews(news) {
				news.NEWS_PIC = ['https://cdn/cloud://cover1'];
				return news;
			}
			getCoverSrc(news) {
				return news.NEWS_PIC[0];
			}
		}
	});

	const service = new HomeService();
	assert.equal(await service.getSetup('plain'), 'value');

	const list = await service.getHomeList();
	assert.equal(list.length, 1);
	assert.equal(typeof list[0].pic, 'string');
	assert.equal(list[0].pic, 'https://cdn/cloud://cover1');

	setupVal = [{ type: 'preset' }];
	assert.deepEqual(await service.getHomeList(), [{ type: 'preset' }]);

	setupVal = [{ type: 'news', pic: 'cloud://cached-cover' }];
	const cachedList = await service.getHomeList();
	assert.equal(cachedList[0].pic, 'https://cdn/cloud://cached-cover');
	assert.deepEqual(tempCalls, [['cloud://cached-cover']]);
});
