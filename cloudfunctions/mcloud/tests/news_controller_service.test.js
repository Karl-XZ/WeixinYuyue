const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadWithMocks } = require('./helpers/load_with_mocks.js');

const root = path.join(__dirname, '..', 'project', 'workfit');

test('NewsController formats list and detail responses', async () => {
	let listInput = null;
	let detailId = null;

	const NewsController = loadWithMocks(path.join(root, 'controller', 'news_controller.js'), {
		'./base_project_controller.js': class BaseProjectController {
			validateData(rules) {
				if (rules.id) return { id: 'news-1' };
				return { cateId: '1', page: 1 };
			}
		},
		'../service/news_service.js': class NewsService {
			async getNewsList(input) {
				listInput = input;
				return {
					list: [
						{
							_id: 'news-1',
							NEWS_TITLE: '标题',
							NEWS_DESC: '描述',
							NEWS_ADD_TIME: 1000,
							NEWS_PIC: ['https://pic/1.jpg'],
							NEWS_OBJ: { desc: '内部描述' }
						}
					]
				};
			}
			async viewNews(id) {
				detailId = id;
				return {
					_id: 'news-1',
					NEWS_TITLE: '详情标题',
					NEWS_ADD_TIME: 2000,
					NEWS_PIC: ['https://pic/2.jpg']
				};
			}
		},
		'../../../framework/utils/time_util.js': {
			timestamp2Time: ts => `T-${ts}`
		}
	});

	const controller = new NewsController();
	const listResult = await controller.getNewsList();
	assert.equal(listInput.cateId, '1');
	assert.deepEqual(listResult.list, [{
		type: 'news',
		id: 'news-1',
		title: '标题',
		desc: '描述',
		ext: 'T-1000',
		pic: 'https://pic/1.jpg'
	}]);

	const detail = await controller.viewNews();
	assert.equal(detailId, 'news-1');
	assert.equal(detail.NEWS_ADD_TIME, 'T-2000');
	assert.equal(controller.transNewsList([{ _id: 'x', NEWS_TITLE: 't', NEWS_DESC: 'd', NEWS_ADD_TIME: 'day', NEWS_PIC: ['pic'] }])[0].pic, 'pic');
});

test('NewsService formats news images in list and detail flows', async () => {
	const NewsService = loadWithMocks(path.join(root, 'service', 'news_service.js'), {
		'./base_project_service.js': class BaseProjectService {
			getProjectId() { return 'workfit'; }
			fmtOrderBySort(sortVal, key) { return { [key]: sortVal }; }
		},
		'../../../framework/utils/util.js': {
			isDefined: v => v !== undefined
		},
		'../model/news_model.js': {
			getOne: async where => {
				if (where._id === 'missing') return null;
				return { _id: 'news-1', NEWS_PIC: ['cloud://cover'], NEWS_CONTENT: [{ type: 'img', val: 'cloud://img' }] };
			},
			getList: async (...args) => ({
				args,
				list: [{ _id: 'news-2', NEWS_PIC: ['cloud://cover2'], NEWS_CONTENT: [] }]
			})
		},
		'./support/news_image_service.js': class NewsImageService {
			async formatNews(news) {
				news.NEWS_PIC = news.NEWS_PIC.map(x => x.replace('cloud://', 'https://cdn/'));
				if (Array.isArray(news.NEWS_CONTENT)) {
					news.NEWS_CONTENT = news.NEWS_CONTENT.map(item => item.type === 'img' ? { ...item, val: item.val.replace('cloud://', 'https://cdn/') } : item);
				}
				return news;
			}
		}
	});

	const service = new NewsService();
	const detail = await service.viewNews('news-1');
	assert.equal(detail.NEWS_PIC[0], 'https://cdn/cover');
	assert.equal(detail.NEWS_CONTENT[0].val, 'https://cdn/img');
	assert.equal(await service.viewNews('missing'), null);

	const listResult = await service.getNewsList({ cateId: '1', page: 1, size: 10 });
	assert.equal(listResult.list[0].NEWS_PIC[0], 'https://cdn/cover2');
	assert.equal(listResult.args[0].and._pid, 'workfit');
	assert.equal(listResult.args[0].and.NEWS_CATE_ID, '1');

	const searchResult = await service.getNewsList({ search: 'key', page: 1, size: 10 });
	assert.deepEqual(searchResult.args[0].or, [{ NEWS_TITLE: ['like', 'key'] }]);

	const sortResult = await service.getNewsList({ sortType: 'sort', sortVal: 'desc', page: 1, size: 10 });
	assert.deepEqual(sortResult.args[2], { NEWS_ADD_TIME: 'desc' });

	const cateResult = await service.getNewsList({ sortType: 'cateId', sortVal: '2', page: 1, size: 10 });
	assert.equal(cateResult.args[0].and.NEWS_CATE_ID, '2');

	const cateZero = await service.getNewsList({ cateId: '0', page: 1, size: 10 });
	assert.equal(cateZero.args[0].and.NEWS_CATE_ID, undefined);
});
