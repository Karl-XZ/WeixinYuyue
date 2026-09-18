# 咨询预约小程序功能全量说明

## 1. 项目概览

本项目是基于微信小程序 + 腾讯云云开发实现的学校咨询预约系统，包含 3 类主要角色：

- 学生端：查看公告、浏览老师、按日历预约、查看我的预约、收藏、资料维护。
- 教师端：手机号 + 教师口令登录，维护个人介绍和排班，查看预约名单，核销/签到。
- 管理端：管理员登录，维护公告、老师、学生、管理员、二维码、首页推荐、导出数据。

项目主配置位于 [project_setting.js](D:/备份/20250313/work/new%20work/新建文件夹/腾讯云codebuddy模板/dao/daodao_with_subscribe_final_v3/daodao7邮件生效0/daodao/miniprogram/projects/workfit/public/project_setting.js)。

## 2. 角色与权限

### 2.1 学生端

- 微信静默登录。
- 首次注册后形成学生档案。
- 允许修改个人资料。
- 允许设置/修改学生密码。
- 可以查看公告、老师详情、可预约日历。
- 可以提交预约、取消预约、查看我的预约详情。
- 可以收藏老师/预约项目。

说明：
学生当前仍然是微信身份登录，新增的“学生密码”是资料安全能力和后台重置能力，不是独立账号密码登录入口。

### 2.2 教师端

- 使用手机号 + 教师登录密码 + 教师口令登录。
- 可自助注册。
- 可修改自己的登录密码。
- 可维护个人信息、封面图、简介、地点、详情内容。
- 可设置可预约日期、时段模板、时段人数限制。
- 可查看预约名单、改预约状态、签到、扫码核销。

### 2.3 管理端

- 管理员账号密码登录。
- 超级管理员可管理其他管理员。
- 可修改自己的管理员密码。
- 可管理全部老师账号、学生账号、公告、预约数据。
- 可修改学生密码、老师密码。
- 可查看首页汇总统计和每个老师的预约情况。

## 3. 页面结构

页面注册清单见 [app.json](D:/备份/20250313/work/new%20work/新建文件夹/腾讯云codebuddy模板/dao/daodao_with_subscribe_final_v3/daodao7邮件生效0/daodao/miniprogram/app.json)。

### 3.1 学生端页面

- 首页：`projects/workfit/pages/default/index/default_index`
- 关于我们列表/详情：`pages/about/list`、`pages/about/index`
- 搜索：`pages/search/search`
- 我的首页：`pages/my/index/my_index`
- 学生注册：`pages/my/reg/my_reg`
- 学生资料编辑：`pages/my/edit/my_edit`
- 学生密码修改：`pages/my/pwd/my_pwd`
- 我的足迹：`pages/my/foot/my_foot`
- 我的收藏：`pages/my/fav/my_fav`
- 公告列表/详情/分类：`pages/news/index`、`pages/news/detail`、`pages/news/cate1`、`pages/news/cate2`
- 预约列表/日历/详情/提交预约：`pages/meet/index`、`pages/meet/calendar`、`pages/meet/detail`、`pages/meet/join`
- 我的预约列表/详情：`pages/meet/my_join_list`、`pages/meet/my_join_detail`

### 3.2 教师端页面

- 教师首页：`pages/work/index/home/work_home`
- 教师登录：`pages/work/index/login/work_login`
- 教师注册：`pages/work/index/register/work_register`
- 教师修改密码：`pages/work/index/pwd/work_pwd`
- 教师资料编辑：`pages/work/meet/edit/work_meet_edit`
- 教师排班设置：`pages/work/meet/time/work_meet_time`
- 教师模板时段：`pages/work/meet/temp/work_meet_temp`
- 教师预约名单：`pages/work/meet/record/work_meet_record`
- 教师预约详情/状态：`pages/work/meet/join/work_meet_join`
- 教师扫码签到：`pages/work/meet/scan/work_meet_scan`

### 3.3 管理端页面

