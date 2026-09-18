/**
 * Notes: 订阅消息授权（微信提示）
 *
 * 需求：
 *  - 学生账号/教师账号在“登录成功后”都弹出订阅授权
 *  - 这里只封装前端授权（wx.requestSubscribeMessage）。
 *
 * 说明：微信限制 requestSubscribeMessage 必须由用户触发。
 * 因此这里采用 showModal -> 用户点击“允许订阅”后再调用 requestSubscribeMessage。
 */

const setting = require('../../setting/setting.js');
const cloudHelper = require('../../helper/cloud_helper.js');

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(v => !!v && v !== 'PLEASE_SET')));
}

async function requestSubscribe(tmplIds) {
  tmplIds = uniq(tmplIds);
  if (!tmplIds.length) {
    console.warn('[SubscribeBiz] tmplIds 为空，请先在 setting.js 配置模板ID');
    return;
  }

  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds,
      success: (res) => {
        console.log('[SubscribeBiz] subscribe result:', res);
        resolve(res);
      },
      fail: (err) => {
        console.warn('[SubscribeBiz] subscribe fail:', err);
        resolve(null);
      }
    });
  });
}

function pickAcceptedIds(subRes, tmplIds) {
	if (!subRes) return [];
	tmplIds = uniq(tmplIds);
	let accepted = [];
	for (let id of tmplIds) {
		if (subRes[id] === 'accept') accepted.push(id);
	}
	return accepted;
}

class SubscribeBiz {

	static async _promptAndSubscribe(needIds = [], modalContent = '', reportParams = {}) {
		needIds = uniq(needIds);
		console.log('[SubscribeBiz._promptAndSubscribe] needIds:', needIds);
		if (!needIds.length) {
			console.warn('[SubscribeBiz._promptAndSubscribe] needIds为空,跳过授权流程');
			return false;
		}

		return new Promise((resolve) => {
			wx.showModal({
				title: '订阅提醒',
				content: modalContent || '开启后可接收微信提醒。',
				confirmText: '允许订阅',
				cancelText: '暂不',
				success: async (r) => {
					console.log('[SubscribeBiz._promptAndSubscribe] 用户选择:', r.confirm ? '允许订阅' : '暂不');
					if (!r.confirm) return resolve(false);

					// 由用户点击触发 requestSubscribeMessage
					console.log('[SubscribeBiz._promptAndSubscribe] 开始调用 wx.requestSubscribeMessage, tmplIds:', needIds);
					const subRes = await requestSubscribe(needIds);
					console.log('[SubscribeBiz._promptAndSubscribe] 授权结果:', subRes);
					const accepted = pickAcceptedIds(subRes, needIds);
					console.log('[SubscribeBiz._promptAndSubscribe] 用户接受的模板ID:', accepted);
					if (accepted.length) {
						try {
							await cloudHelper.callCloudSumbit('subscribe/report', {
								tmplIds: accepted,
								...reportParams
							}, { title: '授权中' });
							console.log('[SubscribeBiz._promptAndSubscribe] 上报授权结果成功');
						} catch (e) {
							console.warn('[SubscribeBiz] report subscribe error', e);
						}
					}

					return resolve(true);
				}
			});
		});
	}

	// 学生端：登录后提示订阅（仅当后端判定订阅失效时才弹窗）
	static async promptStudentLoginSubscribe(subNeedIds = []) {
		return await SubscribeBiz._promptAndSubscribe(
			subNeedIds,
			'开启后可接收预约成功/取消等微信提醒。',
			{ isWork: 0 }
		);
	}

	// 教师端：登录后提示订阅（仅当后端判定订阅失效时才弹窗）
	static async promptTeacherLoginSubscribe(subNeedIds = [], meetId = '') {
		return await SubscribeBiz._promptAndSubscribe(
			subNeedIds,
			'开启后可在有学生预约时收到微信提醒（一次性订阅：每次收到后需重新登录授权下一次）。',
			{ isWork: 1, meetId: meetId || '' }
		);
	}

}


module.exports = SubscribeBiz;
