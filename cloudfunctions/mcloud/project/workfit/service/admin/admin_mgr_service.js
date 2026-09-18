/**
 * Notes: 管理员管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2021-07-11 07:48:00
 */

const BaseProjectAdminService = require('./base_project_admin_service.js');
const util = require('../../../../framework/utils/util.js');
const dataUtil = require('../../../../framework/utils/data_util.js');
const timeUtil = require('../../../../framework/utils/time_util.js');
const AdminModel = require('../../../../framework/platform/model/admin_model.js');
const LogModel = require('../../../../framework/platform/model/log_model.js');
const md5Lib = require('../../../../framework/lib/md5_lib.js');

class AdminMgrService extends BaseProjectAdminService {

	_normalizeText(val) {
		if (val === undefined || val === null) return '';
		return String(val).trim();
	}

	// 管理员登录
	async adminLogin(name, password) {
		name = this._normalizeText(name);

		let where = {
			ADMIN_STATUS: 1,
			ADMIN_NAME: name,
			ADMIN_PASSWORD: md5Lib.md5(password)
		};
		let fields = 'ADMIN_ID,ADMIN_NAME,ADMIN_DESC,ADMIN_TYPE,ADMIN_LOGIN_TIME,ADMIN_LOGIN_CNT';
		let admin = await AdminModel.getOne(where, fields);
		if (!admin) {
			this.AppError('管理员不存在或者已停用');
		}

		let cnt = Number(admin.ADMIN_LOGIN_CNT || 0);

		let token = dataUtil.genRandomString(32);
		let tokenTime = timeUtil.time();
		let data = {
			ADMIN_TOKEN: token,
			ADMIN_TOKEN_TIME: tokenTime,
			ADMIN_LOGIN_TIME: timeUtil.time(),
			ADMIN_LOGIN_CNT: cnt + 1
		};
		await AdminModel.edit(admin._id, data);

		let type = admin.ADMIN_TYPE;
		let last = '尚未登录';
		if (admin.ADMIN_LOGIN_TIME) {
			last = timeUtil.timestamp2Time(admin.ADMIN_LOGIN_TIME);
		}

		this.insertLog('登录了系统', admin, LogModel.TYPE.SYS);

		return {
			token,
			name: admin.ADMIN_NAME,
			type,
			last,
			cnt
		};
	}

	async clearLog() {
		let where = {};
		await LogModel.del(where);
	}

	/** 取得日志分页列表 */
	async getLogList({
		search,
		sortType,
		sortVal,
		orderBy,
		whereEx,
		page,
		size,
		oldTotal = 0
	}) {
		orderBy = orderBy || {
			LOG_ADD_TIME: 'desc'
		};
		let fields = '*';
		let where = {};

		if (util.isDefined(search) && search) {
			where.or = [{
				LOG_CONTENT: ['like', search]
			}, {
				LOG_ADMIN_DESC: ['like', search]
			}, {
				LOG_ADMIN_NAME: ['like', search]
			}];
		} else if (sortType && util.isDefined(sortVal)) {
			switch (sortType) {
				case 'type':
					where.LOG_TYPE = Number(sortVal);
					break;
			}
		}
		return await LogModel.getList(where, fields, orderBy, page, size, true, oldTotal);
	}

	/** 获取所有管理员 */
	async getMgrList({
		search,
		sortType,
		sortVal,
		orderBy,
		whereEx,
		page,
		size,
		isTotal = true,
		oldTotal
	}) {
		orderBy = {
			ADMIN_ADD_TIME: 'desc'
		};
		let fields = 'ADMIN_NAME,ADMIN_STATUS,ADMIN_PHONE,ADMIN_TYPE,ADMIN_LOGIN_CNT,ADMIN_LOGIN_TIME,ADMIN_DESC,ADMIN_EDIT_TIME,ADMIN_EDIT_IP';

		let where = {};
		where.and = {
			_pid: this.getProjectId()
		};
		if (util.isDefined(search) && search) {
			where.or = [{
				ADMIN_NAME: ['like', search]
			}, {
				ADMIN_PHONE: ['like', search]
			}, {
				ADMIN_DESC: ['like', search]
			}];
		} else if (sortType && util.isDefined(sortVal)) {
			switch (sortType) {
				case 'status':
					where.and.ADMIN_STATUS = Number(sortVal);
					break;
				case 'type':
					where.and.ADMIN_TYPE = Number(sortVal);
					break;
			}
		}

		return await AdminModel.getList(where, fields, orderBy, page, size, isTotal, oldTotal);
	}

	/** 删除管理员 */
	async delMgr(id, myAdminId) {
		if (id == myAdminId) {
			this.AppError('不能删除自己');
		}

		let where = { _id: id };
		let mgr = await AdminModel.getOne(where);
		if (!mgr) {
			this.AppError('管理员不存在');
		}

		if (mgr.ADMIN_TYPE == 1) {
			this.AppError('超级管理员不能被删除');
		}

		await AdminModel.del(where);
		this.insertLog(`删除了管理员「${mgr.ADMIN_NAME}」`, { ADMIN_ID: myAdminId }, LogModel.TYPE.ADMIN);

		return { msg: '删除成功' };
	}

