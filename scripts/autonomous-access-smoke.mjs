// Anonymous boundary and login presentation checks against a local built app only.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3036';
const url=new URL(base);assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'This test is local-only.');
const admin=['admin','admin/inquiries','admin/crm','admin/applications','admin/projects','admin/accounts','admin/role-accounts','admin/clients'];
const ops=['','service-requests','ads-reporting','manual-accounts','source-data','manual-sources','source-checks','month-close','pricing','settlements','collections','fund-summary','funds','manual-finance','refunds','upstream','upstream-payments','statement-questions','staff','agents','agents/clients','agents/commissions','agents/settlements','agents/files','agents/settings'].map(p=>'operations'+(p?'/'+p:''));
const external=['account','account/refunds','account/statements','account/funds','agent','agent/clients','agent/commissions','agent/settlements','agent/files'];
const retired=['demo','admin-preview','client-preview','operations-preview','collections-preview','workflow-preview','application-preview','crm-preview'];
let checks=0;
for(const locale of ['zh','en']){
 for(const [paths,login]of [[admin.concat(ops),'admin/login'],[external,'access/login']])for(const path of paths){const r=await fetch(`${base}/${locale}/${path}`,{redirect:'manual'});assert.equal(r.status,307,`${locale}/${path} anonymous redirect`);const target=new URL(r.headers.get('location'),base);if(path==='account'&&target.pathname===`/${locale}/access`){const home=await fetch(target,{redirect:'manual'});assert.equal(home.status,307,'Retired account home must resolve through guarded access');assert.equal(new URL(home.headers.get('location'),base).pathname,`/${locale}/access/login`);}else if(login==='access/login'&&target.pathname===`/${locale}/login`){const alias=await fetch(target,{redirect:'manual'});if(target.searchParams.has('returnTo')){assert.equal(alias.status,200,'Legacy verified document return shows sign-in only');const body=await alias.text();assert.ok(body.includes('login-page'));assert.ok(!body.includes('client-workspace'));}else{assert.equal(alias.status,307);assert.equal(new URL(alias.headers.get('location'),base).pathname,`/${locale}/access/login`);}}else assert.equal(target.pathname,`/${locale}/${login}`,`${path} login boundary`);checks++;}
 const analytics=await fetch(`${base}/${locale}/access/analytics`,{redirect:'manual'});if(analytics.status===307)assert.equal(new URL(analytics.headers.get('location'),base).pathname,`/${locale}/access/login`);else{assert.equal(analytics.status,200);const body=await analytics.text();assert.ok(body.includes('role="alert"'),'Unavailable analytics must be explicit');assert.ok(!body.includes('CNY 0.00'),'Unavailable analytics must not fabricate money');}checks++;
 for(const path of retired){const r=await fetch(`${base}/${locale}/${path}`,{redirect:'manual'});if(path==='demo'){assert.equal(r.status,307);assert.equal(new URL(r.headers.get('location'),base).pathname,`/${locale}/access/login`);}else assert.equal(r.status,404,`${locale}/${path} retired`);checks++;}
}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{for(const locale of ['zh','en'])for(const portal of ['admin','access'])for(const width of [375,1440]){
 const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage(),errors=[],writes=[];
 await page.route('**/*',route=>new URL(route.request().url()).origin===url.origin?route.continue():route.abort());
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))writes.push(r.method())});
 await page.goto(`${base}/${locale}/${portal}/login`,{waitUntil:'networkidle'});
 assert.equal(await page.locator('h1').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${portal}/${locale}/${width} overflow`);
 assert.equal(await page.locator('a[href*="-preview"],a[href*="/demo"]').count(),0,'No retired demo link');
 assert.deepEqual(errors,[],'No page script error');assert.deepEqual(writes,[],'Opening login must not submit actions');
 await context.close();checks++;
}}finally{await browser.close()}
console.log(JSON.stringify({checks,anonymousRoleSessions:true,hostedAccounts:false,financialWrites:0}));
