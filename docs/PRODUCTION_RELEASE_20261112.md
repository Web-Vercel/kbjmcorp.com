# 正式发布候选与恢复核查记录

日期：2026-11-12（温哥华）。候选由正式分支基线b8da8ab与已验收Preview代码956c353整合。Preview保留。

## 所有者办理并提供的证据

- Production新项目智点未来-production，编号rywmjguhvnppfxwhherl；Preview旧项目ziijwwbcpuynkaxsbdvg；两者独立。
- Production已一次性初始化001–040。所有者核查119函数存在、59表存在且RLS均开启；这是对象存在/开关检查，不替代逐项权限行为验收。
- 所有者本人Auth UUID ae76e2a9-7b11-4449-adbe-deb4daac8c7e，截图显示应用角色admin、active=true。
- 所有者报告Production专用Supabase三项连接、独立限流密钥、Turnstile前后端匹配、Auth配置和Site URL已配置。SMS、自助申请、Ads读取暂关闭。未通过特权读取验证这些配置值。
- Pro组织已升级；两个项目均显示数据库备份。Production最新已选备份2026-11-12 21:50:07 UTC（温哥华13:50:07）。
- 恢复目标bukquazjhgrakvcvcaru，名称智点未来-恢复演练-20261112，供应商显示COMPLETED。所有者报告该目标119函数存在、59表/RLS通过、管理员记录正确。
- 演练项目由所有者删除，截图显示REMOVED；原Production备份仍COMPLETED。
- 未演练：恢复后实际Auth登录/MFA、所有字段内容和权限语义、Vercel/Cloudflare配置恢复、Storage实际文件。不得称为全平台灾备演练完成。

## 发布范围与限制

完整核心后台、真实三角色工作台、分析、最新官网内容。仅发布代码；不拷贝数据库、Auth账号、测试资料、DEMO配置、密钥或资金流水。新Production数据库目前初始业务资料为空是正常状态；Preview测试账号与验证器不会自动迁移。

管理员入口/zh/admin/login；真实受限业务账号入口/zh/access/login。首次管理员登录需验证器绑定。暂不开放短信登录、自助申请或Ads读取，不把未连接能力显示为已接通。

## 版本和回退

- 发布前代码基线b8da8ab；Vercel实际当前部署还须在控制台核对。
- 推荐对最终代码使用Production环境重新构建，不直接Promote沿用Preview环境产物。
- 代码回退不等于账务或数据库回退。此发布不自动执行SQL。旧代码并不包含完整新后台，回退后业务功能可能暂不可用；若已有正式写入，先限制办理并保留数据，不恢复旧数据库覆盖新账务。
- 新正式数据库与备份保留，恢复只在核实范围后受控办理。

## 待线上验收

正式部署Ready与提交号、官网和路由、管理员密码+CAPTCHA+MFA、读写范围/退出会话、无数据状态、普通账号拒绝管理员入口。三个受限账号须在新库独立开通；没有实际客户与银行依据，不为验收虚构到账或发布。

本记录不包含任何密码或密钥；仅为发布准备。未触发Production部署，未代操作托管账号或金融记录。

## 候选版本本地验证

`npm run verify:business-loop` 完整通过：TypeScript、159文件863测试、bootstrap一致性和Next生产构建。日志`/tmp/live-release-verify.log`。所有src应用代码与956c353一致；合并保留Production历史及回退基线。候选未包含.env文件或托管凭据。仍需确认Vercel当前部署，未证明正式域名或Auth/MFA验收通过。
