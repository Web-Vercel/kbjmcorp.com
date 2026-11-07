# 首位管理员登录接通

官网品牌、首页、Logo、文案、布局及导航不变。员工使用 `/{locale}/admin/login`；主站现有“客户登录”进入登录页后有独立的“员工登录”入口，不需要新增首页按钮。

## 当前状态

用户已在新建的东京测试项目执行 001–013 初始化，提供的截图显示关键业务函数已创建，表列表共 39 行，截图可见的 RLS 标记为 true。用户已创建首位员工 Auth 身份，并报告在 `staff_members` 将该身份设为 `role=admin, active=true`。这是用户执行结果，不是本次使用特权密钥读取确认的结果。数据库权限中 `admin` 对应平台总管理员，不自动成为 Supabase 项目或广告平台管理员。

Codex 网络白名单已应用，先前通过诊断模式完成 Auth 200 响应与匿名业务表权限拒绝检查。本次本地配置检查仍发现两个保存值含 `NAME=` 前缀，且缺少服务器密钥、HMAC 限流密钥和 Turnstile site key。当前不能宣称网站员工登录、TOTP 或 Vercel 配置已接通。

## 配置项与存放位置

只在选定的隔离测试环境配置。不要修改 Production 范围、域名绑定或 DNS。Codex 环境变量不会自动同步到 Vercel；测试站需在同一个既有 Vercel 项目的 **Preview** 环境单独填写，部署对应开发分支。

| 名称 | 填什么 | 放哪里 |
| --- | --- | --- |
| `SUPABASE_URL` | 项目 HTTPS origin；没有变量名、等号、引号、换行或路径 | 网站服务器环境变量 |
| `SUPABASE_PUBLISHABLE_KEY` | 以 `sb_publishable_` 开头的完整公开连接密钥 | 网站服务器环境变量；普通用户会话使用它，不使用 Secret key |
| `SUPABASE_SECRET_KEY` | 新式 `sb_secret_` 服务器密钥 | 网站服务器安全环境变量，不是 `NEXT_PUBLIC_*`，不贴聊天 |
| `AUTH_RATE_LIMIT_SECRET` | 独立生成的高强度随机值，至少 32 字符，建议 32 随机字节的 64 位十六进制表示 | 网站服务器安全环境变量；不是 Supabase 或 Turnstile 密钥 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile widget 的公开 Site key | 网站环境变量；修改后重新构建测试站 |
| Turnstile Secret key | 同一 widget 的私密 Secret key | **Supabase Auth 的 CAPTCHA 设置**，不填到网站 `NEXT_PUBLIC_*` |
| `SMS_AUTH_ENABLED` | `false` | 员工邮箱登录独立运行，无须先开客户短信 |
| `CLIENT_APPLICATIONS_ENABLED` | 暂保持 `false` | 员工与权限验收后再开放申请 |

`SUPABASE_SECRET_KEY` 优先于旧的 `SUPABASE_SERVICE_ROLE_KEY`，新式值格式错误时直接拒绝，不回退到旧值。旧部署仍可保留原有 `SUPABASE_SERVICE_ROLE_KEY`，新部署无需启用 Legacy API keys。Secret key 不得使用 `NEXT_PUBLIC_` 前缀或发到浏览器。普通会话配置会拒绝误放的新式 Secret key，以及复制整行 `NAME=value` 的配置。

若使用 Vercel 环境变量界面，左边填名字，Value 只填值；不是将 `.env` 整行粘进去。已配置的服务器密钥同时支持持久限流 RPC 和现有咨询表单服务端写入，因此仅在隔离测试部署进行验收，不能据此提前开放生产收集。

## 按顺序操作

1. 更正 URL、Publishable key 的 Value 格式，保留现有项目与地区。不要重新创建项目、初始化或授权 SQL。
2. 从 **Supabase → Settings → API Keys → Secret keys** 复制现有 Secret key，在安全环境变量中设置 `SUPABASE_SECRET_KEY`。不要复制到聊天、GitHub、截图或前端代码。
3. 在自己的终端执行 `openssl rand -hex 32`，只把结果填入 `AUTH_RATE_LIMIT_SECRET` 的安全 Value，不发送到聊天。这个命令生成随机值，不访问网站或改动账户。
4. 创建或使用 Cloudflare Turnstile widget。Turnstile 不要求把 Squarespace 域名或 DNS 迁到 Cloudflare；在 widget 内授权实际测试站 hostname。分别保存 Site key 与 Secret key 到上表所述位置。不以 Cloudflare 测试密钥配合关闭服务端验证来接入真实数据。
5. 在 Supabase **Authentication** 设置确认 Email/Password provider 可用；在 Auth CAPTCHA 设置启用 Turnstile 并填写同一 widget 的 Secret key。界面位置可能随版本变化，按实际标签确认。保持 Phone provider 和网站 SMS flag 不开放，除非另行完成短信配置。
6. 确认 Supabase Auth 支持并启用了 TOTP MFA。配置 Preview 环境后构建、部署开发分支；不要切换生产分支或替换首页。修改配置的具体应用方式遵循产品环境设置流程，本次没有替用户保存或发布任何环境草稿。
7. 由管理员本人在测试站 `/{locale}/admin/login` 输入自己的邮箱密码并完成 Turnstile。首次进入 `/{locale}/admin/security`，用验证器 App 扫码，输入六位动态验证码；二维码、种子、密码和验证码都不发送到聊天。
8. 验证完成后应得到 AAL2 会话并进入后台。此后按每位员工本人建立独立 Auth 身份、明确授予职责并绑定各自验证器，不能共用总管理员账号。

这里列出所需步骤并不意味着已验证实际供应商配置。配置缺失时登录应返回不可用；不能跳过 CAPTCHA、持久限流或 MFA 为了让页面看起来可登录。

## 验收

先运行 `npm run staff:check`；它只输出字段名和配置状态，不显示任何值，也不访问网络。`configured` 仅说明基本格式，不证明密钥真实有效、权限正确或远端 CAPTCHA/MFA 已开启。

随后在测试环境验证：错误密码和无员工权限账号不能进入；缺少 CAPTCHA 不发起登录；限流故障时拒绝登录；AAL1 不能读取客户私有资料；错误／过期 TOTP 不提升权限；成功 MFA 后权限符合当前员工职责；退出后不能继续访问；两个企业之间没有数据交叉。真实手机号客户授权另行测试。

总管理员也不能自审自己的财务制单。验证器丢失需由已核实的项目所有者通过受控恢复流程处理，保留审计，不通过关闭全局 MFA 或放开 RLS 恢复访问。

本轮验证：266 项自动测试、TypeScript 和生产构建通过；Chromium 员工入口 25 项及首页 9 个场景（六种屏幕宽度）通过。新式／旧式服务器密钥选择、错误配置拒绝、用户会话不使用新式 Secret key、咨询服务兼容性及配置诊断不泄露值均有测试。未输入真实密码、设置真实 TOTP、执行托管登录或修改任何环境配置；本地 `staff:check` 按预期报告未就绪。首页组件、营销文案、品牌素材和共享样式未改动。
