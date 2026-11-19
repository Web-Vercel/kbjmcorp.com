import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import Menu from '@/components/operations/OperationsHomeMenu';
it('groups administrator tasks and links to separate task pages',()=>{
 const html=renderToStaticMarkup(<Menu locale="zh" finance source owner support/>);
 for(const text of ['月结与账单','广告数据','资金与公司间核对','客户服务与人员','href="/zh/operations/staff"','/zh/operations/month-close'])expect(html).toContain(text);
});
it('keeps administrator-only destinations out of the finance menu',()=>{
 const html=renderToStaticMarkup(<Menu locale="zh" finance source={false} owner={false} support={false}/>);
 expect(html).not.toContain('href="/zh/operations/staff"');expect(html).not.toContain('/zh/operations/ads-reporting');expect(html).not.toContain('href="/zh/operations/upstream"');expect(html).toContain('/zh/operations/month-close');
});
it('gives ad operations manual handoff access without finance actions',()=>{
 const html=renderToStaticMarkup(<Menu locale="en" source finance={false} owner={false} support={false}/>);
 expect(html).toContain('href="/en/operations/manual-sources"');expect(html).not.toContain('/operations/collections');expect(html).not.toContain('/operations/settlements');
});