- 管理员首页：`pages/admin/index/home/admin_home`
- 管理员登录：`pages/admin/index/login/admin_login`
- 公告管理：`pages/admin/news/list`、`pages/admin/news/add`、`pages/admin/news/edit`
- 关于我们设置：`pages/admin/setup/about`、`pages/admin/setup/about_list`
- 教师口令设置：`pages/admin/setup/work_pwd`
- 二维码查看：`pages/admin/setup/qr`
- 管理员日志：`pages/admin/mgr/log/admin_log_list`
- 管理员增删改查：`pages/admin/mgr/list`、`pages/admin/mgr/add`、`pages/admin/mgr/edit`
- 管理员修改密码：`pages/admin/mgr/pwd/admin_mgr_pwd`
- 学生管理：`pages/admin/user/list`、`pages/admin/user/detail`、`pages/admin/user/pwd`、`pages/admin/user/export`
- 老师与预约管理：`pages/admin/meet/list`、`pages/admin/meet/add`、`pages/admin/meet/edit`、`pages/admin/meet/pwd`
- 预约记录管理：`pages/admin/meet/record`、`pages/admin/meet/join`、`pages/admin/meet/export`
- 老师排班与模板：`pages/admin/meet/time`、`pages/admin/meet/temp`
- 后台扫码：`pages/admin/meet/scan`

## 4. 核心业务能力

### 4.1 首页与公共内容

- TabBar 共 4 个主入口：首页、公告、预约日历、我的。
- “学校公告”已统一调整为“公告”。
- 首页支持公告入口、预约入口、关于我们入口。
- 支持首页推荐位清空。

### 4.2 公告模块

- 公告列表和详情展示。
- 后台新增、编辑、删除、上下架公告。
- 支持公告分类配置，当前默认只有“公告”。
- 支持公告二维码查看。

### 4.3 学生模块

- 微信身份静默登录。
- 学生注册。
- 学生资料编辑。
- 学生密码首次设置 / 后续修改。
- 后台学生列表、详情、状态修改、删除。
- 后台重置学生密码。
- 学生数据导出 Excel。

### 4.4 教师模块

- 教师自助注册。
- 教师登录。
- 教师修改自己的登录密码。
- 教师资料编辑。
- 教师邮箱验证码注册和邮件提醒。
- 老师照片、详情图支持云存储文件 ID 转临时 URL。

### 4.5 预约模块

- 老师/预约项目列表。
- 详情页展示老师封面、简介、地点、详情。
- 预约日历展示可预约日期。
- 按日期/时段预约。
- 预约前规则校验。
- 我的预约列表、详情、取消。
- 老师端/后台端查看预约名单。
- 老师端/后台端签到、扫码核销。
- 后台导出预约数据。

### 4.6 排班与模板模块

- 日期排班维护。
- 时段模板维护。
- 时段人数上限控制。
- 取消规则设置。

### 4.7 管理后台

- 管理员登录。
- 超级管理员自动兜底。
- 管理员增删改查、状态管理、密码修改、操作日志。
- 首页统计：
  - 学生总数
  - 公告总数
  - 老师总数
  - 预约总数
  - 每个老师的预约情况

## 5. 密码相关功能矩阵

### 5.1 管理员

- 管理员自改密码：已支持。
- 超级管理员管理其他管理员账号：已支持。

### 5.2 教师

- 教师自改密码：已支持。
- 管理员重置老师密码：已支持。

### 5.3 学生

- 学生自改密码：已支持。
- 管理员重置学生密码：已支持。

## 6. 重要字段与当前配置

### 6.1 公告配置

- `NEWS_NAME = 公告`
- 默认公告分类：`公告`

### 6.2 老师/预约资料字段

当前老师资料字段见 [project_setting.js](D:/备份/20250313/work/new%20work/新建文件夹/腾讯云codebuddy模板/dao/daodao_with_subscribe_final_v3/daodao7邮件生效0/daodao/miniprogram/projects/workfit/public/project_setting.js:22)：

- 星级
- 特点标签
- 封面图片
- 简介
- 地点
- 详情内容

其中“地点”为必填字段。

### 6.3 学生预约表单

- 姓名
- 手机号

## 7. 云函数路由清单

路由配置位于 [route.js](D:/备份/20250313/work/new%20work/新建文件夹/腾讯云codebuddy模板/dao/daodao_with_subscribe_final_v3/daodao7邮件生效0/daodao/cloudfunctions/mcloud/project/workfit/public/route.js)。

### 7.1 Passport / 学生基础

