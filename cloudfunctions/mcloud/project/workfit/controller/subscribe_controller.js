/**
 * Notes: 订阅消息状态上报控制器
 * Date: 2026-01-06
 */

const BaseProjectController = require('./base_project_controller.js');
const SubscribeService = require('../service/subscribe_service.js');

class SubscribeController extends BaseProjectController {

	// 前端授权成功后上报（用于控制“只在失效时弹窗”）
	async report() {
		// 数据校验
		let rules = {
			tmplIds: 'array|must|name=模板ID',
			isWork: 'int|false|name=是否教师端',
			meetId: 'string|false|name=教师ID',
		};

		let input = this.validateData(rules);
		let service = new SubscribeService();
		return await service.report(this._openId, input.tmplIds, Number(input.isWork) === 1, input.meetId);
	}
}

module.exports = SubscribeController;
