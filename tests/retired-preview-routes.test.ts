import {expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
vi.mock('next/navigation',()=>({notFound:()=>{throw new Error('NEXT_NOT_FOUND');}}));
import admin from '../src/app/[locale]/admin-preview/layout';
import client from '../src/app/[locale]/client-preview/layout';
import operations from '../src/app/[locale]/operations-preview/layout';
import collections from '../src/app/[locale]/collections-preview/layout';
import workflow from '../src/app/[locale]/workflow-preview/layout';
import application from '../src/app/[locale]/application-preview/layout';
import crm from '../src/app/[locale]/crm-preview/layout';
import demo from '../src/app/[locale]/demo/layout';
it.each([admin,client,operations,collections,workflow,application,crm,demo])('blocks archived route trees without rendering fictional content',layout=>{
 expect(()=>layout()).toThrow('NEXT_NOT_FOUND');
});
it.each(['src/app/[locale]/admin/login/page.tsx','src/app/[locale]/admin/(workspace)/crm/page.tsx','src/app/[locale]/apply/page.tsx'])('removes legacy demo entry links from %s',path=>{
 expect(readFileSync(path,'utf8')).not.toMatch(/href=\{`\/\$\{locale\}\/(?:\w+-preview|demo)/);
});
