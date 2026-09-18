module.exports = {

	//### 环境相关 
	CLOUD_ID: 'your_cloud_environment_id', //你的云环境id   

	// ##################################################################   
	COLLECTION_PRFIX: 'bx_',

	IS_DEMO: false, //是否演示版 (后台不可操作提交动作)  
	// ##################################################################
	// #### 调试相关 
	TEST_MODE: false, // 测试模式 涉及小程序码生成路径， 用以下 TEST_TOKEN_ID openid.. 
	TEST_TOKEN_ID: 'your_test_openid',
 

	// #### 内容安全
	CLIENT_CHECK_CONTENT: false, //前台图片文字是否校验
	ADMIN_CHECK_CONTENT: false, //后台图片文字是否校验     

	// ### 后台业务相关
	ADMIN_LOGIN_EXPIRE: 86400, //管理员token过期时间 (秒) 

	// ### 服务者相关
	WORK_LOGIN_EXPIRE: 86400, //服务者token过期时间 (秒)

	
	// ### 教师端注册/登录口令（可在后台设置覆盖）
	WORK_TEACHER_PWD_DEFAULT: '123456',

	// ### 一次性订阅消息有效期（微信官方：一般为 7 天内可发送 1 次）
	SUBSCRIBE_VALID_DAYS: 7,

	// ################# 订阅消息模板（云函数发送） #################
	// 学生端：预约成功通知
	SUBSCRIBE_TPL_STUDENT_APPT_SUCC: 'your_subscribe_template_id',
	// 学生端：预约取消通知（如你们未使用，可保持不变）
	SUBSCRIBE_TPL_STUDENT_APPT_CANCEL: 'your_subscribe_template_id',

	// 教师端：有学生预约时的提醒（请在小程序后台【订阅消息】创建模板后填入）
	SUBSCRIBE_TPL_TEACHER_NEW_APPT: 'your_subscribe_template_id',


}