/**
 * Notes: 预约后台管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2021-12-08 07:48:00 
 */

const BaseProjectAdminService = require('./base_project_admin_service.js');
const MeetService = require('../meet_service.js');
const AdminHomeService = require('../admin/admin_home_service.js');
const dataUtil = require('../../../../framework/utils/data_util.js');
const timeUtil = require('../../../../framework/utils/time_util.js');
const setupUtil = require('../../../../framework/utils/setup/setup_util.js');
const util = require('../../../../framework/utils/util.js');
const cloudUtil = require('../../../../framework/cloud/cloud_util.js');
const cloudBase = require('../../../../framework/cloud/cloud_base.js');
const md5Lib = require('../../../../framework/lib/md5_lib.js');

const MeetModel = require('../../model/meet_model.js');
const JoinModel = require('../../model/join_model.js');
const DayModel = require('../../model/day_model.js');
const TempModel = require('../../model/temp_model.js');

const exportUtil = require('../../../../framework/utils/export_util.js');


// 导出报名数据KEY
const EXPORT_JOIN_DATA_KEY = 'EXPORT_JOIN_DATA';

class AdminMeetService extends BaseProjectAdminService {

	/** 推荐首页SETUP */
	async vouchMeetSetup(id, vouch) {
		// 检查预约项目是否存在
		let where = {
			_id: id
		}
		let meet = await MeetModel.getOne(where);
		if (!meet) {
			this.AppError('预约项目不存在');
		}

		// 更新推荐状态
		let data = {
			MEET_VOUCH: vouch,
			MEET_EDIT_TIME: timeUtil.time()
		}
		await MeetModel.edit(where, data);

		// 如果设置为推荐，生成二维码
		if (vouch == 1) {
			let qr = await this.genDetailQr('meet', id);
			if (qr) {
				await MeetModel.edit(where, { MEET_QR: qr });
			}
		}

		return { msg: '设置成功' };
	}


	/** 预约数据列表 */
	async getDayList(meetId, start, end) {
		let where = {
			DAY_MEET_ID: meetId,
			day: ['between', start, end]
		}
		let orderBy = {
			day: 'asc'
		}
		return await DayModel.getAllBig(where, 'day,times,dayDesc', orderBy);
	}

	// 按项目统计人数
	async statJoinCntByMeet(meetId) {
		let where = {
			JOIN_MEET_ID: meetId
		}

		// 统计总预约数
		let totalCnt = await JoinModel.count(where);

		// 统计成功预约数
		where.JOIN_STATUS = JoinModel.STATUS.SUCC;
		let succCnt = await JoinModel.count(where);

		// 统计已签到数
		where.JOIN_IS_CHECKIN = 1;
		let checkinCnt = await JoinModel.count(where);

		// 统计取消数
		where = {
			JOIN_MEET_ID: meetId,
			JOIN_STATUS: ['in', [JoinModel.STATUS.CANCEL, JoinModel.STATUS.ADMIN_CANCEL]]
		}
		let cancelCnt = await JoinModel.count(where);

		return {
			totalCnt,
			succCnt,
			checkinCnt,
			cancelCnt
		};
	}

	/** 管理员按钮签到 */
	async checkinJoin(joinId, flag) {
		// 检查预约记录是否存在
		let where = {
			_id: joinId
		}
		let join = await JoinModel.getOne(where);
		if (!join) {
			this.AppError('预约记录不存在');
		}

		// 检查预约状态
		if (join.JOIN_STATUS != JoinModel.STATUS.SUCC) {
			this.AppError('预约状态不正确，无法签到');
		}

		// 更新签到状态
		let data = {
			JOIN_IS_CHECKIN: flag,
			JOIN_EDIT_TIME: timeUtil.time()
		}

		if (flag == 1) {
			data.JOIN_CHECKIN_TIME = timeUtil.time();
		} else {
			data.JOIN_CHECKIN_TIME = 0;
		}

		await JoinModel.edit(where, data);

		return { msg: flag == 1 ? '签到成功' : '取消签到成功' };
	}

