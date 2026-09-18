/**
 * Notes: 邮箱验证码实体
 * Date: 2026-01-16
 */

const BaseProjectModel = require('./base_project_model.js');

class MailVerifyModel extends BaseProjectModel {

}

// 集合名
MailVerifyModel.CL = BaseProjectModel.C('mail_verify');

MailVerifyModel.DB_STRUCTURE = {
	_pid: 'string|true',
	MV_ID: 'string|true',
	MV_EMAIL: 'string|true',
	MV_SCENE: 'string|true|comment=场景 register',
	MV_CODE_MD5: 'string|true',
	MV_EXPIRE_TIME: 'int|true',
	MV_USED: 'int|true|default=0',
	MV_ADD_TIME: 'int|true',
	MV_ADD_IP: 'string|false',
	MV_EDIT_TIME: 'int|true',
	MV_EDIT_IP: 'string|false',
};

// 字段前缀
MailVerifyModel.FIELD_PREFIX = "MV_";

module.exports = MailVerifyModel;
