/**
 * 检查文件完整性脚本
 */

const fs = require('fs');
const path = require('path');

console.log('开始检查文件完整性...\n');

const files = [
	'framework/lib/mail_lib.js',
	'project/workfit/model/mail_verify_model.js',
	'project/workfit/service/mail_verify_service.js',
	'project/workfit/controller/work/work_home_controller.js',
	'project/workfit/service/work/work_home_service.js',
	'project/workfit/public/route.js',
	'package.json'
];

let allOk = true;

files.forEach(file => {
	const filePath = path.join(__dirname, file);
	if (fs.existsSync(filePath)) {
		console.log('✅', file);
	} else {
		console.log('❌', file, '- 文件不存在！');
		allOk = false;
	}
});

console.log('\n检查 nodemailer 依赖...');
const nodeModulesPath = path.join(__dirname, 'node_modules/nodemailer');
if (fs.existsSync(nodeModulesPath)) {
	console.log('✅ nodemailer 已安装');
} else {
	console.log('❌ nodemailer 未安装！请运行: npm install');
	allOk = false;
}

console.log('\n检查路由配置...');
const routePath = path.join(__dirname, 'project/workfit/public/route.js');
if (fs.existsSync(routePath)) {
	const routeContent = fs.readFileSync(routePath, 'utf8');
	if (routeContent.includes('work/email_send_code')) {
		console.log('✅ 邮箱验证码路由已配置');
	} else {
		console.log('❌ 邮箱验证码路由未配置！');
		allOk = false;
	}
	
	if (routeContent.includes('subscribe/report')) {
		console.log('⚠️  警告：订阅消息路由仍然存在（应该已删除）');
	} else {
		console.log('✅ 订阅消息路由已删除');
	}
}

console.log('\n检查邮件配置...');
const mailLibPath = path.join(__dirname, 'framework/lib/mail_lib.js');
if (fs.existsSync(mailLibPath)) {
	const mailLibContent = fs.readFileSync(mailLibPath, 'utf8');
	if (mailLibContent.includes('your_email@163.com')) {
		console.log('✅ 邮箱配置正确');
	} else {
		console.log('❌ 邮箱配置错误！');
		allOk = false;
	}
}

console.log('\n' + '='.repeat(50));
if (allOk) {
	console.log('✅ 所有检查通过！文件完整，可以上传云函数。');
} else {
	console.log('❌ 检查失败！请修复上述问题后再上传。');
}
console.log('='.repeat(50));
