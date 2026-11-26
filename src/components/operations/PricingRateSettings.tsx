import AdminForm from '@/components/admin/AdminForm';
import type { PricingRateRow, PricingRates } from '@/lib/billing/pricing-rates';

type Props = {
  locale: 'zh' | 'en';
  companies: { id: string; name: string }[];
  company: string;
  month: string;
  systemScope: boolean;
  stored?: PricingRateRow;
  effective?: PricingRates;
};

export default function PricingRateSettings({ locale, companies, company, month, systemScope, stored, effective }: Props) {
  const zh = locale === 'zh';
  const fields = [
    ['canada', 'canada_bps', zh ? 'KBJM 管理费（%）' : 'KBJM management fee (%)'],
    ['china', 'china_bps', zh ? '智点未来服务费（%）' : 'Zhidian service fee (%)'],
    ['transfer', 'transfer_bps', zh ? '跨境支付费（%）' : 'Cross-border payment fee (%)'],
  ] as const;
  return <section className="admin-panel">
    <h2>{zh ? '收费设置' : 'Pricing settings'}</h2>
    <form className="admin-filter" action={`/${locale}/operations/pricing`}>
      <label>{zh ? '客户企业' : 'Company'}
        <select aria-label={zh ? '收费设置企业' : 'Pricing settings company'} name="company" defaultValue={company}>
          {companies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>{zh ? '账单月份' : 'Billing month'}<input name="month" type="month" required min="2000-01" defaultValue={month}/></label>
      <label>{zh ? '编辑范围' : 'Scope'}
        <select name="ratesScope" defaultValue={systemScope ? 'system' : 'customer'}>
          <option value="system">{zh ? '系统默认' : 'System defaults'}</option>
          <option value="customer">{zh ? '客户专属' : 'Customer overrides'}</option>
        </select>
      </label>
      <button className="button">{zh ? '查看收费设置' : 'View rates'}</button>
    </form>
    {!effective ? <p role="status">{zh ? '收费设置暂不可用。请核对数据库部署。' : 'Pricing settings unavailable. Check database deployment.'}</p> :
      <AdminForm locale={locale} endpoint="/api/admin/pricing-rates" reloadOnSuccess button={zh ? '保存费率版本' : 'Save rate version'}>
        <input type="hidden" name="organizationId" value={systemScope ? '' : company}/>
        <input type="hidden" name="month" value={month}/>
        <p>{systemScope ? (zh ? '系统默认' : 'System defaults') : companies.find(item => item.id === company)?.name} · {month}</p>
        {!systemScope && <p>{zh ? '留空沿用系统默认。填写 0 明确免收该项费用。' : 'Leave blank to inherit. Enter 0 to waive the fee.'}</p>}
        {fields.map(([key, column, label]) => <label key={key}>{label}
          <input name={key} inputMode="decimal" pattern="[0-9]{1,3}([.][0-9]{1,2})?" required={systemScope}
            defaultValue={systemScope ? effective[key] / 100 : stored?.[column] != null ? stored[column] / 100 : ''}/>
          {!systemScope && <span>{zh ? '该月适用' : 'Effective this month'} {effective[key] / 100}% · {stored?.[column] == null ? (zh ? '系统默认' : 'System default') : (zh ? '客户专属' : 'Customer override')}</span>}
        </label>)}
      </AdminForm>}
  </section>;
}