	/** 管理员扫码签到 */
	async scanJoin(meetId, code) {
		// 根据核验码查找预约记录
		let where = {
			JOIN_MEET_ID: meetId,
			JOIN_CODE: code
		}
		let join = await JoinModel.getOne(where);
		if (!join) {
			this.AppError('核验码不存在或已失效');
		}

		// 检查预约状态
		if (join.JOIN_STATUS != JoinModel.STATUS.SUCC) {
			this.AppError('预约状态不正确，无法签到');
		}

		// 检查是否已经签到
		if (join.JOIN_IS_CHECKIN == 1) {
			this.AppError('该预约已经签到过了');
		}

		// 更新签到状态
		let data = {
			JOIN_IS_CHECKIN: 1,
			JOIN_CHECKIN_TIME: timeUtil.time(),
			JOIN_EDIT_TIME: timeUtil.time()
		}

		await JoinModel.edit(where, data);

		return { 
			msg: '签到成功',
			join: {
				JOIN_ID: join.JOIN_ID,
				JOIN_MEET_TITLE: join.JOIN_MEET_TITLE,
				JOIN_MEET_DAY: join.JOIN_MEET_DAY,
				JOIN_MEET_TIME_START: join.JOIN_MEET_TIME_START,
				JOIN_MEET_TIME_END: join.JOIN_MEET_TIME_END,
				JOIN_FORMS: join.JOIN_FORMS
			}
		};
	}

	/**
	 * 判断本日是否有预约记录
	 * @param {*} daySet daysSet的节点
	 */
	checkHasJoinCnt(times) {
		if (!times) return false;
		for (let k = 0; k < times.length; k++) {
			if (times[k].stat.succCnt) return true;
		}
		return false;
	}

	// 判断含有预约的日期
	getCanModifyDaysSet(daysSet) {
		let now = timeUtil.time('Y-M-D');

		for (let k = 0; k < daysSet.length; k++) {
			if (daysSet[k].day < now) continue;
			daysSet[k].hasJoin = this.checkHasJoinCnt(daysSet[k].times);
		}

		return daysSet;
	}

	/** 取消某个时间段的所有预约记录 */
	async cancelJoinByTimeMark(meetId, timeMark, reason) {
		// 查找该时间段的所有成功预约记录
		let where = {
			JOIN_MEET_ID: meetId,
			JOIN_MEET_TIME_MARK: timeMark,
			JOIN_STATUS: JoinModel.STATUS.SUCC
		}

		let joins = await JoinModel.getAll(where, 'JOIN_ID');
		if (!joins || joins.length == 0) {
			this.AppError('该时间段没有预约记录');
		}

		// 批量更新状态为系统取消
		let cancelReason = reason;
		if (!cancelReason) {
			cancelReason = '管理员取消';
		}

		let data = {
			JOIN_STATUS: JoinModel.STATUS.ADMIN_CANCEL,
			JOIN_REASON: cancelReason,
			JOIN_EDIT_TIME: timeUtil.time()
		}

		let cnt = 0;
		for (let join of joins) {
			await JoinModel.edit({ _id: join._id }, data);
			cnt++;
		}

		return { 
			msg: `成功取消${cnt}条预约记录`,
			cancelCnt: cnt
		};
	}

	// 更新forms信息
	async updateMeetForms({
		id,
		hasImageForms
	}) {
		// 检查预约项目是否存在
		let where = {
			_id: id
		}
		let meet = await MeetModel.getOne(where);
		if (!meet) {
			this.AppError('预约项目不存在');
		}

		// 更新表单信息
		await MeetModel.editForms(id, 'MEET_FORMS', 'MEET_OBJ', hasImageForms);

		return { msg: '表单信息更新成功' };
	}


