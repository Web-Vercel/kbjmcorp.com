import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3001';
const wallet='b0000000-0000-4000-8000-000000000001',month='2026-10';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
let checks=0;const writes=[];
try{
 const page=await browser.newPage();page.on('request',r=>{if(r.url().startsWith(base+'/api/'))writes.push(r.url());});
 for(const locale of ['zh','en'])for(const width of [375,1440]){
  await page.setViewportSize({width,height:1000});
  const target=`/${locale}/account/funds?wallet=${wallet}&month=${month}`;
  await page.goto(base+target,{waitUntil:'domcontentloaded'});
  const url=new URL(page.url());assert.equal(url.pathname,`/${locale}/login`);assert.equal(url.searchParams.get('returnTo'),target);
  await expect(page.getByText(locale==='zh'?'验证成功后将返回原资金账户及对账月份；可查看范围仍由企业财务授权决定。':'After verification, return to the original wallet and reconciliation month. Company finance permissions still determine access.')).toBeVisible();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await expect(page.locator('a[href*="/test-login"]')).toHaveCount(0);
  await page.locator('a.language').click();const other=locale==='zh'?'en':'zh';await expect(page).toHaveURL(new RegExp(`/${other}/login\\?`));
  const redirected=new URL(new URL(page.url()).searchParams.get('returnTo'),'https://example.test');assert.equal(redirected.pathname,target.split('?')[0]);assert.equal(redirected.searchParams.get('wallet'),wallet);assert.equal(redirected.searchParams.get('month'),month);
  await expect(page.getByText(other==='zh'?'验证成功后将返回原资金账户及对账月份；可查看范围仍由企业财务授权决定。':'After verification, return to the original wallet and reconciliation month. Company finance permissions still determine access.')).toBeVisible();
  const normalized=new URL(new URL(await page.locator('a.language').getAttribute('href'),base).searchParams.get('returnTo'),'https://example.test');assert.equal(normalized.pathname,`/${other}/account/funds`);assert.equal(normalized.searchParams.get('wallet'),wallet);assert.equal(normalized.searchParams.get('month'),month);checks++;
 }
 for(const target of [`/zh/account/funds?wallet=${wallet}&wallet=${wallet}`,'/zh/account/funds?month=2026-13','/zh/account/funds?next=/zh/admin','https://evil.example/zh/account/funds']){
  await page.goto(`${base}/zh/login?${new URLSearchParams({returnTo:target})}`,{waitUntil:'domcontentloaded'});await expect(page.getByText(/验证成功后将返回原资金账户/)).toHaveCount(0);await expect(page.locator('a.language')).toHaveAttribute('href','/en/login');checks++;
 }
 assert.deepEqual(writes,[]);console.log(`${checks} funds sign-in navigation checks passed; no authentication submissions or financial API calls sent.`);
}finally{await browser.close();}
