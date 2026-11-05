import assert from "node:assert/strict";
import { chromium,expect } from "@playwright/test";
const base=process.env.SMOKE_BASE_URL||"http://127.0.0.1:3016";
let checks=0;
for(const locale of ['zh','en']){
 const preview=await fetch(`${base}/${locale}/admin-preview`);assert.equal(preview.status,200);const html=await preview.text();
 assert.ok(html.includes(locale==='zh'?'演示数据':'Demo data'));assert.ok(!html.includes('Kenny Lu')&&!html.includes('Remix'),'Real pilot identity is not in public demo');assert.ok(html.includes(locale==='zh'?'演示客户':'Demo client'),'Preview contains clearly fictional clients');checks++;
 for(const path of ['admin','admin/inquiries','admin/projects','admin/accounts','admin/security']){
  const response=await fetch(`${base}/${locale}/${path}`,{redirect:'manual'});assert.equal(response.status,307);assert.equal(response.headers.get('location'),`/${locale}/admin/login`);checks++;
 }
 const login=await fetch(`${base}/${locale}/admin/login`);assert.equal(login.status,200);assert.ok((await login.text()).includes(locale==='zh'?'当前为未配置环境':'Authentication is not connected')||process.env.SMOKE_EXPECT_UNCONFIGURED!=='1');checks++;
}
async function post(path,body,expected,origin=new URL(base).origin){const response=await fetch(`${base}/api/admin/${path}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,expected,path);assert.ok(response.headers.get('Cache-Control')?.includes('no-store'));checks++;}
await post('projects',{},400);
await post('projects',{},403,'https://other.example');
await post('mfa',{action:'verify',factorId:'bad',code:'123'},400);
if(process.env.SMOKE_EXPECT_UNCONFIGURED==='1'){
 await post('projects',{organizationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Fixture project',market:'global',budget:'',currency:'CAD'},503);
 await post('login',{email:'fixture@example.com',password:'test-only-password',captchaToken:'fixture'},503);
 await post('mfa',{action:'enroll'},503);
}
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const locale of ['zh','en'])for(const width of [320,375,768,1440]){
  await page.setViewportSize({width,height:1000});await page.goto(`${base}/${locale}/admin-preview`,{waitUntil:'networkidle'});
  await expect(page.getByRole('heading',{level:1})).toHaveText(locale==='zh'?'工作总览':'Overview');
  await expect(page.locator('.admin-demo-banner')).toBeVisible();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`No outer overflow ${locale}/${width}`);
  assert.equal(await page.locator('form').count(),0,'Public demo has no business mutation forms');
  const link=page.getByRole('navigation').getByRole('link',{name:locale==='zh'?'广告账户':'Ad accounts'});await link.click();await expect(page).toHaveURL(/#accounts$/);checks++;
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(`${base}/zh/admin-preview`,{waitUntil:'networkidle'});await page.screenshot({path:'/tmp/kbjm-admin-desktop.png',fullPage:true});
 await page.setViewportSize({width:375,height:1000});await page.goto(`${base}/zh/admin-preview`,{waitUntil:'networkidle'});await page.screenshot({path:'/tmp/kbjm-admin-mobile.png',fullPage:true});
 assert.deepEqual(errors,[],'No uncaught workspace browser errors');
}finally{await browser.close();}
console.log(`Passed ${checks} staff-route and read-only preview checks.`);