	/**添加 */
	async insertMeet(adminId, {
		title,
		order,
		cancelSet,
		cateId,
		cateName,
		daysSet,
		phone,
		password,
		forms,
		joinForms,
	}) {
		// 数据校验
		if (!title || title.trim() == '') {
			this.AppError('标题不能为空');
		}
		if (!cateId) {
			this.AppError('分类不能为空');
		}

		// 构建数据
		let safeCateName = cateName;
		if (!safeCateName) {
			safeCateName = '';
		}
		let safeForms = forms;
		if (!Array.isArray(safeForms)) {
			safeForms = [];
		}
		let safeJoinForms = joinForms;
		if (!Array.isArray(safeJoinForms)) {
			safeJoinForms = [];
		}

		let data = {
			MEET_TITLE: title,
			MEET_CATE_ID: cateId,
			MEET_CATE_NAME: safeCateName,
			MEET_ORDER: order || 9999,
			MEET_CANCEL_SET: cancelSet || 1,
			MEET_ADMIN_ID: adminId,
			MEET_STATUS: MeetModel.STATUS.COMM,
			MEET_FORMS: safeForms,
			MEET_JOIN_FORMS: safeJoinForms,
			MEET_DAYS: [],
			MEET_ADD_TIME: timeUtil.time(),
			MEET_EDIT_TIME: timeUtil.time()
		}

		// 如果有登录信息
		if (phone) {
			data.MEET_PHONE = phone;
		}
		if (password) {
			data.MEET_PASSWORD = md5Lib.md5(password);
		}

		// 插入数据
		let id = await MeetModel.insert(data);

		// 如果有排期设置，更新排期
		if (daysSet && daysSet.length > 0) {
			await this.setDays(id, { daysSet });
		}

		return { id, msg: '添加成功' };
	}


	/**排期设置 */
	async setDays(id, {
		daysSet,
	}) {
		// 检查预约项目是否存在
		let where = {
			_id: id
		}
		let meet = await MeetModel.getOne(where);
		if (!meet) {
			this.AppError('预约项目不存在');
		}

		// 数据校验
		if (!daysSet || !Array.isArray(daysSet)) {
			this.AppError('排期数据格式不正确');
		}

		// 更新排期数据
		let data = {
			MEET_DAYS: daysSet,
			MEET_EDIT_TIME: timeUtil.time()
		}
		await MeetModel.edit(where, data);

		// 更新日期设置到DayModel
		let nowDay = timeUtil.time('Y-M-D');
		await this._editDays(id, nowDay, daysSet);

		return { msg: '排期设置成功' };
	}


	/**删除数据 */
	async delMeet(id) {
		// 检查预约项目是否存在
		let where = {
			_id: id
		}
		let meet = await MeetModel.getOne(where);
		if (!meet) {
			this.AppError('预约项目不存在');
		}

		// 检查是否有预约记录
		let joinWhere = {
			JOIN_MEET_ID: id,
			JOIN_STATUS: JoinModel.STATUS.SUCC
		}
		let joinCnt = await JoinModel.count(joinWhere);
		if (joinCnt > 0) {
			this.AppError('该预约项目还有预约记录，无法删除');
		}

		// 删除相关数据
		await MeetModel.del(where);
		
		// 删除相关的日期数据
		await DayModel.del({ DAY_MEET_ID: id });
		
		// 删除相关的预约记录（已取消的）
		await JoinModel.del({ JOIN_MEET_ID: id });

		return { msg: '删除成功' };
	}

	/**获取信息 */
	async getMeetDetail(id) {
		let fields = '*';

		let where = {
			_id: id
		}
		let meet = await MeetModel.getOne(where, fields);
		if (!meet) return null;

		let meetService = new MeetService();
		meet.MEET_DAYS_SET = await meetService.getDaysSet(id, timeUtil.time('Y-M-D')); //今天及以后

		return meet;
	}


