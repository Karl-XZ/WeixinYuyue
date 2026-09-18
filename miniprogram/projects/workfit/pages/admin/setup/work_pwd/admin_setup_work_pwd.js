const AdminBiz = require('../../../../../../comm/biz/admin_biz.js');
const pageHelper = require('../../../../../../helper/page_helper.js');
const cloudHelper = require('../../../../../../helper/cloud_helper.js');

Page({

	data: {
		isLoad: false,
		oldPwd: '',
		pwd: '',
	},

	onLoad: async function () {
		if (!AdminBiz.isAdmin(this)) return;
		await this._load();
	},

	onPullDownRefresh: async function () {
		await this._load();
		wx.stopPullDownRefresh();
	},

	url: function (e) {
		pageHelper.url(e, this);
	},

	_load: async function () {
		if (!AdminBiz.isAdmin(this)) return;
		let opts = { title: 'bar' };
		try {
			await cloudHelper.callCloudSumbit('home/setup_get', { key: 'SETUP_WORK_TEACHER_PWD' }, opts).then(res => {
				this.setData({
					isLoad: true,
					oldPwd: res.data || '',
				});
			});
		} catch (e) {
			console.log(e);
			this.setData({ isLoad: true, oldPwd: '' });
		}
	},

	bindSaveTap: async function () {
		if (!AdminBiz.isAdmin(this)) return;
		let pwd = (this.data.pwd || '').trim();
		if (!pwd || pwd.length < 1 || pwd.length > 30) {
			wx.showToast({ title: '请输入 1-30 位教师密码', icon: 'none' });
			return;
		}

		let opts = { title: '保存中' };
		try {
			await cloudHelper.callCloudSumbit('admin/setup_set', {
				key: 'SETUP_WORK_TEACHER_PWD',
				content: pwd,
			}, opts);

			wx.showToast({ title: '保存成功', icon: 'success' });
			setTimeout(() => {
				wx.navigateBack();
			}, 800);
		} catch (e) {
			console.log(e);
		}
	}

});
