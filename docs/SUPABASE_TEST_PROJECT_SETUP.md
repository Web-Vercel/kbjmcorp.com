# 东京独立测试项目：连接与初始化

目标项目为用户创建的 `kbjmcorp-智点未来 superbase project`，项目编号 `ziijwwbcpuynkaxsbdvg`，Tokyo / `ap-northeast-1`。本文件不包含密钥或数据库密码。

## 已验证和仍未完成的部分

发布后的 Codex 环境已允许该项目域名。使用用户提供的 Publishable key，仅执行只读连接检查：Auth health 200、Auth settings 200；Phone provider=false；申请表元数据请求返回 404 / PGRST205（接口缓存找不到表，尚不能确认数据库初始化完整）。未登录任何真实客户、发送短信、写入业务记录或应用托管迁移。

当前运行环境的两项值仍带 `NEXT_PUBLIC_...=` 前缀，URL 还有首尾空白。只读诊断在自己的进程内去除前缀后成功；这不代表网站运行配置已更正，也没有修改或重新发布环境草稿。

## 先更正环境值

在 Codex 环境变量编辑中，左栏保持 `SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`；右栏只填对应值，不加变量名、等号、引号或换行。

- `SUPABASE_URL`：`https://ziijwwbcpuynkaxsbdvg.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY`：用户提供的完整 `sb_publishable_...` 值；不在文档、脚本或仓库中复述。
- `SMS_AUTH_ENABLED=false`；`CLIENT_APPLICATIONS_ENABLED=false`（未设置也默认关闭）。

没有新增、修改、重新发布此前的环境配置；上述值需通过用户的安全设置修正。Codex 的配置不会自动成为 Vercel 的环境变量，后续部署测试站时需单独配置，不能据本地检查宣称线上已连接。

## 新项目一次性初始化（用户在 Supabase SQL Editor 执行）

1. 在 Supabase 控制台核对当前选中的是上述新测试项目，不是其他项目。
2. 打开左侧 **SQL Editor**，新建查询。
3. 从仓库 `next-rebuild` 分支打开 `supabase/bootstrap/new-test-project.sql`，点击 **Raw** 并复制整个文件。不要只复制预览可见的部分。
4. 粘贴到 SQL Editor，一次运行完整文件。它包含 001–013 的现有表、RLS 权限和业务函数；不添加客户、员工、广告账户或资金记录。
5. 如果出现 `Existing application objects detected`，停止；不要删除表、覆盖记录或反复执行。先检查这个项目已有迁移状态。脚本不是增量升级工具。
6. 如出现任何 SQL 错误，先提供错误信息（遮盖客户或凭据），不要跳过报错段继续运行。所有迁移位于一个事务内，失败应整体回滚。
7. 成功后运行同目录的 `verify-new-project.sql`。应能看到业务表存在、RLS 开启和对应业务函数。之后再从开发环境做只读接口复查。

文件由 `npm run db:bundle` 根据有序迁移生成，包含各源文件 SHA256，`npm run db:bundle:check` 可检查是否过期。重复初始化会停止。不要与 Supabase CLI 的增量迁移同时使用；SQL Editor 路径不会创建 CLI 的 `supabase_migrations` 追踪记录，后续升级需先建立迁移历史基线再运行 CLI push。保留源迁移不变。

## 后续按顺序接通

数据库初始化只完成结构，并不开放真实后台访问。接下来需在测试项目配置员工 Auth、密码登录与 TOTP、真实的初始所有者授权、服务器限流凭据和 CAPTCHA，再添加明确分工的员工。员工身份必须来自 Auth，不能因为某个邮箱或自报角色就自动升级。

客户手机号登录需要单独设置短信服务及 +86 送达测试；此项目当前未开启 Phone provider。客户测试可使用 Supabase 支持的受控测试手机号／固定测试 OTP 配置，但仍须跑实际 Auth 流程，不添加绕过验证的登录后门；上线前须移除测试配置。公司权限、财务权限和合同授权仍按独立审批流程执行。

Secret key、HMAC 密钥和员工密码不贴到聊天或仓库。Publishable key 没有建表或添加员工权限；不能用它应用 SQL。已有代码的 `SUPABASE_SERVICE_ROLE_KEY` 变量用于服务器特权 SDK 连接，后续应以经测试的新式 Secret key 兼容方案配置，不应因为变量旧名称要求启用即将淘汰的 Legacy keys。

完成配置后，以两个虚构企业和两位独立财务人员验证申请、人工审核、公司授权、财务入账以及跨客户隔离。当前原始文件私有存储、正式月报发布／扣费、退款／冲正和实际支付仍是后续开发，不因建表而自动可用。官网首页不改动。

## 开发检查

```sh
npm run db:bundle:check
npm test
npm run typecheck
npm run db:check
```

`db:check` 只调用 Auth health、Auth settings 和 `customer_applications?select=id&limit=0`，不读取客户行、不写数据、不发送短信，也不输出凭据或原始响应。`--dashboard-values` 仅供诊断错误粘贴的 `NAME=value` 格式，不保存修正，也不修改网站配置。不要把该选项当作生产配置修复。

本轮验证：255 项测试通过，TypeScript 检查及初始化包源文件一致性检查通过。初始化包在本地 PostgreSQL 引擎中完整执行，验证了空项目初始化、RLS、重复初始化停止和末尾语句失败时整体回滚；本地执行不代表已经在托管 Supabase 应用。官网源文件及原迁移未修改。