	/** 更新日期设置 */
	async _editDays(meetId, nowDay, daysSetData) {
		// 删除今天之前的日期数据
		await DayModel.del({
			DAY_MEET_ID: meetId,
			day: ['<', nowDay]
		});

		// 处理新的日期数据
		for (let dayData of daysSetData) {
			if (!dayData.day || dayData.day < nowDay) continue;

			let where = {
				DAY_MEET_ID: meetId,
				day: dayData.day
			}

			let existDay = await DayModel.getOne(where);
			
			let safeTimes = dayData.times;
			if (!Array.isArray(safeTimes)) {
				safeTimes = [];
			}

			let data = {
				DAY_MEET_ID: meetId,
				day: dayData.day,
				times: safeTimes,
				dayDesc: dayData.dayDesc || '',
				DAY_ADD_TIME: timeUtil.time(),
				DAY_EDIT_TIME: timeUtil.time()
			}

			if (existDay) {
				// 更新现有记录
				await DayModel.edit(where, data);
			} else {
				// 插入新记录
				await DayModel.insert(data);
			}
		}

		return { msg: '日期设置更新成功' };
	}

	/**更新数据 */
	async editMeet({
		id,
		title,
		cateId,
		cateName,
		order,
		cancelSet,
		daysSet,
		phone,
		password,
		forms,
		joinForms
	}) {
		// 检查预约项目是否存在
		let where = {
			_id: id
		}
		let meet = await MeetModel.getOne(where);
		if (!meet) {
			this.AppError('预约项目不存在');
		}

		// 数据校验
		if (!title || title.trim() == '') {
			this.AppError('标题不能为空');
		}
		if (!cateId) {
			this.AppError('分类不能为空');
		}

		// 构建更新数据
		let safeCateName = cateName;
		if (!safeCateName) {
			safeCateName = '';
		}
		let safeForms = forms;
		if (!Array.isArray(safeForms)) {
			safeForms = [];
		}
		let safeJoinForms = joinForms;
		if (!Array.isArray(safeJoinForms)) {
			safeJoinForms = [];
		}

		let data = {
			MEET_TITLE: title,
			MEET_CATE_ID: cateId,
			MEET_CATE_NAME: safeCateName,
			MEET_ORDER: order || 9999,
			MEET_CANCEL_SET: cancelSet || 1,
			MEET_FORMS: safeForms,
			MEET_JOIN_FORMS: safeJoinForms,
			MEET_EDIT_TIME: timeUtil.time()
		}

		// 如果有登录信息
		if (phone) {
			data.MEET_PHONE = phone;
		}
		if (password) {
			data.MEET_PASSWORD = md5Lib.md5(password);
		}

		// 更新数据
		await MeetModel.edit(where, data);

		// 如果有排期设置，更新排期
		if (daysSet && daysSet.length > 0) {
			await this.setDays(id, { daysSet });
		}

		return { msg: '更新成功' };
	}

	/**预约名单分页列表 */
	async getJoinList({
		search, // 搜索条件
		sortType, // 搜索菜单
		sortVal, // 搜索菜单
		orderBy, // 排序
		meetId,
		mark,
		page,
		size,
		isTotal = true,
		oldTotal
	}) {

		orderBy = orderBy || {
			'JOIN_ADD_TIME': 'desc'
		};
		let fields = 'JOIN_IS_CHECKIN,JOIN_CHECKIN_TIME,JOIN_CODE,JOIN_ID,JOIN_REASON,JOIN_USER_ID,JOIN_MEET_ID,JOIN_MEET_TITLE,JOIN_MEET_DAY,JOIN_MEET_TIME_START,JOIN_MEET_TIME_END,JOIN_MEET_TIME_MARK,JOIN_FORMS,JOIN_STATUS,JOIN_ADD_TIME';

		let where = {
			JOIN_MEET_ID: meetId,
			JOIN_MEET_TIME_MARK: mark
		}; 
		if (util.isDefined(search) && search) {
			where['JOIN_FORMS.val'] = {
				$regex: '.*' + search,
				$options: 'i'
			};
		} else if (sortType && util.isDefined(sortVal)) {
			// 搜索菜单
			switch (sortType) {
				case 'status':
					// 按类型
					sortVal = Number(sortVal);
					if (sortVal == 1099) //取消的2种
						where.JOIN_STATUS = ['in', [10, 99]]
					else
						where.JOIN_STATUS = Number(sortVal);
					break;
				case 'checkin':
					// 签到
					where.JOIN_STATUS = JoinModel.STATUS.SUCC;
					if (sortVal == 1) {
						where.JOIN_IS_CHECKIN = 1;
					} else {
						where.JOIN_IS_CHECKIN = 0;
					}
					break;
			}
		}

		return await JoinModel.getList(where, fields, orderBy, page, size, isTotal, oldTotal);
	}

