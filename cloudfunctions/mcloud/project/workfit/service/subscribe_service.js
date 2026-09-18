/**
 * Notes: 订阅消息状态管理
 *  - 一次性订阅消息：授权后 7 天内可发送 1 次
 *  - 发送后我们会把 valid 置为 0，提示用户下次登录重新授权
 * Date: 2026-01-06
 */

const BaseProjectService = require('./base_project_service.js');
const timeUtil = require('../../../framework/utils/time_util.js');
const config = require('../../../config/config.js');
const UserModel = require('../model/user_model.js');
const MeetModel = require('../model/meet_model.js');

class SubscribeService extends BaseProjectService {

	static _uniq(arr) {
		return Array.from(new Set((arr || []).filter(v => !!v && v !== 'PLEASE_SET')));
	}

	/**
	 * 计算需要重新授权的模板ID
	 */
	static getNeedIds(subscribeObj = {}, templateIds = []) {
		console.log('[SubscribeService.getNeedIds] 输入参数 - subscribeObj:', subscribeObj, ', templateIds:', templateIds);
		
		templateIds = SubscribeService._uniq(templateIds);
		console.log('[SubscribeService.getNeedIds] 过滤后的templateIds:', templateIds);
		
		if (!templateIds.length) return [];

		let need = [];
		let now = timeUtil.time();
		let ttl = (config.SUBSCRIBE_VALID_DAYS || 7) * 24 * 3600 * 1000;

		for (let tplId of templateIds) {
			let rec = (subscribeObj || {})[tplId];
			console.log('[SubscribeService.getNeedIds] 检查模板 - tplId:', tplId, ', rec:', rec);
			
			if (!rec) {
				console.log('[SubscribeService.getNeedIds] -> 需要授权(记录不存在)');
				need.push(tplId);
			} else if (rec.valid !== 1) {
				console.log('[SubscribeService.getNeedIds] -> 需要授权(valid!=1)');
				need.push(tplId);
			} else if (!rec.time) {
				console.log('[SubscribeService.getNeedIds] -> 需要授权(time为空)');
				need.push(tplId);
			} else if (now - rec.time > ttl) {
				console.log('[SubscribeService.getNeedIds] -> 需要授权(已过期), now:', now, ', rec.time:', rec.time, ', ttl:', ttl);
				need.push(tplId);
			} else {
				console.log('[SubscribeService.getNeedIds] -> 不需要授权(有效)');
			}
		}
		if (need.length > 0) {
			console.log('[SubscribeService.getNeedIds] 最终需要授权的模板ID:', need);
		} else {
			console.log('[SubscribeService.getNeedIds] 所有模板都有效,无需重新授权');
		}
		return need;
	}

	/**
	 * 上报订阅授权结果（只上报用户“accept”的模板ID）
	 * @param {*} openId 当前微信openid
	 * @param {*} tmplIds 接受的模板ID数组
	 * @param {*} isWork 是否教师端
	 * @param {*} meetId 教师记录ID（教师端建议传）
	 */
	async report(openId, tmplIds = [], isWork = false, meetId = '') {
		tmplIds = SubscribeService._uniq(tmplIds);
		if (!tmplIds.length) return { result: 'ok' };

		let now = timeUtil.time();

		if (isWork) {
			let where = null;
			if (meetId) {
				where = { _id: meetId };
			} else {
				where = { MEET_MINI_OPENID: openId, MEET_STATUS: MeetModel.STATUS.COMM };
			}

			let meet = await MeetModel.getOne(where, 'MEET_SUBSCRIBE');
			if (!meet) return { result: 'ok' };

			let sub = meet.MEET_SUBSCRIBE || {};
			for (let tplId of tmplIds) {
				sub[tplId] = { valid: 1, time: now };
			}

			await MeetModel.edit(where, { MEET_SUBSCRIBE: sub });
			return { result: 'ok' };
		}

		// 学生端
		let user = await UserModel.getOne({ USER_MINI_OPENID: openId }, 'USER_SUBSCRIBE');
		if (!user) return { result: 'ok' };

		let sub = user.USER_SUBSCRIBE || {};
		for (let tplId of tmplIds) {
			sub[tplId] = { valid: 1, time: now };
		}

		await UserModel.edit({ USER_MINI_OPENID: openId }, { USER_SUBSCRIBE: sub });
		return { result: 'ok' };
	}

}

module.exports = SubscribeService;
