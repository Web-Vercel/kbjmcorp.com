import {it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {attentionSchema,attentionHref,loadAttention,type Attention} from '@/lib/attention/model';
import HomeAttention from '@/components/attention/HomeAttention';
const org='a0000000-0000-4000-8000-000000000001';
const sample:Attention={role:'staff',totalGroups:2,items:[{key:'statement_review',bucket:'action',count:3,oldest:'2026-11-14T23:30:00Z',org,company:'示例企业（虚构）'},{key:'refund_prepared',bucket:'waiting',count:1,oldest:'2026-11-15T00:00:00Z',org,company:'示例企业（虚构）'}]};
it('renders current actions separately from waiting work with scoped links and Beijing dates',()=>{
 const html=renderToStaticMarkup(<HomeAttention data={sample} locale="zh"/>);
 expect(html).toContain('待办与提醒');expect(html).toContain('需要你处理');expect(html).toContain('等待他人或流程推进');expect(html).toContain('2026/11/15');expect(html).toContain('company='+org);expect(html).toContain('等待项无需重复提交');expect(html).not.toContain('<form');expect(html).not.toContain('逾期');
 expect(attentionHref(sample.items[0],'en')).toBe('/en/operations/settlements?company='+org);
});
it('keeps failures distinct from a successfully empty queue',()=>{
 const failed=renderToStaticMarkup(<HomeAttention data={null} locale="zh"/>);expect(failed).toContain('role="alert"');expect(failed).toContain('待办暂不可用');expect(failed).not.toContain('未发现此类事项');
 expect(renderToStaticMarkup(<HomeAttention data={{role:'client',totalGroups:0,items:[]}} locale="en"/>)).toContain('No matching items in this query.');
});
it('rejects malformed counts, timestamps and mismatched returned roles instead of trusting a response',async()=>{
 expect(attentionSchema.safeParse({...sample,items:[{...sample.items[0],count:-1}]}).success).toBe(false);
 expect(attentionSchema.safeParse({...sample,items:[{...sample.items[0],oldest:'bad'}]}).success).toBe(false);
 expect(await loadAttention({rpc:vi.fn().mockResolvedValue({data:sample,error:null})},'client')).toBeNull();
 expect(await loadAttention({rpc:vi.fn().mockRejectedValue(Error('offline'))},'staff')).toBeNull();
 expect(await loadAttention({rpc:vi.fn().mockResolvedValue({data:sample,error:null})},'staff')).toEqual(sample);
});
it.skipIf(process.env.HOME_ATTENTION_ARTIFACTS!=='1')('exports a fictional reminder panel for responsive visual inspection',async()=>{
 const {mkdirSync,writeFileSync,readFileSync}=await import('node:fs');
 const markup=renderToStaticMarkup(<HomeAttention data={sample} locale="zh"/>);
 let css=readFileSync('src/components/attention/HomeAttention.module.css','utf8');for(const value of new Set(markup.match(/_[a-zA-Z]+_[a-z0-9]+/g)||[]))css=css.replaceAll('.'+value.split('_')[1],'.'+value);
 const dir='/workspace/shared/home-attention';mkdirSync(dir,{recursive:true});
 const data:Attention={...sample,totalGroups:3,items:[...sample.items,{key:'source_difference',bucket:'attention',count:1,oldest:'2026-11-13T00:00:00Z',org,company:'示例企业（虚构）'}]};
 writeFileSync(dir+'/sample.html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px/1.6 system-ui;margin:0;padding:16px;max-width:1100px;margin:auto;box-sizing:border-box}*{box-sizing:border-box}[data-workspace-value]{color:#205481}'+css+'</style>'+renderToStaticMarkup(<HomeAttention data={data} locale="zh"/>));expect(readFileSync(dir+'/sample.html','utf8')).toContain('示例企业（虚构）');
});
