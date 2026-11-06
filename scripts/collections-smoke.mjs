import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3025';let checks=0;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{const page=await browser.newPage();const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url());});
for(const locale of ['zh','en']){const zh=locale==='zh';await page.goto(`${base}/${locale}/admin-preview`,{waitUntil:'networkidle'});await page.getByRole('link',{name:zh?/对公收款与入账/:/Bank collections & posting/}).click();await expect(page).toHaveURL(new RegExp(`/${locale}/collections-preview$`));checks++;
const click=async(a,b)=>page.getByRole('button',{name:zh?a:b,exact:true}).click();const balance=page.getByTestId('collection-balance');await expect(balance).toHaveText('CNY 0.00');await click('模拟登记付款通知','Simulate payment notice');await expect(balance).toHaveText('CNY 0.00');await click('财务制单','Finance preparer');await click('模拟核实到账并制单','Simulate verified receipt preparation');await expect(balance).toHaveText('CNY 0.00');await click('尝试制单人自审','Attempt self-review');await expect(page.getByRole('status')).toContainText(zh?'不能自审':'Self-review denied');checks+=4;
await click('财务复核','Finance reviewer');await click('模拟独立复核并入账','Simulate independent approval and credit');await expect(balance).toHaveText('CNY 10,000.00');await click('模拟重复审批（不重复入账）','Retry approval (no duplicate credit)');await expect(balance).toHaveText('CNY 10,000.00');await click('企业客户','Client');await expect(balance).toHaveText('CNY 10,000.00');checks+=3;
await click('运行虚构匹配示例','Run fictional matching example');await expect(page.getByText(zh?'找到一个建议匹配，仍须核实及独立复核。':'One suggested match found; verification and independent review remain required.')).toBeVisible();checks++;
for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${locale}/${width}`);checks++;}
if(zh){await page.screenshot({path:'/tmp/kbjm-collections-desktop.png',fullPage:true});await page.setViewportSize({width:375,height:1000});await page.locator('h1').click();await page.screenshot({path:'/tmp/kbjm-collections-mobile.png',fullPage:true});}
await page.reload({waitUntil:'networkidle'});await expect(balance).toHaveText('CNY 0.00');checks++;
const res=await fetch(`${base}/${locale}/operations/collections`,{redirect:'manual'});assert.equal(res.status,307);assert.equal(res.headers.get('location'),`/${locale}/admin/login`);checks++;
}
assert.deepEqual(errors,[]);assert.deepEqual(writes,[],'Public collections simulation must send no business writes');
}finally{await browser.close();}
console.log(`Passed ${checks} bank collection flow, duplicate approval, privacy and responsive checks.`);
