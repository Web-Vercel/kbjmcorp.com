// Fresh sequential processes avoid Node 24/V8 WebAssembly JIT-region exhaustion
// during repeated disposable PGlite initialization in a single long-lived runner.
import {readdir,mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
async function find(dir){const out=[];for(const e of await readdir(join(root,dir),{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await find(p));else if(/\.test\.(ts|tsx)$/.test(e.name))out.push(p);}return out;}
const files=(await find('tests')).sort();assert.ok(files.length);
const count=Math.min(8,files.length),batches=Array.from({length:count},()=>[]);files.forEach((f,i)=>batches[i%count].push(f));
const reportDir=resolve(process.env.AUTONOMOUS_REPORT_DIR||join(tmpdir(),'kbjm-autonomous-tests'));await mkdir(reportDir,{recursive:true});
const results=[];
for(let i=0;i<count;i++){
 const output=join(reportDir,`batch-${i+1}.json`),log=join(reportDir,`batch-${i+1}.log`);
 const child=spawn(process.execPath,[join(root,'node_modules/vitest/vitest.mjs'),'run',...batches[i],'--pool=threads','--maxWorkers=1','--reporter=json',`--outputFile=${output}`],{cwd:root,env:{...process.env,REPORT_UI_ARTIFACTS:'1',PARTNER_UI_ARTIFACTS:'1',ANALYTICS_UI_ARTIFACTS:'1',HOME_ATTENTION_ARTIFACTS:'1'},stdio:['ignore','pipe','pipe']});
 let text='';child.stdout.on('data',b=>text+=b);child.stderr.on('data',b=>text+=b);
 const code=await new Promise((ok,no)=>{child.on('error',no);child.on('exit',(code,signal)=>ok({code,signal}))});await writeFile(log,text);
 if(code.code!==0){console.error(`Batch ${i+1} failed or interrupted (${JSON.stringify(code)}). See ${log}`);process.exitCode=1;break;}
 const data=JSON.parse(await readFile(output,'utf8'));assert.equal(data.numFailedTests,0);assert.equal(data.numPendingTests,0,'Artifact checks must run, not skip');results.push(data);
 console.log(`Batch ${i+1}/${count}: ${data.testResults.length} files, ${data.numPassedTests} tests passed.`);
}
if(results.length===count){
 const seen=results.flatMap(r=>r.testResults.map(t=>resolve(t.name)));assert.equal(seen.length,files.length);assert.equal(new Set(seen).size,files.length);assert.ok(files.every(f=>seen.includes(resolve(root,f))));
 const summary={files:files.length,tests:results.reduce((n,r)=>n+r.numTotalTests,0),passed:results.reduce((n,r)=>n+r.numPassedTests,0),failed:0,skipped:0,batches:count,localOnly:true,reportDir};
 await writeFile(join(reportDir,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
}
