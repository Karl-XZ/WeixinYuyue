/**
 * Notes: 预约模块业务逻辑
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2021-12-10 07:48:00 
 */

const BaseBiz = require('../../../comm/biz/base_biz.js');
const pageHelper = require('../../../helper/page_helper.js');
const dataHelper = require('../../../helper/data_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const projectSetting = require('../public/project_setting.js');

class MeetBiz extends BaseBiz {

	static async subscribeMessageMeet(callback) {
		const tmplIds = ['RYDxYPJynjoRcC9lLYGM8P1nuQr68f5sd7mQftVULgk', 'OTw2KKPEt_OVteo8yP10sLN8mWhMHwX9SRv8yVXgy28'];
		wx.requestSubscribeMessage({
			tmplIds,
			success: async (res) => {
				// 与“登录后只在失效时弹窗”的策略保持一致：把 accept 的模板ID上报到云端
				try {
					let accepted = [];
					for (let id of tmplIds) {
						if (res && res[id] === 'accept') accepted.push(id);
					}
					if (accepted.length) {
						await cloudHelper.callCloudSumbit('subscribe/report', {
							tmplIds: accepted,
							isWork: 0
						}, { title: '授权中' });
					}
				} catch (e) {
					console.warn('subscribe/report error', e);
				}
			},
			complete: async () => {
				callback && await callback();
			}
		});
	}

	/** 取得分类 */
	static getCateList() {
		let cateList = projectSetting.MEET_CATE;
		let arr = [];
		for (let k = 0; k < cateList.length; k++) {
			arr.push({
				label: cateList[k].title,
				type: 'cateId',
				val: cateList[k].id, //for options
				value: cateList[k].id, //for list
			})
		}
		return arr;
	} 

	static setCateTitle() {
		return BaseBiz.setCateTitle(projectSetting.MEET_CATE);

	}

}

module.exports = MeetBiz;