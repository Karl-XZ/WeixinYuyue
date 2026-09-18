const WorkBiz = require('../../../../biz/work_biz.js');
const pageHelper = require('../../../../../../helper/page_helper.js');
const behavior = require('../../../admin/meet/record/admin_meet_record_bh.js');

Page({

	behaviors: [behavior],

	/**
	 * 页面的初始数据
	 */
	data: {
		oprt: 'work',
		isWork: true // 确保模板能正确识别教师端
	},

	/**
	 * 生命周期函数--监听页面加载
	 */
	onLoad: async function (options) {
		if (!pageHelper.getOptions(this, options, 'meetId')) return;

		if (!WorkBiz.isWork(this)) return;

		this._init(options);

	},



})