const AdminBiz = require('../../../../../../comm/biz/admin_biz.js');
const pageHelper = require('../../../../../../helper/page_helper.js');
const cloudHelper = require('../../../../../../helper/cloud_helper.js');
const validate = require('../../../../../../helper/validate.js');

const CHECK_FORM = {
	password: 'formPassword|must|string|min:6|max:30|name=新密码',
	password2: 'formPassword2|must|string|min:6|max:30|name=新密码再次填写',
};

Page({
	data: {
		formPassword: '',
		formPassword2: '',
		name: ''
	},

	async onLoad(options) {
		if (!AdminBiz.isAdmin(this)) return;
		if (!pageHelper.getOptions(this, options)) return;
		await this._loadUser();
	},

	async _loadUser() {
		if (!AdminBiz.isAdmin(this)) return;
		if (!this.data.id) return;

		try {
			let user = await cloudHelper.callCloudData('admin/user_detail', {
				id: this.data.id
			}, {
				hint: false
			});

			this.setData({
				name: (user && user.USER_NAME) ? user.USER_NAME : ''
			});
		} catch (err) {
			console.log(err);
		}
	},

	async bindFormSubmit() {
		if (!AdminBiz.isAdmin(this)) return;
		let data = validate.check(this.data, CHECK_FORM, this);
		if (!data) return;
		if (data.password !== data.password2) {
			return pageHelper.showModal('两次输入的新密码不一致');
		}

		try {
			await cloudHelper.callCloudSumbit('admin/user_pwd', {
				id: this.data.id,
				password: data.password,
				password2: data.password2
			}, { title: '提交中' });
			pageHelper.showSuccToast('修改成功', 1500, () => wx.navigateBack());
		} catch (err) {
			console.log(err);
		}
	}
});
