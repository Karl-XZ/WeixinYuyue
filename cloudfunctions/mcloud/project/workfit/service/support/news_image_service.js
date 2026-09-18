const cloudUtil = require('../../../../framework/cloud/cloud_util.js');
const dataUtil = require('../../../../framework/utils/data_util.js');

class NewsImageService {
	constructor({
		cloud = cloudUtil,
		data = dataUtil
	} = {}) {
		this._cloud = cloud;
		this._data = data;
	}

	getCoverSrc(news = {}, defaultCover = '/images/cover.gif') {
		if (Array.isArray(news.NEWS_PIC) && news.NEWS_PIC.length > 0) return news.NEWS_PIC[0];
		if (typeof news.NEWS_PIC === 'string' && news.NEWS_PIC.trim()) return news.NEWS_PIC.trim();
		return defaultCover;
	}

	async _safeGetTempFileURL(cloudIds = []) {
		try {
			return await this._cloud.getTempFileURL(cloudIds);
		} catch (err) {
			return null;
		}
	}

	async replaceCloudImageList(list) {
		if (!Array.isArray(list)) return [];
		if (list.length === 0) return list;

		const cloudIds = list.filter(item => typeof item === 'string' && item.indexOf('cloud://') === 0);
		if (cloudIds.length === 0) return list;

		const tempList = await this._safeGetTempFileURL(cloudIds);
		const urlMap = {};
		for (const item of tempList || []) {
			urlMap[item.cloudId] = item.url;
		}

		return list.map(item => urlMap[item] || item);
	}

	async formatNews(news) {
		if (!news || typeof news !== 'object') return news;

		const ret = news;

		if (typeof ret.NEWS_PIC === 'string' && ret.NEWS_PIC.trim()) {
			ret.NEWS_PIC = [ret.NEWS_PIC.trim()];
		}

		if (Array.isArray(ret.NEWS_PIC) && ret.NEWS_PIC.length > 0) {
			ret.NEWS_PIC = await this.replaceCloudImageList(ret.NEWS_PIC);
		}

		if (Array.isArray(ret.NEWS_CONTENT) && ret.NEWS_CONTENT.length > 0) {
			const cloudIds = ret.NEWS_CONTENT
				.filter(item => item && (item.type === 'img' || item.type === 'image') && typeof item.val === 'string' && item.val.indexOf('cloud://') === 0)
				.map(item => item.val);

			if (cloudIds.length > 0) {
				const tempList = await this._safeGetTempFileURL(cloudIds);
				const urlMap = {};
				for (const item of tempList || []) {
					urlMap[item.cloudId] = item.url;
				}

				ret.NEWS_CONTENT = ret.NEWS_CONTENT.map(item => {
					if (!item || (item.type !== 'img' && item.type !== 'image')) return item;
					return Object.assign({}, item, {
						val: urlMap[item.val] || item.val
					});
				});
			}
		}

		return ret;
	}
}

module.exports = NewsImageService;
