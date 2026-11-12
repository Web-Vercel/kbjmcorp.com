import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3032';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const slugs=['chatgpt-ads','google-ads','meta-ads','tiktok-ads'];let checks=0;
try{
for(const locale of ['zh','en']){
 for(const width of [320,375,768,1024,1440]){
  await page.setViewportSize({width,height:950});await page.goto(`${base}/${locale}`,{waitUntil:'networkidle'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const nav=page.getByRole('navigation',{name:locale==='zh'?'广告平台导航':'Advertising platform navigation'});
  await expect(nav.getByRole('link')).toHaveCount(4);await expect(page.locator('#platforms article')).toHaveCount(4);
  for(const image of await page.locator('#platforms img').all()){await image.scrollIntoViewIfNeeded();await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);}
  for(const slug of slugs)await expect(nav.locator(`a[href="/${locale}/platforms/${slug}"]`)).toBeVisible();
  if(width===1440&&locale==='zh'){await page.locator('#platforms').screenshot({path:'/tmp/kbjm-platforms-desktop.png'});await page.screenshot({path:'/tmp/kbjm-header-desktop.png'});}
  if(width===375&&locale==='zh')await page.locator('#platforms').screenshot({path:'/tmp/kbjm-platforms-mobile.png'});
  checks++;
 }
 for(const slug of slugs){
  const response=await page.goto(`${base}/${locale}/platforms/${slug}`,{waitUntil:'networkidle'});assert.equal(response.status(),200);
  await expect(page.locator('main h1')).toBeVisible();await expect(page.locator(`main a[href="/${locale}#contact"]`)).toBeVisible();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await expect(page.locator(`a[href="/${locale==='zh'?'en':'zh'}/platforms/${slug}"]`)).toHaveCount(1);checks++;
 }
}
assert.deepEqual(errors,[]);console.log(`${checks} platform presentation checks passed`);
}finally{await browser.close();}
