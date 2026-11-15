import {expect,it} from 'vitest';
import {statement} from './fixtures/client-statement';
import {clientStatementSchema,statementPublishedAt} from '@/lib/billing/client-statement';
import {statementCsv,statementHtml} from '@/lib/billing/statement-export';
it('exports exact CNY charges and separates period charges from daily usage',()=>{
 const csv=statementCsv(statement,true),html=statementHtml(statement,true);
 for(const text of ['1234.56','78.90','1313.46',statement.id,'请勿重复支付','经独立复核无活动']){expect(csv).toContain(text);expect(html).toContain(text);}
 expect(csv.startsWith('\uFEFF')).toBe(true);expect(csv).toContain('"日期","展示次数","点击次数","活动状态依据"');
 expect(statementCsv({...statement,advertising_service_minor:'900719925474099301',operating_other_minor:'0',total_minor:'900719925474099301'},false)).toContain('9007199254740993.01');
});
it('strips unknown private fields at both levels before client serialization and export',()=>{
 const input={...statement,rate:'PRIVATE_RATE',rawResponses:['PRIVATE_RAW'],usage:{...statement.usage,sourceCadMinor:'PRIVATE_COST',daily:statement.usage.daily.map(d=>({...d,spendMicros:'PRIVATE_SPEND'}))}};
 const projected=clientStatementSchema.parse(input);expect(JSON.stringify(projected)).not.toContain('PRIVATE');expect(statementCsv(input,true)).not.toContain('PRIVATE');expect(statementHtml(input,true)).not.toContain('PRIVATE');
});
it('neutralizes spreadsheet formulas and escapes active HTML in customer text',()=>{
 const input={...statement,organization_name:' =HYPERLINK("bad")',summary_zh:'<script>alert(1)</script> & text'};
 expect(statementCsv(input,true)).toContain("\"' =HYPERLINK(\"\"bad\"\")\"");const html=statementHtml(input,true);expect(html).not.toContain('<script>');expect(html).toContain('&lt;script&gt;');expect(html).toContain("default-src 'none'");
});
it('rejects inconsistent totals and formats publication time in Vancouver',()=>{
 expect(()=>statementCsv({...statement,total_minor:'1'},true)).toThrow();expect(()=>statementHtml({...statement,currency:'CAD'} as never,true)).toThrow();
 expect(statementPublishedAt(statement.published_at,false)).toContain('2026-11-08');expect(statementPublishedAt(statement.published_at,false)).toContain('17:30');
});
it('marks explicit acceptance statements in CSV and printable HTML without relabelling real sources',()=>{
 const test={...statement,summary_zh:'[ACCEPTANCE-TEST-NOT-PAYABLE] 测试结算',organization_name:'Renamed acceptance company'};
 for(const text of [statementCsv(test,true),statementHtml(test,true)]){expect(text).toContain('测试');expect(text).toContain('不作付款');expect(text).toContain('真实资料');expect(text).not.toContain('本账单已正式发布');}
 expect(statementCsv(statement,true)).toContain('本账单已正式发布');
});
it('uses fictional Chinese issuer details only on acceptance templates and separates the usage appendix',()=>{
 const html=statementHtml({...statement,summary_zh:'[ACCEPTANCE-TEST-NOT-PAYABLE] 测试'},true);
 for(const text of ['中国运营公司的法定全称（虚构测试）','TEST-NOT-VALID','不是税务发票','出单时间（北京时间）','Asia/Shanghai','附件：每日投放使用情况','含税或未税约定待中国财务核实'])expect(html).toContain(text);
 expect(html.indexOf('本期费用')).toBeLessThan(html.indexOf('附件：每日投放使用情况'));
 const live=statementHtml(statement,true);expect(live).not.toContain('TEST-NOT-VALID');expect(live).not.toContain('法定全称（虚构测试）');expect(live).toContain('出单主体资料尚未核实');
 expect(html).not.toContain('注册地址');expect(html).not.toContain('银行账号');
});
it('keeps CTR but omits CPC and CPM in both languages and customer download formats',()=>{
 const input={...statement,advertising_service_minor:'21198',operating_other_minor:'8480',total_minor:'29678',usage:{...statement.usage,impressions:'1017',clicks:'20'}};
 for(const zh of [true,false])for(const output of [statementHtml(input,zh),statementCsv(input,zh)]){
 expect(output).toContain('1.97%');expect(output).toContain('296.78');
 for(const value of ['CPC','CPM','平均每次点击成本','每千次展示成本','Average cost per click','Cost per thousand impressions'])expect(output).not.toContain(value);
 }
 const zero=statementHtml({...input,usage:{...input.usage,impressions:'0',clicks:'0'}},true);expect(zero).not.toContain('NaN');expect(zero).not.toContain('Infinity');
});