	/**预约项目分页列表 */
	async getAdminMeetList({
		search, // 搜索条件
		sortType, // 搜索菜单
		sortVal, // 搜索菜单
		orderBy, // 排序
		whereEx, //附加查询条件
		page,
		size,
		isTotal = true,
		oldTotal
	}) {

		orderBy = orderBy || {
			'MEET_ORDER': 'asc',
			'MEET_ADD_TIME': 'desc'
		};
		let fields = 'MEET_CATE_ID,MEET_CATE_NAME,MEET_TITLE,MEET_STATUS,MEET_DAYS,MEET_ADD_TIME,MEET_EDIT_TIME,MEET_ORDER,MEET_VOUCH,MEET_QR';

		let where = {};
		if (util.isDefined(search) && search) {
			where.MEET_TITLE = {
				$regex: '.*' + search,
				$options: 'i'
			};
		} else if (sortType && util.isDefined(sortVal)) {
			// 搜索菜单
			switch (sortType) {
				case 'status':
					// 按类型
					where.MEET_STATUS = Number(sortVal);
					break;
				case 'cateId':
					// 按类型
					where.MEET_CATE_ID = sortVal;
					break;
				case 'sort':
					// 排序
					if (sortVal == 'view') {
						orderBy = {
							'MEET_VIEW_CNT': 'desc',
							'MEET_ADD_TIME': 'desc'
						};
					}

					break;
			}
		}

		return await MeetModel.getList(where, fields, orderBy, page, size, isTotal, oldTotal);
	}

	/** 删除 */
	async delJoin(joinId) {
		// 检查预约记录是否存在
		let where = {
			_id: joinId
		}
		let join = await JoinModel.getOne(where);
		if (!join) {
			this.AppError('预约记录不存在');
		}

		// 删除预约记录
		await JoinModel.del(where);

		return { msg: '删除成功' };
	}

	/**修改报名状态 
	 * 特殊约定 99=>正常取消 
	 */
	async statusJoin(joinId, status, reason = '') {
		// 检查预约记录是否存在
		let where = {
			_id: joinId
		}
		let join = await JoinModel.getOne(where);
		if (!join) {
			this.AppError('预约记录不存在');
		}

		// 构建更新数据
		let data = {
			JOIN_STATUS: status,
			JOIN_EDIT_TIME: timeUtil.time()
		}

		// 如果有取消原因
		if (reason) {
			data.JOIN_REASON = reason;
		}

		// 如果是取消状态，清除签到信息
		if (status == JoinModel.STATUS.CANCEL || status == JoinModel.STATUS.ADMIN_CANCEL) {
			data.JOIN_IS_CHECKIN = 0;
			data.JOIN_CHECKIN_TIME = 0;
		}

		// 更新状态
		await JoinModel.edit(where, data);

		let statusDesc = JoinModel.STATUS_DESC[status] || '未知状态';
		return { msg: `状态修改为${statusDesc}成功` };
	}

