# KBJM AI advertising — isolated replacement

Next.js / TypeScript / Tailwind website for mainland China advertising prospects. Simplified Chinese is the default; English is secondary. The original Vite checkout and production deployment remain untouched.

Requires Node 24 and npm. At `/workspace/kbjmcorp-next`:

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run dev -- --port 3000
```

Routes:
- `/` → `/zh`; English `/en`.
- `/{zh|en}/services/{strategy|creative|media|insights}`.
- `/{zh|en}/login`: mainland phone + SMS OTP.
- `/{zh|en}/account`: authenticated, tenant-scoped client center; reports are still in development.
- `/{zh|en}/privacy`: development draft requiring final review before collection.

Phone authentication has real Supabase integration code and is disabled until configured. No SMS or accounts are created in the unconfigured environment. Follow `docs/PHONE_AUTH.md` for the separate Supabase project, migrations, provider, CAPTCHA, runtime configuration and actual-device acceptance tests. Never expose service-role or HMAC secrets to the browser or commit their values. The inquiry API also returns 503 without database configuration; it does not simulate success.

Functional regression checks (start the built app on port 3001 first):

```sh
npm run build
npm run start -- --port 3001
# Another terminal, targeting an unconfigured local instance:
SMOKE_EXPECT_UNCONFIGURED=1 npm run test:smoke
```

Omit `SMOKE_EXPECT_UNCONFIGURED` for a configured environment to skip the valid inquiry submission. Set `SMOKE_BASE_URL` to target a different local port. The smoke suite makes no valid SMS/OTP request; `npm test` uses provider test doubles and local PostgreSQL, not real SMS.

See `docs/IMPLEMENTATION.md` for architecture, required Vercel build settings and the independent root-history strategy. The independent `next-rebuild` branch is used for GitHub review and Vercel Preview. Production and hosted database migrations remain unchanged. See `docs/VERCEL_PREVIEW.md` for viewing instructions.

The homepage now includes bilingual FAQ and mobile navigation. Inquiries accept a mainland phone number or email (at least one), plus a target market; this is independent of SMS sign-in. Apply migrations 001–004 in order before connecting hosted inquiry storage; the staff workspace additionally requires migration 005.

Real-browser checks use the environment's installed Chromium:

```sh
SMOKE_BASE_URL=http://127.0.0.1:3001 SMOKE_EXPECT_UNCONFIGURED=1 npm run test:browser
```

`CHROMIUM_PATH` can select another installed Chromium executable. These checks run against a local built server, verify four screen widths, and write screenshots under `/tmp`; they do not validate mainland network access. Omit `SMOKE_EXPECT_UNCONFIGURED` to skip valid inquiry submission when checking a configured instance.

## Phase 2: staff CRM and workspace

The first backend iteration adds protected staff inquiries/follow-up, atomic client conversion, internal projects, account-ownership records and audit events. Staff password + authenticator MFA is independent of customer SMS sign-in. Apply migration `005_staff_crm_projects.sql` only after reviewing the selected test environment; no hosted database has been provisioned by this task.

Public **read-only fictional preview**: `/zh/admin-preview` and `/en/admin-preview`.
Protected staff sign-in: `/{zh|en}/admin/login`; workspace: `/{zh|en}/admin`.

```sh
# Against an unconfigured, locally running build:
SMOKE_BASE_URL=http://127.0.0.1:3016 SMOKE_EXPECT_UNCONFIGURED=1 npm run test:admin
```

The preview does not provide a demo login, persist edits or connect to a real ad account. Real manual CRUD/login tests require a configured test backend and staff identity. See `docs/PHASE2_BACKEND.md` for scope, bootstrap, permissions, evidence and integration boundaries.


客户中心迭代：`/zh/client-preview` 和 `/en/client-preview` 提供虚构只读客户视角；员工演示页底部可点击进入。真实 `/account` 与项目详情使用用户会话和公司权限；内部管理员可在 `/admin/clients` 核实后授予或撤销只读权限。需迁移 006。真实本地身份服务启动受镜像源网络访问限制，尚未完成登录/持久化页面联调；详见 [第二阶段说明](docs/PHASE2_BACKEND.md)。

项目协作迭代：`/zh/workflow-preview`（英文 `/en/workflow-preview`）提供仅在浏览器内存中运行的交互演示，可从客户演示页进入。真实项目详情现有推广需求、创意版本、双向审核与客户确认；仅公司协作成员及通过 MFA 的内部员工可执行各自操作。需迁移 007；引用素材目前使用文字与 HTTPS 外部链接。新增 `npm run test:workflow`，完整的就绪状态和真实服务阻塞见 [PHASE2_READINESS.md](docs/PHASE2_READINESS.md)。

客户后台当前主线已调整为“充值与余额 + 每月广告费用与中文报告”。`/zh/client-preview` 可试用虚构充值登记，并查看 `/zh/client-preview/reports/demo-2026-10` 的中英月报与打印/保存 PDF；原项目协作位于辅助折叠区。迁移 008 提供独立财务权限、待核对充值、资金流水与月报架构，未接支付、实际入账、真实文件导入或翻译服务。详见 [资金与月报说明](docs/CLIENT_FUNDS_REPORTS.md)。
