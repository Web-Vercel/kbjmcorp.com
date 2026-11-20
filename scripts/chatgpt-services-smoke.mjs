import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3036';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw Error('Local built-app checks only');
const out='/workspace/shared/chatgpt-services-2026-11-20';await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});let checks=0;
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const locale of ['zh','en'])for(const width of [320,375,768,1024,1201,1440]){
  await page.setViewportSize({width,height:1000});await page.goto(base+'/'+locale,{waitUntil:'networkidle'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow '+locale+'/'+width);
  const hero=page.locator('aside.hero-visual');await expect(hero).toBeVisible();
  const ad=hero.locator('a[href$="/platforms/chatgpt-ads"]'),commerce=hero.locator('a[href$="/services/chatgpt-commerce"]');
  for(const link of [ad,commerce]){await link.scrollIntoViewIfNeeded();await expect(link).toBeVisible();assert(await link.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit&&el.contains(hit);}),'hero service link must be clickable');}
  assert(await page.evaluate(()=>{const copy=document.querySelector('.hero-copy').getBoundingClientRect(),card=document.querySelector('aside.hero-visual>div:last-child').getBoundingClientRect();return card.left>=copy.right||card.top>=copy.bottom;}),'hero must not overlap copy '+locale+'/'+width);
  if(locale==='zh')await expect(page.locator('h1')).toHaveText('让中国品牌，被世界看见。');
  await page.locator('#chatgpt-services summary').click();await expect(page.locator('#chatgpt-services table')).toBeVisible();await expect(page.locator('#chatgpt-services tbody tr')).toHaveCount(4);
  if(width===375||width===1440){await page.screenshot({path:out+'/'+locale+'-home-'+width+'.png',fullPage:true});}
  await commerce.click();await expect(page).toHaveURL(new RegExp('/'+locale+'/services/chatgpt-commerce$'));await expect(page.locator('h1')).toBeVisible();await expect(page.locator('main')).toContainText('Product Feed');await expect(page.locator('main')).toContainText('ACP');await expect(page.locator('main')).toContainText('Instant Checkout');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'commerce page overflow');
  if(width===375||width===1440)await page.screenshot({path:out+'/'+locale+'-commerce-'+width+'.png',fullPage:true});
  checks++;
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,viewports:6,locales:2,serviceLinksClickable:true,comparisonRows:4,pageErrors:0,artifacts:out}));
}finally{await browser.close();}
