const pageHelper = require('../../../../../helper/page_helper.js');
const cloudHelper = require('../../../../../helper/cloud_helper.js');
const validate = require('../../../../../helper/validate.js');
const PassportBiz = require('../../../../../comm/biz/passport_biz.js');

Page({
	data: {
		formOldPassword: '',
		formPassword: '',
		formPassword2: '',
		hasPassword: false
	},

	async onLoad() {
		await PassportBiz.loginMustBackWin(this);
		await this._loadDetail();
	},

	async onPullDownRefresh() {
		await this._loadDetail();
		wx.stopPullDownRefresh();
	},

	async _loadDetail() {
		let user = await cloudHelper.callCloudData('passport/my_detail', {}, { title: 'bar' });
		this.setData({
			hasPassword: !!(user && user.USER_HAS_PASSWORD)
		});
	},

	async bindFormSubmit() {
		let data = validate.check(this.data, PassportBiz.CHECK_FORM_PWD, this);
		if (!data) return;
		if (data.password !== data.password2) {
			return pageHelper.showModal('两次输入的新密码不一致');
		}

		try {
			await cloudHelper.callCloudSumbit('passport/pwd', data, { title: '提交中' });
			pageHelper.showSuccToast('修改成功', 1500, () => wx.navigateBack());
		} catch (err) {
			console.log(err);
		}
	}
});