	/**修改项目状态 */
	async statusMeet(id, status) {
		// 检查预约项目是否存在
		let where = {
			_id: id
		}
		let meet = await MeetModel.getOne(where);
		if (!meet) {
			this.AppError('预约项目不存在');
		}

		// 更新状态
		let data = {
			MEET_STATUS: status,
			MEET_EDIT_TIME: timeUtil.time()
		}
		await MeetModel.edit(where, data);

		let statusDesc = MeetModel.STATUS_DESC[status] || '未知状态';
		return { msg: `状态修改为${statusDesc}成功` };
	}

	/**置顶排序设定 */
	async sortMeet(id, sort) {
		// 检查预约项目是否存在
		let where = {
			_id: id
		}
		let meet = await MeetModel.getOne(where);
		if (!meet) {
			this.AppError('预约项目不存在');
		}

		// 更新排序
		let data = {
			MEET_ORDER: sort,
			MEET_EDIT_TIME: timeUtil.time()
		}
		await MeetModel.edit(where, data);

		return { msg: '排序设置成功' };
	}

	/**首页设定 */
	async vouchMeet(id, vouch) {
		// 检查预约项目是否存在
		let where = {
			_id: id
		}
		let meet = await MeetModel.getOne(where);
		if (!meet) {
			this.AppError('预约项目不存在');
		}

		// 更新推荐状态
		let data = {
			MEET_VOUCH: vouch,
			MEET_EDIT_TIME: timeUtil.time()
		}
		await MeetModel.edit(where, data);

		// 如果设置为推荐，生成二维码
		if (vouch == 1) {
			let qr = await this.genDetailQr('meet', id);
			if (qr) {
				await MeetModel.edit(where, { MEET_QR: qr });
			}
		}

		return { msg: vouch == 1 ? '设置为首页推荐成功' : '取消首页推荐成功' };
	}

	//##################模板
	/**添加模板 */
	async insertMeetTemp({
		name,
		times,
	}, meetId = 'admin') {
		// 数据校验
		if (!name || name.trim() == '') {
			this.AppError('模板名称不能为空');
		}
		if (!times || !Array.isArray(times) || times.length == 0) {
			this.AppError('时间段不能为空');
		}

		// 检查模板名称是否重复
		let where = {
			TEMP_MEET_ID: meetId,
			TEMP_NAME: name
		}
		let existTemp = await TempModel.getOne(where);
		if (existTemp) {
			this.AppError('模板名称已存在');
		}

		// 构建数据
		let data = {
			TEMP_MEET_ID: meetId,
			TEMP_NAME: name,
			TEMP_TIMES: times,
			TEMP_ADD_TIME: timeUtil.time(),
			TEMP_EDIT_TIME: timeUtil.time()
		}

		// 插入数据
		let id = await TempModel.insert(data);

		return { id, msg: '模板添加成功' };
	}

	/**更新数据 */
	async editMeetTemp({
		id,
		name,
		times
	}, meetId = 'admin') {
		// 检查模板是否存在
		let where = {
			_id: id,
			TEMP_MEET_ID: meetId
		}
		let temp = await TempModel.getOne(where);
		if (!temp) {
			this.AppError('模板不存在');
		}

		// 数据校验
		if (name && name.trim() != '') {
			// 检查模板名称是否重复（排除自己）
			let checkWhere = {
				TEMP_MEET_ID: meetId,
				TEMP_NAME: name,
				_id: ['!=', id]
			}
			let existTemp = await TempModel.getOne(checkWhere);
			if (existTemp) {
				this.AppError('模板名称已存在');
			}
		}

		// 构建更新数据
		let data = {
			TEMP_EDIT_TIME: timeUtil.time()
		}

		if (name && name.trim() != '') {
			data.TEMP_NAME = name;
		}
		if (times && Array.isArray(times)) {
			data.TEMP_TIMES = times;
		}

		// 更新数据
		await TempModel.edit(where, data);

		return { msg: '模板更新成功' };
	}


