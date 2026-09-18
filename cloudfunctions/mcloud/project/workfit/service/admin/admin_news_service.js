/**
 * Notes: 资讯后台管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2021-07-11 07:48:00 
 */

const BaseProjectAdminService = require('./base_project_admin_service.js');
const AdminHomeService = require('../admin/admin_home_service.js');
const dataUtil = require('../../../../framework/utils/data_util.js');
const util = require('../../../../framework/utils/util.js');
const timeUtil = require('../../../../framework/utils/time_util.js');
const cloudUtil = require('../../../../framework/cloud/cloud_util.js');

const NewsModel = require('../../model/news_model.js');

class AdminNewsService extends BaseProjectAdminService {

	/** 推荐首页SETUP */
	async vouchNewsSetup(id, vouch) {
		// 检查新闻是否存在
		let where = {
			_id: id
		}
		let news = await NewsModel.getOne(where);
		if (!news) {
			this.AppError('新闻不存在');
		}

		// 更新推荐状态
		let data = {
			NEWS_VOUCH: vouch,
			NEWS_EDIT_TIME: timeUtil.time()
		}
		await NewsModel.edit(where, data);

		// 如果设置为推荐，生成二维码
		if (vouch == 1) {
			let qr = await this.genDetailQr('news', id);
			if (qr) {
				await NewsModel.edit(where, { NEWS_QR: qr });
			}
		}

		return { msg: '设置成功' };
	}

	/**添加资讯 */
	async insertNews({
		title,
		cateId, //分类
		cateName,
		order,
		desc = '',
		forms
	}) {
		// 数据校验
		if (!title || title.trim() == '') {
			this.AppError('标题不能为空');
		}
		if (!cateId) {
			this.AppError('分类不能为空');
		}

		// 构建数据
		let data = {
			NEWS_TITLE: title,
			NEWS_DESC: desc,
			NEWS_CATE_ID: cateId,
			NEWS_CATE_NAME: cateName || '',
			NEWS_ORDER: order || 9999,
			NEWS_STATUS: 1, // 默认启用
			NEWS_FORMS: forms || [],
			NEWS_CONTENT: [],
			NEWS_PIC: [],
			NEWS_VIEW_CNT: 0,
			NEWS_VOUCH: 0,
			NEWS_ADD_TIME: timeUtil.time(),
			NEWS_EDIT_TIME: timeUtil.time()
		}

		// 插入数据
		let id = await NewsModel.insert(data);

		return { id, msg: '添加成功' };
	}

	/**删除资讯数据 */
	async delNews(id) {
		// 检查新闻是否存在
		let where = {
			_id: id
		}
		let news = await NewsModel.getOne(where);
		if (!news) {
			this.AppError('新闻不存在');
		}

		// 删除新闻
		await NewsModel.del(where);

		return { msg: '删除成功' };
	}

	/**获取资讯信息 */
	async getNewsDetail(id) {
		let fields = '*';

		let where = {
			_id: id
		}
		let news = await NewsModel.getOne(where, fields);
		if (!news) return null;

		return news;
	}

	// 更新forms信息
	async updateNewsForms({
		id,
		hasImageForms
	}) {
		await NewsModel.editForms(id, 'NEWS_FORMS', 'NEWS_OBJ', hasImageForms);

		//this.vouchNewsSetup(id, 1);
	}


	/**
	 * 更新富文本详细的内容及图片信息
	 * @returns 返回 urls数组 [url1, url2, url3, ...]
	 */
	async updateNewsContent({
		id,
		content // 富文本数组
	}) {
		// 检查新闻是否存在
		let where = {
			_id: id
		}
		let news = await NewsModel.getOne(where);
		if (!news) {
			this.AppError('新闻不存在');
		}

		// 数据校验
		if (!content || !Array.isArray(content)) {
			this.AppError('内容格式不正确');
		}

		// 更新内容
		let data = {
			NEWS_CONTENT: content,
			NEWS_EDIT_TIME: timeUtil.time()
		}
		await NewsModel.edit(where, data);

		// 提取图片URL
		let urls = [];
		for (let item of content) {
			if (item.type == 'image' && item.val) {
				urls.push(item.val);
			}
		}

		return { urls, msg: '内容更新成功' };
	}

	/**
	 * 更新资讯图片信息
	 * @returns 返回 urls数组 [url1, url2, url3, ...]
	 */
	async updateNewsPic({
		id,
		imgList // 图片数组
	}) {
		// 检查新闻是否存在
		let where = {
			_id: id
		}
		let news = await NewsModel.getOne(where);
		if (!news) {
			this.AppError('新闻不存在');
		}

		// 数据校验
		if (!imgList || !Array.isArray(imgList)) {
			this.AppError('图片数据格式不正确');
		}

		// 更新图片
		let data = {
			NEWS_PIC: imgList,
			NEWS_EDIT_TIME: timeUtil.time()
		}
		await NewsModel.edit(where, data);

		return { urls: imgList, msg: '图片更新成功' };
	}


