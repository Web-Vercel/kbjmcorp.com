import {it,expect,vi} from 'vitest';
vi.mock('next/navigation',()=>({redirect:(path:string)=>{throw Error('REDIRECT:'+path);},notFound:()=>{throw Error('NOT_FOUND');}}));
import Account from '@/app/[locale]/account/page';
it('sends old home bookmarks to the current portal',async()=>{await expect(Account({params:Promise.resolve({locale:'zh'})})).rejects.toThrow('REDIRECT:/zh/access');});
it('preserves old wallet bookmarks for the scoped ledger page',async()=>{const wallet='b0000000-0000-4000-8000-000000000001';await expect(Account({params:Promise.resolve({locale:'en'}),searchParams:Promise.resolve({wallet})})).rejects.toThrow('REDIRECT:/en/account/transactions?wallet='+wallet);});
it('rejects malformed wallets instead of redirecting arbitrary input',async()=>{await expect(Account({params:Promise.resolve({locale:'zh'}),searchParams:Promise.resolve({wallet:'https://outside.test'})})).rejects.toThrow('NOT_FOUND');});
