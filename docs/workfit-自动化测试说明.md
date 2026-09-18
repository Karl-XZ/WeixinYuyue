# 咨询预约小程序自动化测试说明

## 1. 目标

本次补充的自动化测试目标是把“当前核心云函数业务模块”的覆盖率做到 100%，并增加仓库结构一致性校验，确保：

- 核心密码功能可回归
- 首页统计功能可回归
- 老师图片临时链接转换逻辑可回归
- 初始化兜底逻辑可回归
- 页面注册和路由注册不会出现死链

## 2. 测试框架

测试位于 `cloudfunctions/mcloud/tests`，采用：

- Node 内置测试运行器 `node --test`
- 覆盖率工具 `c8`
- 自定义模块 mock 加载器 `tests/helpers/load_with_mocks.js`

## 3. 命令

在 [cloudfunctions/mcloud/package.json](D:/备份/20250313/work/new%20work/新建文件夹/腾讯云codebuddy模板/dao/daodao_with_subscribe_final_v3/daodao7邮件生效0/daodao/cloudfunctions/mcloud/package.json) 中新增了脚本：

```bash
npm test
npm run coverage
npm run test:integration
```

## 4. 覆盖范围

### 4.1 业务服务

- [passport_service.js](D:/备份/20250313/work/new%20work/新建文件夹/腾讯云codebuddy模板/dao/daodao_with_subscribe_final_v3/daodao7邮件生效0/daodao/cloudfunctions/mcloud/project/workfit/service/passport_service.js)
- [admin_user_service.js](D:/备份/20250313/work/new%20work/新建文件夹/腾讯云codebuddy模板/dao/daodao_with_subscribe_final_v3/daodao7邮件生效0/daodao/cloudfunctions/mcloud/project/workfit/service/admin/admin_user_service.js)
- [admin_home_service.js](D:/备份/20250313/work/new%20work/新建文件夹/腾讯云codebuddy模板/dao/daodao_with_subscribe_final_v3/daodao7邮件生效0/daodao/cloudfunctions/mcloud/project/workfit/service/admin/admin_home_service.js)
- [base_project_service.js](D:/备份/20250313/work/new%20work/新建文件夹/腾讯云codebuddy模板/dao/daodao_with_subscribe_final_v3/daodao7邮件生效0/daodao/cloudfunctions/mcloud/project/workfit/service/base_project_service.js)
- [meet_image_service.js](D:/备份/20250313/work/new%20work/新建文件夹/腾讯云codebuddy模板/dao/daodao_with_subscribe_final_v3/daodao7邮件生效0/daodao/cloudfunctions/mcloud/project/workfit/service/support/meet_image_service.js)

### 4.2 控制器

- [passport_controller.js](D:/备份/20250313/work/new%20work/新建文件夹/腾讯云codebuddy模板/dao/daodao_with_subscribe_final_v3/daodao7邮件生效0/daodao/cloudfunctions/mcloud/project/workfit/controller/passport_controller.js)
- [admin_user_controller.js](D:/备份/20250313/work/new%20work/新建文件夹/腾讯云codebuddy模板/dao/daodao_with_subscribe_final_v3/daodao7邮件生效0/daodao/cloudfunctions/mcloud/project/workfit/controller/admin/admin_user_controller.js)

### 4.3 结构一致性

- `app.json` 注册页面是否存在对应 `js/json/wxml`
- `route.js` 路由是否指向真实控制器和方法
- `project_setting.js` 是否保留“公告”和“地点必填”等关键配置

## 5. 测试文件

- `tests/repository_structure.test.js`
- `tests/meet_image_service.test.js`
- `tests/passport_service.test.js`
- `tests/admin_user_service.test.js`
- `tests/admin_home_service.test.js`
- `tests/base_project_service.test.js`
- `tests/passport_controller.test.js`
- `tests/admin_user_controller.test.js`

## 6. 覆盖的业务点

### 6.1 学生密码体系

- 学生密码首次设置
- 学生修改密码
- 旧密码错误拦截
- 管理员重置学生密码

### 6.2 教师密码体系

- 管理员重置老师密码
- 密码二次确认不一致拦截

### 6.3 首页统计

- 学生/公告/老师/预约总数汇总
- 老师预约情况统计
- 首页推荐清空
- 首页推荐更新和删除

### 6.4 初始化兜底

- 默认超级管理员自动补回
- 默认公告和默认预约项初始化

### 6.5 老师图片转换

- `cloud://` 文件 ID 转临时 URL
- 封面图转换
- 富文本图片转换
- 空返回 / 非图片 / 非数组容错

### 6.6 仓库清单一致性

- 全部注册页面文件存在
- 全部路由指向存在的方法
- 关键配置不被误删

## 7. 覆盖率结果

执行命令：

```bash
npm run coverage
```

最终结果：

```text
All files 100% statements / 100% branches / 100% functions / 100% lines
```

覆盖率脚本统计的是本次明确纳入自动化回归的核心模块，不包含整个微信运行时页面渲染层。

## 8. 真实腾讯云集成测试

集成测试文件位于：

- [tencent_cloud.integration.js](D:/备份/20250313/work/new%20work/新建文件夹/腾讯云codebuddy模板/dao/daodao_with_subscribe_final_v3/daodao7邮件生效0/daodao/cloudfunctions/mcloud/integration/tencent_cloud.integration.js)

用途：

- 连接真实腾讯云数据库
- 上传临时文件到真实云存储
- 获取真实临时文件 URL
- 校验后台首页统计和真实数据库计数一致
- 用临时测试学生记录模拟真实 openid 登录上下文，并自动清理

执行命令：

```bash
npm run test:integration
```

本次已实际执行通过。

## 9. 为什么没有把整个小程序 UI 也做到同一套 100%

原因不是业务遗漏，而是运行环境边界：

- 微信小程序页面 E2E 依赖微信开发者工具或真机运行时
- 当前命令行环境更适合稳定地测试云函数业务层
- 页面级自动化如果直接在这里伪造，会变成脆弱的假测试

因此当前方案把：

- 业务正确性
- 路由存在性
- 页面注册存在性

都纳入自动化；而页面交互层建议后续接入微信小程序自动化工具单独扩展。
