/**
 * Notes: 学生管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2022-01-22 07:48:00
 */

const BaseProjectAdminService = require('./base_project_admin_service.js');
const util = require('../../../../framework/utils/util.js');
const exportUtil = require('../../../../framework/utils/export_util.js');
const timeUtil = require('../../../../framework/utils/time_util.js');
const UserModel = require('../../model/user_model.js');
const JoinModel = require('../../model/join_model.js');
const md5Lib = require('../../../../framework/lib/md5_lib.js');

const EXPORT_USER_DATA_KEY = 'EXPORT_USER_DATA';

class AdminUserService extends BaseProjectAdminService {

	_normalizeText(value) {
		if (value === undefined || value === null) return '';
		return String(value).trim();
	}

	async _getUserByMiniOpenId(userId, fields = '*') {
		return await UserModel.getOne({
			USER_MINI_OPENID: userId,
		}, fields);
	}

	/** 获得某个学生信息 */
	async getUser({
		userId,
		fields = '*'
	}) {
		return await this._getUserByMiniOpenId(userId, fields);
	}

	/** 取得学生分页列表 */
	async getUserList({
		search,
		sortType,
		sortVal,
		orderBy,
		page,
		size,
		oldTotal = 0
	}) {
		orderBy = orderBy || {
			USER_ADD_TIME: 'desc'
		};
		let fields = '*';

		let where = {};
		where.and = {
			_pid: this.getProjectId()
		};

		if (util.isDefined(search) && search) {
			where.or = [
				{ USER_NAME: ['like', search] },
				{ USER_MOBILE: ['like', search] },
				{ USER_MEMO: ['like', search] },
			];
		} else if (sortType && util.isDefined(sortVal)) {
			switch (sortType) {
				case 'status':
					where.and.USER_STATUS = Number(sortVal);
					break;
				case 'sort':
					orderBy = this.fmtOrderBySort(sortVal, 'USER_ADD_TIME');
					break;
			}
		}

		let result = await UserModel.getList(where, fields, orderBy, page, size, true, oldTotal, false);
		result.condition = encodeURIComponent(JSON.stringify(where));
		return result;
	}

	async statusUser(id, status, reason) {
		let where = {
			USER_MINI_OPENID: id
		};
		let user = await UserModel.getOne(where);
		if (!user) {
			this.AppError('学生不存在');
		}

		let data = {
			USER_STATUS: status,
			USER_EDIT_TIME: timeUtil.time()
		};
		if (reason) {
			data.USER_CHECK_REASON = reason;
		}

		await UserModel.edit(where, data);

		let statusDesc = UserModel.STATUS_DESC[status] || '未知状态';
		return { msg: `学生状态修改为${statusDesc}成功` };
	}

	async updateUserPassword(id, password) {
		let where = {
			USER_MINI_OPENID: id
		};
		let user = await UserModel.getOne(where, 'USER_NAME');
		if (!user) {
			this.AppError('学生不存在');
		}

		let data = {
			USER_PASSWORD: md5Lib.md5(password),
			USER_EDIT_TIME: timeUtil.time()
		};
		await UserModel.edit(where, data);

		return {
			msg: '学生密码修改成功',
			name: user.USER_NAME || ''
		};
	}

	/** 删除学生 */
	async delUser(id) {
		let where = {
			USER_MINI_OPENID: id
		};
		let user = await UserModel.getOne(where);
		if (!user) {
			this.AppError('学生不存在');
		}

		let joinWhere = {
			JOIN_USER_ID: user.USER_MINI_OPENID,
			JOIN_STATUS: JoinModel.STATUS.SUCC
		};
		let joinCnt = await JoinModel.count(joinWhere);
		if (joinCnt > 0) {
			this.AppError('该学生还有预约记录，无法删除');
		}

		await UserModel.del(where);
		await JoinModel.del({ JOIN_USER_ID: user.USER_MINI_OPENID });

		return { msg: '删除成功' };
	}

	async getUserDataURL() {
		return await exportUtil.getExportDataURL(EXPORT_USER_DATA_KEY);
	}

	async deleteUserDataExcel() {
		return await exportUtil.deleteDataExcel(EXPORT_USER_DATA_KEY);
	}

	async exportUserDataExcel(condition, fields) {
		let where = {};
		if (condition) {
			try {
				where = JSON.parse(decodeURIComponent(condition));
			} catch (e) {
				where = {};
			}
		}

		let orderBy = {
			USER_ADD_TIME: 'desc'
		};
		let exportFields = fields || 'USER_NAME,USER_MOBILE,USER_STATUS,USER_LOGIN_CNT,USER_LOGIN_TIME,USER_ADD_TIME,USER_FORMS';

		let list = await UserModel.getAll(where, exportFields, orderBy);
		if (!list || list.length == 0) {
			this.AppError('没有数据可导出');
		}

		let data = [];
		for (let item of list) {
			let row = {
				'学生名称': item.USER_NAME || '',
				'联系电话': item.USER_MOBILE || '',
				'状态': UserModel.STATUS_DESC[item.USER_STATUS] || '未知',
				'登录次数': item.USER_LOGIN_CNT || 0,
				'最近登录': item.USER_LOGIN_TIME ? timeUtil.timestamp2Time(item.USER_LOGIN_TIME) : '',
				'注册时间': timeUtil.timestamp2Time(item.USER_ADD_TIME)
			};

			if (item.USER_FORMS && Array.isArray(item.USER_FORMS)) {
				for (let form of item.USER_FORMS) {
					if (form.title && form.val) {
						row[form.title] = form.val;
					}
				}
			}

			data.push(row);
		}

		let title = '学生数据导出_' + timeUtil.time('Y-M-D-h-m-s');
		return await exportUtil.exportDataExcel(EXPORT_USER_DATA_KEY, data, title);
	}
}

module.exports = AdminUserService;
