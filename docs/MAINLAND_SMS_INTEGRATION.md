# 中国大陆短信登录接入方向

Supabase Phone 页的 Twilio、Vonage 等是内置**发送服务适配商**，不是允许接收短信的中国手机运营商列表。收件人属于中国移动、联通或电信，并不要求该运营商出现在下拉框。

Supabase 官方 Send SMS Hook 可替代内置发送，官方明确列出 regional SMS provider 用例：
https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook

已核对的官方源文档：
https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/auth-hooks/send-sms-hook.mdx

建议正式业务评估阿里云短信、腾讯云短信等面向 +86 号码的服务，经企业实名、签名、验证码模板与区域审核后，通过服务端短信钩子对接。它们不是当前下拉框的现成功能；需要单独实现适配器、密钥管理、签名验证、错误映射、发送限额和送达监测。

业务链路：用户提交手机号及 CAPTCHA → 应用限流 → Supabase 生成 OTP → 已鉴别来源的 Send SMS Hook → 大陆短信服务商 → 手机接收 → 用户提交 OTP → Supabase 验证并签发会话。验证码生成、时效和校验继续交由 Supabase；手机归属与客户公司授权是两件事。

HTTP hook 必须按当前 Supabase hook 协议验签和校验时效，拒绝伪造调用及错误项目来源；不得提供匿名任意手机发短信接口。供应商密钥、OTP、hook payload 与验证码模板参数不写日志、不发给浏览器。发送失败不得返回伪成功。供应商接受请求不等于手机已收到，必须分别测试移动／联通／电信及实际目标机型、地区、耗时与失败率。

供应商选择、计费、资质、模板和真实 +86 通道均尚未完成；本轮未开通任何付费短信服务、未接入 hook、未发送短信。当前 Preview 邮箱入口仅用于公司数据隔离验收，不证明正式手机号登录可用。正式站保持原手机登录方案，短信仍关闭。