	/**更新资讯数据 */
	async editNews({
		id,
		title,
		cateId, //分类
		cateName,
		order,
		desc = '',
		forms
	}) {
		// 检查新闻是否存在
		let where = {
			_id: id
		}
		let news = await NewsModel.getOne(where);
		if (!news) {
			this.AppError('新闻不存在');
		}

		// 数据校验
		if (!title || title.trim() == '') {
			this.AppError('标题不能为空');
		}
		if (!cateId) {
			this.AppError('分类不能为空');
		}

		// 构建更新数据
		let data = {
			NEWS_TITLE: title,
			NEWS_DESC: desc,
			NEWS_CATE_ID: cateId,
			NEWS_CATE_NAME: cateName || '',
			NEWS_ORDER: order || 9999,
			NEWS_FORMS: forms || [],
			NEWS_EDIT_TIME: timeUtil.time()
		}

		// 更新数据
		await NewsModel.edit(where, data);

		return { msg: '更新成功' };
	}

	/**取得资讯分页列表 */
	async getAdminNewsList({
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
			'NEWS_ORDER': 'asc',
			'NEWS_ADD_TIME': 'desc'
		};
		let fields = 'NEWS_TITLE,NEWS_DESC,NEWS_CATE_ID,NEWS_CATE_NAME,NEWS_EDIT_TIME,NEWS_ADD_TIME,NEWS_ORDER,NEWS_STATUS,NEWS_CATE2_NAME,NEWS_VOUCH,NEWS_QR,NEWS_OBJ';

		let where = {};
		where.and = {
			_pid: this.getProjectId() //复杂的查询在此处标注PID
		};

		if (util.isDefined(search) && search) {
			where.or = [
				{ NEWS_TITLE: ['like', search] },
			];

		} else if (sortType && util.isDefined(sortVal)) {
			// 搜索菜单
			switch (sortType) {
				case 'cateId': {
					where.and.NEWS_CATE_ID = String(sortVal);
					break;
				}
				case 'status': {
					where.and.NEWS_STATUS = Number(sortVal);
					break;
				}
				case 'vouch': {
					where.and.NEWS_VOUCH = 1;
					break;
				}
				case 'top': {
					where.and.NEWS_ORDER = 0;
					break;
				}
				case 'sort': {
					orderBy = this.fmtOrderBySort(sortVal, 'NEWS_ADD_TIME');
					break;
				}

			}
		}

		return await NewsModel.getList(where, fields, orderBy, page, size, isTotal, oldTotal);
	}

	/**修改资讯状态 */
	async statusNews(id, status) {
		// 检查新闻是否存在
		let where = {
			_id: id
		}
		let news = await NewsModel.getOne(where);
		if (!news) {
			this.AppError('新闻不存在');
		}

		// 更新状态
		let data = {
			NEWS_STATUS: status,
			NEWS_EDIT_TIME: timeUtil.time()
		}
		await NewsModel.edit(where, data);

		let statusDesc = '停用';
		if (status == 1) {
			statusDesc = '启用';
		}
		return { msg: `${statusDesc}成功` };
	}

	/**置顶与排序设定 */
	async sortNews(id, sort) {
		// 检查新闻是否存在
		let where = {
			_id: id
		}
		let news = await NewsModel.getOne(where);
		if (!news) {
			this.AppError('新闻不存在');
		}

		// 更新排序
		let data = {
			NEWS_ORDER: sort,
			NEWS_EDIT_TIME: timeUtil.time()
		}
		await NewsModel.edit(where, data);

		return { msg: '排序设置成功' };
	}

	/**首页设定 */
	async vouchNews(id, vouch) {
		// 检查新闻是否存在
		let where = {
			_id: id
		}
		let news = await NewsModel.getOne(where);
		if (!news) {
			this.AppError('新闻不存在');
		}

		// 更新推荐状态
		let data = {
			NEWS_VOUCH: vouch,
			NEWS_EDIT_TIME: timeUtil.time()
		}
		await NewsModel.edit(where, data);

		// 如果设置为推荐，生成二维码
		if (vouch == 1) {
			let qr = await this.genDetailQr('news', id);
			if (qr) {
				await NewsModel.edit(where, { NEWS_QR: qr });
			}
		}

		return { msg: vouch == 1 ? '设置为首页推荐成功' : '取消首页推荐成功' };
	}
}

module.exports = AdminNewsService;
