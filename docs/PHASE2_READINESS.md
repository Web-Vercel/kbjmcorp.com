# 第二阶段就绪评估

当前结论：**可用于虚构业务的界面评审与本地逻辑测试，尚不适合开放真实客户后台。**

## 可以评审的完整流程

咨询记录 → 员工跟进 → 转为客户公司 → 建立项目 → 核实用户公司授权并分配访问 → 客户查看项目 → 协作成员提交需求 → 团队审核需求 → 团队提交创意 → 客户请求修改或确认指定版本 → 双方查看项目动态。

上述真实业务代码使用 Supabase 用户会话、数据库 RLS 和受控 RPC；SQL 在隔离 PGlite 引擎实际执行。不会操作广告平台，不存在投放或收费接口。浏览器交互演示仅使用页面内存，不能当作实际后端联调证据。

## 能力与证据

| 范围 | 已完成 | 当前限制 |
| --- | --- | --- |
| 员工后台 | 咨询、跟进、公司转化、项目、账户关联、MFA、审计 | 真实 Auth 与页面持久化尚未联调 |
| 客户中心 | 公司隔离、项目详情、只读与协作权限、撤销访问 | 真实手机号登录和客户身份核实流程待演练 |
| 需求与创意 | 文本及 HTTPS 外部参考链接、不可覆盖的版本、双向审核、修改意见、版本确认 | 未实现私有二进制文件上传、病毒扫描、签名下载或对象存储 |
| 进度透明 | 员工发布客户可见说明，阶段变化与审核记录 | 站内记录，不代表实时广告投放状态；暂无邮件/短信通知 |
| 广告账户 | 唯一平台 ID 归属记录、只读适配接口定义 | 未连接真实账户；未确认实际 API/导出能力，不能保证无缝自动同步 |
| 广告报表 | 预留数据结构 | 没有真实来源和指标校验，不展示伪造花费、成效或成功同步 |
| 演示 | 中英员工演示、客户演示、可切换角色的完整协作演示 | 全部虚构；协作演示刷新后清空，不提供认证绕过 |

## 当前阻塞与下一步

1. **本地真实身份服务**：官方 CLI 3.0.0 下载镜像时遇到 `public.ecr.aws` 访问拒绝。已通过 cloud-environment-onboarding:setup 将这个单一域名补充到环境配置草稿，同时更新启动说明，保留已有软件源预设；草稿保存不代表网络已生效。用户在环境设置中审阅、保存并发布环境后，重新核实网络状态并重试。不要绕过代理、关闭 TLS 验证或改用假会话冒充成功。
2. **真实联调**：服务可运行后，建立虚构员工与客户身份，测试完整员工 MFA、测试号码 OTP、Cookie 刷新、持久化 CRUD、版本冲突、撤销访问和两个公司的隔离。CAPTCHA 的供应商验证及真实短信送达仍须单独验证。
3. **资料地区与正式运营**：按用户决定暂不选择部署地区、不建托管项目、不存真实资料。以后再确定身份、数据库、素材存储、备份恢复、账户恢复及删除/保留机制，并完成最终隐私说明和大陆网络实测。
4. **广告接入**：通过受控渠道核实真实样本账户的唯一 ID 与实际开放权限，只读接入起步。没有支持的接口就采用明确标注来源的导入方案；不编造端点、指标或实时连接状态。

这一轮以可评审的业务闭环、权限和测试证据为交付边界。解决外部依赖后，继续实际服务联调与真实数据接入。

## 评审入口

Vercel 部署开发分支最新提交后：
- `/zh/admin-preview`：员工只读演示；底部进入客户演示。
- `/zh/client-preview`：客户只读演示；点击“体验需求提交与创意确认”。
- `/zh/workflow-preview`：在页面内模拟客户提交、团队审核、创意修改与客户确认。
- 将 `/zh/` 换成 `/en/` 查看英文版。

本次没有改动 main、强推、重设仓库或 Vercel 身份，也没有操作域名、DNS、SSL、企业邮箱、托管数据库或真实广告。

## 本轮验证记录

- 151 项自动化测试通过（20 个测试文件），包括实际执行的 PostgreSQL RLS/RPC、版本冲突、权限升级、撤销、自审禁止、确认记录、API 错误和界面行为。
- Next.js 生产构建与 TypeScript 检查通过。
- 最终构建：33 项公开路由/咨询检查、28 项员工后台检查、14 项客户中心检查、26 项中英文完整协作交互检查通过。
- 浏览器检查覆盖 320、375、768、1440 四种宽度，无页面外溢或未捕获错误；交互演示未发送业务写入请求，刷新清空。
- 真实 Auth/数据库托管联调、真实短信、文件存储、广告平台读取、Vercel 实际部署及大陆网络表现未验证。

## 产品方向更新：资金与中文月报优先

按用户最新需求，客户首页已重新聚焦充值登记、已核对余额、月度广告费用与中文版报告。项目协作降为辅助功能。详见 [CLIENT_FUNDS_REPORTS.md](CLIENT_FUNDS_REPORTS.md)。迁移 008 及客户端读取/充值申请代码已有本地测试；支付、实际到账入账、原始报告导入/下载、自动翻译和正式财务发布流程均未实现。不能将这轮预览称为可运营的收款系统。OpenAI 原生中文报表能力尚未确认，官方页面访问受当前环境网络规则阻止。

## 人民币结算更新

用户将收费流程交由开发方决定。新客户资金账户默认 CNY；CAD 原始费用与锁定参考汇率在月报中保留。默认不收固定 10% 汇兑手续费，代理服务费必须事先约定并单列，未约定为零。迁移 009 增加来源报价、结算日和费用依据校验。该规则与尚未连接的实际汇率、支付、对账流程分开，详见 [CNY_SETTLEMENT_POLICY.md](CNY_SETTLEMENT_POLICY.md)。

## 企业客户 CRM 补全

新增人工公司建档、联系人、预批准手机号邀请、公司/财务权限、空 CNY 钱包开立、合同草稿、外部签署人工登记及客户自己的公司/合同页面。当前是智点未来单机构 CRM 与客户门户，并非对外多租户 SaaS。详见 [CRM_CLIENT_LIFECYCLE.md](CRM_CLIENT_LIFECYCLE.md)。未配置实际合同文件存储或电子签名，不能将人工签署记录称为系统电子验签。手机号邀请需后续真实身份服务联调，不自动发送邀请或短信。

### Three-party responsibilities (migration 011)

See [THREE_PARTY_SAAS.md](THREE_PARTY_SAAS.md) for the responsibility matrix, explicit employee role assignment, source revisions, independent financial review, private client service tickets and remaining production prerequisites. Public simulation is available at `/zh/operations-preview`. Source registration is metadata only; approval leaves an internal draft awaiting a future publication service. No hosted migration, client debit, platform authorization, payment or intercompany transfer occurs. Migration 011 intentionally removes legacy broad CRM access from operators until the owner assigns China customer-service responsibilities; Canada and finance employees use their scoped operations workspace.
