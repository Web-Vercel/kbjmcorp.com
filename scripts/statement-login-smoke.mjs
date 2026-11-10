import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3001';
const id='b0000000-0000-4000-8000-000000000001';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
let checks=0;const authRequests=[];
try{
 const page=await browser.newPage();page.on('request',r=>{if(r.url().startsWith(`${base}/api/auth/`))authRequests.push(r.url());});
 for(const locale of ['zh','en']){
  await page.setViewportSize({width:locale==='zh'?375:1440,height:1000});
  await page.goto(`${base}/${locale}/account/statements?month=2026-10&statement=${id}`,{waitUntil:'domcontentloaded'});
  await expect(page).toHaveURL(new RegExp(`/${locale}/login\\?`));const url=new URL(page.url());
  assert.equal(url.searchParams.get('returnTo'),`/${locale}/account/statements?month=2026-10&statement=${id}#statement-${id}`);
  await expect(page.getByText(locale==='zh'?'验证成功后将返回原账单；可查看范围仍由企业授权决定。':'After verification, return to your statement. Company permissions still determine access.')).toBeVisible();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await expect(page.locator('a[href*="/test-login"]')).toHaveCount(0);
  await page.screenshot({path:`/tmp/statement-login-${locale}.png`,fullPage:true});checks++;
 }
 const target=`/zh/account/statements?statement=${id}#statement-${id}`;
 await page.goto(`${base}/zh/login?${new URLSearchParams({returnTo:target})}`,{waitUntil:'domcontentloaded'});
 await page.locator('a.language').click();await expect(page).toHaveURL(/\/en\/login\?/);
 const back=new URL(await page.locator('a.language').getAttribute('href'),base);assert.equal(back.searchParams.get('returnTo'),target.replace('/zh/','/en/'));checks++;
 for(const query of [new URLSearchParams({returnTo:'https://invalid.example'}),new URLSearchParams({returnTo:'/zh/admin'}),new URLSearchParams([['returnTo',target],['returnTo','https://invalid.example']])]){
  await page.goto(`${base}/zh/login?${query}`,{waitUntil:'domcontentloaded'});await expect(page.getByText(/验证成功后将返回原账单/)).toHaveCount(0);await expect(page.locator('a.language')).toHaveAttribute('href','/en/login');checks++;
 }
 await page.goto(`${base}/zh/login?${new URLSearchParams({flow:'application',returnTo:target})}`,{waitUntil:'domcontentloaded'});await expect(page.locator('a.language')).toHaveAttribute('href','/en/login?flow=application');await expect(page.getByText(/验证成功后将返回原账单/)).toHaveCount(0);checks++;
 assert.deepEqual(authRequests,[]);console.log(`${checks} statement login navigation checks passed; no authentication requests sent.`);
}finally{await browser.close();}
