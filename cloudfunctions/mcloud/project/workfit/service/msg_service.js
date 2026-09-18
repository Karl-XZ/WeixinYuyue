/**
 * Notes: 消息模块业务逻辑 
 * Date: 2022-09-26 07:48:00 
 */

const BaseProjectService = require('./base_project_service.js');
const util = require('../../../framework/utils/util.js');
const timeUtil = require('../../../framework/utils/time_util.js');
const miniLib = require('../../../framework/lib/mini_lib.js');
const config = require('../../../config/config.js');
const UserModel = require('../model/user_model.js');
const MeetModel = require('../model/meet_model.js');

class MsgService extends BaseProjectService {

	// 预约成功（学生微信提醒）
	// userOpenid: 学生openid
	// meetTitle: 预约主题
	// timeDesc: 预约时间描述
	// desc: 备注/温馨提示
	async apptSucc(userOpenid, meetTitle, timeDesc, desc = '') {
		if (!userOpenid) return;

		// 清理openid前缀
		if (userOpenid.includes('^^^')) {
			userOpenid = userOpenid.substring(userOpenid.indexOf('^^^') + 3);
		}
		// 确保以 'o' 开头
		while (userOpenid && userOpenid[0] !== 'o') {
			userOpenid = userOpenid.substring(1);
		}
		console.log('[apptSucc] 清理后的学生openid:', userOpenid);

		const page = '/projects/workfit/pages/meet/my_join_list/meet_my_join_list';
		const tplId = config.SUBSCRIBE_TPL_STUDENT_APPT_SUCC;
		if (!tplId || tplId === 'PLEASE_SET') return;

		const body = {
			touser: userOpenid,
			page,
			data: {
				thing1: { value: meetTitle || '预约成功' },
				date2: { value: timeDesc },
				thing4: { value: desc || '点击查看详情！' },
			},
			templateId: tplId,
		};

		// [MODIFIED] 以前这里是 fire-and-forget（不 await），云函数可能提前结束，导致消息未必真正发出
		await miniLib.sendMiniOnceTempMsg(body, 'apptSucc'); // [MODIFIED]

		// 一次性模板：发送后标记失效，避免"频繁弹窗"，下次登录再提示授权
		try {
			let user = await UserModel.getOne({ USER_MINI_OPENID: userOpenid }, 'USER_SUBSCRIBE');
			if (!user) return;
			let sub = user.USER_SUBSCRIBE || {};
			sub[tplId] = { valid: 0, time: timeUtil.time() };
			await UserModel.edit({ USER_MINI_OPENID: userOpenid }, { USER_SUBSCRIBE: sub });
		} catch (e) {
			// ignore
		}
	}


	// 预约取消（学生微信提醒）
	async apptCancel(userId, time, desc = '') {
		// 清理openid前缀
		if (userId.includes('^^^')) {
			userId = userId.substring(userId.indexOf('^^^') + 3);
		}
		// 确保以 'o' 开头
		while (userId && userId[0] !== 'o') {
			userId = userId.substring(1);
		}

		const page = '/projects/workfit/pages/meet/my_join_list/meet_my_join_list';
		const tplId = config.SUBSCRIBE_TPL_STUDENT_APPT_CANCEL;
		if (!tplId || tplId === 'PLEASE_SET') return;

		const body = {
			touser: userId,
			page,
			data: {
				thing1: { value: '预约取消' },
				date2: { value: time },
				thing9: { value: desc || '点击查看详情！' },
			},
			templateId: tplId,
		}

		// [MODIFIED] 以前这里是 fire-and-forget（不 await），云函数可能提前结束，导致消息未必真正发出
		await miniLib.sendMiniOnceTempMsg(body, 'apptCancel'); // [MODIFIED]

		// 一次性模板：发送后标记失效，下次登录再提示授权
		try {
			let user = await UserModel.getOne({ USER_MINI_OPENID: userId }, 'USER_SUBSCRIBE');
			if (!user) return;
			let sub = user.USER_SUBSCRIBE || {};
			sub[tplId] = { valid: 0, time: timeUtil.time() };
			await UserModel.edit({ USER_MINI_OPENID: userId }, { USER_SUBSCRIBE: sub });
		} catch (e) {
			// ignore
		}
	}


	// 教师收到"新的预约"提醒
	async teacherNewAppt(teacherOpenid, timeDesc, studentName = '', joinCnt = 1, meetTitle = '有新的预约', meetId = '') {
		if (!teacherOpenid) {
			console.warn('[teacherNewAppt] 教师openid为空');
			return;
		}

		let rawOpenid = teacherOpenid; // [MODIFIED] 保留原始值便于排查
		// 清理openid前缀（兼容多种格式）
		if (teacherOpenid.includes('^^^')) {
			teacherOpenid = teacherOpenid.substring(teacherOpenid.indexOf('^^^') + 3);
		}
		// 确保以 'o' 开头
		while (teacherOpenid && teacherOpenid[0] !== 'o') {
			teacherOpenid = teacherOpenid.substring(1);
		}
		console.log('[teacherNewAppt] 原始openid:', rawOpenid, ', 清理后:', teacherOpenid); // [MODIFIED]

		const page = '/projects/workfit/pages/work/meet/join/work_meet_join';
		const cntDesc = (joinCnt > 1) ? (` 等${joinCnt}人`) : '';
		const tplId = config.SUBSCRIBE_TPL_TEACHER_NEW_APPT;
		if (!tplId || tplId === 'PLEASE_SET') {
			console.warn('[teacherNewAppt] 模板ID未配置:', tplId);
			return;
		}

		// 使用与模板匹配的字段：thing5, name1, date3, thing7
		const body = {
			touser: teacherOpenid,
			page,
			data: {
				thing5: { value: meetTitle }, // 预约主题
				name1: { value: (studentName || '学生') + cntDesc }, // 预约人
				date3: { value: timeDesc }, // 预约时间
				thing7: { value: '一次性订阅：收到本条后请重新登录授权下次提醒' }, // 备注
			},
			templateId: tplId,
		};

		// [MODIFIED] 等待发送完成，确保订阅消息稳定送达
		console.log('[teacherNewAppt] 发送教师提醒 - openid:', teacherOpenid, ', 标题:', meetTitle, ', 时间:', timeDesc);

		// [MODIFIED] 必须 await，确保 openapi.subscribeMessage.send 在云函数结束前真正执行完成
		await miniLib.sendMiniOnceTempMsg(body, 'teacherNewAppt'); // [MODIFIED]

		// [MODIFIED] 标记失效：不要用 setImmediate（云函数可能提前结束导致该段根本不执行）
		// [MODIFIED] 这里直接 await 落库，保证稳定执行
		if (meetId) {
			try {
				let meet = await MeetModel.getOne({ _id: meetId }, 'MEET_SUBSCRIBE');
				if (!meet) return;
				let sub = meet.MEET_SUBSCRIBE || {};
				sub[tplId] = { valid: 0, time: timeUtil.time() };
				await MeetModel.edit({ _id: meetId }, { MEET_SUBSCRIBE: sub });
			} catch (e) {
				console.error('[teacherNewAppt] 标记失效出错:', e.message);
			}
		}
	}

}

module.exports = MsgService;
