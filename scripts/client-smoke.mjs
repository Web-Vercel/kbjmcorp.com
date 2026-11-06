import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3017';
let checks=0;
for(const locale of ['zh','en']){
 for(const path of ['account','account/projects/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']){
  const response=await fetch(`${base}/${locale}/${path}`,{redirect:'manual'});
  assert.equal(response.status,307);assert.equal(response.headers.get('location'),`/${locale}/login`);checks++;
 }
 const response=await fetch(`${base}/${locale}/admin/clients`,{redirect:'manual'});assert.equal(response.status,307);assert.equal(response.headers.get('location'),`/${locale}/admin/login`);checks++;
}
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const locale of ['zh','en'])for(const width of [320,375,768,1440]){
  await page.setViewportSize({width,height:1000});
  await page.goto(`${base}/${locale}/admin-preview`,{waitUntil:'networkidle'});
  await page.getByRole('link',{name:locale==='zh'?'查看客户中心演示':'View client preview'}).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/client-preview$`));
  await expect(page.getByRole('heading',{level:1})).toHaveText(locale==='zh'?'您的品牌，进展清晰可见。':'Your brand. Clear progress.');
  await expect(page.locator('.admin-demo-banner')).toBeVisible();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`No overflow ${locale}/${width}`);
  assert.equal(await page.locator('form').count(),0,'Public preview has no mutation forms');
  const text=await page.locator('main').innerText();assert.ok(!text.includes('Kenny Lu')&&!text.includes('Remix'),'No real pilot identity');
  assert.ok(text.includes(locale==='zh'?'演示客户':'Demo client'));
  checks++;
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(`${base}/zh/client-preview`,{waitUntil:'networkidle'});await page.screenshot({path:'/tmp/kbjm-client-desktop.png',fullPage:true});
 await page.setViewportSize({width:375,height:1000});await page.screenshot({path:'/tmp/kbjm-client-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
console.log(`Passed ${checks} client route and browser checks.`);