- `passport/login`
- `passport/phone`
- `passport/my_detail`
- `passport/register`
- `passport/edit_base`
- `passport/pwd`

### 7.2 收藏

- `fav/update`
- `fav/del`
- `fav/is_fav`
- `fav/my_list`

### 7.3 教师端

- `work/home`
- `work/login`
- `work/register`
- `work/email_send_code`
- `work/pwd`
- `work/meet_detail`
- `work/meet_edit`
- `work/meet_update_forms`
- `work/meet_temp_insert`
- `work/meet_temp_list`
- `work/meet_temp_del`
- `work/meet_temp_edit`
- `work/meet_cancel_time_join`
- `work/join_scan`
- `work/join_checkin`
- `work/meet_day_list`
- `work/meet_join_list`
- `work/join_status`
- `work/join_del`

### 7.4 内容与学生侧预约

- `home/setup_get`
- `home/list`
- `news/list`
- `news/view`
- `meet/list`
- `meet/list_by_day`
- `meet/list_has_day`
- `meet/view`
- `meet/detail_for_join`
- `meet/before_join`
- `meet/join`
- `meet/my_join_list`
- `meet/my_join_cancel`
- `meet/my_join_detail`
- `meet/my_join_someday`

### 7.5 管理后台

- `admin/home`
- `admin/clear_vouch`
- `admin/login`
- `admin/mgr_list`
- `admin/mgr_insert`
- `admin/mgr_del`
- `admin/mgr_detail`
- `admin/mgr_edit`
- `admin/mgr_status`
- `admin/mgr_pwd`
- `admin/log_list`
- `admin/log_clear`
- `admin/setup_set`
- `admin/setup_set_content`
- `admin/setup_qr`
- `admin/user_list`
- `admin/user_detail`
- `admin/user_pwd`
- `admin/user_del`
- `admin/user_status`
- `admin/user_data_get`
- `admin/user_data_export`
- `admin/user_data_del`
- `admin/news_list`
- `admin/news_insert`
- `admin/news_detail`
- `admin/news_edit`
- `admin/news_update_forms`
- `admin/news_update_pic`
- `admin/news_update_content`
- `admin/news_del`
- `admin/news_sort`
- `admin/news_status`
- `admin/news_vouch`
- `admin/meet_list`
- `admin/meet_join_list`
- `admin/join_status`
- `admin/join_del`
- `admin/meet_insert`
- `admin/meet_detail`
- `admin/meet_edit`
- `admin/meet_update_forms`
- `admin/meet_del`
- `admin/meet_sort`
- `admin/meet_vouch`
- `admin/meet_status`
- `admin/meet_cancel_time_join`
- `admin/join_scan`
- `admin/join_checkin`
- `admin/meet_day_list`
- `admin/meet_set_days`
- `admin/meet_temp_insert`
- `admin/meet_temp_list`
- `admin/meet_temp_del`
- `admin/meet_temp_edit`
- `admin/join_data_get`
- `admin/join_data_export`
- `admin/join_data_del`

## 8. 数据集合

初始化逻辑位于 [base_project_service.js](D:/备份/20250313/work/new%20work/新建文件夹/腾讯云codebuddy模板/dao/daodao_with_subscribe_final_v3/daodao7邮件生效0/daodao/cloudfunctions/mcloud/project/workfit/service/base_project_service.js)。

当前主要集合：

- `bx_setup`
- `bx_admin`
- `bx_log`
- `bx_day`
- `bx_fav`
- `bx_join`
- `bx_meet`
- `bx_news`
- `bx_temp`
- `bx_user`
- `bx_mail_verify`
- `bx_setup_workfit`

## 9. 本次新增和修复

### 9.1 新增

- 学生自改密码
- 管理员重置学生密码
- 管理员重置老师密码
- 后台首页统计卡片
- 后台老师预约情况列表
- 老师资料必填地点字段

### 9.2 修复

- 学生端老师图片转临时链接，解决图片经常不显示的问题
- 公告文案统一为“公告”
- 初始化默认公告分类同步更新为“公告”

## 10. 已知边界

- 学生仍然基于微信登录，不是账号密码登录模式。
- 小程序页面级 E2E 自动化需要微信开发者工具运行时；当前仓库内自动化测试主要覆盖云函数业务核心与仓库结构一致性。
