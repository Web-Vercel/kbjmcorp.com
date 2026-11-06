import assert from 'node:assert/strict';
import { chromium,expect } from '@playwright/test';
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3020';let checks=0;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();const errors=[];const mutations=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))mutations.push(r.url());});
 for(const locale of ['zh','en']){
  const zh=locale==='zh';
  for(const width of [320,375,768,1440]){
   await page.setViewportSize({width,height:1000});await page.goto(`${base}/${locale}/client-preview`,{waitUntil:'networkidle'});await expect(page.getByTestId('wallet-balance')).toHaveText('CAD 7,500.00');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Dashboard overflow ${locale}/${width}`);checks++;
  }
  await page.getByRole('button',{name:zh?/充值 \/ 登记付款/:/Top up \/ Register payment/}).click();await page.getByLabel(zh?'充值金额（CAD）':'Top-up amount (CAD)',{exact:true}).fill('500.25');await page.getByLabel(zh?'付款参考号':'Payment reference',{exact:true}).fill('DEMO-ONLY-500');await page.getByRole('checkbox').check();await page.getByRole('button',{name:zh?'提交充值核对':'Request top-up verification',exact:true}).click();await expect(page.getByText(zh?'待核对到账':'Awaiting verification',{exact:true})).toBeVisible();await expect(page.getByTestId('wallet-balance')).toHaveText('CAD 7,500.00');checks++;
  if(zh){await page.screenshot({path:'/tmp/kbjm-billing-desktop.png',fullPage:true});await page.setViewportSize({width:375,height:1000});await page.screenshot({path:'/tmp/kbjm-billing-mobile.png',fullPage:true});}
  await page.reload({waitUntil:'networkidle'});await expect(page.getByText('DEMO-ONLY-500',{exact:true})).toHaveCount(0);checks++;
  await page.getByRole('link',{name:zh?/查看中文月报/:/View monthly report/}).click();await expect(page).toHaveURL(/reports\/demo-2026-10$/);await expect(page.getByRole('heading',{level:1})).toHaveText(zh?'每月广告使用报告':'Monthly advertising report');await expect(page.locator('.report-demo')).toBeVisible();checks++;
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`Report overflow ${locale}/${width}`);checks++;}
  await page.getByRole('combobox').selectOption(zh?'en':'zh');await expect(page.getByRole('heading',{level:1})).toHaveText(zh?'Monthly advertising report':'每月广告使用报告');checks++;
  await page.getByRole('combobox').selectOption('zh');await page.pdf({path:`/tmp/kbjm-monthly-demo-${locale}.pdf`,format:'A4',printBackground:true,preferCSSPageSize:true});
  if(zh){await page.screenshot({path:'/tmp/kbjm-report-desktop.png',fullPage:true});await page.setViewportSize({width:375,height:1000});await page.screenshot({path:'/tmp/kbjm-report-mobile.png',fullPage:true});}
 }
 assert.deepEqual(errors,[]);assert.deepEqual(mutations,[],'Public finance demo does not send financial mutations');
 const response=await fetch(`${base}/zh/account/reports/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,{redirect:'manual'});assert.equal(response.status,307);assert.equal(response.headers.get('location'),'/zh/login');checks++;
}finally{await browser.close();}
console.log(`Passed ${checks} funding, monthly-report, print and privacy checks.`);
