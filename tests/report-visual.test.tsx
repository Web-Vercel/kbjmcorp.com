import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import PasswordInput from '@/components/auth/PasswordInput';
import {statementHtml} from '@/lib/billing/statement-export';
import {statement} from './fixtures/client-statement';
it.skipIf(process.env.REPORT_UI_ARTIFACTS!=='1')('exports fictional report and password controls for visual inspection',()=>{
 const dir='/workspace/shared/report-metrics';mkdirSync(dir,{recursive:true});
 writeFileSync(dir+'/statement.html',statementHtml({...statement,summary_zh:'[ACCEPTANCE-TEST-NOT-PAYABLE] 虚构测试账单',advertising_service_minor:'21198',operating_other_minor:'8480',total_minor:'29678',usage:{...statement.usage,impressions:'1017',clicks:'20',daily:statement.usage.daily.map((d,i)=>({...d,impressions:i===0?'1017':'0',clicks:i===0?'20':'0'}))}},true));
 const markup=renderToStaticMarkup(<form className="admin-form"><label>工作邮箱<input type="email"/></label><label>密码<PasswordInput name="password" defaultValue="fictional-password"/></label><button className="button">登录</button></form>);
 let css=readFileSync('src/components/auth/PasswordInput.module.css','utf8');for(const name of new Set(markup.match(/_[a-zA-Z]+_[a-z0-9]+/g)||[]))css=css.replaceAll('.'+name.split('_')[1],'.'+name);
 writeFileSync(dir+'/password.html','<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+readFileSync('src/app/globals.css','utf8')+css+'</style><main style="max-width:440px;margin:32px auto;padding:20px"><h1>账户登录</h1>'+markup+'</main>');expect(markup).toContain('显示密码');
});
