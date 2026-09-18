/**
 * Notes: 全局/首页模块业务逻辑
 * Date: 2021-03-15 04:00:00 
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 */

const BaseProjectService = require('./base_project_service.js');
const setupUtil = require('../../../framework/utils/setup/setup_util.js');
const constants = require('../public/constants.js');
const NewsModel = require('../model/news_model.js');
const NewsImageService = require('./support/news_image_service.js');

class HomeService extends BaseProjectService {
	constructor() {
		super();
		this._newsImageService = new NewsImageService();
	}

	async _formatHomeVouchList(list) {
		if (!Array.isArray(list)) return [];

		for (let k = 0; k < list.length; k++) {
			let node = list[k];
			if (!node || typeof node !== 'object') continue;

			if (typeof node.pic === 'string' && node.pic.indexOf('cloud://') === 0) {
				let picList = await this._newsImageService.replaceCloudImageList([node.pic]);
				node.pic = picList[0] || node.pic;
			}
		}

		return list;
	}

	async getSetup(key) {
		return await setupUtil.get(key);
	}

	/**首页列表 */
	async getHomeList() {
		let list = await setupUtil.get(constants.SETUP_HOME_VOUCH_KEY);
		if (!list || !Array.isArray(list)) list = [];
		list = await this._formatHomeVouchList(list);


		if (list.length == 0) {
			let orderBy = {
				'NEWS_ORDER': 'asc',
				'NEWS_ADD_TIME': 'desc'
			};
			let fields = 'NEWS_PIC,NEWS_CATE_NAME,NEWS_TITLE,NEWS_DESC,NEWS_ADD_TIME';

			let where = {};
			where.NEWS_STATUS = 1; // 状态    

			let retList = await NewsModel.getAll(where, fields, orderBy, 10);
			for (let k = 0; k < retList.length; k++) {
				await this._newsImageService.formatNews(retList[k]);
				list.push({
					type: 'news',
					ext: retList[k].NEWS_CATE_NAME,
					title: retList[k].NEWS_TITLE,
					id: retList[k]._id,
					desc: retList[k].NEWS_DESC,
					pic: this._newsImageService.getCoverSrc(retList[k])
				})
			}
		}

		return list;
	}
}

module.exports = HomeService;
