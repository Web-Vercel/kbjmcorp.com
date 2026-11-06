import assert from 'node:assert/strict';
import { chromium,expect } from '@playwright/test';
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3018';
let checks=0;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage();const errors=[];const businessRequests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET'&&r.method()!=='HEAD')businessRequests.push(r.url());});
 for(const locale of ['zh','en']){
  const zh=locale==='zh';await page.goto(`${base}/${locale}/client-preview`,{waitUntil:'networkidle'});
  await page.getByRole('link',{name:zh?'体验需求提交与创意确认':'Try briefs and creative approval'}).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/workflow-preview$`));checks++;
  const submit=page.getByRole('button',{name:zh?'提交并保留版本':'Submit version'});
  await page.getByLabel(zh?'标题':'Title',{exact:true}).fill('Demo brief');
  await page.getByLabel(zh?'产品、品牌、目标受众与推广目标':'Product, brand, audience and objectives').fill('Fictional brand expanding to North America.');await submit.click();
  await expect(page.getByRole('heading',{name:'Demo brief',exact:true})).toBeVisible();checks++;
  await page.getByRole('button',{name:zh?'团队视角':'Team view',exact:true}).click();
  await page.getByLabel(zh?'反馈意见':'Feedback').fill('Requirements confirmed.');
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:zh?'提交审核意见':'Submit decision'}).click();
  await expect(page.getByText('Requirements confirmed.',{exact:true})).toBeVisible();checks++;
  await page.getByLabel(zh?'标题':'Title',{exact:true}).fill('Demo creative V1');
  await page.getByLabel(zh?'创意内容、表达方向与交付说明':'Creative content, direction and delivery notes').fill('Fictional creative proposal, first version.');await submit.click();
  await page.getByRole('button',{name:zh?'客户协作视角':'Client collaborator',exact:true}).click();
  await page.getByRole('combobox',{name:zh?/^审核结果/:/^Decision/}).selectOption('changes_requested');
  await page.getByLabel(zh?'反馈意见':'Feedback').fill('Please refine the headline.');await page.getByRole('checkbox').check();await page.getByRole('button',{name:zh?'提交审核意见':'Submit decision'}).click();
  await expect(page.getByText('Please refine the headline.',{exact:true})).toBeVisible();checks++;
  await page.getByRole('button',{name:zh?'团队视角':'Team view',exact:true}).click();
  await page.getByLabel(zh?'标题':'Title',{exact:true}).fill('Demo creative V2');
  await page.getByLabel(zh?'创意内容、表达方向与交付说明':'Creative content, direction and delivery notes').fill('Fictional creative proposal with a refined headline.');await submit.click();
  await page.getByRole('button',{name:zh?'客户协作视角':'Client collaborator',exact:true}).click();
  await page.getByLabel(zh?'反馈意见':'Feedback').fill('This second version is approved.');await page.getByRole('checkbox').check();await page.getByRole('button',{name:zh?'提交审核意见':'Submit decision'}).click();
  await expect(page.getByText('This second version is approved.',{exact:true})).toBeVisible();assert.equal(await page.getByRole('button',{name:zh?'提交审核意见':'Submit decision'}).count(),0);checks++;
  const history=page.locator('details.workflow-history');await history.locator('summary').click();await expect(page.getByRole('heading',{name:'Demo creative V1',exact:true})).toBeVisible();checks++;
  await page.getByRole('button',{name:zh?'团队视角':'Team view',exact:true}).click();
  await page.getByLabel(zh?'进展说明':'Progress update',{exact:true}).fill('Fictional progress update for the client.');await page.getByRole('button',{name:zh?'发布进展':'Publish update',exact:true}).click();await expect(page.getByText('Fictional progress update for the client.',{exact:true})).toBeVisible();checks++;
  await page.getByRole('button',{name:zh?'客户只读视角':'Read-only client',exact:true}).click();assert.equal(await page.locator('form').count(),0);checks++;
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`No overflow at ${locale}/${width}`);checks++;}
  if(zh){await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/kbjm-workflow-desktop.png',fullPage:true});await page.setViewportSize({width:375,height:1000});await page.screenshot({path:'/tmp/kbjm-workflow-mobile.png',fullPage:true});}
  await page.reload({waitUntil:'networkidle'});await expect(page.getByRole('heading',{name:'Demo brief',exact:true})).toHaveCount(0);checks++;
 }
 assert.deepEqual(errors,[]);assert.deepEqual(businessRequests,[],'The public interactive demo sends no business mutations');
}finally{await browser.close();}
console.log(`Passed ${checks} bilingual interactive workflow checks.`);