	/**删除数据 */
	async delMeetTemp(id, meetId = 'admin') {
		// 检查模板是否存在
		let where = {
			_id: id,
			TEMP_MEET_ID: meetId
		}
		let temp = await TempModel.getOne(where);
		if (!temp) {
			this.AppError('模板不存在');
		}

		// 删除模板
		await TempModel.del(where);

		return { msg: '模板删除成功' };
	}


	/**模板列表 */
	async getMeetTempList(meetId = 'admin') {
		let orderBy = {
			'TEMP_ADD_TIME': 'desc'
		};
		let fields = 'TEMP_NAME,TEMP_TIMES';

		let where = {
			TEMP_MEET_ID: meetId
		};
		return await TempModel.getAll(where, fields, orderBy);
	}

	// #####################导出报名数据
	/**获取报名数据 */
	async getJoinDataURL() {
		return await exportUtil.getExportDataURL(EXPORT_JOIN_DATA_KEY);
	}

	/**删除报名数据 */
	async deleteJoinDataExcel() {
		return await exportUtil.deleteDataExcel(EXPORT_JOIN_DATA_KEY);
	}

	/**导出报名数据 */
	async exportJoinDataExcel({
		meetId,
		startDay,
		endDay,
		status
	}) {
		// 构建查询条件
		let where = {};
		if (meetId) {
			where.JOIN_MEET_ID = meetId;
		}
		if (startDay && endDay) {
			where.JOIN_MEET_DAY = ['between', startDay, endDay];
		}
		if (util.isDefined(status)) {
			where.JOIN_STATUS = status;
		}

		// 获取数据
		let orderBy = {
			JOIN_ADD_TIME: 'desc'
		}
		let fields = 'JOIN_ID,JOIN_CODE,JOIN_USER_ID,JOIN_MEET_TITLE,JOIN_MEET_DAY,JOIN_MEET_TIME_START,JOIN_MEET_TIME_END,JOIN_FORMS,JOIN_STATUS,JOIN_IS_CHECKIN,JOIN_CHECKIN_TIME,JOIN_ADD_TIME,JOIN_REASON';
		
		let list = await JoinModel.getAll(where, fields, orderBy);
		if (!list || list.length == 0) {
			this.AppError('没有数据可导出');
		}

		// 处理数据格式
		let data = [];
		for (let item of list) {
			let row = {
				'预约编号': item.JOIN_ID,
				'核验码': item.JOIN_CODE,
				'学生ID': item.JOIN_USER_ID,
				'预约项目': item.JOIN_MEET_TITLE,
				'预约日期': item.JOIN_MEET_DAY,
				'开始时间': item.JOIN_MEET_TIME_START,
				'结束时间': item.JOIN_MEET_TIME_END,
				'状态': JoinModel.STATUS_DESC[item.JOIN_STATUS] || '未知',
				'是否签到': item.JOIN_IS_CHECKIN ? '已签到' : '未签到',
				'签到时间': item.JOIN_CHECKIN_TIME ? timeUtil.timestamp2Time(item.JOIN_CHECKIN_TIME) : '',
				'预约时间': timeUtil.timestamp2Time(item.JOIN_ADD_TIME),
				'备注': item.JOIN_REASON || ''
			};

			// 处理表单数据
			if (item.JOIN_FORMS && Array.isArray(item.JOIN_FORMS)) {
				for (let form of item.JOIN_FORMS) {
					if (form.title && form.val) {
						row[form.title] = form.val;
					}
				}
			}

			data.push(row);
		}

		// 导出Excel
		let title = '预约数据导出_' + timeUtil.time('Y-M-D-h-m-s');
		return await exportUtil.exportDataExcel(EXPORT_JOIN_DATA_KEY, data, title);
	}
}

module.exports = AdminMeetService;
