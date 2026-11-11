import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomBytes,scryptSync} from 'node:crypto';
const args=process.argv.slice(2),destination=args[args.indexOf('--output')+1],days=Number(args.includes('--days')?args[args.indexOf('--days')+1]:30);
if(!args.includes('--output')||!destination||destination.startsWith('--')||!Number.isInteger(days)||days<1||days>90)throw Error('Usage: node scripts/create-demo-accounts.mjs --output /private/directory [--days 30]; days must be 1–90.');
const dir=resolve(destination);await mkdir(dir,{recursive:true,mode:0o700});
const expiresAt=new Date(Date.now()+days*86400000).toISOString();const credentials=[];
const accounts=['investor','client','sales'].map(role=>{const username=role+'-demo',password=randomBytes(18).toString('base64url'),salt=randomBytes(16).toString('hex');credentials.push({username,password,role,expiresAt});return {username,role,salt,passwordHash:scryptSync(password,salt,64).toString('hex'),expiresAt};});
const config={DEMO_LOGIN_ENABLED:'true',DEMO_SESSION_SECRET:randomBytes(32).toString('hex'),DEMO_ACCOUNTS_JSON:JSON.stringify(accounts)};
// Exclusive creation prevents accidentally replacing a previously issued credential file.
await writeFile(resolve(dir,'server-config.json'),JSON.stringify(config,null,2)+'\n',{mode:0o600,flag:'wx'});
await writeFile(resolve(dir,'demo-credentials.json'),JSON.stringify(credentials,null,2)+'\n',{mode:0o600,flag:'wx'});
console.log('Created server-config.json and demo-credentials.json in '+dir+'. These files contain secrets. Configure the server privately; share each visitor only their own credentials. No hosted account or permission was created.');
