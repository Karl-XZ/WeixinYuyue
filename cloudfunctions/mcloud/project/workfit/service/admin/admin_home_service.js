/**
 * Notes: 后台HOME/登录模块
 * Date: 2021-06-15 07:48:00
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 */

const BaseProjectAdminService = require('./base_project_admin_service.js');
const UserModel = require('../../model/user_model.js');
const MeetModel = require('../../model/meet_model.js');
const NewsModel = require('../../model/news_model.js');
const JoinModel = require('../../model/join_model.js');
const constants = require('../../public/constants.js');
const setupUtil = require('../../../../framework/utils/setup/setup_util.js');

class AdminHomeService extends BaseProjectAdminService {

	/**
	 * 首页数据归集
	 */
	async adminHome() {
		let where = {};

		let userCnt = await UserModel.count(where);
		let newsCnt = await NewsModel.count(where);
		let meetCnt = await MeetModel.count(where);
		let joinCnt = await JoinModel.count(where);

		return {
			summary: [
				{ title: '学生总数', cnt: userCnt },
				{ title: '公告总数', cnt: newsCnt },
				{ title: '老师总数', cnt: meetCnt },
				{ title: '预约总数', cnt: joinCnt },
			]
		};
	}

	async clearUserData(userId) {
	}

	async clearVouchData() {
		await setupUtil.remove(constants.SETUP_HOME_VOUCH_KEY);

		NewsModel.edit({}, { NEWS_VOUCH: 0 });
		MeetModel.edit({}, { MEET_VOUCH: 0 });
	}

	async updateHomeVouch(node) {
		if (node.ext) node.ext = '#' + node.ext;
		let key = constants.SETUP_HOME_VOUCH_KEY;
		let list = await setupUtil.get(key);
		if (!list || !Array.isArray(list)) list = [];

		for (let k = 0; k < list.length; k++) {
			if (list[k].id == node.id) {
				list[k] = node;
				return await setupUtil.set(key, list, 'vouch');
			}
		}

		list.unshift(node);
		await setupUtil.set(key, list, 'vouch');
	}

	async delHomeVouch(id) {
		let key = constants.SETUP_HOME_VOUCH_KEY;
		let list = await setupUtil.get(key);
		if (!list || !Array.isArray(list)) return;

		let newList = [];
		for (let k = 0; k < list.length; k++) {
			if (list[k].id != id) {
				newList.push(list[k]);
			}
		}

		return await setupUtil.set(key, newList, 'vouch');
	}
}

module.exports = AdminHomeService;
