# Production 040 → 053 增量升级准备

2026-11-19（温哥华）；仅准备和本地演练，未执行 Production SQL、未发布或Promote代码。

## 已取得的生产证据

用户在项目 `rywmjguhvnppfxwhherl`（智点未来-production LIVE）执行只读核对：虚构企业筛选0、测试账单标记0。6个函数探测中，company_profiles/upstream_reversal存在，client_scope/manual_publication/refund_workflow/credential_session_gate不存在。仅能据此确认缺少新功能，不直接证明整库精确为040。查询文档编号与数据库版本无关：Production已有01–04，05为生产上线前只读核对。

## 接下来的唯一用户步骤

Production SQL Editor 新建并保存 **`06 生产040升级前只读检查`**，执行 `supabase/upgrades/production_040_readiness.sql` 全文。它只读取系统目录，检查既有表/列/类型/默认值/RLS、原有策略与125个原有函数定义指纹，拒绝部分升级和既有同名文件桶冲突。成功只返回 `ready_for_reviewed_040_to_053_upgrade`。出错原样保留信息，由代码侧核对差异，不跳过guard、不删除对象来强行通过。

这一步没有业务写入，无需重建数据库或重新输入任何客户/付款资料。无需再重复退款申请。

## 受控升级包（此刻不要执行）

`supabase/upgrades/production_040_to_053.sql`：包含原始041–053源迁移，附SHA256；剥离13个独立事务边界后放入一个原子事务，5秒锁超时、120秒语句超时及专用事务锁；先做与06一致的基线校验，再应用。不会导入Preview资料、Auth用户、密码、MFA因素或角色绑定。041会创建私有partner-documents桶和策略；这是schema/存储配置变化，不是纯读取。

升级会创建退款/代理/凭证维护等新结构、更新权限辅助函数和会话门禁、新增手工结算/项目授权，以及放宽自动账单列的NOT NULL以支持新的来源约束。它不是全新初始化，也不是仅补4个缺失函数。必须整体评审、确认当前备份和数据库基线后执行。

下一份正式升级文档可命名 **`07 生产数据库040到053增量升级`**，但仅在06通过、当前生产备份状态/时间已核实且确认维护窗口后提供执行步骤。不要用 `supabase/bootstrap/new-test-project.sql` 替代，不能在现有库执行整库初始化。

## 本地验证

- 与历史Production候选checkout的001–040源文件SHA对比一致，无旧迁移内容替换。
- PGlite迁移测试：只读检查不安装新表；列漂移拒绝；部分安装拒绝；053前故障时041–052全部回滚；原Auth身份、管理员active/role、钱包与原流水逐字段保留；最新函数和私有文件桶存在；再次运行升级在变更前拒绝，原记录不重复。
- 原生PostgreSQL17：从001–040起步，写入隔离的旧Auth/管理员/钱包/流水fixture；校验由PGlite生成的基线指纹能在原生PostgreSQL通过；末尾故障回滚、成功升级保留原记录、重跑拒绝。随后在这一个升级后的数据库上完成真实并发退款、独立核实、退款与重复出账并行、原生加密pg_dump/独立pg_restore等门槛测试，全部通过。
- 机器结果 `/workspace/shared/production-upgrade-2026-11-19/result.json`。均为虚构隔离fixture，不替代托管Auth/MFA或真实文件恢复证据。
- `npm run db:production-upgrade:check` 比较生成物与源文件，防止手改/过期包；`GATES_UPGRADE_FROM_040=1 npm run verify:financial-gates` 在网络隔离临时PostgreSQL容器复现实验。

## 保护与回退

guard失败就停止，不能只复制缺失函数或单独挑某条迁移。若升级事务失败，由PostgreSQL回滚该次变更；若已成功，不执行反向DROP，不回退已产生业务记录。代码与数据库发布分开，先核实当前生产部署及兼容性，再采用Production配置重新构建候选，禁止直接Promote复用Preview变量。本准备不构成Production代码发布或真实财务业务放行。

## 生产函数差异核对 — 2026-11-19

06首次在Production只读检查中停止于prepare_monthly_settlement(uuid,uuid,text,text)。用户导出单行CSV提供函数定义；文件作为数据读取，不执行附件中的SQL。

逐字比较结果：与原始026函数定义仅有一处空白行上的一个空格不同；与历史初始化包生成器（去除每行行尾空格）的输出完全一致。附件函数MD5为45ba415d6c7ba53ed18cecde6aebc911，原始迁移定义MD5为a07524dc92c8e84e1e3519b981a61a1a。制单权限、月度覆盖、幂等校验、币种/月结范围及金额计算均无变化。首次校验未考虑既有初始化安装路径，属于基线检查误报，不需要修改生产函数。

修正：生成器为每个函数预计算“原始迁移”和“历史初始化包格式”两个准确指纹；线上定义仍按原样计算指纹，只接受这两种已知输出，绝不对任意生产代码做空白/逻辑宽松归一化。表、列、RLS、策略及部分升级防护保持。新增测试验证：已审阅的45ba415d…定义可通过，把输入长度门槛从3改为1则必须拒绝。两个SQL生成物同步重建，Production未写入。

下一步：将已保存06的正文替换为更新后的production_040_readiness.sql全文，重跑只读检查；不新建文档编号、不直接运行07。

最终验证：18项针对性测试、类型检查、初始化包一致性检查通过；原生PostgreSQL按历史bootstrap格式安装040后，更新guard通过，040→053保留数据、故障回滚、重跑拒绝、后续真实并发财务与原生备份恢复全部通过。证据 `/workspace/shared/production-upgrade-bootstrap-2026-11-19/result.json`。
