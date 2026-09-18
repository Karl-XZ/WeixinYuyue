const pageHelper = require('../../helper/page_helper.js');
const cloudHelper = require('../../helper/cloud_helper.js');

Page({
  data: {
    isLoad: false,
    type: '', // 'agreement' 或 'privacy'
    title: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    let type = options.type || 'agreement';
    let title = type === 'agreement' ? '用户服务协议' : '隐私政策';

    this.setData({
      type: type,
      title: title,
      isLoad: true
    });

    wx.setNavigationBarTitle({
      title: title
    });
  }
})