	/** 添加新的管理员 */
	async insertMgr({
		name,
		desc,
		phone,
		password
	}) {
		name = this._normalizeText(name);
		desc = this._normalizeText(desc);
		phone = this._normalizeText(phone);

		if (!name) {
			this.AppError('管理员名称不能为空');
		}
		if (!password || password.length < 6) {
			this.AppError('密码不能少于6位');
		}

		let where = {
			ADMIN_NAME: name
		};
		let existMgr = await AdminModel.getOne(where);
		if (existMgr) {
			this.AppError('管理员名称已存在');
		}

		let data = {
			ADMIN_NAME: name,
			ADMIN_DESC: desc || '',
			ADMIN_PHONE: phone || '',
			ADMIN_PASSWORD: md5Lib.md5(password),
			ADMIN_TYPE: 0,
			ADMIN_STATUS: 1,
			ADMIN_LOGIN_CNT: 0,
			ADMIN_ADD_TIME: timeUtil.time(),
			ADMIN_EDIT_TIME: timeUtil.time()
		};

		let id = await AdminModel.insert(data);
		this.insertLog(`添加了管理员「${name}」`, { ADMIN_ID: this.getAdminId() }, LogModel.TYPE.ADMIN);

		return { id, msg: '添加成功' };
	}

	/** 修改状态 */
	async statusMgr(id, status, myAdminId) {
		if (id == myAdminId) {
			this.AppError('不能修改自己的状态');
		}

		let where = { _id: id };
		let mgr = await AdminModel.getOne(where);
		if (!mgr) {
			this.AppError('管理员不存在');
		}

		if (mgr.ADMIN_TYPE == 1) {
			this.AppError('超级管理员状态不能被修改');
		}

		let data = {
			ADMIN_STATUS: status,
			ADMIN_EDIT_TIME: timeUtil.time()
		};
		await AdminModel.edit(where, data);

		let statusDesc = status == 1 ? '启用' : '停用';
		this.insertLog(`${statusDesc}了管理员「${mgr.ADMIN_NAME}」`, { ADMIN_ID: myAdminId }, LogModel.TYPE.ADMIN);

		return { msg: `${statusDesc}成功` };
	}

	/** 获取管理员信息 */
	async getMgrDetail(id) {
		let fields = '*';
		let where = { _id: id };
		let mgr = await AdminModel.getOne(where, fields);
		if (!mgr) return null;

		return mgr;
	}

	/** 修改管理员 */
	async editMgr(id, {
		name,
		desc,
		phone,
		password
	}) {
		let where = { _id: id };
		let mgr = await AdminModel.getOne(where);
		if (!mgr) {
			this.AppError('管理员不存在');
		}

		name = this._normalizeText(name);
		desc = this._normalizeText(desc);
		phone = this._normalizeText(phone);

		if (!name) {
			this.AppError('管理员名称不能为空');
		}

		let checkWhere = {
			ADMIN_NAME: name,
			_id: ['!=', id]
		};
		let existMgr = await AdminModel.getOne(checkWhere);
		if (existMgr) {
			this.AppError('管理员名称已存在');
		}

		let data = {
			ADMIN_NAME: name,
			ADMIN_DESC: desc || '',
			ADMIN_PHONE: phone || '',
			ADMIN_EDIT_TIME: timeUtil.time()
		};

		if (password && password.length >= 6) {
			data.ADMIN_PASSWORD = md5Lib.md5(password);
		}

		await AdminModel.edit(where, data);
		this.insertLog(`修改了管理员「${name}」的信息`, { ADMIN_ID: this.getAdminId() }, LogModel.TYPE.ADMIN);

		return { msg: '修改成功' };
	}

	/** 修改自身密码 */
	async pwdtMgr(adminId, oldPassword, password) {
		if (!oldPassword) {
			this.AppError('原密码不能为空');
		}
		if (!password || password.length < 6) {
			this.AppError('新密码不能少于6位');
		}

		let where = { _id: adminId };
		let mgr = await AdminModel.getOne(where);
		if (!mgr) {
			this.AppError('管理员不存在');
		}

		if (mgr.ADMIN_PASSWORD != md5Lib.md5(oldPassword)) {
			this.AppError('原密码不正确');
		}

		let data = {
			ADMIN_PASSWORD: md5Lib.md5(password),
			ADMIN_EDIT_TIME: timeUtil.time()
		};
		await AdminModel.edit(where, data);

		this.insertLog('修改了自己的密码', { ADMIN_ID: adminId }, LogModel.TYPE.SYS);
		return { msg: '密码修改成功' };
	}
}

module.exports = AdminMgrService;
