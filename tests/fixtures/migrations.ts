import type {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
// Upgrade tests need a fixed starting schema, independent of the current full bootstrap.
export async function applyMigrationsThrough(db:PGlite,last:number){
 const dir=new URL('../../supabase/migrations/',import.meta.url);
 for(const name of (await readdir(dir)).filter(n=>/^\d{3}_[a-z0-9_]+\.sql$/.test(n)&&Number(n.slice(0,3))<=last).sort())await db.exec(await readFile(new URL(name,dir),'utf8'));
}
