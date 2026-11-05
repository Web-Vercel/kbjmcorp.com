# 查看新版网站：GitHub 分支与 Vercel Preview

新版代码发布到现有仓库 `Web-Vercel/kbjmcorp.com` 的独立分支 `next-rebuild`。该分支使用独立的根提交，不继承旧网站提交；旧 `main` 保留。

## 查看方式

1. 打开现有 Vercel Project，查看新分支是否已自动生成 Preview Deployment。
2. 如果尚未自动部署，在同一个 Project 为 Git 分支 `next-rebuild` 创建 **Preview** 部署。
3. 部署源码应为 `next-rebuild`，项目根目录应为仓库根目录。
4. 打开这次 Preview 的地址；`/` 会进入简体中文 `/zh`，右上角可切换英文。客户登录页面为 `/zh/login` 或 `/en/login`。

刷新旧的生产部署，或重新部署旧的 `main` 提交，不会显示新版。

## 分支构建配置

新分支的 `vercel.json` 指定：
- Framework：Next.js
- Install：`npm ci`
- Build：`npm run build`
- Output：`.next`

原 Vite 的 `index.html` SPA rewrite 未包含在新版中。建议使用 Node 24。此处是分支代码配置，没有修改项目身份、生产分支、域名绑定、DNS、SSL 或邮箱。不要为了看预览而切换 Production Branch 或点击 Promote to Production。

## 当前可体验内容

中英文首页、服务详情、咨询表单、手机号登录页面。未配置 Supabase/短信时，咨询及短信会明确显示暂不可用；不会伪造提交成功、验证码或客户数据。认证 API 和权限逻辑已有本地自动化测试，但真实短信尚未接通。

公开收集信息前，还需完成独立 Supabase 项目、短信供应商、安全验证、真实大陆网络测试以及正式隐私条款。详见 `PHONE_AUTH.md`。

## 历史与替换

`next-rebuild` 与 `main` 无共同祖先。不要为了创建普通 PR 而强制覆盖主分支或随意合并无关历史。正式替换需另行确认方案；本次发布只提供可查看的新分支。
