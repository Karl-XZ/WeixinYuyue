const cloudHelper = require('../../../../../helper/cloud_helper.js');
const pageHelper = require('../../../../../helper/page_helper.js');
const MeetBiz = require('../../../biz/meet_biz.js');
const ProjectBiz = require('../../../biz/project_biz.js');
const setting = require('../../../../../setting/setting.js');
const PassportBiz = require('../../../../../comm/biz/passport_biz.js');

Page({
	/**
	 * 页面的初始数据
	 */
	data: {
		isLoad: false,
		formsList: [],
	},

	/**
	 * 生命周期函数--监听页面加载
	 */
	onLoad: async function (options) {
		ProjectBiz.initPage(this);
		if (!pageHelper.getOptions(this, options)) return;
		if (!pageHelper.getOptions(this, options, 'timeMark')) return;

		if (!await PassportBiz.loginMustBackWin(this)) return;

		this._loadDetail();

	},

	_loadDetail: async function () {
		let id = this.data.id;
		if (!id) return;

		let timeMark = this.data.timeMark;
		if (!timeMark) return;

		let params = {
			meetId: id,
			timeMark
		};
		let opt = {
			title: 'bar'
		};
		let meet = await cloudHelper.callCloudData('meet/detail_for_join', params, opt);
		if (!meet) {
			this.setData({
				isLoad: null
			})
			return;
		}


		this.setData({
			isLoad: true,
			meet,
		});

	},

	/**
	 * 生命周期函数--监听页面初次渲染完成
	 */
	onReady: function () { },

	/**
	 * 生命周期函数--监听页面显示
	 */
	onShow: function () {

	},

	/**
	 * 生命周期函数--监听页面隐藏
	 */
	onHide: function () {

	},

	/**
	 * 生命周期函数--监听页面卸载
	 */
	onUnload: function () {

	},

	/**
	 * 页面相关事件处理函数--监听学生下拉动作
	 */
	onPullDownRefresh: async function () {
		await this._loadDetail();
		wx.stopPullDownRefresh();
	},



	url: function (e) {
		pageHelper.url(e, this);
	},

	onPageScroll: function (e) {
		// 回页首按钮
		pageHelper.showTopBtn(e, this);

	},


	bindDel: function (e) {
		let idx = pageHelper.dataset(e, 'idx');

		let cb = () => {
			let formsList = this.data.formsList;
			formsList.splice(idx, 1);
			this.setData({ formsList });
		}
		pageHelper.showConfirm('确认删除该预约人信息?', cb);

	},

	bindSubmitCmpt: async function (e) {
		// 再次检查登录状态
		if (!PassportBiz.isLogin()) {
			wx.showModal({
				title: '温馨提示',
				content: '请先登录后再进行预约',
				showCancel: false,
				success: () => {
					let url = pageHelper.fmtURLByPID('/pages/my/reg/my_reg') + '?retUrl=' + encodeURIComponent('/pages/meet/join/meet_join?id=' + this.data.id + '&timeMark=' + this.data.timeMark);
					wx.redirectTo({ url });
				}
			});
			return;
		}

		let formsList = [];

		formsList = [e.detail];
		if (formsList.length == 0) return pageHelper.showModal('请先填写资料');


		try {
			let opts = {
				title: '提交中'
			}
			let params = {
				meetId: this.data.id,
				timeMark: this.data.timeMark,
				formsList
			}

			// 等待云函数调用完成
			let res = await cloudHelper.callCloudSumbit('meet/join', params, opts);

			// 等待成功弹窗显示完成
			await new Promise((resolve) => {
				wx.showModal({
					title: '温馨提示',
					showCancel: false,
					content: '预约成功！',
					success: resolve
				});
			});

			// 跳转到预约列表页
			if (setting.IS_SUB) {
				wx.redirectTo({
					url: pageHelper.fmtURLByPID('/pages/meet/my_join_list/meet_my_join_list')
				});
			} else {
				wx.reLaunch({
					url: pageHelper.fmtURLByPID('/pages/meet/my_join_list/meet_my_join_list')
				});
			}
		} catch (err) {
			console.error(err);
			pageHelper.showModal('预约失败: ' + (err.message || err.errMsg || '未知错误'));
		}
	},

	bindCheckTap: async function (e) {
		this.selectComponent("#form-show").checkForms();
	},

})