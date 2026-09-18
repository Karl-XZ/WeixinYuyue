const WorkBiz = require('../../../../biz/work_biz.js');
const pageHelper = require('../../../../../../helper/page_helper.js');

Page({

	data: {
		phone: '',
		pwd: '',
		teacherPwd: '',
		agreed: false,
		submitting: false,
	},

	onLoad: function () {
		WorkBiz.clearWorkToken();
	},

	onReady: function () {},

	onShow: function () {},

	onHide: function () {},

	onUnload: function () {},

	url: function (e) {
		pageHelper.url(e, this);
	},

	bindBackTap: function () {
		wx.reLaunch({
			url: pageHelper.fmtURLByPID('/pages/my/index/my_index'),
		});
	},

	bindAgreementChange: function (e) {
		this.setData({
			agreed: e.detail.value.length > 0
		});
	},

	bindInput: function (e) {
		const field = e.currentTarget.dataset.field;
		if (!field) return;
		this.setData({
			[field]: e.detail.value
		});
	},

	bindLoginTap: async function () {
		if (this.data.submitting) return;

		if (!this.data.agreed) {
			wx.showToast({
				title: '请先阅读并同意《用户服务协议》和《隐私政策》',
				icon: 'none',
				duration: 2000
			});
			return;
		}

		this.setData({ submitting: true });
		try {
			return await WorkBiz.workLogin(this, this.data.phone, this.data.pwd, this.data.teacherPwd);
		} finally {
			this.setData({ submitting: false });
		}
	}

});
