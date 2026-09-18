/**
 * 邮件发送测试脚本
 * 使用方法：在云函数目录执行 node test_mail.js
 */

const nodemailer = require('nodemailer');

async function testMail() {
	console.log('开始测试邮件发送...');

	const transporter = nodemailer.createTransport({
		host: 'smtp.163.com',
		port: 465,
		secure: true,
		auth: {
			user: 'your_email@163.com',
			pass: 'your_smtp_auth_code_here'
		},
	});

	try {
		const info = await transporter.sendMail({
			from: 'your_email@163.com',
			to: 'your_email@163.com', // 发送给自己测试
			subject: '【测试】邮件发送功能测试',
			text: '这是一封测试邮件。\n\n如果你收到这封邮件，说明邮件发送功能正常。\n\n测试时间：' + new Date().toLocaleString('zh-CN'),
		});

		console.log('✅ 邮件发送成功！');
		console.log('Message ID:', info.messageId);
		console.log('请检查邮箱：your_email@163.com');
	} catch (error) {
		console.error('❌ 邮件发送失败：', error.message);
		console.error('详细错误：', error);
	}
}

testMail();
