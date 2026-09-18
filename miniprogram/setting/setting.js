module.exports = {
	//### 环境相关 
	CLOUD_ID: 'your_cloud_environment_id', //云服务id ,本地测试环境 

	// #### 版本信息 
	VER: 'build 2023.01.14',
	COMPANY: '联系作者',

	// #### 系统参数 
	IS_SUB: false, //分包模式 
	IS_DEMO: false, //是否演示版  

	MOBILE_CHECK: false, //手机号码是否真实性校验


	//#################     
	IMG_UPLOAD_SIZE: 20, //图片上传大小M兆    

	// #### 缓存相关
	CACHE_IS_LIST: true, //列表是否缓存
	CACHE_LIST_TIME: 60 * 30, //列表缓存时间秒

	// ################# 订阅消息模板（微信提示） #################
	// 学生端：预约成功/取消等提醒（对应云函数 msg_service.js 里的模板ID）
	SUBSCRIBE_TPL_STUDENT_APPT_SUCC: 'your_subscribe_template_id',
	SUBSCRIBE_TPL_STUDENT_APPT_CANCEL: 'your_subscribe_template_id',

	// 教师端：有学生预约时的提醒（请在小程序后台【订阅消息】创建模板后填入）
	SUBSCRIBE_TPL_TEACHER_NEW_APPT: 'your_subscribe_template_id',

}