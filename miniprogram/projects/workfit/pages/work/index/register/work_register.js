const WorkBiz = require('../../../../biz/work_biz.js');
const pageHelper = require('../../../../../../helper/page_helper.js');
const cloudHelper = require('../../../../../../helper/cloud_helper.js');

Page({

	data: {
		name: '',
		phone: '',
		pwd: '',
		teacherPwd: '',
		email: '',
		emailCode: '',
		codeSending: false,
		countDown: 0,
		agreed: false,
		submitting: false,
	},

	onLoad: function () {},

	url: function (e) {
		pageHelper.url(e, this);
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

	bindSendEmailCodeTap: async function () {
		if (this.data.codeSending || this.data.countDown > 0) return;

		const email = this.data.email;
		if (!email || email.length < 5) {
			wx.showToast({
				title: '请输入正确的邮箱',
				icon: 'none'
			});
			return;
		}

		this.setData({ codeSending: true });

		try {
			await cloudHelper.callCloudSumbit('work/email_send_code', { email }, { title: '发送中' });

			wx.showToast({
				title: '验证码已发送',
				icon: 'success'
			});

			this.setData({ countDown: 60 });
			const timer = setInterval(() => {
				const count = this.data.countDown - 1;
				if (count <= 0) {
					clearInterval(timer);
					this.setData({ countDown: 0, codeSending: false });
				} else {
					this.setData({ countDown: count });
				}
			}, 1000);
		} catch (e) {
			console.error(e);
			this.setData({ codeSending: false });
		}
	},

	bindRegisterTap: async function () {
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
			return await WorkBiz.workRegister(
				this,
				this.data.name,
				this.data.phone,
				this.data.pwd,
				this.data.teacherPwd,
				this.data.email,
				this.data.emailCode
			);
		} finally {
			this.setData({ submitting: false });
		}
	},

	bindGoLoginTap: function () {
		wx.navigateBack();
	}

});
