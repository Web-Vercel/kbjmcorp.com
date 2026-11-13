/** Stored in the immutable statement summary, independently of deployment or company renames. */
export const acceptancePrefix = '[ACCEPTANCE-TEST-NOT-PAYABLE] ';
export function isAcceptanceStatement(statement: { summary_zh: string; organization_name: string }) {
  return statement.summary_zh.startsWith(acceptancePrefix) || statement.organization_name === '财务流程验收企业（虚构）';
}
export function acceptanceNotice(zh: boolean) {
  return zh ? '测试账单，不作付款或税务依据。金额仅影响独立验收账本，不代表真实收付款；不得迁入正式账本。广告来源可能为获授权的真实资料。' : 'Acceptance test statement. Not payable and not a tax document. Amounts affect only the isolated test ledger, not actual payments; do not migrate them into the live ledger. Advertising sources may contain authorized real data.';
}
