import assert from 'node:assert/strict';
const base=process.env.SMOKE_BASE_URL||'http://127.0.0.1:3031';
// Run only on a local build with the test-entry flag disabled. No real Auth attempts are made.
for(const locale of ['zh','en']){
 const response=await fetch(`${base}/${locale}/test-login`,{redirect:'manual'});assert.equal(response.status,404,'Test page stays closed without activation');
}
const response=await fetch(`${base}/api/auth/test-email`,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'fictional@example.invalid',password:'NOT-A-REAL-PASSWORD',captchaToken:'NOT-A-REAL-TOKEN'})});assert.equal(response.status,404);assert.match(response.headers.get('cache-control')||'',/no-store/);
const cross=await fetch(`${base}/api/auth/test-email`,{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'});assert.equal(cross.status,403);
console.log('Passed 4 closed-entry, no-store and same-origin HTTP checks; no email/SMS or Auth login was requested.');
